// Explicit single-stage retry of a saved synthetic text evaluation, not automatic recovery.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Engine } from "../src/engine.ts";
import { Meetings } from "../src/meetings.ts";
import { Store } from "../src/store.ts";
import { defaults, loadEnvironment } from "../src/config.ts";
import { createMuse, modelSettings } from "../src/muse.ts";
import { qualityChecks } from "./astra-quality-checks.ts";
import type { Snapshot, Meeting } from "../src/contracts.ts";
if (process.env.RALLY_QUALITY_APPROVED !== "1")
  throw new Error("Explicit approval required for report-only retry");
loadEnvironment();
const dir = resolve(process.argv[2]);
const input: Snapshot = JSON.parse(
  readFileSync(resolve(dir, "report-input.json"), "utf8"),
);
const saved: Meeting = JSON.parse(
  readFileSync(resolve(dir, "meeting.json"), "utf8"),
);
const usageStore = new Store(resolve(".data/astra-quality-usage.sqlite"));
const previous = Number(
  usageStore.db
    .prepare("SELECT coalesce(sum(cost),0) AS total FROM usage")
    .get()!.total,
);
const before = new Set(
  (usageStore.db.prepare("SELECT id FROM usage").all() as { id: string }[]).map(
    (r) => r.id,
  ),
);
const config = {
  ...defaults,
  paidEnabled: true,
  buildBudget: previous + 0.2,
  meetingBudget: previous + 0.2,
};
const settings = modelSettings();
const muse = createMuse(usageStore, config, { settings });
const meetingStore = new Store(resolve(dir, "meetings.sqlite"));
const meetings = new Meetings(meetingStore, {
  ...muse,
  report: () => muse.report(input),
});
const engine = new Engine(
  meetings,
  {
    open: async () => {
      throw new Error("Retry never opens media");
    },
  },
  config,
);
let failure: string | null = null;
try {
  engine.launchReport(meetings.get(saved.id));
  await Promise.all(engine.reports.values());
  const result = { ...meetings.get(saved.id), turns: meetings.turns(saved.id) };
  writeFileSync(
    resolve(dir, "meeting-retry.json"),
    JSON.stringify(result, null, 2),
  );
  if (result.reportStatus !== "ready")
    throw new Error(result.error || "Report failed");
  const review = qualityChecks(result.report, input);
  writeFileSync(resolve(dir, "review.json"), JSON.stringify(review, null, 2));
  console.log(JSON.stringify({ reportStatus: result.reportStatus, review }));
} catch (e) {
  failure = String(e);
  console.error(failure);
  process.exitCode = 1;
} finally {
  await engine.close();
  meetingStore.close();
  const usage = usageStore.db
    .prepare("SELECT id,status,cost,estimate,body FROM usage")
    .all()
    .filter((r) => !before.has(String(r.id)))
    .map((r) => ({
      ...JSON.parse(String(r.body)),
      status: r.status,
      cost: r.cost,
      reserved: r.estimate,
    }));
  const summary = {
    at: new Date().toISOString(),
    run: `report-retry-${Date.now()}`,
    failure,
    settings,
    batchCost: usage.reduce((s, r) => s + (r.cost || 0), 0),
    unknown: usage.filter((r) => r.status !== "known").length,
    usage,
  };
  writeFileSync(
    resolve(dir, "usage-retry.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(
    JSON.stringify({
      path: dir,
      batchCost: summary.batchCost,
      unknown: summary.unknown,
    }),
  );
  usageStore.close();
}
