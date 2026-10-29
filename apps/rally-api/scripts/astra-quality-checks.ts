import { reportSchema } from "../src/contracts.ts";
import type { Snapshot } from "../src/contracts.ts";
import { validateEvidence } from "../src/engine.ts";

// A small case-specific review aid, not a general semantic grader or quality score.
export function qualityChecks(raw: unknown, snapshot: Snapshot) {
  const report = reportSchema.parse(raw);
  validateEvidence(report, snapshot.turns);
  const findings: string[] = [];
  const outcomes = [...report.decisions, ...report.actions];
  const namedOwner = (owner: string | null, name: string, label: string) =>
    owner === name || owner === label;
  const findAction = (pattern: RegExp) =>
    report.actions.find((a) => pattern.test(a.text));
  const fix = findAction(/timezone|time.zone/i);
  if (
    !fix ||
    !namedOwner(fix.owner, "Leo", "quality:B") ||
    !/Thursday.*3\s*(pm|p\.m\.)/i.test(fix.dueDate || "")
  )
    findings.push(
      "Review timezone fix: expected Leo, corrected literal deadline Thursday at 3 pm.",
    );
  const audit = report.actions.find(
    (a) => /audit|export/i.test(a.text) && /verif|test|check/i.test(a.text),
  );
  if (
    !audit ||
    !namedOwner(audit.owner, "Priya", "quality:C") ||
    !/Friday.*(noon|12)/i.test(audit.dueDate || "")
  )
    findings.push("Review audit verification: expected Priya, Friday noon.");
  const rollback = findAction(/rollback/i);
  if (
    !rollback ||
    !namedOwner(rollback.owner, "Priya", "quality:C") ||
    !/Friday.*2\s*(pm|p\.m\.)/i.test(rollback.dueDate || "")
  )
    findings.push("Review rollback rehearsal: expected Priya, Friday at 2 pm.");
  if (
    !report.decisions.some(
      (d) =>
        /pilot/i.test(d.text) &&
        /accessibility/i.test(d.text) &&
        /if|condition|contingent|subject|unless|depend/i.test(d.text),
    )
  )
    findings.push(
      "Review pilot decision: must retain late accessibility condition; Monday is conditional.",
    );
  for (const item of outcomes) {
    if (
      /email|accessibility|support.checklist/i.test(item.text) &&
      item.owner !== null
    )
      findings.push(
        `Review unsupported owner for unresolved task: ${item.text}`,
      );
    if (
      /support.checklist/i.test(item.text) &&
      item.status === "reported_agreement"
    )
      findings.push(
        "Tentative unattributed support-checklist offer must not become reported agreement.",
      );
  }
  if (
    !/email/i.test(
      [
        ...report.unresolved,
        ...outcomes.filter((a) => a.status === "unresolved").map((a) => a.text),
      ].join(" "),
    )
  )
    findings.push(
      "Review omission: customer email ownership remains unresolved.",
    );
  const seconds = Object.values(report.focusTime).filter(
    (v): v is number => typeof v === "number",
  );
  if (seconds.reduce((a, b) => a + b, 0) > snapshot.elapsedSeconds + 1)
    findings.push("Focus-time estimates exceed the elapsed meeting duration.");
  const speakers = new Map(snapshot.turns.map((t) => [t.id, t.speaker]));
  for (const group of report.speakerTips)
    if (
      group.tips.some((t) =>
        t.evidence.some((id) => speakers.get(id) !== group.speakerId),
      )
    )
      findings.push(
        "Speaker tip cites another speaker or unknown attribution.",
      );
  return {
    findings,
    manualReview: [
      "Read all outcome evidence for entailment; valid IDs alone do not prove a claim.",
      "Useful incident discussion is relevant; sustained coffee discussion is drift.",
      "Participation should recognize explicit invitations and responses, never require equal airtime.",
      "Scores need concrete reasons; exact 0–5 values are not a golden answer.",
      "Speaker tips should be optional, actionable, and limited to observed behavior.",
      "An emitted redirect is not proof participants heard, ignored, or obeyed it.",
    ],
  };
}
