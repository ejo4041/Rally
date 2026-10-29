import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { Store } from "../src/store.ts";
import { defaults } from "../src/config.ts";
import { createMuse, TranscriptDecoder } from "../src/muse.ts";
import type { Meeting, TranscriptEvent } from "../src/contracts.ts";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
async function fixture(t: TestContext, onEnd?: (socket: WebSocket) => void) {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const store = new Store(":memory:");
  const received: { bytes: Buffer; at: number }[] = [];
  const events: TranscriptEvent[] = [];
  const errors: string[] = [];
  let ended = 0,
    closedCount = 0;
  let resolveClosed: () => void = () => {};
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  server.on("connection", (socket) =>
    socket.on("message", (raw, binary) => {
      if (binary) {
        received.push({
          bytes: Buffer.from(raw as Buffer),
          at: performance.now(),
        });
        return;
      }
      const value = JSON.parse(raw.toString());
      if (value.authorization) {
        assert.equal(value.audioEncoding, "PCM_16KHZ");
        assert.equal(value.mode, "DIARIZATION");
        socket.send(JSON.stringify({ sessionId: "astra-local" }));
      } else if (value.type === "endStream") {
        ended++;
        if (onEnd) onEnd(socket);
        else socket.close(1000);
      }
    }),
  );
  t.after(async () => {
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
  });
  const muse = createMuse(
    store,
    { ...defaults, paidEnabled: true },
    {
      key: "fixture-never-a-provider-key",
      asrUrl: `ws://127.0.0.1:${(server.address() as { port: number }).port}`,
    },
  );
  const session = await muse.openASR(
    { id: "fixture", userId: "fixture" } as Meeting,
    {
      onEvent: (event) => events.push(event),
      onError: (error) => errors.push(error.message),
      onClose: () => {
        closedCount++;
        resolveClosed();
      },
    },
  );
  t.after(async () => {
    session.close();
    await closed;
  });
  return {
    session,
    received,
    events,
    errors,
    closed,
    store,
    get ended() {
      return ended;
    },
    get closedCount() {
      return closedCount;
    },
  };
}

test("ASR sends queued PCM in real-time frames, pads the final frame, and drains delayed final speech once", async (t) => {
  const f = await fixture(t, (socket) => {
    setTimeout(() => {
      for (const value of [
        { type: "speechStart", turnId: 1, audioProcessedMs: 0 },
        { type: "speaker", label: "A", audioProcessedMs: 40 },
        { type: "speechEnd", turnId: 1, audioProcessedMs: 200 },
        {
          type: "speechComplete",
          turnId: 1,
          audioProcessedMs: 200,
          transcript: "Save the last sentence.",
        },
      ])
        socket.send(JSON.stringify(value));
      socket.close(1000);
    }, 60);
  });
  // Ten full frames and one partial: observable byte-for-byte preservation.
  const input = Buffer.alloc(10 * 640 + 100, 7);
  const started = performance.now();
  f.session.send(input);
  const end = f.session.end();
  assert.equal(f.session.end(), end, "end shares one final-drain promise");
  await end;
  assert.equal(f.received.length, 11);
  assert.ok(f.received.every((frame) => frame.bytes.length === 640));
  const output = Buffer.concat(f.received.map((frame) => frame.bytes));
  assert.deepEqual(output.subarray(0, input.length), input);
  assert.ok(output.subarray(input.length).every((value) => value === 0));
  assert.ok(
    f.received.at(-1)!.at - started >= 180,
    "queued audio is paced, not sent in a burst",
  );
  assert.equal(f.events.filter((event) => event.type === "final").length, 1);
  assert.deepEqual(f.errors, []);
  assert.equal(f.ended, 1);
  assert.equal(f.closedCount, 1);
  assert.throws(() => f.session.send(Buffer.alloc(640)), /not accepting/);
});

test("ASR rejects more than one second of buffered audio without sending the stale payload", async (t) => {
  const f = await fixture(t);
  f.session.send(Buffer.alloc(32000, 1));
  f.session.send(Buffer.alloc(2, 2));
  await f.closed;
  assert.match(f.errors.join("\n"), /buffer exceeded one second/);
  assert.equal(f.received.length, 0);
  assert.equal(f.closedCount, 1);
});

test("ASR rejects a partial PCM16 sample rather than shifting every following sample", async (t) => {
  const f = await fixture(t);
  f.session.send(Buffer.alloc(641, 1));
  await f.closed;
  assert.equal(f.received.length, 0);
  assert.match(f.errors.join("\n"), /buffer exceeded/);
});

test("ASR timer stall closes capture without replaying queued microphone audio", async (t) => {
  const f = await fixture(t);
  f.session.send(Buffer.alloc(32000, 9));
  // Simulate a blocked Node event loop, not slow real provider access.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 620);
  await f.closed;
  assert.match(f.errors.join("\n"), /pacing stalled/);
  assert.equal(f.received.length, 0);
});

test("ASR emits bounded silence when capture is temporarily absent", async (t) => {
  const f = await fixture(t);
  await delay(130);
  await f.session.end();
  assert.ok(f.received.length >= 4 && f.received.length <= 12);
  assert.ok(
    f.received.every(
      (frame) =>
        frame.bytes.length === 640 && frame.bytes.every((value) => value === 0),
    ),
  );
  assert.deepEqual(f.errors, []);
});

test("speaker ambiguity remains unknown and finalized turns preserve session-scoped identity", () => {
  const events: TranscriptEvent[] = [];
  const decoder = new TranscriptDecoder("session-one", (event) =>
    events.push(event),
  );
  for (const value of [
    { type: "speechStart", turnId: 1, audioProcessedMs: 0 },
    { type: "speaker", label: "A", audioProcessedMs: 20 },
    { type: "speaker", label: "B", audioProcessedMs: 30 },
    { type: "speechEnd", turnId: 1, audioProcessedMs: 100 },
    {
      type: "speechComplete",
      turnId: 1,
      audioProcessedMs: 100,
      transcript: "Overlapping speakers.",
    },
    { type: "speechStart", turnId: 2, audioProcessedMs: 120 },
    { type: "speaker", label: "A", audioProcessedMs: 130 },
    { type: "speechEnd", turnId: 2, audioProcessedMs: 200 },
    {
      type: "speechComplete",
      turnId: 2,
      audioProcessedMs: 200,
      transcript: "One speaker.",
    },
  ])
    decoder.accept(value);
  const finals = events.filter((event) => event.type === "final");
  assert.equal(finals[0].speaker, null);
  assert.equal(finals[1].speaker, "A");
  assert.equal(finals[1].sessionId, "session-one");
});

test("ASR reports incomplete final drain and releases the session when a provider never closes", async (t) => {
  const f = await fixture(t, () => {
    /* Deliberately withhold final events and close. */
  });
  f.session.send(Buffer.alloc(640, 1));
  const started = performance.now();
  await f.session.end();
  assert.ok(performance.now() - started >= 4900);
  assert.match(f.errors.join("\n"), /Final transcript drain timed out/);
  assert.equal(f.closedCount, 1);
  assert.equal(f.ended, 1);
  assert.throws(() => f.session.send(Buffer.alloc(640)), /not accepting/);
});
