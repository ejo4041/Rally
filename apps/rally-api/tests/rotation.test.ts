import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "./support/application.ts";
import type { ASRSession, LiveEvent, Providers } from "../src/contracts.ts";

async function fixture(t: TestContext, assessmentMs = 100000) {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  let transportGap: (reason: string) => void = () => {};
  let audio: (bytes: Uint8Array) => void = () => {},
    opens = 0,
    assessments = 0,
    resolveNext: (value: ASRSession) => void = () => {},
    rejectNext: (error: Error) => void = () => {};
  const callbacks: Parameters<Providers["openASR"]>[1][] = [];
  const events: LiveEvent[] = [],
    streams: {
      stream: ASRSession;
      bytes: number;
      closed: boolean;
      received: number[][];
    }[] = [];
  let shutdown = false;
  const api = createApplication({
    // These scenarios isolate ASR rotation from the separately tested browser lease.
    captureLeaseMs:24*3600000,
    dbPath: ":memory:",
    assessmentMs,
    providers: {
      async prepare() {
        return {
          objective: "Observe synthetic source continuity",
          topics: [
            {
              id: "check",
              title: "Check",
              outcome: "Verify continuity",
              minutes: 2,
              status: "pending",
            },
          ],
          durationMinutes: 3,
          wrapMinutes: 1,
        };
      },
      async openASR(_m, c) {
        callbacks.push(c);
        const id = "source-" + ++opens;
        const state: { bytes: number; closed: boolean; received: number[][] } =
          {
            bytes: 0,
            closed: false,
            received: [],
          };
        let emitted = false;
        const stream: ASRSession = {
          sessionId: id,
          send(bytes) {
            if (state.closed) throw Error("Closed source received audio");
            state.bytes += bytes.byteLength;
            state.received.push([...bytes]);
            if (!emitted) {
              emitted = true;
              c.onEvent({
                type: "final",
                sessionId: id,
                turnId: 0,
                sourceOrder: 0,
                text: "Synthetic source sentence.",
                speaker: "A",
              });
            }
          },
          async end() {
            if (!state.closed) {
              state.closed = true;
              c.onEvent({
                type: "final",
                sessionId: id,
                turnId: 1,
                sourceOrder: 1,
                text: "Synthetic final drain.",
                speaker: null,
              });
              c.onClose();
            }
          },
          close() {
            state.closed = true;
            c.onClose();
          },
          get sentSeconds() {
            return state.bytes / 32000;
          },
          processedMs: 0,
        };
        streams.push(Object.assign(state, { stream }));
        if (opens === 2)
          return new Promise<ASRSession>((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });
        return stream;
      },
      async assess() {
        assessments++;
        return {
          health: null,
          reason: "Synthetic fixture",
          issues: [],
          evidence: [],
          progress: "Observing source",
          intervention: null,
          plan: null,
          planReason: "",
        };
      },
    },
    media: {
      async open(_m, onAudio, onGap) {
        audio = onAudio;
        transportGap = onGap;
        return {
          async connection() {
            return { url: "ws://fixture", token: "fixture", room: "fixture" };
          },
          async send(event) {
            events.push(event);
          },
          async close() {},
        };
      },
    },
  });
  const server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  t.after(async () => {
    server.close();
    if (!shutdown) await api.close();
  });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  let cookie = "";
  const req = (path: string, method = "GET", body?: unknown) =>
    fetch(base + path, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const signup = await req("/fixture/signup", "POST", {
    username: "host",
    password: "fixture-password",
  });
  cookie = signup.headers.get("set-cookie")!.split(";")[0];
  const m = await (
    await req("/meetings", "POST", {
      agenda: "Synthetic continuity check",
      durationMinutes: 3,
    })
  ).json();
  const path = `/meetings/${m.id}`;
  await req(path + "/start", "POST", { consented: true });
  audio(new Uint8Array([1, 2]));
  return {
    req,
    path,
    events,
    streams,
    audio: (bytes: Uint8Array) => audio(bytes),
    opens: () => opens,
    assessments: () => assessments,
    rotate() {
      t.mock.timers.tick(55 * 60000 + 1);
      return req(path + "/commands", "POST", { type: "request_guidance" });
    },
    async pending() {
      for (let i = 0; i < 100 && opens < 2; i++)
        await new Promise((r) => setTimeout(r, 2));
      assert.equal(opens, 2);
    },
    resolve() {
      resolveNext(streams[1].stream);
    },
    reject() {
      streams[1].stream.close();
      rejectNext(Error("Synthetic handshake failure"));
    },
    transportGap: (reason: string) => transportGap(reason),
    stale() {
      callbacks[0].onEvent({
        type: "final",
        sessionId: "source-1",
        turnId: 99,
        sourceOrder: 99,
        text: "Stale source output",
        speaker: "A",
      });
      callbacks[0].onError(Error("Stale source error"));
      callbacks[0].onClose();
    },
    advanceBy(ms: number) {
      t.mock.timers.tick(ms);
    },
    advance() {
      t.mock.timers.tick(55 * 60000 + 1);
    },
    async shutdown() {
      shutdown = true;
      server.close();
      await api.close();
    },
    async login() {
      const r = await req("/fixture/login", "POST", {
        username: "host",
        password: "fixture-password",
      });
      cookie = r.headers.get("set-cookie")!.split(";")[0];
    },
  };
}

test("normal ASR handoff preserves capture, discards handoff frames and restarts speaker scope without a fatal gap", async (t) => {
  const f = await fixture(t),
    pending = f.rotate();
  await f.pending();
  f.audio(new Uint8Array([3, 4]));
  f.resolve();
  await pending;
  f.audio(new Uint8Array([5, 6]));
  assert.equal(f.streams[0].bytes, 2);
  assert.equal(f.streams[1].bytes, 2);
  assert.deepEqual(f.streams[0].received, [[1, 2]]);
  assert.deepEqual(f.streams[1].received, [[5, 6]]);
  assert.equal(
    f.events.some((e) => e.type === "capture.gap"),
    false,
  );
  assert.ok(f.events.some((e) => e.type === "transcription.gap"));
  const m = await (await f.req(f.path)).json();
  assert.equal(m.phase, "live");
  assert.equal(m.error, null);
  f.stale();
  assert.equal(
    (await (await f.req(f.path)).json()).turns.length,
    m.turns.length,
  );
  assert.equal(
    f.events.some((e) => e.type === "capture.gap"),
    false,
  );
  assert.equal(m.gaps.length, 1);
  await f.rotate();
  assert.equal((await (await f.req(f.path)).json()).gaps.length, 2);
  assert.equal(
    f.events.filter((e) => e.type === "transcription.gap").length,
    2,
  );
  assert.equal(
    new Set(
      m.turns.flatMap((x: { speaker: string | null }) =>
        x.speaker ? [x.speaker] : [],
      ),
    ).size,
    2,
  );
});

test("handoff still occurs while moderation is paused without requesting an assessment", async (t) => {
  const f = await fixture(t);
  await f.req(f.path + "/commands", "POST", { type: "pause" });
  const pending = f.rotate();
  await f.pending();
  f.resolve();
  await pending;
  assert.equal(f.opens(), 2);
  assert.equal(f.assessments(), 0);
  assert.equal((await (await f.req(f.path)).json()).paused, true);
});

test("a failed replacement source interrupts capture and is not retried automatically", async (t) => {
  const f = await fixture(t),
    pending = f.rotate();
  await f.pending();
  f.reject();
  await pending;
  const m = await (await f.req(f.path)).json();
  assert.equal(m.phase, "interrupted");
  assert.ok(f.events.some((e) => e.type === "capture.gap"));
  assert.equal(
    (await f.req(f.path + "/commands", "POST", { type: "request_guidance" }))
      .status,
    409,
  );
  assert.equal(f.opens(), 2);
});

test("logout during a pending handoff stops capture and closes a late replacement source", async (t) => {
  const f = await fixture(t),
    pending = f.rotate();
  await f.pending();
  assert.equal((await f.req("/auth/logout", "POST", {})).status, 204);
  f.resolve();
  await pending;
  await f.login();
  assert.equal(f.streams[1].closed, true);
  assert.equal((await (await f.req(f.path)).json()).phase, "interrupted");
  assert.equal(f.assessments(), 0);
});

test("shutdown waits for a background handoff and closes its late source before closing storage", async (t) => {
  const f = await fixture(t, 5);
  f.advance();
  await f.pending();
  const shutdown = f.shutdown();
  await new Promise((r) => setImmediate(r));
  f.resolve();
  await shutdown;
  assert.equal(f.streams[1].closed, true);
  assert.ok(
    !f.events.some(
      (e) =>
        e.type === "transcript.final" &&
        (e.data as { sessionId: string }).sessionId === "source-2",
    ),
  );
});

test("repeated capture failures are briefly coalesced rather than hidden permanently", async (t) => {
  const f = await fixture(t);
  f.transportGap("Synthetic input lost");
  f.transportGap("Synthetic input lost");
  assert.equal(f.events.filter((e) => e.type === "capture.gap").length, 1);
  f.advanceBy(2000);
  f.transportGap("Synthetic input lost");
  assert.equal(f.events.filter((e) => e.type === "capture.gap").length, 2);
});
