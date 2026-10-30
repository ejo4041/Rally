import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../src/app.ts";
import type {
  Assessment,
  Providers,
  TranscriptEvent,
  LiveEvent,
} from "../src/contracts.ts";
import { assessmentContext } from "../src/assessment-context.ts";
const empty: Assessment = {
  health: null,
  reason: "Insufficient evidence",
  issues: [],
  evidence: [],
  progress: "Waiting",
  intervention: null,
  plan: null,
  planReason: "",
  urgency: 0,
};
async function fixture(
  t: TestContext,
  assess: Providers["assess"] = async () => empty,
) {
  t.mock.timers.enable({ apis: ["Date"], now: 1800000000000 });
  const previous = process.env.RALLY_PRESENCE_RUNNER_SECRET;
  process.env.RALLY_PRESENCE_RUNNER_SECRET =
    "fixture-private-runner-credential-12345";
  let receive: (event: TranscriptEvent) => void = () => {};
  const events: LiveEvent[] = [];
  const app = createApplication({
    dbPath: ":memory:",
    assessmentMs: 10000,
    captureLeaseMs: 300000,
    media: {
      async open() {
        return {
          connection: async (role = "host") => ({
            url: "ws://fixture",
            token: role,
            room: "fixture",
          }),
          send: async (e) => {
            events.push(e);
          },
          close: async () => {},
        };
      },
    },
    providers: {
      prepare: async () => ({
        objective: "Choose scope",
        topics: [
          {
            id: "scope",
            title: "Launch scope",
            outcome: "Decision",
            minutes: 2,
            status: "active",
          },
        ],
        durationMinutes: 3,
        wrapMinutes: 1,
      }),
      assess,
      openASR: async (_m, c) => {
        receive = c.onEvent;
        return {
          sessionId: "fixture",
          send() {},
          end: async () => {},
          close() {},
          sentSeconds: 0,
          processedMs: 0,
        };
      },
    },
  });
  const server = app.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  let cookie = "";
  const request = (path: string, body?: unknown, runner = false) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        ...(runner
          ? {
              authorization:
                "Bearer " + process.env.RALLY_PRESENCE_RUNNER_SECRET,
            }
          : { cookie }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const signup = await request("/auth/signup", {
    username: "presence",
    password: "fixture-password-only",
  });
  cookie = signup.headers.get("set-cookie")!.split(";")[0];
  const m = await (
    await request("/meetings", {
      title: "Presence scenario",
      agenda: "Choose launch scope",
      durationMinutes: 3,
    })
  ).json();
  t.after(async () => {
    await app.close();
    await new Promise<void>((r) => server.close(() => r()));
    if (previous === undefined) delete process.env.RALLY_PRESENCE_RUNNER_SECRET;
    else process.env.RALLY_PRESENCE_RUNNER_SECRET = previous;
  });
  return {
    app,
    request,
    m,
    events,
    turn(text: string, turnId = 1) {
      receive({
        type: "final",
        sessionId: "fixture",
        turnId,
        text,
        speaker: null,
      });
    },
  };
}
test("an active native runner claim cannot be acquired again after restart", async (t) => {
  const f = await fixture(t);
  await f.request("/presence/runner/poll", {}, true);
  assert.equal(
    (
      await f.request(`/meetings/${f.m.id}/teams-presence`, {
        url: "https://teams.microsoft.com/meet/fixture",
        consented: true,
      })
    ).status,
    202,
  );
  const first = await (
    await f.request("/presence/runner/poll", {}, true)
  ).json();
  assert.equal(first.job.state, "joining");
  assert.equal(
    (await (await f.request("/presence/runner/poll", {}, true)).json()).job,
    null,
  );
  assert.equal(
    (
      await (
        await f.request(
          "/presence/runner/poll",
          { claim: first.job.claim },
          true,
        )
      ).json()
    ).job.claim,
    first.job.claim,
  );
});
test("a long assessment cannot prevent the capture watchdog from closing an abandoned source", async (t) => {
  let complete!: (value: Assessment) => void;
  const pending = new Promise<Assessment>((resolve) => {
    complete = resolve;
  });
  let entered = false;
  const f = await fixture(t, () => {
    entered = true;
    return pending;
  });
  await f.request(`/meetings/${f.m.id}/start`, { consented: true });
  f.turn("Let us decide launch scope.");
  const work = f.request(`/meetings/${f.m.id}/commands`, {
    type: "request_guidance",
  });
  while (!entered) await new Promise((r) => setTimeout(r, 1));
  t.mock.timers.setTime(Date.now() + 300001);
  await f.request(`/meetings/${f.m.id}/commands`, { type: "request_guidance" });
  assert.equal(
    (await (await f.request(`/meetings/${f.m.id}`)).json()).phase,
    "interrupted",
  );
  complete({ ...empty, progress: "Stale response must be discarded" });
  await work;
  assert.notEqual(
    (await (await f.request(`/meetings/${f.m.id}`)).json()).progress,
    "Stale response must be discarded",
  );
});
test("invalid focus cannot partially commit otherwise valid emotion or agenda changes", async (t) => {
  const f = await fixture(t, async () => ({
    ...empty,
    progress: "Should not be saved",
    focus: {
      intendedTopicId: "missing",
      detour: null,
      evidence: ["fixture:1"],
    },
    affect: {
      forces: {
        joy: 0.7,
        curiosity: null,
        worry: null,
        irritation: null,
        sadness: null,
        confidence: null,
        energy: null,
        sass: null,
      },
      evidence: ["fixture:1"],
      rationale: "Synthetic invalid transaction",
    },
  }));
  await f.request(`/meetings/${f.m.id}/start`, { consented: true });
  f.turn("We have agreed launch scope.");
  await f.request(`/meetings/${f.m.id}/commands`, { type: "request_guidance" });
  const saved = await (await f.request(`/meetings/${f.m.id}`)).json();
  assert.notEqual(saved.progress, "Should not be saved");
  assert.equal(saved.presence, undefined);
  assert.equal(
    f.events.some((e) => e.type === "assessment"),
    false,
  );
});
test("logging out withdraws a queued Teams invitation before the runner can join", async (t) => {
  const f = await fixture(t);
  await f.request("/presence/runner/poll", {}, true);
  await f.request(`/meetings/${f.m.id}/teams-presence`, {
    url: "https://teams.microsoft.com/meet/fixture",
    consented: true,
  });
  await f.request("/auth/logout", {});
  assert.equal(
    (await (await f.request("/presence/runner/poll", {}, true)).json()).job,
    null,
  );
});
test("renderer bootstrap is single-use and does not return account data or transcript", async (t) => {
  const f = await fixture(t);
  await f.request("/presence/runner/poll", {}, true);
  await f.request(`/meetings/${f.m.id}/teams-presence`, {
    url: "https://teams.microsoft.com/meet/fixture",
    consented: true,
  });
  const { job } = await (
    await f.request("/presence/runner/poll", {}, true)
  ).json();
  const started = await (
    await f.request("/presence/runner/connected", { claim: job.claim }, true)
  ).json();
  f.turn("Private participant sentence that is not renderer state");
  const access = await (
    await f.request("/presence/bootstrap", { token: started.bootstrap })
  ).json();
  assert.equal(access.connection.token, "renderer");
  assert.equal(access.scene.current, "Launch scope");
  assert.equal(JSON.stringify(access).includes("Private participant"), false);
  assert.equal(access.meeting, undefined);
  assert.equal(
    (await f.request("/presence/bootstrap", { token: started.bootstrap }))
      .status,
    401,
  );
});
test("assessment context supplies valid force bounds instead of making Muse redo actuator arithmetic", async (t) => {
  const f = await fixture(t);
  const { initialPresence } = await import(
    "../../../packages/rally-presence/state.ts"
  );
  f.m.presence = initialPresence(10000);
  f.m.presence.channels.worry = {
    value: 5,
    velocity: 0,
    anchor: 20,
    target: 5,
    force: -0.15,
    at: 10000,
    expires: 10000,
    omega: 1,
  };
  const context = assessmentContext(
    { meeting: f.m, turns: [], elapsedSeconds: 20 },
    20000,
  );
  assert.equal(context.meeting.emotions.worry.decreaseToZero, -0.2);
  assert.equal(context.meeting.emotions.worry.negativeMaximum, -0.15);
  assert.equal("userId" in context.meeting, false);
});
test("a renderer bootstrap cannot be used after its capture lease expires", async (t) => {
  const f = await fixture(t);
  await f.request("/presence/runner/poll", {}, true);
  await f.request(`/meetings/${f.m.id}/teams-presence`, {
    url: "https://teams.microsoft.com/meet/fixture",
    consented: true,
  });
  const { job } = await (
    await f.request("/presence/runner/poll", {}, true)
  ).json();
  const started = await (
    await f.request("/presence/runner/connected", { claim: job.claim }, true)
  ).json();
  t.mock.timers.setTime(Date.now() + 31000);
  assert.equal(
    (await f.request("/presence/bootstrap", { token: started.bootstrap }))
      .status,
    401,
  );
  assert.equal(
    (
      await f.request(
        "/presence/runner/heartbeat",
        { claim: job.claim, captureToken: started.connection.captureToken },
        true,
      )
    ).status,
    409,
  );
});
test('maximum-length Unicode topic plans fit in a scene packet without exposing transcript history',async t=>{
 const f=await fixture(t);const {sceneFor}=await import('../../../packages/rally-presence/scene.ts');
 f.m.plan.topics=Array.from({length:20},(_,i)=>({id:String(i),title:'€'.repeat(2000),outcome:'€'.repeat(2000),minutes:1,status:i===0?'active':'pending'}));
 f.m.revisions=[{at:Date.now(),reason:'€'.repeat(1000),plan:f.m.plan}];
 f.m.playback={id:'speech',interventionId:'offer',text:'€'.repeat(500),state:'playing',at:Date.now(),until:Date.now()+30000};f.m.phase='live';
 const scene=sceneFor(f.m);assert.ok(Buffer.byteLength(JSON.stringify({version:1,id:'event',meetingId:f.m.id,type:'presence.scene',data:scene}))<14000);
});
