// Bounded synthetic cache/latency experiment; never reads real meeting content.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { Store } from "../src/store.ts";
import { createMuse, modelSettings } from "../src/muse.ts";
import { defaults } from "../src/config.ts";
import { LiveMonitor } from "../src/realtime.ts";
import type { Meeting, Turn } from "../src/contracts.ts";
if (process.env.RALLY_PRESENCE_CALIBRATION_APPROVED !== "1")
  throw Error("Explicit authorization required; maximum $0.15");
const dir = new URL("../test-results/presence-cache/", import.meta.url);
mkdirSync(dir, { recursive: true });
const output = new URL("result.json", dir);
if (existsSync(output) || existsSync(new URL("usage.sqlite", dir)))
  throw Error("Existing experiment; audit before repeat");
const env = parseEnv(
  readFileSync("/srv/hackathon/rally-deployed/config/api.env", "utf8"),
);
const store = new Store(new URL("usage.sqlite", dir).pathname);
const settings = modelSettings();
// This experiment never produces a report. Keep its hypothetical reserve small.
settings.report.maxOutputTokens = 1024;
const muse = createMuse(
  store,
  {
    ...defaults,
    paidEnabled: true,
    reportReserve: 0,
    meetingBudget: 0.15,
    buildBudget: 0.15,
  },
  { key: env.MODEL_API_KEY, settings },
);
const monitor = new LiveMonitor(store);
const meeting = {
  id: "synthetic-cache",
  userId: "benchmark",
  startedAt: Date.now() - 300000,
  durationMinutes: 60,
  interventions: [],
  phase: "live",
  epoch: 1,
  paused: false,
  plan: {
    objective: "Choose launch scope and validation owners",
    durationMinutes: 60,
    wrapMinutes: 5,
    topics: [
      {
        id: "scope",
        title: "Launch scope",
        outcome: "Agree required launch features",
        minutes: 30,
        status: "active",
      },
      {
        id: "owners",
        title: "Validation owners",
        outcome: "Assign validation owners and deadlines",
        minutes: 25,
        status: "pending",
      },
    ],
  },
} as unknown as Meeting;
meeting.originalPlan = structuredClone(meeting.plan);
const turns: Turn[] = Array.from({ length: 16 }, (_, i) => ({
  id: `s:${i}`,
  sessionId: "s",
  turnId: i,
  revision: 1,
  text: `Discussion point ${i + 1}: We are reviewing launch scope. The retry correction is required, but the analytics dashboard can wait. We still need agreement on validation coverage and an owner before confirming the date. This is a proposal, not a final agreement.`,
  speaker: null,
  startMs: i * 15000,
  endMs: (i + 1) * 15000,
}));
const results: unknown[] = [];
try {
  for (let i = 0; i < 3; i++) {
    if (i)
      turns.push({
        ...turns[0],
        id: `s:${15 + i}`,
        turnId: 15 + i,
        text:
          i === 1
            ? "Let us keep the retry correction in scope and ask who can validate it."
            : "I can validate retry behavior tomorrow. The launch date is still undecided.",
      });
    const context = monitor.context({
      meeting,
      turns,
      elapsedSeconds: 300 + i * 10,
    });
    const at = performance.now();
    try {
      const decision = await muse.checkLive!(
        context,
        meeting,
        new AbortController().signal,
      );
      results.push({
        sample: i,
        valid: true,
        latencyMs: performance.now() - at,
        eligible: performance.now() - at <= 8000,
        decision,
      });
    } catch (e) {
      results.push({
        sample: i,
        valid: false,
        latencyMs: performance.now() - at,
        error: String(e),
      });
      break;
    }
  }
} finally {
  const usage = (
    store.db.prepare("SELECT body FROM usage").all() as { body: string }[]
  ).map((r) => JSON.parse(r.body));
  const report = {
    at: new Date().toISOString(),
    scope:
      "Three synthetic append-only bounded transcript requests; no remote call or real participant data",
    results,
    usage,
    knownCost: usage.reduce((n, r) => n + (r.cost ?? 0), 0),
    unknown: usage.filter((r) => r.status !== "known").length,
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  writeFileSync(
    new URL(
      "../../../docs/research/living-presence-cache-benchmark.json",
      import.meta.url,
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      results: results.map((r: any) => ({
        sample: r.sample,
        valid: r.valid,
        latencyMs: r.latencyMs,
        eligible: r.eligible,
        error: r.error,
      })),
      knownCost: report.knownCost,
      unknown: report.unknown,
      usage: usage.map((r) => r.usage),
    }),
  );
  await monitor.close();
  store.close();
}
