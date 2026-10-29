import type { Meeting, Snapshot, Turn } from "../../src/contracts.ts";

// Original synthetic text, created for this evaluation. These are NOT ASR results.
export const fixtureAgenda = {
  title: "Heimdall pilot readiness",
  agenda:
    "Decide whether the Heimdall dashboard can enter a two-customer pilot on Monday. Check the audit-export and rollback requirements, assign remaining checks and communications, and close with blockers and owners. Keep a minute for wrap-up.",
  durationMinutes: 10,
  participants: ["Maya", "Leo", "Priya"],
};
const rows: [string | null, number, number, string][] = [
  [
    "A",
    0,
    18,
    "Maya here. We need a decision on Monday's two-customer Heimdall pilot, not general availability. Leo, then Priya, tell us what could block it.",
  ],
  [
    "B",
    25,
    45,
    "Leo: the dashboard is ready. Audit export has a timezone bug. I can fix it by Friday—sorry, by Thursday at 3 pm. Friday is too late for QA.",
  ],
  [
    "C",
    50,
    72,
    "Priya: I can verify the audit export after that fix, by Friday noon. The other requirement is a tested rollback. Leo, is that actually ready?",
  ],
  [
    "B",
    80,
    103,
    "The old incident is relevant: a customer had an empty dashboard because a migration failed. We should test rollback against that migration, not just the happy path.",
  ],
  [
    "C",
    110,
    128,
    "Yes, that incident explains the requirement. I will run the rollback rehearsal by Friday at 2 pm and report whether it passes.",
  ],
  [
    "A",
    135,
    155,
    "Then our decision is a two-customer pilot on Monday only if audit export and rollback both pass. If either fails, we postpone; we are not committing to a full launch.",
  ],
  [
    "B",
    162,
    174,
    "Agreed on the conditional pilot. No general availability announcement.",
  ],
  [
    "C",
    180,
    197,
    "Agreed. Maya, could someone handle the customer email? I could maybe help after QA, but I am not committing to write it.",
  ],
  [
    "A",
    205,
    220,
    "Let's leave the customer email owner and deadline open. We need to ask who can take it before we close.",
  ],
  [
    "B",
    230,
    255,
    "While we are here, should the office coffee machine be replaced? I spent the weekend comparing grinders and there are six brands we could debate.",
  ],
  [
    "A",
    265,
    290,
    "I bought a grinder last year. My holiday itinerary had three cafes, and I could explain how each brewed coffee. This has nothing to do with Heimdall.",
  ],
  [
    "B",
    300,
    325,
    "Let's rank those cafes and coffee machines now. It will take a few more minutes before we return to the pilot.",
  ],
  [
    "A",
    365,
    389,
    "Parking coffee. Back to the pilot: Priya owns both verification checks. Leo owns the timezone fix, due Thursday at 3 pm. The customer email still has no owner or date.",
  ],
  [
    null,
    405,
    419,
    "I can review the support checklist sometime next week, perhaps. Don't put my name against it yet.",
  ],
  [
    "C",
    440,
    460,
    "One more blocker: accessibility sign-off is missing. We have not assigned that check or set its deadline. It must happen before the pilot.",
  ],
  [
    "A",
    500,
    524,
    "Add accessibility sign-off as another condition. If audit export, rollback, or accessibility fails, postpone Monday's pilot. Leo and Priya, any objection?",
  ],
  [
    "B",
    550,
    568,
    "No objection. My fix is Thursday at 3 pm, not Friday. I cannot own accessibility as well.",
  ],
  [
    "C",
    580,
    599,
    "Agreed on all three conditions. Audit verification Friday noon, rollback rehearsal Friday at 2 pm; both are mine. I have no capacity for the email.",
  ],
  [
    "A",
    610,
    625,
    "We are twenty-five seconds over. Close with the conditional pilot decision and those three assigned tasks. Email and accessibility ownership remain unresolved. Do not turn the tentative support-checklist offer into an assignment.",
  ],
];

export const fixtureTurns: Turn[] = rows.map(
  ([speaker, start, end, text], turnId) => ({
    id: `quality:${turnId}`,
    sessionId: "quality",
    turnId,
    revision: 1,
    text,
    speaker: speaker === null ? null : `quality:${speaker}`,
    startMs: start * 1000,
    endMs: end * 1000,
  }),
);

export function fixtureSnapshot(
  stage: "useful-tangent" | "drift" | "wrapup" | "report" = "report",
): Snapshot {
  const end = { "useful-tangent": 128, drift: 325, wrapup: 599, report: 625 }[
    stage
  ];
  const startedAt = Date.UTC(2026, 9, 29, 10);
  const plan = {
    objective: "Agree a conditional pilot decision and assign remaining checks",
    durationMinutes: 10,
    wrapMinutes: 1,
    topics: [
      {
        id: "requirements",
        title: "Requirements",
        outcome: "Identify pilot blockers",
        minutes: 4,
        status: "pending" as const,
      },
      {
        id: "decision",
        title: "Pilot decision",
        outcome: "Agree go/no-go conditions",
        minutes: 2,
        status: "pending" as const,
      },
      {
        id: "owners",
        title: "Owners",
        outcome: "Assign checks and communication",
        minutes: 3,
        status: "pending" as const,
      },
    ],
  };
  const meeting: Meeting = {
    ...fixtureAgenda,
    id: "astra-quality",
    userId: "fixture-host",
    createdAt: startedAt - 60000,
    phase: stage === "report" ? "ended" : "live",
    plan,
    originalPlan: structuredClone(plan),
    revisions: [],
    startedAt,
    endedAt: stage === "report" ? startedAt + end * 1000 : null,
    paused: false,
    epoch: 0,
    progress: "",
    speakerNames: {
      "quality:A": "Maya",
      "quality:B": "Leo",
      "quality:C": "Priya",
    },
    assessment: null,
    interventions: [],
    reportStatus: "none",
    report: null,
    error: null,
    gaps: [],
  };
  return {
    meeting,
    elapsedSeconds: end,
    turns: structuredClone(fixtureTurns.filter((t) => t.endMs! <= end * 1000)),
  };
}
