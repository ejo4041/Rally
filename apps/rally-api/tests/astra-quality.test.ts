import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { categories, reportSchema } from "../src/contracts.ts";
import { fixtureSnapshot } from "./fixtures/astra-meeting.ts";
import { qualityChecks } from "../scripts/astra-quality-checks.ts";

function exampleReport() {
  const action = (
    text: string,
    owner: string | null,
    dueDate: string | null,
    evidence: string[],
  ) => ({
    text,
    owner,
    dueDate,
    evidence,
    status: "reported_agreement" as const,
    followup: "none" as const,
    followupPrompt: null,
  });
  return reportSchema.parse({
    summary:
      "Conditional pilot agreed; three checks assigned and two ownership gaps remain.",
    decisions: [
      action(
        "Monday two-customer pilot only if audit export, rollback and accessibility pass; otherwise postpone.",
        null,
        "Monday",
        ["quality:5", "quality:15", "quality:17"],
      ),
    ],
    actions: [
      action("Fix audit-export timezone bug", "Leo", "Thursday at 3 pm", [
        "quality:1",
        "quality:16",
      ]),
      action("Verify audit export", "Priya", "Friday noon", [
        "quality:2",
        "quality:17",
      ]),
      action("Run rollback rehearsal", "Priya", "Friday at 2 pm", [
        "quality:4",
        "quality:17",
      ]),
    ],
    unresolved: [
      "Customer email owner and deadline",
      "Accessibility sign-off owner and deadline",
      "Tentative support-checklist offer is unassigned",
    ],
    scores: categories.map((category) => ({
      category,
      score: null,
      reason: "Fixture leaves subjective rating to human review.",
      evidence: [],
    })),
    speakerTips: [
      {
        speakerId: "quality:B",
        tips: [
          {
            text: "Park the coffee discussion until after pilot decisions.",
            evidence: ["quality:9", "quality:11"],
          },
        ],
      },
    ],
    focusTime: {
      onTopicSeconds: null,
      offTopicSeconds: null,
      unknownSeconds: null,
      note: "Synthetic fixture, no real audio timing measurement.",
    },
  });
}

test("quality fixture preserves original decisions, later condition, corrected date and unattributed tentative offer", () => {
  const snapshot = fixtureSnapshot();
  assert.equal(snapshot.turns.length, 19);
  assert.equal(snapshot.turns.filter((t) => t.speaker === null).length, 1);
  assert.equal(snapshot.elapsedSeconds, 625);
  assert.equal(fixtureSnapshot("useful-tangent").turns.length, 5);
  assert.deepEqual(qualityChecks(exampleReport(), snapshot).findings, []);
});

test("quality review flags realistic hallucinated commitments, stale dates, missed late conditions and inflated timing", () => {
  const report = exampleReport();
  report.actions[0].dueDate = "Friday";
  report.decisions[0].text = "Unconditional full public launch Monday.";
  report.actions.push({
    ...report.actions[0],
    text: "Write customer email",
    owner: "Priya",
  });
  report.actions.push({
    ...report.actions[0],
    text: "Review support checklist",
    owner: "Maya",
  });
  report.focusTime.onTopicSeconds = 700;
  report.speakerTips[0].tips[0].evidence = ["quality:13"];
  const findings = qualityChecks(report, fixtureSnapshot()).findings.join("\n");
  for (const expected of [
    "corrected literal deadline",
    "late accessibility",
    "unsupported owner",
    "Tentative unattributed",
    "exceed",
    "unknown attribution",
  ])
    assert.match(findings, new RegExp(expected));
});

test("quality review rejects nonexistent evidence and runner keeps paid execution behind an explicit gate", () => {
  const report = exampleReport();
  report.actions[0].evidence = ["made-up-turn"];
  assert.throws(
    () => qualityChecks(report, fixtureSnapshot()),
    /missing transcript evidence/,
  );
  const env = { ...process.env };
  delete env.RALLY_QUALITY_APPROVED;
  const offline = spawnSync(process.execPath, ["scripts/astra-quality.ts"], {
    encoding: "utf8",
    env,
  });
  assert.equal(offline.status, 0, offline.stderr);
  assert.match(offline.stdout, /no provider calls/);
  const gated = spawnSync(
    process.execPath,
    ["scripts/astra-quality.ts", "--paid"],
    { encoding: "utf8", env },
  );
  assert.notEqual(gated.status, 0);
  assert.match(gated.stderr, /Explicitly approve/);
});
