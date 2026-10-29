import { randomUUID } from "node:crypto";
import { z } from "zod";
import { HttpError } from "./auth.ts";
import type { Store } from "./store.ts";
import { planSchema } from "./contracts.ts";
import type { Meeting, Providers, Turn } from "./contracts.ts";

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
    this.store.db
      .prepare(
        "INSERT INTO meetings VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      )
      .run(m.id, m.userId, JSON.stringify(m));
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
    return (
      this.store.db
        .prepare("SELECT body FROM turns WHERE meeting_id=?")
        .all(id) as { body: string }[]
    )
      .map((r) => JSON.parse(r.body))
      .sort(
        (a, b) =>
          (a.startMs ?? Infinity) - (b.startMs ?? Infinity) ||
          a.id.localeCompare(b.id),
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
export function validatePlan(plan: z.infer<typeof planSchema>) {
  if (new Set(plan.topics.map((t) => t.id)).size !== plan.topics.length)
    throw new HttpError("Agenda topic IDs must be unique");
  const allocated =
    plan.topics
      .filter((t) => t.status !== "parked")
      .reduce((sum, t) => sum + t.minutes, 0) + plan.wrapMinutes;
  if (
    plan.wrapMinutes >= plan.durationMinutes ||
    Math.abs(allocated - plan.durationMinutes) > 0.05
  )
    throw new HttpError(
      "Topic budgets and wrap-up must add up to the duration",
    );
}
