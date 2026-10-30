import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../src/app.ts";
import { categories } from "../src/contracts.ts";
import type {
  Providers,
  Plan,
  Snapshot,
  TranscriptEvent,
  Media,
} from "../src/contracts.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { Store } from "../src/store.ts";
import { defaults } from "../src/config.ts";
import { createMuse, modelSettings } from "../src/muse.ts";

const plan: Plan = {
  objective: "Choose a launch date",
  topics: [
    {
      id: "launch",
      title: "Launch",
      outcome: "Choose date",
      minutes: 8,
      status: "pending",
    },
  ],
  durationMinutes: 10,
  wrapMinutes: 2,
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const report = (s: Snapshot) => ({
  summary: "The launch date was discussed.",
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
    unknownSeconds: null,
    note: "Unknown",
  },
});
const fakeMedia: Media = {
  open: async () => ({
    connection: async () => ({
      room: "fixture",
      token: "fixture",
      url: "ws://fixture",
    }),
    send: async () => {},
    close: async () => {},
  }),
};

async function fixture(
  t: TestContext,
  options: {
    providers?: Partial<Providers>;
    media?: Media;
    capacity?: number;
    dbPath?: string;
  } = {},
) {
  const events = new Map<string, (e: TranscriptEvent) => void>();
  const api = createApplication({
    dbPath: options.dbPath || ":memory:",
    assessmentMs: 100000,
    media: options.media || fakeMedia,
    capacity: options.capacity ?? 5,
    providers: {
      prepare: async () => structuredClone(plan),
      report: async (s) => report(s),
      openASR: async (m, callbacks) => {
        events.set(m.id, callbacks.onEvent);
        return {
          sessionId: "session",
          send() {},
          async end() {},
          close() {},
          sentSeconds: 0,
          processedMs: 0,
        };
      },
      ...options.providers,
    },
  });
  const server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await api.close();
  });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  let cookie = "";
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    session = cookie,
  ) =>
    fetch(base + path, {
      method,
      headers: { cookie: session, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const signup = async (username: string) => {
    const response = await request("/auth/signup", "POST", {
      username,
      password: "a-demo-password",
    });
    assert.equal(response.status, 201);
    return response.headers.get("set-cookie")!.split(";")[0];
  };
  cookie = await signup("alice");
  const create = async (session = cookie) => {
    const response = await request(
      "/meetings",
      "POST",
      { agenda: "Choose a launch date", durationMinutes: 10 },
      session,
    );
    assert.equal(response.status, 201);
    return response.json();
  };
  const start = (id: string, session = cookie) =>
    request(`/meetings/${id}/start`, "POST", { consented: true }, session);
  const emit = (id: string, turnId: number, text: string, timing = true) =>
    events.get(id)!({
      type: "final",
      sessionId: "session",
      turnId,
      text,
      speaker: "A",
      ...(timing ? { startMs: turnId * 1000, endMs: turnId * 1000 + 500 } : {}),
    });
  return { request, signup, create, start, emit };
}

test("an ended meeting's background report does not block the host's next meeting or consume capture capacity", async (t) => {
  const reporting = deferred<void>();
  const release = deferred<void>();
  const f = await fixture(t, {
    capacity: 1,
    providers: {
      report: async (s) => {
        reporting.resolve();
        await release.promise;
        return report(s);
      },
    },
  });
  const first = await f.create(),
    next = await f.create();
  assert.equal((await f.start(first.id)).status, 200);
  f.emit(first.id, 1, "We should decide the date.");
  assert.equal(
    (await f.request(`/meetings/${first.id}/end`, "POST")).status,
    202,
  );
  await reporting.promise;
  const starting = await f.start(next.id);
  const body = await starting.json();
  release.resolve();
  assert.equal(starting.status, 200, JSON.stringify(body));
});

test("a failed audio start preserves a host edit made while connection was pending", async (t) => {
  const opening = deferred<void>();
  const release = deferred<void>();
  const f = await fixture(t, {
    media: {
      open: async () => {
        opening.resolve();
        await release.promise;
        throw new Error("Media unavailable");
      },
    },
  });
  const m = await f.create();
  const starting = f.start(m.id);
  await opening.promise;
  const edited = { ...plan, objective: "Host corrected objective" };
  assert.equal(
    (await f.request(`/meetings/${m.id}/plan`, "PATCH", edited)).status,
    200,
  );
  release.resolve();
  assert.equal((await starting).status, 500);
  const saved = await (await f.request(`/meetings/${m.id}`)).json();
  assert.equal(saved.plan.objective, edited.objective);
  assert.equal(saved.revisions.at(-1).reason, "Host edit");
  assert.equal(
    saved.startedAt,
    null,
    "An unsuccessful first start must not start the meeting clock",
  );
});

test("turns without provider timestamps retain conversation order in history and report input", async (t) => {
  let reviewed: Snapshot | undefined;
  const f = await fixture(t, {
    providers: {
      report: async (s) => {
        reviewed = s;
        return report(s);
      },
    },
  });
  const m = await f.create();
  assert.equal((await f.start(m.id)).status, 200);
  // Finalization may arrive out of order; source turn sequence must still prevail.
  for (let n = 12; n >= 1; n--) f.emit(m.id, n, `Statement ${n}`, false);
  const saved = await (await f.request(`/meetings/${m.id}`)).json();
  assert.equal((await f.request(`/meetings/${m.id}/end`, "POST")).status, 202);
  assert.deepEqual(
    saved.turns.map((turn: { turnId: number }) => turn.turnId),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
  assert.deepEqual(
    reviewed?.turns.map((turn) => turn.turnId),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
});

test("every meeting mutation and retrieval rejects another owner", async (t) => {
  const f = await fixture(t);
  const m = await f.create();
  const bravo = await f.signup("bravo");
  const routes: [string, string, unknown?][] = [
    ["", "GET"],
    ["", "DELETE"],
    ["/prepare", "POST"],
    ["/plan", "PATCH", plan],
    ["/speakers", "PATCH", { speakerId: "session:A", name: "Alice" }],
    ["/start", "POST", { consented: true }],
    ["/reconnect", "POST", { consented: true }],
    ["/connection", "POST"],
    ["/commands", "POST", { type: "pause" }],
    ["/end", "POST"],
    ["/report", "GET"],
    ["/report/retry", "POST"],
    ["/report", "PATCH", { note: "Mine" }],
    ["/export", "GET"],
  ];
  for (const [suffix, method, body] of routes)
    assert.equal(
      (await f.request(`/meetings/${m.id}${suffix}`, method, body, bravo))
        .status,
      404,
      `${method} ${suffix}`,
    );
  assert.equal((await f.request(`/meetings/${m.id}`)).status, 200);
});

test("HTTP usage stays owner-isolated after deletion and unknown charges block further provider requests", async (t) => {
  const dir = await mkdtemp("/tmp/rally-astra-accounting-");
  const dbPath = `${dir}/db`;
  const accounting = new Store(dbPath);
  let fail = false;
  let calls = 0;
  const muse = createMuse(
    accounting,
    { ...defaults, paidEnabled: true },
    {
      key: "fixture-key-never-sent",
      settings: modelSettings("{}"),
      fetch: async () => {
        calls++;
        if (fail) throw new Error("Fixture network loss");
        return Response.json({
          usage: { prompt_tokens: 100, completion_tokens: 100 },
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(plan) },
            },
          ],
        });
      },
    },
  );
  const f = await fixture(t, { dbPath, providers: { prepare: muse.prepare } });
  t.after(async () => {
    accounting.close();
    await rm(dir, { recursive: true });
  });
  const aliceMeeting = await f.create();
  const bravo = await f.signup("bravo");
  await f.create(bravo);
  const usage = await (await f.request("/usage")).json();
  assert.equal(usage.length, 1);
  assert.equal(usage[0].status, "known");
  assert.equal(usage[0].cost, 0.00055);
  assert.equal(
    (await f.request(`/meetings/${aliceMeeting.id}`, "DELETE")).status,
    204,
  );
  assert.deepEqual(await (await f.request("/usage")).json(), usage);
  const bravoUsage = await (
    await f.request("/usage", "GET", undefined, bravo)
  ).json();
  assert.equal(bravoUsage.length, 1);
  assert.notEqual(bravoUsage[0].id, usage[0].id);
  fail = true;
  const failed = await f.create();
  assert.equal(failed.phase, "draft");
  assert.equal(
    (await f.request(`/meetings/${failed.id}`, "DELETE")).status,
    204,
  );
  const after = await (await f.request("/usage")).json();
  assert.equal(after.length, 2);
  assert.equal(after[1].status, "unknown");
  assert.equal(after[1].cost, null);
  const blocked = await f.create(bravo);
  assert.match(blocked.error, /Unknown provider costs/);
  assert.equal(calls, 3);
});

test("concurrent starts reserve capacity before awaiting audio connection", async (t) => {
  const opening = deferred<void>();
  const release = deferred<void>();
  let calls = 0;
  const f = await fixture(t, {
    capacity: 1,
    media: {
      open: async (...args) => {
        calls++;
        opening.resolve();
        await release.promise;
        return fakeMedia.open(...args);
      },
    },
  });
  const first = await f.create();
  const bravo = await f.signup("bravo");
  const second = await f.create(bravo);
  const start = f.start(first.id);
  await opening.promise;
  const blocked = await f.start(second.id, bravo);
  const duplicate = await f.start(first.id);
  release.resolve();
  assert.equal((await start).status, 200);
  assert.equal(blocked.status, 409);
  assert.equal(duplicate.status, 409);
  assert.equal(calls, 1);
});

test("deletion is rejected while end drains final speech, and the report receives the drained turn", async (t) => {
  const draining = deferred<void>();
  const duplicateDrain = deferred<void>();
  const release = deferred<void>();
  let drainCalls = 0;
  let reviewed: Snapshot | undefined;
  const f = await fixture(t, {
    providers: {
      openASR: async (_m, callbacks) => ({
        sessionId: "session",
        send() {},
        close() {},
        sentSeconds: 0,
        processedMs: 0,
        async end() {
          drainCalls++;
          draining.resolve();
          if (drainCalls > 1) duplicateDrain.resolve();
          await release.promise;
          callbacks.onEvent({
            type: "final",
            sessionId: "session",
            turnId: 1,
            text: "The final decision is Friday.",
            speaker: "A",
          });
        },
      }),
      report: async (s) => {
        reviewed = s;
        return report(s);
      },
    },
  });
  const m = await f.create();
  assert.equal((await f.start(m.id)).status, 200);
  const ending = f.request(`/meetings/${m.id}/end`, "POST");
  await draining.promise;
  const deleting = f.request(`/meetings/${m.id}`, "DELETE");
  // A guarded delete responds immediately; the existing race calls end() again.
  await Promise.race([deleting, duplicateDrain.promise]);
  release.resolve();
  const [ended, deleted] = await Promise.all([ending, deleting]);
  assert.equal(
    deleted.status,
    409,
    `DELETE returned ${deleted.status}; concurrent end returned ${ended.status}`,
  );
  assert.equal(ended.status, 202);
  assert.equal(reviewed?.turns.at(-1)?.text, "The final decision is Friday.");
  assert.equal((await f.request(`/meetings/${m.id}`)).status, 200);
});

test("speaker names can be cleared without extra analysis; processing is stable and completed reports disclose stale labels", async (t) => {
  const reporting = deferred<void>(),
    release = deferred<void>();
  let calls = 0;
  const f = await fixture(t, {
    providers: {
      report: async (s) => {
        assert.equal(s.meeting.report, null);
        assert.deepEqual(s.meeting.reportNotes, []);
        calls++;
        if (calls === 1) {
          reporting.resolve();
          await release.promise;
        }
        return {
          ...report(s),
          summary:
            "Speaker: " + (s.meeting.speakerNames["session:A"] || "Unknown"),
        };
      },
    },
  });
  const m = await f.create();
  await f.start(m.id);
  f.emit(m.id, 0, "I can handle the release.");
  const name = (value: unknown, session?: string) =>
    f.request(
      `/meetings/${m.id}/speakers`,
      "PATCH",
      { speakerId: "session:A", name: value },
      session,
    );
  let saved = await (await name("  Alex  ")).json();
  assert.equal(saved.speakerNames["session:A"], "Alex");
  const epoch = saved.epoch;
  assert.equal((await (await name("Alex")).json()).epoch, epoch);
  const bravo = await f.signup("bravo");
  assert.equal((await name(null, bravo)).status, 404);
  assert.equal(
    (
      await f.request(`/meetings/${m.id}/speakers`, "PATCH", {
        speakerId: "other-session:A",
        name: "Wrong",
      })
    ).status,
    400,
  );
  saved = await (await name(null)).json();
  assert.equal(saved.speakerNames["session:A"], undefined);
  assert.equal(calls, 0);
  assert.equal((await name("")).status, 400);
  await name("Alex");
  await f.request(`/meetings/${m.id}/end`, "POST", {});
  await reporting.promise;
  assert.equal((await name(null)).status, 409);
  release.resolve();
  async function ready() {
    for (let i = 0; i < 100; i++) {
      const r = await (await f.request(`/meetings/${m.id}`)).json();
      if (r.reportStatus === "ready") return r;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw Error("Report timeout");
  }
  saved = await ready();
  assert.equal(saved.reportStale, false);
  assert.equal(saved.report.summary, "Speaker: Alex");
  assert.equal(
    (await f.request(`/meetings/${m.id}/report`, "PATCH", { note: "  " }))
      .status,
    400,
  );
  assert.equal(
    (
      await f.request(
        `/meetings/${m.id}/report`,
        "PATCH",
        { note: "Corrected by host" },
        bravo,
      )
    ).status,
    404,
  );
  await f.request(`/meetings/${m.id}/report`, "PATCH", {
    note: "  Corrected by host  ",
  });
  saved = await (await name(null)).json();
  assert.equal(saved.reportNotes.length, 1);
  assert.equal(saved.reportNotes[0].text, "Corrected by host");
  assert.equal(saved.reportStale, true);
  assert.equal(
    saved.report.summary,
    "Speaker: Alex\nHost correction: Corrected by host",
  );
  assert.equal(calls, 1);
  assert.equal(
    (await (await f.request(`/meetings/${m.id}/report`)).json()).stale,
    true,
  );
  await f.request(`/meetings/${m.id}/report/retry`, "POST", {});
  saved = await ready();
  assert.equal(calls, 2);
  assert.equal(saved.reportStale, false);
  assert.equal(
    saved.report.summary,
    "Speaker: Unknown\nHost correction: Corrected by host",
  );
  assert.equal(saved.reportNotes.length, 1);
});
