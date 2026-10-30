import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.ts";
import { LiveMonitor, type LiveDecision } from "../src/realtime.ts";
import type { Meeting, Snapshot } from "../src/contracts.ts";
import {
  applyAgenda,
  confirmExtension,
  proposeExtension,
} from "../src/live-agenda.ts";
const decision: LiveDecision = {
  health: 4,
  feeling: "curious",
  observation: "Exploring a useful candidate",
  progress: "",
  concern: "",
  evidence: ["s:1"],
  intervention: null,
  agendaChange: null,
  extension: null,
  extensionConsent: null,
};
function setup() {
  const store = new Store(":memory:");
  store.db.prepare("INSERT INTO users VALUES(?,?,?)").run("u", "u", "x");
  const meeting = {
    id: "m",
    userId: "u",
    phase: "live",
    epoch: 1,
    paused: false,
    startedAt: Date.now() - 10000,
    interventions: [],
    revisions: [],
    plan: {
      objective: "Pick top three",
      topics: [
        {
          id: "a",
          title: "Explore",
          outcome: "Choose",
          minutes: 9,
          status: "active",
        },
      ],
      durationMinutes: 10,
      wrapMinutes: 1,
    },
  } as unknown as Meeting;
  store.db
    .prepare("INSERT INTO meetings VALUES(?,?,?)")
    .run("m", "u", JSON.stringify(meeting));
  const monitor = new LiveMonitor(store);
  const snapshot: Snapshot = { meeting, turns: [], elapsedSeconds: 10 };
  return { store, meeting, monitor, snapshot };
}
test("assesses current cumulative speech before finalization without duplication", async () => {
  const { store, meeting, monitor, snapshot } = setup();
  monitor.ingest("m", "s", 1, "Discuss");
  monitor.ingest("m", "s", 1, "Discuss this candidate");
  let applied = false;
  await monitor.check(
    snapshot,
    async (input) => {
      assert.equal(input.partials.length, 1);
      assert.equal(input.partials[0].text, "Discuss this candidate");
      return decision;
    },
    () => meeting,
    () => {},
    () => (applied = true),
  );
  assert.ok(applied);
  monitor.ingest("m", "s", 1, "Final", true);
  monitor.ingest("m", "s", 1, "Late");
  assert.equal(monitor.context(snapshot).partials.length, 0);
  store.close();
});
test("append growth permits current decision but correction rejects it", async () => {
  for (const correction of [false, true]) {
    const { store, meeting, monitor, snapshot } = setup();
    monitor.ingest("m", "s", 1, "We should");
    let resolve!: (v: LiveDecision) => void,
      applied = false;
    const checking = monitor.check(
      snapshot,
      () => new Promise((r) => (resolve = r)),
      () => meeting,
      () => {},
      () => (applied = true),
    );
    monitor.ingest(
      "m",
      "s",
      1,
      correction ? "We should not" : "We should proceed",
    );
    if (correction) monitor.ingest("m", "s", 1, "Actually do not");
    resolve(decision);
    await checking;
    assert.equal(applied, !correction);
    store.close();
  }
});
test("expired checks cannot act and do not block next tick", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const { store, meeting, monitor, snapshot } = setup();
  monitor.ingest("m", "s", 1, "Discuss");
  let resolve!: (v: LiveDecision) => void,
    applied = 0;
  const old = monitor.check(
    snapshot,
    () => new Promise((r) => (resolve = r)),
    () => meeting,
    () => {},
    () => applied++,
  );
  t.mock.timers.tick(10000);
  await monitor.check(
    snapshot,
    async () => decision,
    () => meeting,
    () => {},
    () => applied++,
  );
  resolve(decision);
  await old;
  assert.equal(applied, 1);
  assert.equal(monitor.history("m").items.length, 2);
  store.close();
});
test("extension requires explicit exact proposal consent and is single-use", () => {
  const { store, meeting } = setup();
  proposeExtension(meeting, 5, "Finish decision");
  const p = meeting.extension!;
  p.presentedAt = Date.now();
  assert.throws(
    () =>
      confirmExtension(meeting, p.id, true, {
        id: "s:2",
        revision: 1,
        text: "yes",
        startMs: 20000,
      } as any),
    /Ambiguous/,
  );
  confirmExtension(meeting, p.id, true);
  assert.equal(meeting.plan!.durationMinutes, 15);
  assert.throws(() => confirmExtension(meeting, p.id, true), /no longer/);
  store.close();
});

