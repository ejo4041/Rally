// Explicit paid calibration. Never run by npm test; maximum cumulative budget $3.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Store } from "../src/store.ts";
import { createMuse } from "../src/muse.ts";
import { loadEnvironment, defaults } from "../src/config.ts";
import { validateEvidence } from "../src/engine.ts";
import {
  actuate,
  initialPresence,
} from "../../../packages/rally-presence/state.ts";
import type { Meeting, Turn } from "../src/contracts.ts";
if (process.env.RALLY_PRESENCE_CALIBRATION_APPROVED !== "1")
  throw new Error("Explicit paid calibration authorization required");
loadEnvironment();
const directory = resolve("test-results/presence-calibration");
mkdirSync(directory, { recursive: true });
const store = new Store(resolve(directory, "usage.sqlite"));
const provider = createMuse(store, {
  ...defaults,
  paidEnabled: true,
  buildBudget: 3,
  meetingBudget: 3,
});
const cases = [
  "Alex: Our goal is to decide the launch scope. The login fix is tested and ready. Sam: Agreed, let us decide whether export belongs in this release.",
  "Sam: Quick tangent, did anyone see the new phone announcement? Alex: We have ten minutes left for the scope decision.",
  "Sam: The camera specs are fascinating. Let me compare three phones and the holiday deals. Alex: We still need the export decision. Sam: Wait, I have more phone comparisons.",
  "Alex: Let us park the phones and return to release scope. Sam: Yes, sorry. Export can ship next week; login is ready now.",
  "Alex: Agreed, login only this release. Pat owns export next week. Sam: Confirmed. We are back on the agenda.",
  "Sam: Actually stop, forget launch scope. I am going to spend the rest of this meeting on phone deals. Alex: We just agreed to return to scope, and we have two minutes to confirm owners. Sam: No, phone deals first.",
];
const repair = process.env.RALLY_PRESENCE_CALIBRATION_REPAIR === "1";
const file = resolve(directory, repair ? "repair-state.json" : "state.json");
const initial: Meeting = {
  id: "presence-calibration",
  userId: "synthetic",
  title: "Launch decision",
  agenda: "Decide launch scope, confirm owners",
  participants: [],
  durationMinutes: 15,
  createdAt: Date.now(),
  phase: "live",
  plan: {
    objective: "Decide launch scope and owners",
    topics: [
      {
        id: "scope",
        title: "Launch scope",
        outcome: "Decide included work",
        minutes: 10,
        status: "active",
      },
      {
        id: "owners",
        title: "Owners",
        outcome: "Confirm responsibility",
        minutes: 3,
        status: "pending",
      },
    ],
    durationMinutes: 15,
    wrapMinutes: 2,
  },
  originalPlan: null,
  revisions: [],
  startedAt: Date.now() - 5 * 60000,
  endedAt: null,
  paused: false,
  epoch: 1,
  progress: "Launch scope is under discussion",
  speakerNames: {},
  assessment: null,
  presence: initialPresence(Date.now()),
  interventions: [],
  reportStatus: "none",
  report: null,
  error: null,
  gaps: [],
};
let state: {
  meeting: Meeting;
  turns: Turn[];
  results: unknown[];
  index: number;
} = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : { meeting: initial, turns: [], results: [], index: 0 };
if (repair && !existsSync(file)) {
  const previous = JSON.parse(
    readFileSync(resolve(directory, "state.json"), "utf8"),
  );
  state = {
    meeting: {
      ...previous.meeting,
      assessment: previous.results[3].result,
      progress: previous.results[3].result.progress,
      presence: initialPresence(Date.now()),
      concerns: [],
    },
    turns: previous.turns.slice(0, 4),
    index: 4,
    results: [],
  };
  for (const axis of ["worry", "irritation"] as const)
    state.meeting.presence!.channels[axis] = {
      value: 5,
      velocity: 0,
      anchor: 20,
      target: 5,
      force: -0.15,
      at: Date.now(),
      expires: Date.now(),
      omega: 1,
    };
}
const count = Math.min(
  6,
  Math.max(1, Number(process.env.RALLY_PRESENCE_CALIBRATION_COUNT || 1)),
);
let failure: null | string = null;
try {
  for (let n = 0; n < count && state.index < cases.length; n++) {
    const i = state.index;
    const turn: Turn = {
      id: `scenario:${i}`,
      sessionId: "scenario",
      turnId: i,
      revision: 1,
      text: cases[i],
      speaker: null,
      startMs: (300 + i * 10) * 1000,
      endMs: (310 + i * 10) * 1000,
    };
    state.turns.push(turn);
    const start = Date.now();
    const result = await provider.assess({
      meeting: state.meeting,
      turns: state.turns,
      elapsedSeconds: 310 + i * 10,
    });
    validateEvidence(result, state.turns);
    if (result.affect?.evidence.length)
      state.meeting.presence = actuate(
        state.meeting.presence!,
        result.affect.forces as Parameters<typeof actuate>[1],
        result.affect.evidence
          .map((id) => id + "@1")
          .sort()
          .join("|"),
        Date.now(),
      );
    state.meeting.assessment = result;
    state.meeting.progress = result.progress;
    if (result.concerns) {
      const memory = new Map(
        (state.meeting.concerns ?? []).map((c) => [c.id, c]),
      );
      for (const c of result.concerns)
        memory.set(c.id, {
          ...c,
          updatedAt: Date.now(),
          revisions: Object.fromEntries(c.evidence.map((id) => [id, 1])),
        });
      state.meeting.concerns = [...memory.values()];
    }
    state.results.push({
      scenario: i,
      input: turn.text,
      latencyMs: Date.now() - start,
      result,
      rejected: state.meeting.presence?.rejected,
    });
    state.index++;
    writeFileSync(file, JSON.stringify(state, null, 2));
    if (n < count - 1) await new Promise((r) => setTimeout(r, 10000));
  }
} catch (e) {
  failure = e instanceof Error ? e.message : String(e);
  process.exitCode = 1;
}
const rows = store.db
  .prepare("SELECT body,status,cost,estimate FROM usage")
  .all();
writeFileSync(resolve(directory, "usage.json"), JSON.stringify(rows, null, 2));
console.log(
  JSON.stringify(
    {
      completed: state.index,
      failure,
      knownUSD: rows.reduce((total, row) => total + Number(row.cost ?? 0), 0),
      unknown: rows.filter((row) => row.status !== "known").length,
      results: state.results,
    },
    null,
    2,
  ),
);
store.close();
