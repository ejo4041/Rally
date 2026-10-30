import { sceneFor } from "../../../packages/rally-presence/scene.ts";
import { recentTurns } from "./assessment-context.ts";
import {
  actuate,
  hold,
  initialPresence,
  type Axis,
} from "../../../packages/rally-presence/state.ts";
import type { SpeechOutput } from "./speech.ts";
import { retainLegacyNotes } from "./report-notes.ts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { HttpError } from "./auth.ts";
import { Meetings, validatePlan } from "./meetings.ts";
import {
  assessmentSchema,
  reportSchema,
  planSchema,
  categories,
} from "./contracts.ts";
import type {
  ASRSession,
  Meeting,
  Media,
  MediaSession,
  TranscriptEvent,
  Snapshot,
  Turn,
  Report,
} from "./contracts.ts";
import type { Configuration } from "./config.ts";

type Active = {
  asr?: ASRSession;
  media?: MediaSession;
  timer?: NodeJS.Timeout;
  busy: boolean;
  ending: boolean;
  rotating: boolean;
  signature: string;
  lastIntervention: number;
  rotationAt: number;
  offset: number;
  captureToken: string;
  leaseUntil: number;
  lastStart: number;
  tokens: number;
  refilledAt: number;
};
export class Engine {
  meetings: Meetings;
  media: Media;
  config: Configuration;
  active = new Map<string, Active>();
  reports = new Map<string, Promise<void>>();
  starting = new Set<string>();
  closed = false;
  private handoffs = new Set<Promise<boolean>>();
  speech?: SpeechOutput;
  constructor(
    meetings: Meetings,
    media: Media,
    config: Configuration,
    speech?: SpeechOutput,
  ) {
    this.speech = speech;
    this.meetings = meetings;
    this.media = media;
    this.config = config;
    // In-process work cannot survive a process restart. Never silently repeat a paid request.
    for (const row of meetings.store.db
      .prepare("SELECT body FROM meetings")
      .all() as { body: string }[]) {
      const m: Meeting = JSON.parse(row.body);
      let changed = false;
      if (m.phase === "live") {
        m.phase = "interrupted";
        if (m.presence) m.presence = hold(m.presence, Date.now());
        changed = true;
      }
      if (m.reportStatus === "processing") {
        m.reportStatus = "failed";
        changed = true;
      }
      if (changed) {
        m.error =
          "Server restarted; saved data is available. Retry explicitly after checking usage.";
        meetings.save(m);
      }
    }
  }
  private cancelSpeech(m: Meeting) {
    this.speech?.cancel(m.id);
    const saved = this.meetings.get(m.id);
    return {
      ...m,
      playback: saved.playback,
      lastSpokenEnd: this.speech?.lastEnd(m.id) ?? saved.lastSpokenEnd,
      sceneRevision: saved.sceneRevision,
    };
  }
  snapshot(id: string): Snapshot {
    const meeting = this.meetings.get(id);
    return {
      meeting,
      turns: this.meetings.turns(id),
      elapsedSeconds:
        meeting.startedAt === null
          ? 0
          : Math.max(
              0,
              ((meeting.endedAt ?? Date.now()) - meeting.startedAt) / 1000,
            ),
    };
  }
  emit(id: string, type: string, data: unknown) {
    const session = this.active.get(id)?.media;
    if (session)
      void session
        .send({ version: 1, id: randomUUID(), meetingId: id, type, data })
        .catch(() => {});
    if (session && type !== "transcript.partial") {
      const scene = sceneFor(this.meetings.get(id));
      void session
        .send({
          version: 1,
          id: randomUUID(),
          meetingId: id,
          type: "presence.scene",
          data: scene,
        })
        .catch(() => {});
    }
  }
  gap(id: string, reason: string, mode: "capture" | "continuity" = "capture") {
    this.speech?.cancel(id);
    try {
      const m = this.meetings.get(id);
      const previous = m.gaps.at(-1);
      if (
        mode === "continuity" ||
        m.error !== reason ||
        previous?.reason !== reason ||
        Date.now() - previous.at >= 1000
      ) {
        m.gaps.push({ at: Date.now(), reason });
        m.gaps = m.gaps.slice(-100);
        if (mode === "capture") m.error = reason;
        this.meetings.save(m);
        this.emit(
          id,
          mode === "capture" ? "capture.gap" : "transcription.gap",
          { reason },
        );
      }
    } catch {
      /* deleted */
    }
  }
  ingest(id: string, e: TranscriptEvent) {
    const state = this.active.get(id);
    if (!state) return;
    if (e.type === "partial") {
      this.emit(id, "transcript.partial", {
        text: e.text,
        sessionId: e.sessionId,
        turnId: e.turnId,
      });
      return;
    }
    if (e.type !== "final") return;
    const m = this.meetings.get(id);
    if (m.phase !== "live") return;
    const key = `${e.sessionId}:${e.turnId}`;
    const old = this.meetings.turns(id).find((t) => t.id === key);
    const turn: Turn = {
      id: key,
      sessionId: e.sessionId,
      turnId: e.turnId,
      sourceOrder:
        typeof e.sourceOrder === "number" &&
        Number.isSafeInteger(e.sourceOrder) &&
        e.sourceOrder >= 0
          ? e.sourceOrder
          : undefined,
      revision: (old?.revision || 0) + 1,
      text: e.text,
      speaker: e.speaker ? `${e.sessionId}:${e.speaker}` : null,
      startMs: e.startMs == null ? null : state.offset + e.startMs,
      endMs: e.endMs == null ? null : state.offset + e.endMs,
    };
    if (
      old &&
      old.text === turn.text &&
      old.speaker === turn.speaker &&
      old.sourceOrder === turn.sourceOrder &&
      old.startMs === turn.startMs &&
      old.endMs === turn.endMs
    )
      return;
    if (old) {
      if (m.presence) m.presence = hold(m.presence, Date.now());
      m.concerns = m.concerns?.filter((c) => !(key in c.revisions));
      m.assessment = null;
      this.meetings.save(m);
      this.speech?.cancel(id);
      this.emit(id, "speech.cancel", {
        reason: "Transcript evidence was revised",
      });
    }
    this.meetings.store.db
      .prepare(
        "INSERT INTO turns VALUES(?,?,?) ON CONFLICT(meeting_id,id) DO UPDATE SET body=excluded.body",
      )
      .run(id, key, JSON.stringify(turn));
    this.emit(id, "transcript.final", turn);
  }
  async openASR(m: Meeting, state: Active) {
    let opened: ASRSession | undefined;
    const owns = () =>
      this.active.get(m.id) === state && (!opened || state.asr === opened);
    opened = await this.meetings.providers.openASR(m, {
      onEvent: (event) => {
        if (!owns()) return;
        if (
          event.type === "final" &&
          state.asr &&
          event.sessionId !== state.asr.sessionId
        )
          return;
        this.ingest(m.id, event);
      },
      onError: (error) => {
        if (owns() && this.meetings.get(m.id).phase === "live")
          this.gap(
            m.id,
            error.message,
            state.rotating ? "continuity" : "capture",
          );
      },
      onClose: () => {
        if (owns() && !state.ending && !state.rotating)
          this.gap(
            m.id,
            "Transcription connection closed; reconnect audio explicitly.",
          );
      },
    });
    return opened;
  }

