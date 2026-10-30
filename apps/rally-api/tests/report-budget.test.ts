import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.ts";
import { defaults } from "../src/config.ts";
import { createMuse, modelSettings } from "../src/muse.ts";
import { LiveMonitor } from "../src/realtime.ts";
import { reportContext } from "../src/report-context.ts";
import { categories, type Meeting, type Turn } from "../src/contracts.ts";

function fixture(t: TestContext, long = true) {
  const store = new Store(":memory:");
  t.after(() => store.close());
  store.db
    .prepare("INSERT INTO users VALUES(?,?,?)")
    .run("host", "host", "fixture");
  const plan = {
    objective: "Agree the launch scope, owners, and customer communication",
    durationMinutes: 30,
    wrapMinutes: 2,
    topics: [
      {
        id: "scope",
        title: "Launch scope",
        outcome: "Choose the release boundary",
        minutes: 14,
        status: "active" as const,
      },
      {
        id: "owners",
        title: "Owners",
        outcome: "Assign owners and communication",
        minutes: 14,
        status: "pending" as const,
      },
    ],
  };
  const meeting: Meeting = {
    id: "meeting",
    userId: "host",
    title: "Launch review",
    agenda: "Scope, owners, customer communication",
    participants: ["Alice", "Bob"],
    durationMinutes: 30,
    createdAt: 1000,
    phase: "live",
    plan,
    originalPlan: structuredClone(plan),
    revisions: [],
    startedAt: 1000,
    endedAt: 121000,
    paused: false,
    epoch: 1,
    progress: "LIVE-HYPOTHESIS-EXCLUDED",
    speakerNames: {},
    assessment: null,
    interventions: [
      {
        id: "i",
        at: 50000,
        text: "Return to the launch scope",
        kind: "redirect",
      },
    ],
    report: null,
    reportStatus: "none",
    gaps: [{ at: 30000, reason: "Brief input interruption" }],
    error: null,
  };
  store.db
    .prepare("INSERT INTO meetings VALUES(?,?,?)")
    .run(meeting.id, meeting.userId, JSON.stringify(meeting));
  const turns: Turn[] = Array.from({ length: long ? 40 : 2 }, (_, i) => ({
    id: `s:${i}`,
    sessionId: "s",
    turnId: i,
    sourceOrder: i,
    revision: 1,
    text:
      `Evidence ${i}: ` +
      (long
        ? 'Release details with quoted "text" and Unicode café. '.repeat(120)
        : "Agree the scope."),
    speaker: "s:A",
    startMs: i * 2000,
    endMs: i * 2000 + 1500,
  }));
  for (const turn of turns)
    store.db
      .prepare("INSERT INTO turns VALUES(?,?,?)")
      .run(meeting.id, turn.id, JSON.stringify(turn));
  const monitor = new LiveMonitor(store);
  const context = monitor.context({
    meeting,
    turns: turns.slice(-1),
    elapsedSeconds: 120,
  });
  const settings = modelSettings(
    JSON.stringify({
      reasoning: { rates: { input: 1.25, cachedInput: 0, output: 4.25 } },
    }),
  );
  const requests: string[] = [];
  const fetch: typeof globalThis.fetch = async (_url, init) => {
    const encoded = String(init?.body);
    requests.push(encoded);
    const request = JSON.parse(encoded);
    const result =
      request.response_format.json_schema.name === "rally_report"
        ? {
            summary: "Launch scope remains under discussion.",
            decisions: [],
            actions: [],
            unresolved: [],
            scores: categories.map((category) => ({
              category,
              score: null,
              reason: "Insufficient evidence",
              evidence: [],
            })),
            speakerTips: [],
            focusTime: {
              onTopicSeconds: null,
              offTopicSeconds: null,
              unknownSeconds: 120,
              note: "Unknown",
            },
          }
        : {
            health: 4,
            feeling: "curious",
            observation: "Discussing scope",
            progress: "Scope under discussion",
            concern: "",
            evidence: [turns.at(-1)!.id],
            intervention: null,
            agendaChange: null,
            extension: null,
            extensionConsent: null,
            affect: null,
            focus: null,
            concerns: null,
          };
    return new Response(
      JSON.stringify({
        usage: {
          prompt_tokens: 100,
          completion_tokens: 10,
          prompt_tokens_details: { cached_tokens: 100 },
        },
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(result) },
          },
        ],
      }),
    );
  };
  const cost = (encoded: string) =>
    (Buffer.byteLength(encoded) * settings.reasoning.rates.input +
      JSON.parse(encoded).max_tokens * settings.reasoning.rates.output) /
    1e6;
  return { store, meeting, turns, context, settings, requests, fetch, cost };
}

