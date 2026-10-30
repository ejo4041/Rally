import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Meeting, Turn } from "./contracts.ts";
import { validatePlan } from "./meetings.ts";
import { HttpError } from "./auth.ts";
export const agendaChangeSchema = z.object({
  reason: z.string().min(1).max(240),
  order: z.array(z.string()).max(20).nullable(),
  additions: z
    .array(
      z.object({
        id: z.string().max(80),
        title: z.string().max(120),
        outcome: z.string().max(240),
        minutes: z.number().positive().max(240),
      }),
    )
    .max(2),
  updates: z
    .array(
      z.object({
        id: z.string(),
        minutes: z.number().positive().max(240).nullable(),
        status: z.enum(["pending", "active", "done", "parked"]).nullable(),
      }),
    )
    .max(5),
  evidence: z.array(z.string()).max(12),
});
export type ExtensionProposal = {
  id: string;
  minutes: number;
  deadline: number;
  baseRevision: number;
  at: number;
  state: "pending" | "confirmed" | "rejected" | "superseded" | "disputed";
  reason: string;
  presentedAt?: number;
  checkId?: string;
  utteranceId?: string;
  confirmedRevision?: number;
  confirmation?: {
    method: "host" | "spoken";
    at: number;
    evidence?: { id: string; revision: number };
  };
};
export function applyAgenda(
  m: Meeting,
  change: z.infer<typeof agendaChangeSchema>,
  turns: Turn[],
) {
  if (!m.plan) throw new HttpError("No agenda");
  if (m.extension?.state === "disputed")
    throw new HttpError(
      "Resolve disputed extra time before changing the agenda",
      409,
    );
  const next = structuredClone(m.plan),
    finalIds = new Set(turns.map((t) => t.id));
  for (const added of change.additions) {
    if (next.topics.some((t) => t.id === added.id))
      throw new HttpError("Duplicate topic");
    next.topics.push({ ...added, status: "pending" });
  }
  for (const update of change.updates) {
    const topic = next.topics.find((t) => t.id === update.id);
    if (!topic) throw new HttpError("Unknown topic");
    if (
      ["done", "parked"].includes(update.status ?? "") &&
      (!change.evidence.length ||
        change.evidence.some((id) => !finalIds.has(id)))
    )
      throw new HttpError("Retirement/completion requires finalized evidence");
    if (update.minutes !== null) {
      if (update.minutes * 60 < (m.topicSpentSeconds?.[topic.id] ?? 0))
        throw new HttpError("Cannot reclaim elapsed topic time");
      topic.minutes = update.minutes;
    }
    if (update.status !== null) topic.status = update.status;
  }
  if (change.order) {
    if (
      change.order.length !== next.topics.length ||
      new Set(change.order).size !== next.topics.length
    )
      throw new HttpError("Invalid agenda order");
    next.topics = change.order.map((id) => {
      const topic = next.topics.find((t) => t.id === id);
      if (!topic) throw new HttpError("Unknown topic");
      return topic;
    });
  }
  if (next.topics.filter((t) => t.status === "active").length > 1)
    throw new HttpError("Only one topic may be active");
  next.retiredMinutes = next.topics
    .filter((t) => t.status === "parked")
    .reduce((sum, t) => sum + (m.topicSpentSeconds?.[t.id] ?? 0) / 60, 0);
  validatePlan(next);
  m.plan = next;
  m.revisions.push({
    at: Date.now(),
    reason: change.reason,
    plan: structuredClone(next),
  });
  if (m.extension?.state === "pending") m.extension.state = "superseded";
}
export function proposeExtension(m: Meeting, minutes: number, reason: string) {
  if (
    !m.startedAt ||
    !m.plan ||
    m.extension?.state === "pending" ||
    m.extension?.state === "disputed"
  )
    return;
  m.extension = {
    id: randomUUID(),
    minutes,
    deadline: m.startedAt + (m.plan.durationMinutes + minutes) * 60000,
    baseRevision: m.revisions.length,
    at: Date.now(),
    state: "pending",
    reason,
  };
}
export function confirmExtension(
  m: Meeting,
  id: string,
  accept: boolean,
  evidence?: Turn,
) {
  const p = m.extension;
  if (p?.state === "disputed" && p.id === id && !evidence && accept) {
    if (
      m.phase !== "live" ||
      p.confirmedRevision !== m.revisions.length ||
      !m.plan ||
      m.startedAt === null ||
      m.startedAt + m.plan.durationMinutes * 60000 !== p.deadline
    )
      throw new HttpError("Extension confirmation no longer current", 409);
    p.state = "confirmed";
    p.confirmation = { method: "host", at: Date.now() };
    return;
  }
  if (
    !p ||
    p.id !== id ||
    p.state !== "pending" ||
    p.baseRevision !== m.revisions.length ||
    m.phase !== "live" ||
    !m.plan
  )
    throw new HttpError("Extension proposal no longer current", 409);
  if (!accept) {
    p.state = "rejected";
    return;
  }
  if (evidence) {
    if (
      p.presentedAt === undefined ||
      evidence.startMs === null ||
      !m.startedAt ||
      m.startedAt + evidence.startMs <= p.presentedAt!
    )
      throw new HttpError("Response must begin after proposal");
    if (
      !new RegExp(
        "\\b" + p.minutes + "\\s*(?:more\\s*)?min(?:ute)?s?\\b",
        "i",
      ).test(
        evidence.text.replace(
          /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\b/gi,
          (v) =>
            String(
              [
                "one",
                "two",
                "three",
                "four",
                "five",
                "six",
                "seven",
                "eight",
                "nine",
                "ten",
                "eleven",
                "twelve",
                "thirteen",
                "fourteen",
                "fifteen",
              ].indexOf(v.toLowerCase()) + 1,
            ),
        ),
      ) ||
      !/\b(yes|agree|okay|ok|extend|can stay)\b/i.test(evidence.text) ||
      /\b(no|not|cannot|can.t|quote|said|say|would|could|if)\b/i.test(
        evidence.text,
      )
    )
      throw new HttpError("Ambiguous extension agreement");
  }
  const next = structuredClone(m.plan);
  next.durationMinutes += p.minutes;
  next.wrapMinutes += p.minutes;
  if (next.wrapMinutes > 30)
    throw new HttpError("Extension exceeds supported wrap time");
  validatePlan(next);
  m.plan = next;
  p.state = "confirmed";
  p.confirmation = {
    method: evidence ? "spoken" : "host",
    at: Date.now(),
    ...(evidence
      ? { evidence: { id: evidence.id, revision: evidence.revision } }
      : {}),
  };
  p.confirmedRevision = m.revisions.length + 1;
  m.revisions.push({
    at: Date.now(),
    reason: `Confirmed ${p.minutes}-minute extension`,
    plan: structuredClone(next),
  });
}
