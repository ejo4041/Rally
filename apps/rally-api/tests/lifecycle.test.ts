import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../src/app.ts";
import { categories } from "../src/contracts.ts";
import type {
  Providers,
  Media,
  TranscriptEvent,
  Snapshot,
} from "../src/contracts.ts";

test("a live meeting saves speaker turns, accepts autonomous plan changes and reports on the whole transcript", async (t) => {
  let event: (e: TranscriptEvent) => void = () => {};
  let reportInput: Snapshot | undefined;
  const plan = {
    objective: "Choose launch date",
    topics: [
      {
        id: "launch",
        title: "Launch",
        outcome: "Agree date",
        minutes: 8,
        status: "pending" as const,
      },
    ],
    durationMinutes: 10,
    wrapMinutes: 2,
  };
  const providers: Providers = {
    prepare: async () => plan,
    openASR: async (_m, c) => {
      event = c.onEvent;
      return {
        sessionId: "speech",
        send() {},
        async end() {},
        close() {},
        sentSeconds: 0,
        processedMs: 0,
      };
    },
    assess: async (s) => ({
      health: 2,
      reason: "Launch details need more time",
      issues: ["pacing"],
      evidence: [s.turns[0].id],
      progress: "Discussing launch",
      intervention: {
        text: "Let us settle the date.",
        kind: "checkpoint",
        evidence: [s.turns[0].id],
      },
      plan: {
        ...plan,
        durationMinutes: 12,
        topics: [{ ...plan.topics[0], minutes: 10 }],
      },
      planReason: "Allow two more minutes for the decision",
    }),
    report: async (s) => {
      reportInput = s;
      return {
        summary: "Launch discussed.",
        decisions: [],
        actions: [
          {
            text: "Prepare release",
            owner: null,
            dueDate: null,
            status: "proposal",
            evidence: [s.turns[24].id],
            followup: "ticket",
            followupPrompt: "Create a release preparation task",
          },
        ],
        unresolved: ["Owner needed"],
        scores: categories.map((category) => ({
          category,
          score: 4,
          reason: "Useful discussion",
          evidence: [s.turns[0].id],
        })),
        speakerTips: [
          {
            speakerId: "speech:A",
            tips: [
              {
                text: "State the proposed date first.",
                evidence: [s.turns[0].id],
              },
            ],
          },
        ],
        focusTime: {
          onTopicSeconds: null,
          offTopicSeconds: null,
          unknownSeconds: null,
          note: "Not enough timing evidence",
        },
      };
    },
  };
  let corruption = "";
  const originalReport = providers.report;
  providers.report = async (snapshot) => {
    const result = await originalReport(snapshot);
    if (corruption === "duplicate")
      result.speakerTips.push(structuredClone(result.speakerTips[0]));
    if (corruption === "wrong-speaker")
      result.speakerTips[0].tips[0].evidence = [snapshot.turns[24].id];
    if (corruption === "empty-outcome") result.actions[0].evidence = [];
    if (corruption === "empty-score") result.scores[0].evidence = [];
    return result;
  };
  const media: Media = {
    open: async () => ({
      connection: async () => ({
        url: "ws://fixture",
        token: "fixture",
        room: "fixture",
      }),
      send: async () => {},
      close: async () => {},
    }),
  };
  const api = createApplication({
    dbPath: ":memory:",
    providers,
    media,
    assessmentMs: 100000,
  });
  const server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await api.close();
  });
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  let cookie = "";
  const request = async (path: string, method = "GET", body?: unknown) =>
    fetch(url + path, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  const signup = await request("/auth/signup", "POST", {
    username: "alice",
    password: "demo-password",
  });
  cookie = signup.headers.get("set-cookie")!.split(";")[0];
  const meeting = await (
    await request("/meetings", "POST", {
      agenda: "Choose launch date",
      durationMinutes: 10,
    })
  ).json();
  const path = `/meetings/${meeting.id}`;
  assert.equal(
    (await request(`${path}/start`, "POST", { consented: false })).status,
    400,
  );
  assert.equal(
    (await request(`${path}/start`, "POST", { consented: true })).status,
    200,
  );
  event({ type: "partial", text: "not evidence" });
  for (let n = 0; n < 25; n++)
    event({
      type: "final",
      sessionId: "speech",
      turnId: n,
      text: `Discussion ${n}`,
      speaker: n === 24 ? "B" : "A",
      startMs: n * 1000,
      endMs: n * 1000 + 900,
    });
  let saved = await (await request(path)).json();
  assert.equal(saved.turns.length, 25);
  assert.equal(saved.turns[0].speaker, "speech:A");
  assert.equal(
    (await request(`${path}/commands`, "POST", { type: "request_guidance" }))
      .status,
    200,
  );
  saved = await (await request(path)).json();
  assert.equal(saved.plan.durationMinutes, 12);
  assert.equal(saved.originalPlan.durationMinutes, 10);
  assert.equal(saved.interventions.length, 1);
  assert.equal((await request(`${path}/end`, "POST")).status, 202);
  for (let n = 0; n < 50; n++) {
    saved = await (await request(path)).json();
    if (saved.reportStatus === "ready") break;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(saved.reportStatus, "ready");
  assert.equal(reportInput?.turns.length, 25);
  assert.equal(saved.report.overall, 4);
  assert.equal(saved.report.coverage, 5);
  assert.equal(saved.report.actions[0].status, "proposal");
  assert.equal((await request(`${path}/export`)).status, 200);
  for (const mode of [
    "duplicate",
    "wrong-speaker",
    "empty-outcome",
    "empty-score",
  ]) {
    corruption = mode;
    assert.equal((await request(`${path}/report/retry`, "POST")).status, 202);
    for (let n = 0; n < 50; n++) {
      saved = await (await request(path)).json();
      if (saved.reportStatus !== "processing") break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(saved.reportStatus, "failed", mode);
  }
});