test("host invalidation drains accounting but cannot publish or apply late decisions", async () => {
  const { store, meeting, monitor, snapshot } = setup();
  monitor.ingest("m", "s", 1, "Discuss");
  let resolve!: (v: LiveDecision) => void,
    signal: AbortSignal | undefined,
    applied = false;
  const events: string[] = [];
  const checking = monitor.check(
    snapshot,
    (_c, s) => {
      signal = s;
      return new Promise((r) => (resolve = r));
    },
    () => meeting,
    (c) => events.push(c.status),
    () => (applied = true),
  );
  monitor.cancel("m");
  assert.equal(signal!.aborted, false);
  resolve(decision);
  await checking;
  assert.equal(applied, false);
  assert.deepEqual(events, ["checking"]);
  await monitor.close();
  store.close();
});

test("a partial-only agenda retirement cannot become canonical state", async () => {
  const { store, meeting, monitor, snapshot } = setup();
  monitor.ingest("m", "s", 1, "Topic is done");
  let applied = false;
  await monitor.check(
    snapshot,
    async () => ({
      ...decision,
      agendaChange: {
        reason: "Done",
        order: null,
        additions: [],
        updates: [{ id: "a", minutes: null, status: "done" }],
        evidence: ["not-in-snapshot"],
      },
    }),
    () => meeting,
    () => {},
    () => (applied = true),
  );
  assert.equal(applied, false);
  store.close();
});

test("newer accepted result wins when manual checks finish in reverse order", async () => {
  const { store, meeting, monitor, snapshot } = setup();
  monitor.ingest("m", "s", 1, "Discuss");
  let resolve!: (d: LiveDecision) => void;
  const applied: number[] = [];
  const old = monitor.check(
    snapshot,
    () => new Promise((r) => (resolve = r)),
    () => meeting,
    () => {},
    (_d, c) => applied.push(c.sequence),
  );
  await monitor.check(
    snapshot,
    async () => decision,
    () => meeting,
    () => {},
    (_d, c) => applied.push(c.sequence),
  );
  resolve(decision);
  await old;
  assert.deepEqual(applied, [2]);
  store.close();
});
test("finalized promotion is compatible but a late partial cannot resurrect it after pause", async () => {
  const { store, meeting, monitor, snapshot } = setup();
  let turns: any[] = [];
  monitor.finalReader = () => turns;
  monitor.ingest("m", "s", 1, "Discuss");
  let resolve!: (d: LiveDecision) => void,
    applied = false;
  const task = monitor.check(
    snapshot,
    () => new Promise((r) => (resolve = r)),
    () => meeting,
    () => {},
    () => (applied = true),
  );
  turns = [{ id: "s:1", revision: 1, text: "Discuss" }];
  monitor.ingest("m", "s", 1, "Discuss", true);
  resolve(decision);
  await task;
  assert.equal(applied, true);
  monitor.cancel("m");
  monitor.ingest("m", "s", 1, "Late changed text");
  assert.equal(monitor.context(snapshot).partials.length, 0);
  store.close();
});
test("parking a partly consumed topic cannot redistribute its spent minutes", () => {
  const { store, meeting } = setup();
  meeting.topicSpentSeconds = { a: 120 };
  assert.throws(
    () =>
      applyAgenda(
        meeting,
        {
          reason: "Park",
          order: null,
          additions: [
            { id: "b", title: "Next", outcome: "Choose", minutes: 9 },
          ],
          updates: [{ id: "a", minutes: null, status: "parked" }],
          evidence: ["s:1"],
        },
        [{ id: "s:1" } as any],
      ),
    /budgets/,
  );
  applyAgenda(
    meeting,
    {
      reason: "Park",
      order: null,
      additions: [{ id: "b", title: "Next", outcome: "Choose", minutes: 7 }],
      updates: [{ id: "a", minutes: null, status: "parked" }],
      evidence: ["s:1"],
    },
    [{ id: "s:1" } as any],
  );
  assert.equal(meeting.plan!.retiredMinutes, 2);
  store.close();
});

