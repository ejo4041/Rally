// Text-only quality experiment. Default execution is offline and never loads credentials.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fixtureAgenda,
  fixtureSnapshot,
  fixtureTurns,
} from "../tests/fixtures/astra-meeting.ts";
import { qualityChecks } from "./astra-quality-checks.ts";
import type { Snapshot, TranscriptEvent } from "../src/contracts.ts";

const paid = process.argv.includes("--paid");
if (!paid) {
  console.log(
    JSON.stringify(
      {
        mode: "offline; no provider calls",
        agenda: fixtureAgenda,
        cases: ["useful-tangent", "drift", "wrapup", "report"].map((stage) => {
          const s = fixtureSnapshot(
            stage as Parameters<typeof fixtureSnapshot>[0],
          );
          return {
            stage,
            elapsedSeconds: s.elapsedSeconds,
            turns: s.turns.length,
          };
        }),
        next: "Paid text-only run requires --paid and RALLY_QUALITY_APPROVED=1 after budget reconciliation. No automatic retry.",
      },
      null,
      2,
    ),
  );
} else {
  if (process.env.RALLY_QUALITY_APPROVED !== "1")
    throw new Error(
      "Explicitly approve this text-only batch with RALLY_QUALITY_APPROVED=1; estimated cap $0.25.",
    );
  const { createApplication } = await import("../src/app.ts");
  const { defaults, loadEnvironment } = await import("../src/config.ts");
  const { createMuse, modelSettings, UsageLedger } = await import(
    "../src/muse.ts"
  );
  const { Store } = await import("../src/store.ts");
  loadEnvironment();
  const run = randomUUID(),
    dir = resolve(`test-results/astra-quality-${run}`);
  mkdirSync(dir, { recursive: true });
  // Reusing this ledger prevents a new run from silently bypassing unknown charges or the batch cap.
  const usageStore = new Store(resolve(".data/astra-quality-usage.sqlite"));
  const config = {
    ...defaults,
    paidEnabled: true,
    buildBudget: 0.25,
    meetingBudget: 0.25,
  };
  new UsageLedger(usageStore, config).check("preflight", 0);
  const settings = modelSettings();
  const muse = createMuse(usageStore, config, { settings });
  let emit: (e: TranscriptEvent) => void = () => {};
  let paidCalls = 0;
  const modelInput = (snapshot: Snapshot, stage: "drift" | "report") => {
    const timeline = fixtureSnapshot(stage);
    const input: Snapshot = {
      ...snapshot,
      elapsedSeconds: timeline.elapsedSeconds,
      meeting: {
        ...snapshot.meeting,
        startedAt: timeline.meeting.startedAt,
        endedAt: timeline.meeting.endedAt,
        speakerNames: timeline.meeting.speakerNames,
        revisions: snapshot.meeting.revisions.map(revision=>({...revision,at:timeline.meeting.startedAt!+325000})),
        // Only one intervention is requested, at synthetic second 325. This is a controlled clock.
        interventions: snapshot.meeting.interventions.map((i) => ({
          ...i,
          at: timeline.meeting.startedAt! + 325000,
        })),
      },
    };
    writeFileSync(
      resolve(dir, `${stage}-input.json`),
      JSON.stringify(input, null, 2),
    );
    return input;
  };
  const api = createApplication({
    ...config,
    dbPath: resolve(dir, "meetings.sqlite"),
    assessmentMs: 3600000,
    providers: {
      prepare: async (m) => {
        paidCalls++;
        return muse.prepare(m);
      },
      assess: async (s) => {
        paidCalls++;
        return muse.assess(modelInput(s, "drift"));
      },
      report: async (s) => {
        paidCalls++;
        return muse.report(modelInput(s, "report"));
      },
      openASR: async (_m, callbacks) => {
        emit = callbacks.onEvent;
        return {
          sessionId: "quality",
          send() {},
          async end() {},
          close() {},
          sentSeconds: 0,
          processedMs: 0,
        };
      },
    },
    media: {
      open: async () => ({
        connection: async () => ({
          url: "ws://synthetic-no-media",
          token: "fixture",
          room: "fixture",
        }),
        send: async () => {},
        close: async () => {},
      }),
    },
  });
  const server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  let cookie = "",
    meetingId = "",
    failure: string | null = null;
  const request = async (path: string, method = "GET", body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok)
      throw new Error(
        `${method} ${path}: ${res.status} ${JSON.stringify(json)}`,
      );
    return { res, json };
  };
  try {
    const signup = await request("/auth/signup", "POST", {
      username: "quality",
      password: randomUUID(),
    });
    cookie = signup.res.headers.get("set-cookie")!.split(";")[0];
    const created = (await request("/meetings", "POST", fixtureAgenda)).json;
    meetingId = created.id;
    assert.equal(created.phase, "ready", created.error);
    writeFileSync(
      resolve(dir, "agenda.json"),
      JSON.stringify(created.plan, null, 2),
    );
    const path = `/meetings/${meetingId}`;
    await request(`${path}/start`, "POST", { consented: true });
    const inject = (turns: typeof fixtureTurns) =>
      turns.forEach((t) =>
        emit({
          type: "final",
          sessionId: t.sessionId,
          turnId: t.turnId,
          text: t.text,
          speaker: t.speaker?.split(":")[1] || null,
          startMs: t.startMs,
          endMs: t.endMs,
        }),
      );
    const drift = fixtureSnapshot("drift").turns;
    inject(drift);
    await request(`${path}/commands`, "POST", { type: "request_guidance" });
    const assessed = (await request(path)).json;
    writeFileSync(
      resolve(dir, "assessment.json"),
      JSON.stringify(assessed.assessment, null, 2),
    );
    assert.ok(
      assessed.assessment,
      assessed.error || "No validated assessment returned",
    );
    inject(fixtureTurns.slice(drift.length));
    await request(`${path}/end`, "POST");
    let saved;
    for (let n = 0; n < 200; n++) {
      saved = (await request(path)).json;
      if (saved.reportStatus !== "processing") break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    writeFileSync(resolve(dir, "meeting.json"), JSON.stringify(saved, null, 2));
    assert.equal(saved.reportStatus, "ready", saved.error);
    assert.equal(saved.turns.length, fixtureTurns.length);
    const review = qualityChecks(saved.report, fixtureSnapshot());
    writeFileSync(resolve(dir, "review.json"), JSON.stringify(review, null, 2));
    console.log(
      JSON.stringify(
        { evidence: dir, paidCalls, reportStatus: saved.reportStatus, review },
        null,
        2,
      ),
    );
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
    console.error(failure);
  } finally {
    // api.close interrupts any failed active meeting; it does not start a second report or retry.
    await api.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    const usage = usageStore.db
      .prepare("SELECT status,cost,estimate,body FROM usage")
      .all()
      .map((row) => ({
        ...JSON.parse(String(row.body)),
        status: row.status,
        cost: row.cost,
        reserved: row.estimate,
      }));
    // Ledger metadata may not carry meetingId, so select exact current rows through SQL.
    const batchRows = usageStore.db
      .prepare("SELECT status,cost,estimate,body FROM usage WHERE meeting_id=?")
      .all(meetingId);
    const batch = batchRows.map((row) => ({
      ...JSON.parse(String(row.body)),
      status: row.status,
      cost: row.cost,
      reserved: row.estimate,
    }));
    const summary = {
      run,
      at: new Date().toISOString(),
      fixture:
        "Original synthetic three-speaker text; no audio/ASR or LiveKit evidence",
      syntheticTimeline: true,
      settings,
      paidCalls,
      failure,
      batchCost: batch.reduce((sum, row) => sum + (row.cost ?? 0), 0),
      unknown: batch.filter((row) => row.status !== "known").length,
      cumulativeExperimentCost: usage.reduce(
        (sum, row) => sum + (row.cost ?? 0),
        0,
      ),
      usage: batch,
      accountingNote:
        "Known-cost subtotal; unknown costs remain additional. Add batch to repository ledger before reporting global cumulative spend and conditional $150 remainder. Billing/grant unverified.",
    };
    writeFileSync(resolve(dir, "usage.json"), JSON.stringify(summary, null, 2));
    console.log(
      JSON.stringify({
        evidence: dir,
        batchCost: summary.batchCost,
        unknown: summary.unknown,
      }),
    );
    usageStore.close();
  }
}
