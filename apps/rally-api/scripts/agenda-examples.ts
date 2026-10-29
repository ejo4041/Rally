// Actual paid agenda examples; never included in npm test.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createApplication } from "../src/app.ts";
import { loadEnvironment, environmentConfig } from "../src/config.ts";
loadEnvironment();
if (process.env.RALLY_EXAMPLES_APPROVED !== "1")
  throw new Error(
    "Explicitly enable this capped $0.15 paid batch with RALLY_EXAMPLES_APPROVED=1",
  );
const allCases = JSON.parse(
  readFileSync(
    new URL("./fixtures/agenda-examples.json", import.meta.url),
    "utf8",
  ),
);
const cases = process.env.RALLY_EXAMPLE_TITLE
  ? allCases.filter(
      (c: { title: string }) => c.title === process.env.RALLY_EXAMPLE_TITLE,
    )
  : allCases;
const run = randomUUID(),
  dir = resolve(`test-results/agendas-${run}`);
mkdirSync(dir, { recursive: true });
const api = createApplication({
  ...environmentConfig(),
  paidEnabled: true,
  dbPath: resolve(dir, "usage.sqlite"),
  buildBudget: 0.15,
  meetingBudget: 0.05,
});
const server = api.app.listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
let cookie = "";
const request = (path: string, method = "GET", body?: unknown) =>
  fetch(base + path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
const results = [];
let failure: string | null = null;
try {
  cookie = (
    await request("/auth/signup", "POST", {
      username: "examples",
      password: randomUUID(),
    })
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  for (const input of cases) {
    const started = Date.now();
    const response = await request("/meetings", "POST", input);
    const meeting = await response.json();
    results.push({
      input,
      elapsedMs: Date.now() - started,
      status: response.status,
      phase: meeting.phase,
      error: meeting.error,
      plan: meeting.plan,
    });
    if (meeting.phase !== "ready")
      throw new Error(meeting.error || "Agenda failed");
  }
} catch (e) {
  failure = String(e);
  process.exitCode = 1;
} finally {
  const usage = await (await request("/usage")).json();
  const summary = {
    run,
    at: new Date().toISOString(),
    failure,
    results,
    batchCost: usage.reduce(
      (s: number, r: { cost: number | null }) => s + (r.cost || 0),
      0,
    ),
    unknown: usage.filter((r: { status: string }) => r.status !== "known")
      .length,
    usage,
  };
  writeFileSync(resolve(dir, "results.json"), JSON.stringify(summary, null, 2));
  console.log(
    JSON.stringify({
      path: dir,
      batchCost: summary.batchCost,
      unknown: summary.unknown,
      failure,
    }),
  );
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await api.close();
}
