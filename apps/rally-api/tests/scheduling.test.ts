import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../src/app.ts";
import type { TranscriptEvent } from "../src/contracts.ts";

test("scheduled checks suppress unchanged work and cooldown repeats; empty reports remain retryable", async (t) => {
  t.mock.timers.enable({apis:["Date"],now:Date.now()});
  let event: (e: TranscriptEvent) => void = () => {};
  let calls = 0;
  const plan = {
    objective: "Decide",
    topics: [
      {
        id: "a",
        title: "Decision",
        outcome: "Agreement",
        minutes: 8,
        status: "pending" as const,
      },
    ],
    durationMinutes: 10,
    wrapMinutes: 2,
  };
  const api = createApplication({
    dbPath: ":memory:",
    assessmentMs: 20,
    cooldownMs: 60000,
    providers: {
      prepare: async () => plan,
      openASR: async (_m, c) => {
        event = c.onEvent;
        return {
          sessionId: "s",
          send() {},
          async end() {},
          close() {},
          sentSeconds: 0,
          processedMs: 0,
        };
      },
      assess: async (s) => {
        calls++;
        return {
          health: 2,
          reason: "Tangent",
          issues: ["drift"],
          evidence: [s.turns[0].id],
          progress: "Return to agenda",
          intervention: {
            text: "Return to the decision",
            kind: "redirect",
            evidence: [s.turns[0].id],
          },
          plan: null,
          planReason: "",
        };
      },
    },
    media: {
      open: async () => ({
        connection: async () => ({
          room: "test",
          token: "test",
          url: "ws://test",
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
  let cookie = "";
  const req = (path: string, method = "GET", body?: unknown) =>
    fetch(base + path, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  cookie = (
    await req("/auth/signup", "POST", {
      username: "host",
      password: "demo-password",
    })
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const m = await (
    await req("/meetings", "POST", { agenda: "Decide", durationMinutes: 10 })
  ).json();
  const path = `/meetings/${m.id}`;
  await req(path + "/start", "POST", { consented: true });
  event({
    type: "final",
    sessionId: "s",
    turnId: 1,
    text: "Tangent",
    speaker: "A",
  });
  const waitFor = async (check: () => boolean) => {
    for (let n = 0; n < 100 && !check(); n++)
      await new Promise((r) => setTimeout(r, 10));
    assert.ok(check());
  };
  await waitFor(() => calls === 1);
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(calls, 1);
  event({
    type: "final",
    sessionId: "s",
    turnId: 2,
    text: "Still a tangent",
    speaker: "A",
  });
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(calls,1,"automatic requests are at least two seconds apart");
  t.mock.timers.setTime(Date.now()+2000);
  await waitFor(() => calls === 2);
  assert.equal((await (await req(path)).json()).interventions.length, 1);
  await req(path + "/commands", "POST", { type: "request_guidance" });
  assert.equal((await (await req(path)).json()).interventions.length, 2);
  await req(path, "DELETE");
  const empty = await (
    await req("/meetings", "POST", { agenda: "Decide", durationMinutes: 10 })
  ).json();
  const ep = `/meetings/${empty.id}`;
  await req(ep + "/end", "POST");
  assert.equal((await (await req(ep)).json()).reportStatus, "failed");
  assert.equal((await req(ep + "/report/retry", "POST")).status, 202);
  assert.equal((await req(ep, "DELETE")).status, 204);
});