  async start(
    m: Meeting,
    consented: boolean,
    mode: "browser" | "teams" = "browser",
  ) {
    if (!consented) throw new HttpError("Recording consent required");
    if (!["ready", "interrupted"].includes(m.phase) || !m.plan)
      throw new HttpError("Prepare and review the meeting plan first", 409);
    if (this.reports.has(m.id))
      throw new HttpError(
        "Wait for the report to finish before restarting",
        409,
      );
    if (this.starting.has(m.id) || this.active.has(m.id))
      throw new HttpError("Meeting already running", 409);
    const capturing = [...this.active.keys()].filter(
      (id) => this.meetings.get(id).phase === "live",
    );
    if (capturing.length >= this.config.capacity)
      throw new HttpError("Server meeting capacity reached", 409);
    for (const id of capturing)
      if (this.meetings.get(id).userId === m.userId)
        throw new HttpError("This host already has an active meeting", 409);
    this.starting.add(m.id);
    const state: Active = {
      busy: false,
      ending: false,
      rotating: false,
      signature: "",
      lastIntervention: 0,
      rotationAt: Date.now() + this.config.asrRotationMs,
      offset: m.startedAt ? Date.now() - m.startedAt : 0,
      captureToken: randomUUID(),
      leaseUntil: Date.now() + this.config.captureLeaseMs,
      lastStart: 0,
      tokens: 3,
      refilledAt: Date.now(),
    };
    this.active.set(m.id, state);
    const previous = m.phase;
    const previousStartedAt = m.startedAt;
    m.phase = "live";
    m.captureMode = mode;
    m.captureEpoch = m.epoch + 1;
    m.startedAt ??= Date.now();
    m = this.cancelSpeech(m);
    m.epoch++;
    if (m.presence) m.presence = hold(m.presence, Date.now());
    m.error = null;
    this.meetings.save(m);
    try {
      state.media = await this.media.open(
        m,
        (bytes) => {
          try {
            if (!state.ending && !state.rotating)
              state.asr?.send(
                this.speech?.shielded(m.id)
                  ? new Uint8Array(bytes.byteLength)
                  : bytes,
              );
          } catch (e) {
            this.gap(
              m.id,
              e instanceof Error ? e.message : "Audio interrupted",
            );
          }
        },
        (reason) => this.gap(m.id, reason),
      );
      state.asr = await this.openASR(m, state);
      const connection = await state.media.connection(
        mode === "teams" ? "capture" : "host",
      );
      state.leaseUntil = Date.now() + this.config.captureLeaseMs;
      const current = this.meetings.get(m.id);
      if (current.report) {
        current.reportStale = true;
        this.meetings.save(current);
      }
      state.timer = setInterval(
        () => void this.tick(m.id).catch(() => {}),
        Math.min(500, this.config.assessmentMs),
      );
      state.timer.unref();
      return {
        meeting: this.meetings.get(m.id),
        connection: { ...connection, captureToken: state.captureToken },
      };
    } catch (error) {
      state.ending = true;
      clearInterval(state.timer);
      state.asr?.close();
      await state.media?.close();
      this.active.delete(m.id);
      const current = this.meetings.get(m.id);
      current.phase = previous;
      current.startedAt = previousStartedAt;
      current.error = "Could not start audio; retry explicitly.";
      this.meetings.save(current);
      throw error;
    } finally {
      this.starting.delete(m.id);
    }
  }
  async observerConnection(m: Meeting) {
    const state = this.active.get(m.id);
    if (m.captureMode !== "teams" || !state?.media || state.ending)
      throw new HttpError("Teams capture is not live", 409);
    return state.media.connection("host");
  }
  async rendererConnection(m: Meeting) {
    const state = this.active.get(m.id);
    if (!state?.media || state.ending)
      throw new HttpError("Meeting is not live", 409);
    return state.media.connection("renderer");
  }
  async connection(m: Meeting) {
    if (m.captureMode === "teams")
      throw new HttpError("The Teams runner owns capture", 409);
    const state = this.active.get(m.id);
    if (!state?.media || state.ending || Date.now() >= state.leaseUntil)
      throw new HttpError("Audio is off; reconnect explicitly.", 409);
    return {
      ...(await state.media.connection()),
      captureToken: state.captureToken,
    };
  }
  heartbeat(m: Meeting, captureToken: unknown) {
    const state = this.active.get(m.id);
    if (
      !state ||
      this.closed ||
      state.ending ||
      m.phase !== "live" ||
      typeof captureToken !== "string" ||
      captureToken !== state.captureToken ||
      Date.now() >= state.leaseUntil
    )
      throw new HttpError("Audio is off; reconnect explicitly.", 409);
    state.leaseUntil = Date.now() + this.config.captureLeaseMs;
    return { expiresAt: state.leaseUntil };
  }
  private async rotateASR(m: Meeting, state: Active) {
    const current = () =>
      !this.closed &&
      this.active.get(m.id) === state &&
      !state.ending &&
      this.meetings.get(m.id).phase === "live";
    state.rotating = true;
    this.speech?.cancel(m.id);
    this.emit(m.id, "speech.cancel", { reason: "Transcription handoff" });
    try {
      await state.asr?.end();
      if (!current()) return false;
      state.offset = Date.now() - (m.startedAt ?? Date.now());
      const next = await this.openASR(this.meetings.get(m.id), state);
      if (!current()) {
        try {
          await next.end();
        } finally {
          next.close();
        }
        return false;
      }
      state.asr = next;
      state.rotationAt = Date.now() + this.config.asrRotationMs;
      this.gap(
        m.id,
        "Muse transcription restarted. Audio capture continues; speaker labels restart. Check the transcript around this handoff.",
        "continuity",
      );
      return true;
    } catch {
      if (!current()) return false;
      this.gap(
        m.id,
        "Transcription restart failed. Audio is stopping; check usage and reconnect explicitly.",
      );
      await this.interrupt(this.meetings.get(m.id));
      throw new HttpError(
        "Transcription restart failed. Audio is off; check usage and reconnect explicitly.",
        502,
      );
    } finally {
      state.rotating = false;
    }
  }
  async tick(id: string, force = false) {
    const state = this.active.get(id);
    if (this.closed || !state || state.ending) return;
    if (Date.now() >= state.leaseUntil) {
      this.gap(
        id,
        "Browser connection expired. Audio is stopping; reconnect explicitly.",
      );
      await this.interrupt(this.meetings.get(id));
      return;
    }
    if (state.rotating) return;
    // Lifecycle work must run even while a model request is in flight.
    if (Date.now() >= state.rotationAt) {
      const handoff = this.rotateASR(this.meetings.get(id), state);
      this.handoffs.add(handoff);
      try {
        if (!(await handoff)) return;
      } finally {
        this.handoffs.delete(handoff);
      }
    }
    if (state.busy) return;
    let snapshot = this.snapshot(id),
      m = snapshot.meeting;
    if (m.phase !== "live") return;
    const shouldRotate = Date.now() >= state.rotationAt;
    if (m.paused && !shouldRotate) return;
    // Milestone changes permit reassessment without calling on every silent tick.
    const signature = `${m.epoch}:${snapshot.turns.map((t) => `${t.id}@${t.revision}`).join(",")}:${Math.floor(snapshot.elapsedSeconds / 60)}`;
    if (!force && !shouldRotate && signature === state.signature) return;
    const now = Date.now();
    state.tokens = Math.min(3, state.tokens + (now - state.refilledAt) / 5000);
    state.refilledAt = now;
    const cadence =
      (m.assessment?.urgency ?? 0) >= 0.6 ? 2000 : this.config.assessmentMs;
    if (
      !force &&
      (now - state.lastStart < Math.max(2000, cadence) || state.tokens < 1)
    )
      return;
    if (!force && state.tokens < 1) return;
    if (!force) state.tokens--;
    state.lastStart = now;
    state.busy = true;
    state.signature = signature;
    try {
      if (shouldRotate) {
        const handoff = this.rotateASR(m, state);
        this.handoffs.add(handoff);
        try {
          if (!(await handoff)) return;
        } finally {
          this.handoffs.delete(handoff);
        }
        snapshot = this.snapshot(id);
        m = snapshot.meeting;
      }
      if (m.paused || m.phase !== "live" || !snapshot.turns.length) return;
      const epoch = m.epoch;
      const supplied = recentTurns(snapshot.turns);
      if (!supplied.length)
        throw new HttpError(
          "Latest transcript segment exceeds assessment context capacity; no model call was made.",
        );
      const result = assessmentSchema.parse(
        await this.meetings.providers.assess({
          ...snapshot,
          turns: supplied,
        }),
      );
      validateEvidence(result, supplied);
      const currentTurns = new Map(
        this.meetings.turns(id).map((t) => [t.id, t.revision]),
      );
      if (
        supplied.some((t) => currentTurns.get(t.id) !== t.revision) ||
        (m.concerns ?? []).some((c) =>
          Object.entries(c.revisions).some(
            ([id, revision]) => currentTurns.get(id) !== revision,
          ),
        )
      )
        return;
      const current = this.meetings.get(id);
      if (
        current.epoch !== epoch ||
        current.paused ||
        current.phase !== "live" ||
        state.ending || state.rotating
      )
        return;
      if (result.plan) {
        validatePlan(result.plan);
        if (!result.planReason.trim())
          throw new HttpError("Plan revision needs a reason");
      }
      if (
        result.focus &&
        !(result.plan ?? current.plan)?.topics.some(
          (t) => t.id === result.focus!.intendedTopicId,
        )
      )
        throw new HttpError("Focus must reference an existing topic");
      if (result.focus?.detour && !result.focus.evidence.length)
        throw new HttpError("Detours require evidence");
      const urgent =
        (result.urgency ?? 0) >= 0.8 && !!result.intervention?.evidence.length;
      if (
        result.intervention &&
        result.intervention.text.trim().split(/\s+/u).length >
          (urgent ? 20 : 40)
      )
        throw new HttpError("Intervention exceeds spoken word limit");
      if (result.concerns) {
        const memory = new Map((current.concerns ?? []).map((c) => [c.id, c]));
        for (const c of result.concerns)
          memory.set(c.id, {
            ...c,
            updatedAt: Date.now(),
            revisions: Object.fromEntries(
              c.evidence.map((id) => [id, currentTurns.get(id)!]),
            ),
          });
        const newest = [...memory.values()].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        );
        current.concerns = [
          ...newest.filter((c) => !c.resolved).slice(0, 8),
          ...newest.filter((c) => c.resolved).slice(0, 8),
        ];
      }
      if (result.affect && result.affect.evidence.length) {
        const key = result.affect.evidence
          .map((id) => `${id}@${currentTurns.get(id)}`)
          .sort()
          .join("|");
        current.presence = actuate(
          current.presence ?? initialPresence(Date.now()),
          result.affect.forces as Record<Axis, number | null>,
          key,
          Date.now(),
        );
      }
      current.assessment = result;
      current.progress = result.progress;
      current.error = null;
      if (result.plan) {
        validatePlan(result.plan);
        if (!result.planReason.trim())
          throw new HttpError("Plan revision needs a reason");
        current.plan = result.plan;
        current.revisions.push({
          at: Date.now(),
          reason: result.planReason,
          plan: result.plan,
        });
      }
      let approved:
        | { id: string; at: number; text: string; kind: string; epoch: number }
        | undefined;
      const playback = this.speech?.activity(id);
      const playbackBusy =
        playback &&
        ["armed", "playing"].includes(playback.state) &&
        playback.until > Date.now();
      const lastEnd = Math.max(
        current.lastSpokenEnd ?? 0,
        this.speech?.lastEnd(id) ?? 0,
        state.lastIntervention,
      );
      if (
        result.intervention &&
        !playbackBusy &&
        (force ||
          Date.now() - lastEnd >= (urgent ? 15000 : this.config.cooldownMs))
      ) {
        const item = {
          id: randomUUID(),
          at: Date.now(),
          text: result.intervention.text,
          kind: result.intervention.kind,
        };
        current.interventions.push(item);
        state.lastIntervention = item.at;
        approved = { ...item, epoch: current.epoch };
      }
      current.sceneRevision = (current.sceneRevision ?? 0) + 1;
      this.meetings.save(current);
      // Publish only after the entire validated result has committed.
      if (result.plan)
        this.emit(id, "plan.updated", {
          plan: result.plan,
          reason: result.planReason,
        });
      if (approved) {
        this.speech?.offer(id, approved);
        this.emit(id, "intervention", approved);
      }
      this.emit(id, "assessment", result);
    } catch (error) {
      let current: Meeting;
      try {
        current = this.meetings.get(id);
      } catch {
        return;
      }
      current.error =
        error instanceof HttpError
          ? error.message
          : "Assessment failed; transcript remains available.";
      this.meetings.save(current);
      this.emit(id, "processing.error", { error: current.error });
    } finally {
      state.busy = false;
    }
  }
  async command(m: Meeting, input: unknown) {
    const command = z
      .object({
        type: z.enum(["pause", "resume", "dismiss", "request_guidance"]),
        id: z.string().optional(),
      })
      .parse(input);
    if (m.phase !== "live") throw new HttpError("Meeting is not live", 409);
    if (command.type === "request_guidance") {
      await this.tick(m.id, true);
      return this.meetings.get(m.id);
    }
    m = this.cancelSpeech(m);
    m.epoch++;
    if (m.presence) m.presence = hold(m.presence, Date.now());
    if (command.type === "pause") m.paused = true;
    if (command.type === "resume") m.paused = false;
    this.meetings.save(m);
    this.emit(m.id, "moderator.control", {
      type: command.type,
      epoch: m.epoch,
    });
    return m;
  }
  editPlan(m: Meeting, input: unknown) {
    if (m.phase === "ended") throw new HttpError("Meeting has ended", 409);
    const plan = planSchema.parse(input);
    validatePlan(plan);
    m = this.cancelSpeech(m);
    m.epoch++;
    if (m.presence) m.presence = hold(m.presence, Date.now());
    m.plan = plan;
    m.originalPlan ??= structuredClone(plan);
    if (m.phase === "draft") m.phase = "ready";
    m.revisions.push({ at: Date.now(), reason: "Host edit", plan });
    this.meetings.save(m);
    this.emit(m.id, "plan.updated", { plan, reason: "Host edit" });
    return m;
  }
  speaker(m: Meeting, input: unknown) {
    const { speakerId, name } = z
      .object({
        speakerId: z.string(),
        name: z.string().trim().min(1).max(100).nullable(),
      })
      .parse(input);
    if (!this.meetings.turns(m.id).some((t) => t.speaker === speakerId))
      throw new HttpError("Unknown speaker label");
    if ((m.speakerNames[speakerId] ?? null) === name) return m;
    if (m.reportStatus === "processing")
      throw new HttpError(
        "Wait for analysis to finish before changing speaker labels.",
        409,
      );
    if (name === null) delete m.speakerNames[speakerId];
    else m.speakerNames[speakerId] = name;
    if (m.report) m.reportStale = true;
    m = this.cancelSpeech(m);
    m.epoch++;
    if (m.presence) m.presence = hold(m.presence, Date.now());
    this.meetings.save(m);
    this.emit(m.id, "speaker.updated", { speakerId, name });
    return m;
  }
  async end(m: Meeting) {
    if (this.starting.has(m.id))
      throw new HttpError("Audio is starting; retry in a moment", 409);
    if (m.phase === "ended") return m;
    const state = this.active.get(m.id);
    if (state?.ending) throw new HttpError("Meeting is ending", 409);
    m = this.cancelSpeech(m);
    m.epoch++;
    if (m.presence) m.presence = hold(m.presence, Date.now());
    this.meetings.save(m);
    if (state) {
      state.ending = true;
      clearInterval(state.timer);
      await state.asr?.end();
    }
    m = this.meetings.get(m.id);
    m.phase = "ended";
    m.endedAt = Date.now();
    this.meetings.save(m);
    this.emit(m.id, "meeting.ended", { endedAt: m.endedAt });
    this.launchReport(m);
    return this.meetings.get(m.id);
  }
  launchReport(m: Meeting) {
    if (this.reports.has(m.id))
      throw new HttpError("Report already processing", 409);
    if (!["ended", "interrupted"].includes(m.phase))
      throw new HttpError("End the meeting first", 409);
    retainLegacyNotes(m);
    m.reportStatus = "processing";
    m.error = null;
    this.meetings.save(m);
    const epoch = m.epoch;
    const task = Promise.resolve().then(async () => {
      try {
        const snapshot = this.snapshot(m.id);
        if (!snapshot.turns.length)
          throw new HttpError("No finalized speech to review");
        const raw = reportSchema.parse(
          await this.meetings.providers.report({
            ...snapshot,
            // Reanalyze source evidence, not the previous model's conclusions.
            // Host annotations are preserved separately after generation.
            meeting: { ...snapshot.meeting, report: null, reportNotes: [] },
          }),
        );
        validateEvidence(raw, snapshot.turns);
        if (
          new Set(raw.scores.map((s) => s.category)).size !== categories.length
        )
          throw new HttpError("Report must score each category once");
        const speakers = new Set(snapshot.turns.map((t) => t.speaker));
        if (raw.speakerTips.some((t) => !speakers.has(t.speakerId)))
          throw new HttpError("Report cites an unknown speaker");
        if (
          new Set(raw.speakerTips.map((t) => t.speakerId)).size !==
          raw.speakerTips.length
        )
          throw new HttpError("Duplicate speaker tips");
        if (raw.scores.some((s) => s.score !== null && !s.evidence.length))
          throw new HttpError("Scored categories require transcript evidence");
        const turnSpeakers = new Map(
          snapshot.turns.map((t) => [t.id, t.speaker]),
        );
        if (
          raw.speakerTips.some((s) =>
            s.tips.some((t) =>
              t.evidence.some((id) => turnSpeakers.get(id) !== s.speakerId),
            ),
          )
        )
          throw new HttpError("Speaker tips must cite that speaker");
        const values = raw.scores.flatMap((s) =>
          s.score === null ? [] : [s.score],
        );
        const report: Report = {
          ...raw,
          coverage: values.length,
          overall: values.length
            ? Math.round(
                (values.reduce((a, b) => a + b, 0) / values.length) * 10,
              ) / 10
            : null,
        };
        const current = this.meetings.get(m.id);
        if (current.epoch !== epoch)
          throw new HttpError("Meeting changed during analysis; retry report");
        for (const note of current.reportNotes || [])
          report.summary += "\nHost correction: " + note.text;
        current.report = report;
        current.reportStatus = "ready";
        current.reportStale = false;
        current.error = null;
        this.meetings.save(current);
        this.emit(m.id, "report.ready", { reportStatus: "ready" });
      } catch (error) {
        try {
          const current = this.meetings.get(m.id);
          current.reportStatus = "failed";
          current.error =
            error instanceof HttpError
              ? error.message
              : "Report failed; retry explicitly after checking usage.";
          this.meetings.save(current);
          this.emit(m.id, "report.failed", { error: current.error });
        } catch {
          /* deleted */
        }
      } finally {
        const state = this.active.get(m.id);
        await state?.media?.close();
        this.speech?.forget(m.id);
        this.active.delete(m.id);
        this.reports.delete(m.id);
      }
    });
    this.reports.set(m.id, task);
  }
  async interrupt(m: Meeting) {
    if (this.starting.has(m.id))
      throw new HttpError("Audio is starting; retry in a moment", 409);
    const state = this.active.get(m.id);
    if (!state || state.ending) return;
    state.ending = true;
    clearInterval(state.timer);
    m = this.cancelSpeech(m);
    m.epoch++;
    if (m.presence) m.presence = hold(m.presence, Date.now());
    this.meetings.save(m);
    try {
      await state.asr?.end();
    } finally {
      state.asr?.close();
      try {
        await state.media?.close();
      } finally {
        this.active.delete(m.id);
        m = this.meetings.get(m.id);
        m.phase = "interrupted";
        m.error = "Capture stopped; reconnect explicitly.";
        this.meetings.save(m);
      }
    }
  }
  async disconnectUser(userId: string) {
    for (const id of this.active.keys()) {
      const m = this.meetings.get(id);
      if (m.userId === userId) await this.interrupt(m);
    }
  }
  async remove(m: Meeting) {
    if (
      this.starting.has(m.id) ||
      this.reports.has(m.id) ||
      this.meetings.preparing.has(m.id) ||
      this.active.get(m.id)?.ending
    )
      throw new HttpError("Wait for processing to finish before deleting", 409);
    const state = this.active.get(m.id);
    this.speech?.forget(m.id);
    if (state) {
      state.ending = true;
      clearInterval(state.timer);
      await state.asr?.end();
      await state.media?.close();
      this.active.delete(m.id);
    }
    this.meetings.store.db.prepare("DELETE FROM meetings WHERE id=?").run(m.id);
  }
  async close() {
    this.closed = true;
    for (const [id, s] of this.active) {
      this.speech?.forget(id);
      s.ending = true;
      clearInterval(s.timer);
      await s.asr?.end();
      await s.media?.close();
      try {
        const m = this.meetings.get(id);
        if (m.phase === "live") {
          m.phase = "interrupted";
          this.speech?.cancel(m.id);
          m.epoch++;
          if (m.presence) m.presence = hold(m.presence, Date.now());
          this.meetings.save(m);
        }
      } catch {}
    }
    await Promise.allSettled(this.reports.values());
    this.active.clear();
    await Promise.allSettled(this.handoffs);
  }
}
export function validateEvidence(value: unknown, turns: Turn[]) {
  const ids = new Set(turns.map((t) => t.id));
  const visit = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    for (const [key, item] of Object.entries(v)) {
      if (key === "evidence" && Array.isArray(item)) {
        if (item.some((id) => !ids.has(id)))
          throw new HttpError("Model cited missing transcript evidence");
      } else if (Array.isArray(item)) item.forEach(visit);
      else visit(item);
    }
  };
  visit(value);
}
