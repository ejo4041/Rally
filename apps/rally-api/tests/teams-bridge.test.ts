import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "./support/application.ts";
import { randomUUID } from "node:crypto";
import { HttpError } from "../src/auth.ts";

test("Teams bridge authenticates, isolates ownership, bounds links/consent and imports only finalized owned text", async (t) => {
  let job: any = null,
    joins = 0,
    leaves = 0;
  const remote = async (action: string, data?: any) => {
    if (action === "status")
      return {
        online: true,
        transport: "teams-web",
        transcriptionReady: true,
        job,
      };
    if (action === "join") {
      joins++;
      job = {
        id: randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deadline: Date.now() + 180000,
        state: "queued",
        message: "Queued",
        transcriptionState: "waiting",
        transcript: [],
        transcribe: true,
      };
      return { job };
    }
    if (action === "leave") {
      assert.equal(data.id, job.id);
      leaves++;
      return { ok: true };
    }
    throw Error("Unexpected operation");
  };
  const api = createApplication({ dbPath: ":memory:", teamsRequest: remote });
  const server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  t.after(async () => {
    server.close();
    await api.close();
  });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  async function req(
    path: string,
    method = "GET",
    data?: unknown,
    cookie = "",
  ) {
    return fetch(base + path, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }
  const users = [];
  for (const username of ["alice", "bravo"]) {
    const r = await req("/fixture/signup", "POST", {
      username,
      password: "fixture-password-only",
    });
    users.push(r.headers.get("set-cookie")!.split(";")[0]);
  }
  const [alice, bravo] = users;
  assert.equal((await req("/teams/status")).status, 401);
  const input = {
    meetingUrl: "https://teams.microsoft.com/l/meetup-join/fixture",
    consented: true,
    transcribe: true,
    transcriptionConsented: true,
  };
  for (const value of [
    "https://evil.example/meet/a",
    "https://teams.microsoft.com.evil.example/meet/a",
    "http://teams.microsoft.com/meet/a",
    "https://user@teams.microsoft.com/meet/a",
    "https://teams.microsoft.com:444/meet/a",
    "https://teams.microsoft.com/meet/",
  ])
    assert.equal(
      (await req("/teams/join", "POST", { ...input, meetingUrl: value }, alice))
        .status,
      400,
    );
  assert.equal(
    (await req("/teams/join", "POST", { ...input, consented: false }, alice))
      .status,
    400,
  );
  assert.equal(
    (
      await req(
        "/teams/join",
        "POST",
        { ...input, transcriptionConsented: false },
        alice,
      )
    ).status,
    400,
  );
  assert.equal(joins, 0);
  const joined = await (await req("/teams/join", "POST", input, alice)).json();
  assert.equal(joins, 1);
  assert.notEqual(joined.job.id, job.id);
  const ownId = joined.job.id;
  const other = await (
    await req("/teams/status", "GET", undefined, bravo)
  ).json();
  assert.equal(other.busy, true);
  assert.equal(other.job, null);
  assert.ok(!JSON.stringify(other).includes(job.id));
  for (const route of ["/teams/leave", "/teams/save"])
    assert.equal((await req(route, "POST", { id: ownId }, bravo)).status, 404);
  assert.equal(leaves, 0);
  assert.equal(
    (await req("/teams/save", "POST", { id: ownId }, alice)).status,
    409,
  );
  await req("/teams/leave", "POST", { id: ownId }, alice);
  assert.equal(leaves, 1);
  job = {
    ...job,
    state: "left",
    message: "Left",
    transcriptionState: "stopped",
    partial: "Do not save this partial",
    transcript: [
      { id: "asr:0", text: "Priya will check rollback.", speaker: "A" },
    ],
  };
  const saved = await (
    await req("/teams/save", "POST", { id: ownId }, alice)
  ).json();
  assert.ok(saved.meetingId);
  const record = await (
    await req("/meetings/" + saved.meetingId, "GET", undefined, alice)
  ).json();
  assert.equal(record.phase, "ended");
  assert.equal(record.turns.length, 1);
  assert.equal(record.turns[0].startMs, null);
  assert.equal(record.reportStatus, "none");
  assert.equal(record.turns[0].text, "Priya will check rollback.");
  assert.ok(!JSON.stringify(record).includes("Do not save this partial"));
  assert.ok(!JSON.stringify(record).includes(input.meetingUrl));
  assert.equal(
    (await req("/meetings/" + saved.meetingId, "GET", undefined, bravo)).status,
    404,
  );
  const again = await (
    await req("/teams/save", "POST", { id: ownId }, alice)
  ).json();
  assert.equal(again.meetingId, saved.meetingId);
  assert.deepEqual(
    await (await req("/usage", "GET", undefined, alice)).json(),
    [],
  );
  await req("/meetings/" + saved.meetingId, "DELETE", undefined, alice);
  assert.equal(
    (await req("/teams/save", "POST", { id: ownId }, alice)).status,
    409,
  );
});

test("an uncertain invitation blocks duplicate remote joins, including a concurrent request", async (t) => {
  let release: () => void = () => {},
    calls = 0;
  const api = createApplication({
    dbPath: ":memory:",
    teamsRequest: async (action) => {
      if (action === "status") return { online: true, transport: "teams-web" };
      calls++;
      await new Promise<void>((r) => (release = r));
      throw new Error("Network response lost");
    },
  });
  const server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  t.after(async () => {
    server.close();
    await api.close();
  });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const signup = await fetch(base + "/fixture/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "alice",
      password: "fixture-password-only",
    }),
  });
  const cookie = signup.headers.get("set-cookie")!.split(";")[0];
  const join = () =>
    fetch(base + "/teams/join", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        meetingUrl: "https://teams.microsoft.com/meet/fixture",
        consented: true,
      }),
    });
  const first = join();
  for (let n = 0; n < 50 && !calls; n++)
    await new Promise((r) => setTimeout(r, 10));
  assert.equal((await join()).status, 409);
  release();
  assert.equal((await first).status, 503);
  assert.equal((await join()).status, 409);
  assert.equal(calls, 1);
  const status = await (
    await fetch(base + "/teams/status", { headers: { cookie } })
  ).json();
  assert.equal(status.uncertain, true);
});
