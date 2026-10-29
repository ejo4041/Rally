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
  signature: string;
  lastIntervention: number;
  rotationAt: number;
  offset: number;
};
export class Engine {
  meetings: Meetings;
  media: Media;
  config: Configuration;
  active = new Map<string, Active>();
  reports = new Map<string, Promise<void>>();
  starting = new Set<string>();
  closed = false;
  constructor(meetings: Meetings, media: Media, config: Configuration) {
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
  gap(id: string, reason: string) {
    try {
      const m = this.meetings.get(id);
      if (m.gaps.at(-1)?.reason !== reason) {
        m.gaps.push({ at: Date.now(), reason });
        m.gaps = m.gaps.slice(-100);
        m.error = reason;
        this.meetings.save(m);
        this.emit(id, "capture.gap", { reason });
      }
    } catch {
      /* deleted */
    }
  }
  ingest(id: string, e: TranscriptEvent) {
    const state = this.active.get(id);
    if (!state) return;
    if (e.type === "partial") {
      this.emit(id, "transcript.partial", { text: e.text });
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
      old.startMs === turn.startMs &&
      old.endMs === turn.endMs
    )
      return;
    this.meetings.store.db
      .prepare(
        "INSERT INTO turns VALUES(?,?,?) ON CONFLICT(meeting_id,id) DO UPDATE SET body=excluded.body",
      )
      .run(id, key, JSON.stringify(turn));
    this.emit(id, "transcript.final", turn);
  }
  async openASR(m: Meeting, state: Active) {
    return this.meetings.providers.openASR(m, {
      onEvent: (e) => this.ingest(m.id, e),
      onError: (e) => this.gap(m.id, e.message),
      onClose: () => {
        if (!state.ending)
          this.gap(
            m.id,
            "Transcription connection closed; reconnect audio explicitly.",
          );
      },
    });
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
    if (this.active.size >= this.config.capacity)
      throw new HttpError("Server meeting capacity reached", 409);
    for (const id of this.active.keys())
      if (this.meetings.get(id).userId === m.userId)
        throw new HttpError("This host already has an active meeting", 409);
    this.starting.add(m.id);
    const state: Active = {
      busy: false,
      ending: false,
      signature: "",
      lastIntervention: 0,
      rotationAt: Date.now() + 55 * 60000,
      offset: m.startedAt ? Date.now() - m.startedAt : 0,
    };
    this.active.set(m.id, state);
    const previous = m.phase;
    m.phase = "live";
    m.startedAt ??= Date.now();
    m.epoch++;
    m.error = null;
    this.meetings.save(m);
    try {
      state.media = await this.media.open(
        m,
        (bytes) => {
          try {
            if (!state.ending) state.asr?.send(bytes);
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
      state.timer = setInterval(
        () => void this.tick(m.id).catch(() => {}),
        this.config.assessmentMs,
      );
      state.timer.unref();
      return {
        meeting: this.meetings.get(m.id),
        connection: await state.media.connection(),
      };
    } catch (error) {
      state.ending = true;
      state.asr?.close();
      await state.media?.close();
      this.active.delete(m.id);
      m.phase = previous;
      m.error = "Could not start audio; retry explicitly.";
      this.meetings.save(m);
      throw error;
    } finally {
      this.starting.delete(m.id);
    }
  }
  async connection(m: Meeting) {
    const state = this.active.get(m.id);
    if (!state?.media) throw new HttpError("Start the meeting first", 409);
    return state.media.connection();
  }
  async tick(id: string, force = false) {
    const state = this.active.get(id);
    if (!state || state.busy || state.ending) return;
    let snapshot = this.snapshot(id),
      m = snapshot.meeting;
    if (m.paused || m.phase !== "live") return;
    // Milestone changes permit reassessment without calling on every silent tick.
    const signature = `${m.epoch}:${snapshot.turns.map((t) => `${t.id}@${t.revision}`).join(",")}:${Math.floor(snapshot.elapsedSeconds / 60)}`;
    if (!force && signature === state.signature) return;
    state.busy = true;
    state.signature = signature;
    try {
      if (Date.now() >= state.rotationAt) {
        state.ending = true;
        await state.asr?.end();
        state.ending = false;
        state.offset = Date.now() - (m.startedAt || Date.now());
        state.asr = await this.openASR(m, state);
        state.rotationAt = Date.now() + 55 * 60000;
        this.gap(id, "Transcription session rotated; speaker labels restart.");
        snapshot = this.snapshot(id);
        m = snapshot.meeting;
      }
      if (!snapshot.turns.length) return;
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
      if (
        result.intervention &&
        (force ||
          result.intervention.kind === "wrapup" ||
          Date.now() - state.lastIntervention >= this.config.cooldownMs)
      ) {
        const item = {
          id: randomUUID(),
          at: Date.now(),
          text: result.intervention.text,
          kind: result.intervention.kind,
        };
        current.interventions.push(item);
        state.lastIntervention = item.at;
        this.emit(id, "intervention", item);
      }
      this.meetings.save(current);
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
    m.epoch++;
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
        name: z.string().trim().min(1).max(100),
      })
      .parse(input);
    if (!this.meetings.turns(m.id).some((t) => t.speaker === speakerId))
      throw new HttpError("Unknown speaker label");
    m.speakerNames[speakerId] = name;
    m.epoch++;
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
          await this.meetings.providers.report(snapshot),
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
        current.report = report;
        current.reportStatus = "ready";
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
      this.meetings.preparing.has(m.id)
    )
      throw new HttpError("Wait for processing to finish before deleting", 409);
    const state = this.active.get(m.id);
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
      s.ending = true;
      clearInterval(s.timer);
      await s.asr?.end();
      await s.media?.close();
      try {
        const m = this.meetings.get(id);
        if (m.phase === "live") {
          m.phase = "interrupted";
          m.epoch++;
          this.meetings.save(m);
        }
      } catch {}
    }
    await Promise.allSettled(this.reports.values());
    this.active.clear();
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
