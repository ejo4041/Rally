import { randomUUID } from "node:crypto";
import { z } from "zod";
import { HttpError } from "./auth.ts";
import type { Store } from "./store.ts";
import { planSchema } from "./contracts.ts";
import type { Meeting, Providers, Turn, Plan } from "./contracts.ts";

export const createMeetingSchema = z.object({
  title: z.string().trim().min(1).max(160).default("Meeting"),
  agenda: z.string().trim().min(1).max(20000),
  durationMinutes: z.number().min(1).max(240),
  participants: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
});
export class Meetings {
  store: Store;
  providers: Providers;
  preparing = new Set<string>();
  constructor(store: Store, providers: Providers) {
    this.store = store;
    this.providers = providers;
  }
  save(m: Meeting) {
    const stored = this.store.db
      .prepare("SELECT body FROM meetings WHERE id=?")
      .get(m.id) as { body: string } | undefined;
    m.sceneRevision =
      Math.max(
        m.sceneRevision ?? 0,
        stored ? (JSON.parse(stored.body).sceneRevision ?? 0) : 0,
      ) + 1;
    this.store.db
      .prepare(
        "INSERT INTO meetings VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      )
      .run(m.id, m.userId, JSON.stringify(m));
  }
  recordAudioExclusion(
    id: string,
    shield: { id: string; start: number; end: number },
  ) {
    const m = this.get(id);
    if (m.startedAt === null) return;
    const exclusions = (m.audioExclusions ??= []);
    const existing = exclusions.find((item) => item.id === shield.id);
    if (existing) {
      existing.maxEndMs = Math.max(existing.maxEndMs, shield.end - m.startedAt);
      this.save(m);
      return;
    }
    exclusions.push({
      id: shield.id,
      startMs: Math.max(0, shield.start - m.startedAt),
      maxEndMs: Math.max(0, shield.end - m.startedAt),
      reason: "moderator_speech",
    });
    this.save(m);
  }
  get(id: string, userId?: string): Meeting {
    const row = this.store.db
      .prepare("SELECT user_id,body FROM meetings WHERE id=?")
      .get(id) as { user_id: string; body: string } | undefined;
    if (!row || (userId && row.user_id !== userId))
      throw new HttpError("Meeting not found", 404);
    return JSON.parse(row.body);
  }
  list(userId: string) {
    return (
      this.store.db
        .prepare(
          "SELECT body FROM meetings WHERE user_id=? ORDER BY rowid DESC",
        )
        .all(userId) as { body: string }[]
    ).map((r) => {
      const m: Meeting = JSON.parse(r.body);
      return {
        id: m.id,
        title: m.title,
        createdAt: m.createdAt,
        phase: m.phase,
        reportStatus: m.reportStatus,
      };
    });
  }
  turns(id: string): Turn[] {
    const turns: Turn[] = (
      this.store.db
        .prepare("SELECT body FROM turns WHERE meeting_id=? ORDER BY rowid")
        .all(id) as { body: string }[]
    ).map((row) => JSON.parse(row.body));
    // Source event order is independent of opaque provider turn IDs. Older
    // records fall back to processing-position timestamps, then insertion order.
    const sessions = new Map<string, number>();
    const inserted = new Map(turns.map((t, i) => [t.id, i]));
    for (const turn of turns)
      if (!sessions.has(turn.sessionId))
        sessions.set(turn.sessionId, sessions.size);
    const rank = (t: Turn) =>
      t.sourceOrder !== undefined
        ? [0, t.sourceOrder]
        : t.startMs !== null
          ? [1, t.startMs]
          : [2, inserted.get(t.id)!];
    return turns.sort(
      (a, b) =>
        sessions.get(a.sessionId)! - sessions.get(b.sessionId)! ||
        rank(a)[0] - rank(b)[0] ||
        rank(a)[1] - rank(b)[1],
    );
  }
  async create(userId: string, input: unknown) {
    const data = createMeetingSchema.parse(input);
    const m: Meeting = {
      ...data,
      id: randomUUID(),
      userId,
      createdAt: Date.now(),
      phase: "draft",
      plan: null,
      originalPlan: null,
      revisions: [],
      startedAt: null,
      endedAt: null,
      paused: false,
      epoch: 0,
      progress: "",
      speakerNames: {},
      assessment: null,
      interventions: [],
      reportStatus: "none",
      reportStale: false,
      report: null,
      error: null,
      gaps: [],
    };
    this.save(m);
    await this.prepare(m);
    return this.get(m.id);
  }
  async prepare(m: Meeting) {
    if (!["draft", "ready"].includes(m.phase))
      throw new HttpError("Meeting already started", 409);
    if (this.preparing.has(m.id))
      throw new HttpError("Agenda generation already running", 409);
    this.preparing.add(m.id);
    const epoch = m.epoch;
    try {
      const plan = planSchema.parse(await this.providers.prepare(m));
      validatePlan(plan);
      if (plan.durationMinutes !== m.durationMinutes)
        throw new HttpError("Generated plan changed the requested duration");
      const current = this.get(m.id);
      if (current.epoch !== epoch)
        throw new HttpError(
          "Plan changed during generation; retry explicitly",
          409,
        );
      m = current;
      m.plan = plan;
      m.originalPlan = structuredClone(plan);
      m.phase = "ready";
      m.error = null;
    } catch (error) {
      m.error =
        error instanceof HttpError
          ? error.message
          : "Agenda preparation failed; retry or provide a plan.";
    } finally {
      this.preparing.delete(m.id);
    }
    const current = this.get(m.id);
    if (current.epoch === epoch) this.save(m);
  }
}
export function validatePlan(plan: Plan, spent: Record<string, number> = {}) {
  if (
    Object.entries(spent).some(
      ([id, seconds]) => seconds > 0 && !plan.topics.some((t) => t.id === id),
    )
  )
    throw new HttpError(
      "Retain consumed topics as parked instead of removing their spent time",
    );
  if (plan.topics.filter((t) => t.status === "active").length > 1)
    throw new HttpError("Only one topic may be active");
  for (const t of plan.topics)
    if (t.status !== "parked" && t.minutes * 60 + 0.01 < (spent[t.id] ?? 0))
      throw new HttpError("Topic allocation cannot reclaim spent time");
  if (new Set(plan.topics.map((t) => t.id)).size !== plan.topics.length)
    throw new HttpError("Agenda topic IDs must be unique");
  const allocated =
    plan.topics
      .filter((t) => t.status !== "parked")
      .reduce((sum, t) => sum + t.minutes, 0) +
    plan.wrapMinutes +
    (plan.retiredMinutes ?? 0);
  if (
    plan.wrapMinutes >= plan.durationMinutes ||
    Math.abs(allocated - plan.durationMinutes) > 0.05
  )
    throw new HttpError(
      "Topic budgets and wrap-up must add up to the duration",
    );
}