test("a finalized ID omitted from bounded input cannot authorize a decision", async () => {
  const { store, meeting, monitor, snapshot } = setup();
  snapshot.turns = Array.from({ length: 21 }, (_, i) => ({
    id: "s:" + i,
    sessionId: "s",
    turnId: i,
    revision: 1,
    text: "Text",
    speaker: null,
    startMs: null,
    endMs: null,
  }));
  monitor.finalReader = () => snapshot.turns;
  let applied = false;
  await monitor.check(
    snapshot,
    async () => ({ ...decision, evidence: ["s:0"] }),
    () => meeting,
    () => {},
    () => (applied = true),
  );
  assert.equal(applied, false);
  store.close();
});

test("disputed extra time cannot authorize agenda changes or post-end reconfirmation", () => {
  const { store, meeting } = setup();
  proposeExtension(meeting, 5, "Finish");
  confirmExtension(meeting, meeting.extension!.id, true);
  meeting.extension!.state = "disputed";
  assert.throws(
    () =>
      applyAgenda(
        meeting,
        {
          reason: "Use extra time",
          order: null,
          additions: [],
          updates: [],
          evidence: [],
        },
        [],
      ),
    /disputed/,
  );
  meeting.phase = "ended";
  assert.throws(
    () => confirmExtension(meeting, meeting.extension!.id, true),
    /no longer/,
  );
  store.close();
});

test("presence evidence is validated and identical partial-to-final content keeps the same actuation key", async () => {
  const { store, meeting, monitor, snapshot } = setup();
  const text = "We have returned to launch scope.";
  monitor.ingest("m", "s", 1, text);
  const affect = {
    forces: {
      joy: 0.2,
      curiosity: null,
      worry: -0.2,
      irritation: -0.2,
      sadness: null,
      confidence: null,
      energy: null,
      sass: null,
    },
    evidence: ["s:1"],
    rationale: "Recovery",
  };
  const keys: string[] = [];
  const apply = (_d: LiveDecision, c: any) => keys.push(c.affectEvidenceKey);
  await monitor.check(
    snapshot,
    async () => ({ ...decision, affect }),
    () => meeting,
    () => {},
    apply,
  );
  const turn = {
    id: "s:1",
    text,
    revision: 1,
    sessionId: "s",
    speakerId: "s:A",
    startMs: 0,
    endMs: 1000,
  } as any;
  snapshot.turns = [turn];
  monitor.finalReader = () => snapshot.turns;
  monitor.ingest("m", "s", 1, text, true);
  await monitor.check(
    snapshot,
    async () => ({ ...decision, affect }),
    () => meeting,
    () => {},
    apply,
  );
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
  await monitor.check(
    snapshot,
    async () => ({
      ...decision,
      affect: { ...affect, evidence: ["unsupplied"] },
    }),
    () => meeting,
    () => {},
    apply,
  );
  assert.equal(keys.length, 2);
  store.close();
});
test("live context retains complete bounded finalized turns and invalidates nested focus evidence", async () => {
  const { store, meeting, monitor, snapshot } = setup();
  const text = "Do not approve this. " + "Important context. ".repeat(150);
  snapshot.turns = [
    { id: "s:1", text, revision: 1 },
    { id: "s:2", text: "Other", revision: 1 },
  ] as any;
  monitor.finalReader = () => snapshot.turns;
  assert.equal(monitor.context(snapshot).finals[0].text, text);
  await monitor.check(
    snapshot,
    async () => ({
      ...decision,
      evidence: ["s:2"],
      focus: {
        intendedTopicId: "a",
        detour: "Side discussion",
        evidence: ["s:1"],
      },
    }),
    () => meeting,
    () => {},
    () => {},
  );
  snapshot.turns[0] = { ...snapshot.turns[0], revision: 2, text: "Correction" };
  assert.equal(monitor.context(snapshot).previous, null);
  store.close();
});
