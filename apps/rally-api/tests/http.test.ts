import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "./support/application.ts";

test("meeting plans and history are private to their owner and survive restart", async (t) => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const dir = await mkdtemp("/tmp/rally-api-test-");
  const plan = {
    objective: "Choose launch date",
    topics: [
      {
        id: "launch",
        title: "Launch",
        outcome: "Agree date",
        minutes: 8,
        status: "pending",
      },
    ],
    durationMinutes: 10,
    wrapMinutes: 2,
  };
  const providers = {
    prepare: async () => ({
      ...plan,
      topics: plan.topics.map((t) => ({ ...t, status: "pending" as const })),
    }),
  };
  let api = createApplication({ dbPath: `${dir}/db`, providers });
  let server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await api.close();
    await rm(dir, { recursive: true });
  });
  const base = () =>
    `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    cookie = "",
  ) {
    return fetch(base() + path, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  const signup = await request("/fixture/signup", "POST", {
    username: "alice",
    password: "demo-password",
  });
  const alice = signup.headers.get("set-cookie")!.split(";")[0];
  const b = await request("/fixture/signup", "POST", {
    username: "bravo",
    password: "demo-password",
  });
  const bravo = b.headers.get("set-cookie")!.split(";")[0];
  const created = await request(
    "/meetings",
    "POST",
    { agenda: "Choose launch date", durationMinutes: 10 },
    alice,
  );
  assert.equal(created.status, 201);
  const meeting = await created.json();
  assert.equal(meeting.plan.objective, "Choose launch date");
  assert.deepEqual(
    await (await request("/meetings", "GET", undefined, bravo)).json(),
    [],
  );
  assert.equal(
    (await request(`/meetings/${meeting.id}`, "GET", undefined, bravo)).status,
    404,
  );
  assert.equal(
    (await request(`/meetings/${meeting.id}`, "DELETE", undefined, bravo))
      .status,
    404,
  );
  await new Promise<void>((r) => server.close(() => r()));
  await api.close();
  api = createApplication({ dbPath: `${dir}/db`, providers });
  server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  assert.equal(
    (
      await (
        await request(`/meetings/${meeting.id}`, "GET", undefined, alice)
      ).json()
    ).plan.objective,
    "Choose launch date",
  );
});

test("a fixture host stays signed in and logout revokes its cookie; meeting tests omit the MFA UI", async (t) => {
  const api = createApplication({ dbPath: ":memory:" });
  const server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await api.close();
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api`;
  const signup = await fetch(`${url}/fixture/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "alice", password: "a-demo-password" }),
  });
  assert.equal(signup.status, 201);
  const user = await signup.json();
  assert.equal(user.username, "alice");
  assert.deepEqual(Object.keys(user).sort(), ["id", "username"]);
  const cookie = signup.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await fetch(`${url}/auth/me`, { headers: { cookie } })).status,
    200,
  );
  assert.equal(
    (await fetch(`${url}/auth/logout`, { method: "POST", headers: { cookie } }))
      .status,
    204,
  );
  assert.equal(
    (await fetch(`${url}/auth/me`, { headers: { cookie } })).status,
    401,
  );
});
