import { listSpeechDeliveries } from "./speech-delivery.ts";
import { reportContext } from "./report-context.ts";
import {
  applyAgenda,
  proposeExtension,
  confirmExtension,
} from "./live-agenda.ts";
import { LiveMonitor } from "./realtime.ts";
import { interventionSpeech } from "./seamless.ts";
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
  captureToken: string;
  leaseUntil: number;
  budgetAt?: number;
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
};
export class Engine {
  monitor: LiveMonitor;
  meetings: Meetings;
  media: Media;
  config: Configuration;
  active = new Map<string, Active>();
  reports = new Map<string, Promise<void>>();
  starting = new Set<string>();
  closed = false;
  private handoffs = new Set<Promise<boolean>>();
  onCaptureStop?: (id: string) => Promise<void>;
  speech?: SpeechOutput;
  constructor(
    meetings: Meetings,
    media: Media,
    config: Configuration,
    speech?: SpeechOutput,
  ) {
    this.monitor = new LiveMonitor(meetings.store);
    this.monitor.finalReader = (id) => meetings.turns(id);
    this.monitor.forecast = meetings.providers.forecastLive;
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
      if (
        m.speechStatus &&
        ["preparing", "playing"].includes(m.speechStatus.state)
      ) {
        m.speechStatus = {
          ...m.speechStatus,
          state: "canceled",
          at: Date.now(),
        };
        changed = true;
      }
      if (
        m.callState &&
        ["joining", "lobby", "connected"].includes(m.callState)
      ) {
        m.callState = "failed";
        changed = true;
      }

      if (m.phase === "live") {
        m.phase = "interrupted";
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
  }
  private cancelSpeech(m: Meeting) {
    this.speech?.cancel(m.id);
    m.speechStatus = this.meetings.get(m.id).speechStatus;
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
    if (
      this.config.realtimeEnabled &&
      "sessionId" in e &&
      e.sessionId &&
      state.asr &&
      e.sessionId !== state.asr.sessionId
    )
      return;
    if (e.type === "progress")
      this.monitor.progress(id, state.offset + e.processedMs);
    if (e.type === "partial") {
      this.monitor.ingest(id, e.sessionId, e.turnId, e.text);
      this.emit(id, "transcript.partial", {
        text: e.text,
        sessionId: e.sessionId,
        turnId: e.turnId,
      });
      return;
    }
    if (e.type !== "final") return;
    this.monitor.ingest(id, e.sessionId, e.turnId, e.text, true);
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
    if (
      old &&
      m.extension?.confirmation?.evidence?.id === key &&
      m.extension.confirmation.evidence.revision !== turn.revision
    ) {
      m.extension.state = "disputed";
      this.meetings.save(m);
    }
    if (old) {
      if (this.speech?.live) this.speech.live.invalidateEvidence(id);
      else this.speech?.cancel(id);
      if (!this.speech?.live?.isActive(id))
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

  async start(m: Meeting, consented: boolean) {
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
    this.monitor.clear(m.id);
    const state: Active = {
      captureToken: randomUUID(),
      budgetAt: Date.now(),
      leaseUntil: Date.now() + this.config.captureLeaseMs,
      busy: false,
      ending: false,
      rotating: false,
      signature: "",
      lastIntervention: 0,
      rotationAt: Date.now() + this.config.asrRotationMs,
      offset: m.startedAt ? Date.now() - m.startedAt : 0,
    };
    this.active.set(m.id, state);
    const previous = m.phase;
    const previousStartedAt = m.startedAt;
    m.phase = "live";
    m.speechTransport = this.speech?.live ? "livekit" : "wav";
    m.startedAt ??= Date.now();
    this.monitor.cancel(m.id);
    this.cancelSpeech(m);
    m.epoch++;
    m.error = null;
    this.meetings.save(m);
    try {
      state.media = await this.media.open(
        m,
        (bytes) => {
          try {
            if (!state.ending && !state.rotating)
              state.asr?.send(
                this.speech?.shielded(m.id) &&
                  !(
                    m.captureSource === "teams" &&
                    this.config.teamsDuplexEnabled
                  )
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
      if (state.ending || this.active.get(m.id) !== state)
        throw new HttpError("Session revoked during startup", 401);
      state.asr = await this.openASR(m, state);
      if (state.ending || this.active.get(m.id) !== state)
        throw new HttpError("Session revoked during startup", 401);
      const connection = await state.media.connection();
      const current = this.meetings.get(m.id);
      if (current.report) {
        current.reportStale = true;
        this.meetings.save(current);
      }
      state.timer = setInterval(
        () => void this.tick(m.id).catch(() => {}),
        this.config.assessmentMs,
      );
      state.timer.unref();
      return {
        meeting: this.meetings.get(m.id),
        connection: {
          ...connection,
          captureToken:
            m.captureSource === "teams" ? undefined : state.captureToken,
        },
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
  heartbeat(m: Meeting, token: unknown) {
    const state = this.active.get(m.id);
    if (
      m.captureSource === "teams" ||
      !state ||
      state.ending ||
      typeof token !== "string" ||
      token !== state.captureToken ||
      Date.now() >= state.leaseUntil
    )
      throw new HttpError("Capture lease expired or invalid", 409);
    state.leaseUntil = Date.now() + this.config.captureLeaseMs;
    return { expiresAt: state.leaseUntil };
  }
  renewCall(id: string) {
    const state = this.active.get(id);
    if (
      state &&
      !state.ending &&
      this.meetings.get(id).captureSource === "teams"
    )
      state.leaseUntil = Date.now() + this.config.captureLeaseMs;
  }
  async connection(m: Meeting) {
    const state = this.active.get(m.id);
    if (!state?.media) throw new HttpError("Start the meeting first", 409);
    const connection = await state.media.connection();
    return {
      ...connection,
      captureToken:
        m.captureSource === "teams" ? undefined : state.captureToken,
    };
  }
  private async rotateASR(m: Meeting, state: Active) {
    const current = () =>
      !this.closed &&
      this.active.get(m.id) === state &&
      !state.ending &&
      this.meetings.get(m.id).phase === "live";
    state.rotating = true;
    this.monitor.cancel(m.id);
    this.cancelSpeech(m);
    this.emit(m.id, "speech.cancel", { reason: "Transcription handoff" });
    try {
      await state.asr?.end();
      if (!current()) return false;
      this.monitor.clear(m.id);
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
      await this.interrupt(this.meetings.get(id));
      return;
    }
    const statusMeeting = this.meetings.get(id);
    if (this.config.realtimeEnabled) {
      const now = Date.now(),
        topic = statusMeeting.plan?.topics.find((t) => t.status === "active");
      if (topic && state.budgetAt) {
        statusMeeting.topicSpentSeconds ??= {};
        statusMeeting.topicSpentSeconds[topic.id] =
          (statusMeeting.topicSpentSeconds[topic.id] ?? 0) +
          (now - state.budgetAt) / 1000;
      }
      state.budgetAt = now;
    }
    statusMeeting.liveStatus = {
      at: Date.now(),
      assessmentState: statusMeeting.paused
        ? "paused"
        : state.busy
          ? "assessing"
          : "listening",
      destination:
        statusMeeting.captureSource === "teams" ? "teams" : "browser",
      callState: statusMeeting.callState ?? "idle",
    };
    this.meetings.save(statusMeeting);
    this.emit(id, "meeting.status", {
      at: Date.now(),
      epoch: statusMeeting.epoch,
      phase: statusMeeting.phase,
      paused: statusMeeting.paused,
      health: statusMeeting.assessment?.health ?? null,
      reason: statusMeeting.assessment?.reason ?? null,
      issues: statusMeeting.assessment?.issues ?? [],
      progress: statusMeeting.progress,
      assessmentAt: statusMeeting.assessmentAt ?? null,
      assessmentState: statusMeeting.paused
        ? "paused"
        : state.busy
          ? "assessing"
          : "listening",
      speech: statusMeeting.speechStatus ?? null,
      destination:
        statusMeeting.captureSource === "teams" ? "teams" : "browser",
      callState: statusMeeting.callState ?? "idle",
      currentTopic:
        statusMeeting.plan?.topics.find((t) => t.status === "active") ?? null,
    });
    if (this.config.realtimeEnabled) {
      if (Date.now() >= state.rotationAt && !state.rotating) {
        const handoff = this.rotateASR(statusMeeting, state);
        this.handoffs.add(handoff);
        try {
          if (!(await handoff)) return;
        } finally {
          this.handoffs.delete(handoff);
        }
      }
      if (state.rotating || state.ending) return;
      const provider = this.meetings.providers.checkLive;
      if (!provider) return;
      await this.monitor.check(
        this.snapshot(id),
        (context, signal) => provider(context, this.meetings.get(id), signal),
        () => this.meetings.get(id),
        (check) => {
          const current = this.meetings.get(id);
          if ((current.monitor?.sequence ?? 0) > check.sequence) return;
          current.monitor = check;
          this.meetings.save(current);
          this.emit(id, "meeting.check", check);
        },
        (decision, check) => {
          const current = this.meetings.get(id);
          if (decision.agendaChange)
            applyAgenda(
              current,
              decision.agendaChange,
              this.meetings.turns(id),
            );
          const previousProposal = current.extension?.id;
          if (decision.extension)
            proposeExtension(
              current,
              decision.extension.minutes,
              decision.extension.reason,
            );
          const newProposal =
            current.extension?.state === "pending" &&
            current.extension.id !== previousProposal;
          if (decision.extensionConsent) {
            const turns = this.meetings.turns(id),
              t = turns.find(
                (t) => t.id === decision.extensionConsent!.evidence,
              ),
              p = current.extension;
            if (t && p) {
              const deliveries = listSpeechDeliveries(this.meetings.store, id);
              const delivered = deliveries.find(
                (d) =>
                  p.utteranceId !== undefined &&
                  d.interventionId === p.utteranceId &&
                  d.state === "completed",
              );
              if (p.presentedAt === undefined && delivered?.completedAt)
                p.presentedAt = delivered.completedAt;
              const after = p.presentedAt ?? Infinity,
                start = current.startedAt ?? 0;
              const conflict = turns.some(
                (v) =>
                  v.startMs !== null &&
                  start + v.startMs > after &&
                  /\b(no|cannot|can't|not available|have to leave)\b/i.test(
                    v.text,
                  ),
              );
              const overlap = deliveries.some(
                (d) =>
                  d.startedAt != null &&
                  t.startMs != null &&
                  start + t.startMs < (d.completedAt ?? Infinity) &&
                  (t.endMs == null || start + t.endMs > d.startedAt),
              );
              if (conflict || overlap)
                throw new HttpError(
                  "Conflicting or overlapping extension response",
                );
              confirmExtension(
                current,
                decision.extensionConsent.proposalId,
                true,
                t,
              );
            }
          }
          if (check.sequence >= (current.monitor?.sequence ?? 0))
            current.monitor = { ...check, decision };
          this.meetings.save(current);
          if (
            decision.agendaChange ||
            decision.extension ||
            decision.extensionConsent
          )
            this.emit(id, "plan.updated", {
              plan: current.plan,
              extension: current.extension,
              reason: decision.agendaChange?.reason ?? "Extension updated",
            });
          const acceptedRevision = current.revisions.length;
          if (
            decision.intervention &&
            !["preparing", "playing"].includes(
              current.speechStatus?.state ?? "",
            )
          ) {
            const item = {
              id: randomUUID(),
              at: Date.now(),
              text: interventionSpeech(
                newProposal
                  ? `Can everyone stay for another ${current.extension!.minutes} minutes?`
                  : decision.intervention.text,
              ),
              kind: decision.intervention.kind,
            };
            if (newProposal) {
              current.extension!.checkId = check.id;
              current.extension!.utteranceId = item.id;
            }
            current.interventions.push(item);
            this.meetings.save(current);
            if (current.speechEnabled !== false)
              this.speech?.offer(id, {
                ...item,
                epoch: current.epoch,
                checkId: check.id,
                snapshotAt: check.capturedAt,
                speakBy: check.capturedAt + 10000,
                evidenceValid: () =>
                  this.meetings.get(id).revisions.length === acceptedRevision &&
                  this.monitor.validEvidence(id, check.id),
              });
            this.emit(id, "intervention", {
              ...item,
              epoch: current.epoch,
              streaming: true,
            });
          }
        },
      );
      return;
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
      const result = assessmentSchema.parse(
        await this.meetings.providers.assess({
          ...snapshot,
          turns: snapshot.turns.slice(-40),
        }),
      );
      validateEvidence(result, snapshot.turns.slice(-40));
      const currentTurns = new Map(
        this.meetings.turns(id).map((t) => [t.id, t.revision]),
      );
      if (snapshot.turns.some((t) => currentTurns.get(t.id) !== t.revision))
        return;
      const current = this.meetings.get(id);
      if (
        current.epoch !== epoch ||
        current.paused ||
        current.phase !== "live" ||
        state.ending
      )
        return;
      current.assessment = result;
      current.assessmentAt = Date.now();
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
        this.emit(id, "plan.updated", {
          plan: result.plan,
          reason: result.planReason,
        });
      }
      this.meetings.save(current);
      if (
        result.intervention &&
        (force ||
          result.intervention.kind === "wrapup" ||
          Date.now() - state.lastIntervention >= this.config.cooldownMs)
      ) {
        const item = {
          id: randomUUID(),
          at: Date.now(),
          text: this.speech?.live
            ? interventionSpeech(result.intervention.text)
            : result.intervention.text,
          kind: result.intervention.kind,
        };
        current.interventions.push(item);
        state.lastIntervention = item.at;
        this.meetings.save(current);
        if (current.speechEnabled !== false)
          this.speech?.offer(id, { ...item, epoch: current.epoch });
        this.emit(id, "intervention", {
          ...item,
          epoch: current.epoch,
          streaming: !!this.speech?.live,
        });
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
        type: z.enum([
          "pause",
          "resume",
          "dismiss",
          "request_guidance",
          "voice_on",
          "voice_off",
        ]),
        id: z.string().optional(),
      })
      .parse(input);
    if (m.phase !== "live") throw new HttpError("Meeting is not live", 409);
    if (command.type === "request_guidance") {
      await this.tick(m.id, true);
      return this.meetings.get(m.id);
    }
    this.monitor.cancel(m.id);
    this.cancelSpeech(m);
    m.epoch++;
    if (command.type === "pause") m.paused = true;
    if (command.type === "resume") m.paused = false;
    if (command.type === "voice_on") m.speechEnabled = true;
    if (command.type === "voice_off") m.speechEnabled = false;
    this.meetings.save(m);
    this.emit(m.id, "moderator.control", {
      type: command.type,
      epoch: m.epoch,
    });
    return m;
  }
  editPlan(m: Meeting, input: unknown) {
    if (m.phase === "ended") throw new HttpError("Meeting has ended", 409);
    const plan: import("./contracts.ts").Plan = planSchema.parse(input);
    if (
      m.startedAt !== null &&
      m.plan &&
      plan.durationMinutes >
        m.plan.durationMinutes -
          (m.extension?.state === "disputed" ? m.extension.minutes : 0)
    )
      throw new HttpError(
        "Confirm a specific extension before increasing the deadline",
        409,
      );
    if (m.extension?.state === "pending") m.extension.state = "superseded";
    plan.retiredMinutes = plan.topics
      .filter((t) => t.status === "parked")
      .reduce((sum, t) => sum + (m.topicSpentSeconds?.[t.id] ?? 0) / 60, 0);
    validatePlan(plan);
    this.monitor.cancel(m.id);
    this.cancelSpeech(m);
    m.epoch++;
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
    this.monitor.cancel(m.id);
    this.cancelSpeech(m);
    m.epoch++;
    this.meetings.save(m);
    this.emit(m.id, "speaker.updated", { speakerId, name });
    return m;
  }
  async end(m: Meeting) {
    this.monitor.cancel(m.id);
    await this.onCaptureStop?.(m.id);
    m = this.meetings.get(m.id);
    if (this.starting.has(m.id))
      throw new HttpError("Audio is starting; retry in a moment", 409);
    if (m.phase === "ended") return m;
    const state = this.active.get(m.id);
    if (state?.ending) throw new HttpError("Meeting is ending", 409);
    this.monitor.cancel(m.id);
    this.cancelSpeech(m);
    m.epoch++;
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
          await this.meetings.providers.report(reportContext(snapshot)),
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
    this.monitor.cancel(m.id);
    await this.onCaptureStop?.(m.id);
    m = this.meetings.get(m.id);
    if (this.starting.has(m.id))
      throw new HttpError("Audio is starting; retry in a moment", 409);
    const state = this.active.get(m.id);
    if (!state || state.ending) return;
    state.ending = true;
    clearInterval(state.timer);
    this.monitor.cancel(m.id);
    this.cancelSpeech(m);
    m.epoch++;
    this.meetings.save(m);
    await state.asr?.end();
    await state.media?.close();
    this.active.delete(m.id);
    m = this.meetings.get(m.id);
    m.phase = "interrupted";
    m.error = "Capture stopped; reconnect explicitly.";
    this.meetings.save(m);
  }
  // Security revocation also covers Teams and pending startup. Ordinary logout
  // retains its existing behavior for independently hosted Teams meetings.
  async revokeUser(userId: string) {
    for (const [id, state] of this.active) {
      const m = this.meetings.get(id);
      if (m.userId !== userId) continue;
      this.monitor.cancel(id);
      const wasEnding = state.ending;
      state.ending = true;
      clearInterval(state.timer);
      this.cancelSpeech(m);
      state.asr?.close();
      await state.media?.close();
      if (!wasEnding) {
        this.active.delete(id);
        m.epoch++;
        m.phase = "interrupted";
        m.error = "Account access changed. Sign in again before reconnecting.";
        this.meetings.save(m);
      }
    }
  }
  async disconnectUser(userId: string) {
    for (const id of this.active.keys()) {
      const m = this.meetings.get(id);
      if (m.userId === userId && m.captureSource !== "teams")
        await this.interrupt(m);
    }
  }
  async remove(m: Meeting) {
    this.monitor.cancel(m.id);
    await this.onCaptureStop?.(m.id);
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
    await this.monitor.close();
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
          this.cancelSpeech(m);
          m.epoch++;
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