test("forecast covers exact live/cache-reference and full canonical report requests at configured cadence", async (t) => {
  const f = fixture(t);
  const config = {
    ...defaults,
    paidEnabled: true,
    reportReserve: 0.01,
    assessmentMs: 7000,
    meetingBudget: 10,
    buildBudget: 20,
  };
  const muse = createMuse(f.store, config, {
    key: "fixture",
    settings: f.settings,
    fetch: f.fetch,
  });
  const forecast = muse.forecastLive!(f.context, f.meeting);
  await muse.checkLive!(f.context, f.meeting, new AbortController().signal);
  await muse.report(
    reportContext({ meeting: f.meeting, turns: f.turns, elapsedSeconds: 120 }),
  );
  assert.equal(forecast.estimatedCheckCost, f.cost(f.requests[0]));
  assert.equal(forecast.reportReserve, f.cost(f.requests[1]));
  assert.ok(forecast.reportReserve > config.reportReserve);
  assert.equal(
    forecast.checksRemaining,
    Math.ceil((f.context.meeting.remainingSeconds * 1000) / 7000),
  );
  assert.equal(
    forecast.estimatedRemainingCost,
    forecast.checksRemaining * forecast.estimatedCheckCost +
      (f.context.meeting.remainingSeconds *
        f.settings.transcription.usdPerAudioHour) /
        3600 +
      forecast.reportReserve,
  );
  const live = JSON.parse(f.requests[0]);
  assert.deepEqual(JSON.parse(live.messages[1].content).plan, f.meeting.plan);
  assert.equal(JSON.parse(live.messages[2].content).finals.length, 1);
  const report = JSON.parse(JSON.parse(f.requests[1]).messages[1].content);
  assert.equal(report.turns.length, 40);
  assert.equal(report.meeting.progress, "");
  assert.equal(report.meeting.interventions.length, 1);
});

test("report reserve keeps its configured floor and reflects stored updates beyond live context", (t) => {
  const f = fixture(t, false);
  const floor = 0.25;
  const muse = createMuse(
    f.store,
    { ...defaults, reportReserve: floor },
    { settings: f.settings, fetch: f.fetch },
  );
  assert.equal(muse.forecastLive!(f.context, f.meeting).reportReserve, floor);
  const stored = {
    ...f.meeting,
    revisions: Array.from({ length: 100 }, (_, i) => ({
      at: i * 1000,
      reason: "A recorded agenda revision with its supporting context. ".repeat(
        15,
      ),
      plan: f.meeting.plan!,
    })),
  };
  f.store.db
    .prepare("UPDATE meetings SET body=? WHERE id=?")
    .run(JSON.stringify(stored), f.meeting.id);
  assert.ok(muse.forecastLive!(f.context, f.meeting).reportReserve > floor);
  assert.equal(f.requests.length, 0);
});

test("live preflight preserves dynamic report headroom in both meeting and build budgets", async (t) => {
  const f = fixture(t);
  const config = {
    ...defaults,
    paidEnabled: true,
    reportReserve: 0.01,
    meetingBudget: 10,
    buildBudget: 10,
  };
  const forecast = createMuse(f.store, config, { settings: f.settings })
    .forecastLive!(f.context, f.meeting);
  // This would admit a live check with the former fixed reserve, but would leave
  // insufficient room for the complete canonical report.
  const insufficient =
    forecast.estimatedCheckCost + config.reportReserve + 0.001;
  assert.ok(
    insufficient < forecast.estimatedCheckCost + forecast.reportReserve,
  );
  for (const limit of ["meetingBudget", "buildBudget"] as const) {
    const muse = createMuse(
      f.store,
      { ...config, [limit]: insufficient },
      { key: "fixture", settings: f.settings, fetch: f.fetch },
    );
    await assert.rejects(
      muse.checkLive!(f.context, f.meeting, new AbortController().signal),
      /Configured API budget exceeded/,
    );
  }
  assert.equal(f.requests.length, 0);
  assert.equal(
    (
      f.store.db.prepare("SELECT COUNT(*) AS n FROM usage").get() as {
        n: number;
      }
    ).n,
    0,
  );
});
