import { assessmentSchema } from "./contracts.ts";
import { assessmentContext } from "./assessment-context.ts";
import { listSpeechDeliveries } from "./speech-delivery.ts";
import { agendaChangeSchema } from "./live-agenda.ts";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Meeting, Turn, Snapshot } from "./contracts.ts";
import type { Store } from "./store.ts";
export const liveDecisionSchema = z.object({
  affect: assessmentSchema.shape.affect,
  concerns: assessmentSchema.shape.concerns,
  focus: assessmentSchema.shape.focus,
  agendaChange: agendaChangeSchema.nullable(),
  extension: z
    .object({
      minutes: z.number().int().min(1).max(15),
      reason: z.string().max(240),
    })
    .nullable(),
  extensionConsent: z
    .object({ proposalId: z.string(), evidence: z.string() })
    .nullable(),
  health: z.number().int().min(0).max(5).nullable(),
  feeling: z.enum(["focused", "curious", "concerned", "urgent", "neutral"]),
  observation: z.string().max(240),
  progress: z.string().max(500),
  concern: z.string().max(160),
  evidence: z.array(z.string()).max(12),
  intervention: z
    .object({
      text: z.string().max(400),
      kind: z.enum(["redirect", "clarify", "checkpoint", "wrapup"]),
    })
    .nullable(),
});
export type LiveDecision = z.infer<typeof liveDecisionSchema>;
export type LiveForecast = {
  checksRemaining: number;
  estimatedCheckCost: number;
  estimatedRemainingCost: number;
  reportReserve: number;
  remainingWorkSeconds: number;
  slackSeconds: number;
};
export type LiveCheck = {
  forecast?: LiveForecast;
  id: string;
  sequence: number;
  capturedAt: number;
  completedAt?: number;
  transcriptAt?: number | null;
  processedMs?: number | null;
  status:
    | "checking"
    | "accepted"
    | "expired"
    | "rejected"
    | "failed"
    | "skipped"
    | "waiting"
    | "paused";
  epoch: number;
  planRevision: number;
  decision?: LiveDecision;
  reason?: string;
  latencyMs?: number;
  affectEvidenceKey?: string;
  evidenceHashes?: Record<string, string>;
  evidenceProofs?: Record<string, import("./contracts.ts").EvidenceProof>;
};
export type LiveContext = {
  concerns?: Meeting["concerns"];
  focus?: Meeting["presenceFocus"];
  progress?: string;
  gaps?: Meeting["gaps"];
  originalDeadline?: number | null;
  emotions?: ReturnType<typeof assessmentContext>["meeting"]["emotions"];
  rejectedEmotionCommands?: string[];
  meeting: {
    id: string;
    objective: string;
    originalGoals: {
      id: string;
      title: string;
      outcome: string;
      currentStatus: string;
    }[];
    plan: Meeting["plan"];
    elapsedSeconds: number;
    remainingSeconds: number;
    topicSpentSeconds: Record<string, number>;
  };
  finals: Turn[];
  partials: {
    id: string;
    text: string;
    version: number;
    at: number;
    prefixLength?: number;
  }[];
  previous: LiveDecision | null;
  moderator: Meeting["interventions"];
  speech: Meeting["speechStatus"];
  extension: Meeting["extension"];
  deliveries: ReturnType<typeof listSpeechDeliveries>;
};
type Partial = { id: string; text: string; version: number; at: number };
export class LiveMonitor {
  private accepted = new Map<string, number>();
  private inputAt = new Map<string, number>();
  private processed = new Map<string, number>();
  private generation = new Map<string, number>();
  private memory = new Map<
    string,
    { decision: LiveDecision; context: LiveContext }
  >();
  private proofs = new Map<
    string,
    { context: LiveContext; evidence: string[] }
  >();
  private partials = new Map<string, Map<string, Partial>>();
  private tombstones = new Map<string, Set<string>>();
  private tasks = new Map<
    string,
    Map<string, { abort: AbortController; task: Promise<void> }>
  >();
  private sequence = new Map<string, number>();
  constructor(privateStore: Store) {
    this.store = privateStore;
    this.store.db.exec(
      "CREATE TABLE IF NOT EXISTS live_checks(id TEXT PRIMARY KEY,meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,sequence INTEGER NOT NULL,body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS live_check_page ON live_checks(meeting_id,sequence);",
    );
  }
  private store: Store;
  ingest(
    id: string,
    session: string | undefined,
    turn: number | undefined,
    text: string,
    final = false,
  ) {
    if (session === undefined || turn === undefined) return;
    const key = session + ":" + turn;
    if (!final && this.finalReader?.(id).some((t) => t.id === key)) return;
    this.inputAt.set(id, Date.now());
    let dead = this.tombstones.get(id);
    if (!dead) this.tombstones.set(id, (dead = new Set()));
    let entries = this.partials.get(id);
    if (!entries) this.partials.set(id, (entries = new Map()));
    if (final) {
      dead.add(key);
      entries.delete(key);
      return;
    }
    if (dead.has(key)) return;
    const old = entries.get(key);
    entries.set(key, {
      id: key,
      text: text.slice(-8000),
      version: (old?.version ?? 0) + 1,
      at: Date.now(),
    });
    while (entries.size > 4) entries.delete(entries.keys().next().value!);
  }
  clear(id: string) {
    this.partials.delete(id);
    this.tombstones.delete(id);
    this.memory.delete(id);
  }
  cancel(id: string) {
    this.generation.set(id, (this.generation.get(id) ?? 0) + 1);
    this.memory.delete(id);
    for (const [key, proof] of this.proofs)
      if (proof.context.meeting.id === id) this.proofs.delete(key);
  }
  history(id: string, before = Number.MAX_SAFE_INTEGER) {
    const rows = this.store.db
      .prepare(
        "SELECT body FROM live_checks WHERE meeting_id=? AND sequence<? ORDER BY sequence DESC LIMIT 50",
      )
      .all(id, before) as { body: string }[];
    const items = rows.map((r) => JSON.parse(r.body) as LiveCheck);
    return {
      items,
      nextCursor: items.length === 50 ? items.at(-1)!.sequence : null,
    };
  }
  save(id: string, check: LiveCheck) {
    this.store.db
      .prepare(
        "INSERT INTO live_checks VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      )
      .run(check.id, id, check.sequence, JSON.stringify(check));
    this.store.db
      .prepare("DELETE FROM live_checks WHERE meeting_id=? AND sequence < ?")
      .run(id, check.sequence - 10000);
  }
  presenceProofValid(
    id: string,
    proofs: Record<string, import("./contracts.ts").EvidenceProof> | undefined,
    finals: Turn[],
  ): boolean {
    return (
      !proofs ||
      Object.entries(proofs).every(([key, proof]) => {
        const final = finals.find((t) => t.id === key),
          partial = this.partials.get(id)?.get(key),
          text = final?.text ?? partial?.text;
        if (
          text === undefined ||
          text.length < proof.length ||
          (proof.revision !== undefined && final?.revision !== proof.revision)
        )
          return false;
        return (
          createHash("sha256")
            .update(text.slice(0, proof.length).slice(-proof.tailLength))
            .digest("hex") === proof.hash
        );
      })
    );
  }
  context(s: Snapshot): LiveContext {
    return {
      concerns: (s.meeting.concerns ?? [])
        .filter((c) =>
          this.presenceProofValid(s.meeting.id, c.evidenceProofs, s.turns),
        )
        .slice(0, 16),
      focus: this.presenceProofValid(
        s.meeting.id,
        s.meeting.presenceFocusProofs,
        s.turns,
      )
        ? s.meeting.presenceFocus
        : null,
      progress: (s.meeting.progress ?? "").slice(0, 1000),
      gaps: (s.meeting.gaps ?? []).slice(-3),
      originalDeadline:
        s.meeting.startedAt == null
          ? null
          : s.meeting.startedAt + s.meeting.durationMinutes * 60000,
      emotions: assessmentContext(s).meeting.emotions,
      rejectedEmotionCommands: s.meeting.presence?.rejected,
      meeting: {
        id: s.meeting.id,
        objective: (s.meeting.plan?.objective ?? "").slice(0, 500),
        originalGoals: (s.meeting.originalPlan?.topics ?? []).map((t) => ({
          id: t.id,
          title: t.title.slice(0, 120),
          outcome: t.outcome.slice(0, 200),
          currentStatus:
            s.meeting.plan?.topics.find((v) => v.id === t.id)?.status ??
            "retired",
        })),
        plan: s.meeting.plan
          ? {
              ...s.meeting.plan,
              objective: s.meeting.plan.objective.slice(0, 500),
              topics: s.meeting.plan.topics.map((t) => ({
                ...t,
                title: t.title.slice(0, 120),
                outcome: t.outcome.slice(0, 200),
              })),
            }
          : null,
        elapsedSeconds: s.elapsedSeconds,
        topicSpentSeconds: s.meeting.topicSpentSeconds ?? {},
        remainingSeconds:
          ((s.meeting.plan?.durationMinutes ?? s.meeting.durationMinutes) -
            (s.meeting.extension?.state === "disputed"
              ? s.meeting.extension.minutes
              : 0)) *
            60 -
          s.elapsedSeconds,
      },
      finals: this.boundedFinals(s.turns),
      partials: [...(this.partials.get(s.meeting.id)?.values() ?? [])]
        .slice(-2)
        .map((p) => ({
          ...p,
          text: p.text.slice(-4000),
          prefixLength: p.text.length,
        })),
      previous: this.remembered(s.meeting.id),
      moderator: s.meeting.interventions.slice(-4),
      speech: s.meeting.speechStatus,
      extension: s.meeting.extension,
      deliveries: listSpeechDeliveries(this.store, s.meeting.id),
    };
  }
  private boundedFinals(turns: Turn[]) {
    let remaining = 8000;
    const selected: Turn[] = [];
    for (const t of turns.slice(-20).reverse()) {
      if (t.text.length > remaining) break;
      selected.unshift(t);
      remaining -= t.text.length;
    }
    return selected;
  }
  async check(
    s: Snapshot,
    assess: (
      context: LiveContext,
      signal: AbortSignal,
    ) => Promise<LiveDecision>,
    current: () => Meeting,
    emit: (check: LiveCheck) => void,
    apply: (decision: LiveDecision, check: LiveCheck) => void,
  ) {
    const id = s.meeting.id,
      now = Date.now();
    let seq = this.sequence.get(id);
    if (seq === undefined) seq = this.history(id).items[0]?.sequence ?? 0;
    this.sequence.set(id, ++seq);
    const check: LiveCheck = {
      id: randomUUID(),
      sequence: seq,
      capturedAt: now,
      transcriptAt: this.inputAt.get(id) ?? null,
      processedMs: this.processed.get(id) ?? null,
      status: "checking",
      epoch: s.meeting.epoch,
      planRevision: s.meeting.revisions.length,
    };
    const generation = this.generation.get(id) ?? 0;
    const context = this.context(s);
    check.forecast = this.forecast?.(context, s.meeting);
    const publish = () => {
      try {
        this.save(id, check);
        const m = current();
        if (
          generation === (this.generation.get(id) ?? 0) &&
          m.epoch === check.epoch &&
          m.phase === "live"
        )
          emit({ ...check });
      } catch {}
    };
    let jobs = this.tasks.get(id);
    if (!jobs) this.tasks.set(id, (jobs = new Map()));
    if (
      s.meeting.paused ||
      (!context.finals.length &&
        !context.partials.some((p) => p.text.trim())) ||
      jobs.size >= 2 ||
      [...this.tasks.values()].reduce((n, j) => n + j.size, 0) >= 10
    ) {
      if (
        s.turns.at(-1)?.text.length! > 8000 &&
        !context.finals.length &&
        !context.partials.length
      ) {
        check.status = "skipped";
        check.reason =
          "Latest finalized turn exceeds the 8000-character complete-evidence budget";
        publish();
        return;
      }
      check.status = s.meeting.paused
        ? "paused"
        : context.finals.length || context.partials.length
          ? "skipped"
          : "waiting";
      publish();
      return;
    }
    publish();
    const abort = new AbortController();
    let expired = false;
    const soft = setTimeout(() => {
      expired = true;
      check.status = "expired";
      check.reason = "Assessment missed its decision deadline";
      publish();
    }, 8000);
    const hard = setTimeout(() => abort.abort(), 18000);
    const task = (async () => {
      try {
        const result = liveDecisionSchema.parse(
          await Promise.race([
            assess(context, abort.signal),
            new Promise<never>((_, reject) => {
              abort.signal.addEventListener(
                "abort",
                () => reject(new Error("Assessment canceled")),
                { once: true },
              );
            }),
          ]),
        );
        check.completedAt = Date.now();
        check.latencyMs = check.completedAt - now;
        if (expired || abort.signal.aborted || check.latencyMs > 8000) {
          check.status = "expired";
          return;
        }
        const m = current();
        if (
          generation !== (this.generation.get(id) ?? 0) ||
          check.sequence < (this.accepted.get(id) ?? 0) ||
          m.epoch !== check.epoch ||
          m.phase !== "live" ||
          m.paused ||
          m.revisions.length !== check.planRevision
        ) {
          check.status = "rejected";
          return;
        }
        const evidence = [
          ...result.evidence,
          ...(result.concerns?.flatMap((c) => c.evidence) ?? []),
          ...(result.affect?.evidence ?? []),
          ...(result.focus?.evidence ?? []),
          ...(result.agendaChange?.evidence ?? []),
          ...(result.extensionConsent
            ? [result.extensionConsent.evidence]
            : []),
        ];
        if (!this.compatible(id, context, evidence)) {
          check.status = "rejected";
          return;
        }
        if (result.intervention && !result.evidence.length)
          throw new Error("Spoken guidance requires evidence");
        check.evidenceProofs = Object.fromEntries(
          evidence.map((key) => {
            const final = context.finals.find((t) => t.id === key),
              partial = context.partials.find((t) => t.id === key),
              supplied = final ?? partial!;
            return [
              key,
              {
                hash: createHash("sha256").update(supplied.text).digest("hex"),
                length: partial?.prefixLength ?? supplied.text.length,
                tailLength: supplied.text.length,
                ...(final ? { revision: final.revision } : {}),
              },
            ];
          }),
        );
        check.evidenceHashes = Object.fromEntries(
          evidence.map((key) => {
            const supplied =
              context.finals.find((t) => t.id === key) ??
              context.partials.find((t) => t.id === key);
            return [
              key,
              createHash("sha256")
                .update(supplied?.text ?? "")
                .digest("hex"),
            ];
          }),
        );
        check.affectEvidenceKey = result.affect?.evidence
          .map((key) => {
            const supplied =
              context.finals.find((t) => t.id === key) ??
              context.partials.find((t) => t.id === key);
            return `${key}@${createHash("sha256")
              .update(supplied?.text ?? "")
              .digest("hex")}`;
          })
          .sort()
          .join("|");
        check.status = "accepted";
        check.decision = result;
        this.proofs.set(check.id, {
          context,
          evidence: [
            ...result.evidence,
            ...(result.concerns?.flatMap((c) => c.evidence) ?? []),
            ...(result.affect?.evidence ?? []),
            ...(result.focus?.evidence ?? []),
            ...(result.agendaChange?.evidence ?? []),
            ...(result.extensionConsent
              ? [result.extensionConsent.evidence]
              : []),
          ],
        });
        while (this.proofs.size > 100)
          this.proofs.delete(this.proofs.keys().next().value!);
        apply(result, check);
        this.accepted.set(id, check.sequence);
        this.memory.set(id, { decision: result, context });
      } catch {
        if (!expired) {
          check.status = abort.signal.aborted ? "rejected" : "failed";
          check.reason = "Assessment unavailable; no action taken";
        }
      } finally {
        clearTimeout(soft);
        clearTimeout(hard);
        try {
          this.save(id, check);
          if (
            generation === (this.generation.get(id) ?? 0) &&
            !expired &&
            !abort.signal.aborted &&
            current().epoch === check.epoch &&
            current().phase === "live"
          )
            emit({ ...check });
        } catch {}
        jobs!.delete(check.id);
      }
    })();
    jobs.set(check.id, { abort, task });
    await task;
  }
  validEvidence(id: string, checkId: string) {
    const proof = this.proofs.get(checkId);
    return !!proof && this.compatible(id, proof.context, proof.evidence);
  }
  private remembered(id: string) {
    const memory = this.memory.get(id);
    if (
      !memory ||
      !this.compatible(id, memory.context, [
        ...memory.decision.evidence,
        ...(memory.decision.affect?.evidence ?? []),
        ...(memory.decision.focus?.evidence ?? []),
        ...(memory.decision.concerns?.flatMap((c) => c.evidence) ?? []),
        ...(memory.decision.agendaChange?.evidence ?? []),
        ...(memory.decision.extensionConsent
          ? [memory.decision.extensionConsent.evidence]
          : []),
      ])
    )
      return null;
    return memory.decision;
  }
  private compatible(id: string, context: LiveContext, evidence: string[]) {
    const finals = this.finalReader?.(id) ?? context.finals;
    return evidence.every((key) => {
      const old = context.finals.find((t) => t.id === key);
      if (old)
        return finals.some((t) => t.id === key && t.revision === old.revision);
      const partial = context.partials.find((p) => p.id === key);
      if (!partial) return false;
      const live = this.partials.get(id)?.get(key);
      return (
        !!live?.text
          .slice(0, partial.prefixLength ?? partial.text.length)
          .endsWith(partial.text) ||
        finals.some(
          (t) =>
            t.id === key &&
            t.text
              .slice(0, partial.prefixLength ?? partial.text.length)
              .endsWith(partial.text),
        )
      );
    });
  }
  progress(id: string, processedMs: number) {
    this.processed.set(id, processedMs);
  }
  forecast?: (context: LiveContext, meeting: Meeting) => LiveForecast;
  finalReader?: (id: string) => Turn[];
  async close() {
    for (const id of this.tasks.keys()) this.cancel(id);
    await Promise.allSettled(
      [...this.tasks.values()].flatMap((j) =>
        [...j.values()].map((v) => v.task),
      ),
    );
  }
}
