import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../src/app.ts";
import type {
  Providers,
  TranscriptEvent,
  Assessment,
} from "../src/contracts.ts";

test("pause cancels pending guidance, hosts run independently, and logout stops capture", async (t) => {
  const events = new Map<string, (e: TranscriptEvent) => void>();
  let resolveAssessment: ((v: Assessment) => void) | undefined;
  const plan = {
    objective: "Decide",
    topics: [
      {
        id: "a",
        title: "Decide",
        outcome: "Decision",
        minutes: 8,
        status: "pending" as const,
      },
    ],
    durationMinutes: 10,
    wrapMinutes: 2,
  };
  const providers: Partial<Providers> = {
    prepare: async () => plan,
    assess: () => new Promise((r) => (resolveAssessment = r)),
    openASR: async (m, c) => {
      events.set(m.id, c.onEvent);
      return {
        sessionId: "s",
        send() {},
        async end() {},
        close() {},
        sentSeconds: 0,
        processedMs: 0,
      };
    },
  };
  const api = createApplication({
    dbPath: ":memory:",
    providers,
    assessmentMs: 100000,
    media: {
      open: async () => ({
        connection: async () => ({
          room: "fake",
          token: "fake",
          url: "ws://fake",
        }),
        send: async () => {},
        close: async () => {},
      }),
    },
  });
  const server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await api.close();
  });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const req = (cookie: string, path: string, method = "GET", body?: unknown) =>
    fetch(base + path, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  const signup = async (username: string) =>
    (
      await req("", "/auth/signup", "POST", {
        username,
        password: "a-demo-password",
      })
    ).headers
      .get("set-cookie")!
      .split(";")[0];
  const alice = await signup("alice"),
    bravo = await signup("bravo");
  const create = async (cookie: string) =>
    (
      await (
        await req(cookie, "/meetings", "POST", {
          agenda: "Decide",
          durationMinutes: 10,
        })
      ).json()
    ).id as string;
  const a = await create(alice),
    b = await create(bravo),
    extra = await create(alice);
  assert.equal(
    (await req(alice, `/meetings/${a}/start`, "POST", { consented: true }))
      .status,
    200,
  );
  assert.equal(
    (await req(bravo, `/meetings/${b}/start`, "POST", { consented: true }))
      .status,
    200,
  );
  assert.equal(
    (await req(alice, `/meetings/${extra}/start`, "POST", { consented: true }))
      .status,
    409,
  );
  events.get(a)!({
    type: "final",
    sessionId: "s",
    turnId: 1,
    text: "A tangent",
    speaker: "A",
  });
  const pending = req(alice, `/meetings/${a}/commands`, "POST", {
    type: "request_guidance",
  });
  while (!resolveAssessment) await new Promise((r) => setTimeout(r, 5));
  await req(alice, `/meetings/${a}/commands`, "POST", { type: "pause" });
  resolveAssessment({
    health: 1,
    reason: "Off topic",
    issues: ["drift"],
    evidence: ["s:1"],
    progress: "Tangent",
    intervention: {
      text: "Return to the decision.",
      kind: "redirect",
      evidence: ["s:1"],
    },
    plan: null,
    planReason: "",
  });
  await pending;
  const saved = await (await req(alice, `/meetings/${a}`)).json();
  assert.equal(saved.paused, true);
  assert.equal(saved.interventions.length, 0);

  await req(alice, `/meetings/${a}/commands`, "POST", { type: "resume" });
  resolveAssessment = undefined;
  const corrected = req(alice, `/meetings/${a}/commands`, "POST", {
    type: "request_guidance",
  });
  while (!resolveAssessment) await new Promise((r) => setTimeout(r, 5));
  events.get(a)!({
    type: "final",
    sessionId: "s",
    turnId: 1,
    text: "Actually on agenda",
    speaker: "A",
  });
  (resolveAssessment as (v: Assessment) => void)({
    health: 1,
    reason: "Old tangent",
    issues: ["drift"],
    evidence: ["s:1"],
    progress: "Tangent",
    intervention: {
      text: "Return to the decision.",
      kind: "redirect",
      evidence: ["s:1"],
    },
    plan: null,
    planReason: "",
  });
  await corrected;
  assert.equal(
    (await (await req(alice, `/meetings/${a}`)).json()).interventions.length,
    0,
  );
  await req(alice, "/auth/logout", "POST");
  const signin = await req("", "/auth/login", "POST", {
    username: "alice",
    password: "a-demo-password",
  });
  const again = signin.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await (await req(again, `/meetings/${a}`)).json()).phase,
    "interrupted",
  );
  assert.equal(
    (await (await req(bravo, `/meetings/${b}`)).json()).phase,
    "live",
  );
});
