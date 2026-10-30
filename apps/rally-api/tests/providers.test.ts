import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.ts";
import { defaults } from "../src/config.ts";
import { createMuse, TranscriptDecoder } from "../src/muse.ts";
import type { Meeting, TranscriptEvent } from "../src/contracts.ts";

test("the Muse adapter normalizes speaker spans, timing, partials and out-of-order final turns", () => {
  const events: TranscriptEvent[] = [];
  const decoder = new TranscriptDecoder("s", (e) => events.push(e));
  decoder.accept({ type: "speechStart", turnId: 1, audioProcessedMs: 100 });
  decoder.accept({ type: "transcript", transcript: "hello" });
  decoder.accept({ type: "speaker", label: "A", audioProcessedMs: 400 });
  decoder.accept({ type: "speechEnd", turnId: 1, audioProcessedMs: 500 });
  decoder.accept({ type: "speechStart", turnId: 2, audioProcessedMs: 600 });
  decoder.accept({ type: "speaker", label: "B", audioProcessedMs: 800 });
  decoder.accept({ type: "speechEnd", turnId: 2, audioProcessedMs: 900 });
  decoder.accept({
    type: "speechComplete",
    turnId: 2,
    transcript: "Second.",
    audioProcessedMs: 900,
  });
  decoder.accept({
    type: "speechComplete",
    turnId: 1,
    transcript: "First.",
    audioProcessedMs: 500,
  });
  const finals = events.filter((e) => e.type === "final");
  assert.deepEqual(events.find((e) => e.type === "partial"), {
    type: "partial",
    text: "hello",
    sessionId: "s",
    turnId: 1,
  });
  assert.equal(finals.length, 2);
  assert.deepEqual(finals[1], {
    type: "final",
    sessionId: "s",
    turnId: 1,
    sourceOrder: 0,
    text: "First.",
    speaker: "A",
    startMs: 100,
    endMs: 500,
  });
});

test("unknown text charges block later calls and a failed request is never retried automatically", async (t) => {
  const store = new Store(":memory:");
  t.after(() => store.close());
  let calls = 0;
  const muse = createMuse(
    store,
    { ...defaults, paidEnabled: true },
    {
      key: "fixture",
      fetch: async () => {
        calls++;
        throw new Error("network");
      },
    },
  );
  const meeting = {
    id: "meeting",
    userId: "host",
    agenda: "Choose launch",
    durationMinutes: 10,
    participants: [],
  } as unknown as Meeting;
  await assert.rejects(muse.prepare(meeting));
  await assert.rejects(muse.prepare(meeting), /unknown/i);
  assert.equal(calls, 1);
});

test("the streaming adapter drains final speech and records known audio usage through a real local WebSocket", async (t) => {
  const { WebSocketServer } = await import("ws");
  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise<void>((r) => wss.once("listening", r));
  const store = new Store(":memory:");
  t.after(async () => {
    for (const client of wss.clients) client.terminate();
    await new Promise<void>((r) => wss.close(() => r()));
    store.close();
  });
  let frames = 0;
  wss.on("connection", (socket) =>
    socket.on("message", (data, binary) => {
      if (binary) {
        frames++;
        return;
      }
      const value = JSON.parse(data.toString());
      if (value.authorization) {
        assert.equal(value.mode, "DIARIZATION");
        socket.send(JSON.stringify({ sessionId: "local-asr" }));
      }
      if (value.type === "endStream") {
        for (const event of [
          { type: "speechStart", turnId: 1, audioProcessedMs: 0 },
          { type: "speaker", label: "A", audioProcessedMs: 50 },
          { type: "speechEnd", turnId: 1, audioProcessedMs: 100 },
          {
            type: "speechComplete",
            turnId: 1,
            transcript: "Finished.",
            audioProcessedMs: 100,
          },
          { type: "speaker", label: "B", audioProcessedMs: 75 },
        ])
          socket.send(JSON.stringify(event));
        socket.close(1000);
      }
    }),
  );
  const events: TranscriptEvent[] = [];
  const muse = createMuse(
    store,
    { ...defaults, paidEnabled: true },
    {
      key: "fixture",
      asrUrl: `ws://127.0.0.1:${(wss.address() as { port: number }).port}`,
    },
  );
  const session = await muse.openASR(
    { id: "meeting", userId: "host" } as Meeting,
    {
      onEvent: (e) => events.push(e),
      onError: (e) => {
        throw e;
      },
      onClose() {},
    },
  );
  session.send(new Uint8Array(3200));
  await session.end();
  assert.ok(frames >= 5);
  const finals = events.filter((e) => e.type === "final");
  assert.equal(finals.length, 2);
  assert.equal(finals[0].speaker, "A");
  assert.equal(finals[1].speaker, null);
  assert.equal(finals[1].turnId, finals[0].turnId);
  // The external accounting contract is checked through the ledger's next-call gate.
  const { UsageLedger } = await import("../src/muse.ts");
  new UsageLedger(store, defaults).check("meeting", 0.01);
});

test("unsupported post-completion speaker labels remain uncertain while metadata revisions keep the same turn", () => {
  const events: TranscriptEvent[] = [];
  const decoder = new TranscriptDecoder("session-late", (event) =>
    events.push(event),
  );
  decoder.accept({ type: "speechStart", turnId: 4, audioProcessedMs: 0 });
  decoder.accept({ type: "speechEnd", turnId: 4, audioProcessedMs: 1000 });
  decoder.accept({
    type: "speechComplete",
    turnId: 4,
    audioProcessedMs: 1000,
    transcript: "I can check rollback.",
  });
  decoder.accept({ type: "speaker", label: "A", audioProcessedMs: 300 });
  decoder.accept({ type: "speaker", label: "A", audioProcessedMs: 300 });
  decoder.accept({ type: "speaker", label: "B", audioProcessedMs: 600 });
  decoder.accept({ type: "speechEnd", turnId: 4, audioProcessedMs: 900 });
  const finals = events.filter((e) => e.type === "final");
  assert.deepEqual(
    finals.map((e) => e.speaker),
    [null, null],
  );
  assert.ok(
    finals.every(
      (e) =>
        e.turnId === 4 &&
        e.text === "I can check rollback." &&
        e.sessionId === "session-late",
    ),
  );
  assert.equal(finals.at(-1)!.endMs, 900);
});

test("blank finals and malformed metadata cannot become speech evidence or erase valid timestamps", () => {
  const events: TranscriptEvent[] = [];
  const decoder = new TranscriptDecoder("safe", (event) => events.push(event));
  decoder.accept({
    type: "speechComplete",
    turnId: 1.5,
    transcript: "Invalid turn",
  });
  decoder.accept({ type: "speechComplete", turnId: 1, transcript: "  " });
  decoder.accept({ type: "speechStart", turnId: 2, audioProcessedMs: 0 });
  decoder.accept({ type: "speaker", label: "  ", audioProcessedMs: 10 });
  decoder.accept({
    type: "speechComplete",
    turnId: 2,
    transcript: "Actual speech",
    audioProcessedMs: Infinity,
  });
  decoder.accept({ type: "speechStart", turnId: 2, audioProcessedMs: NaN });
  decoder.accept({ type: "speechEnd", turnId: 2, audioProcessedMs: -10 });
  const finals = events.filter((e) => e.type === "final");
  assert.equal(finals.length, 1);
  assert.equal(finals[0].speaker, null);
  assert.equal(finals[0].startMs, 0);
  assert.equal(finals[0].endMs, null);
  assert.ok(
    events
      .filter((e) => e.type === "progress")
      .every((e) => Number.isFinite(e.processedMs) && e.processedMs >= 0),
  );
});

test("a conflicting timing correction leaves earlier attribution uncertain", () => {
  const events: TranscriptEvent[] = [];
  const decoder = new TranscriptDecoder("bounded", (e) => events.push(e));
  decoder.accept({ type: "speechStart", turnId: 0, audioProcessedMs: 0 });
  decoder.accept({ type: "speechEnd", turnId: 0, audioProcessedMs: 1000 });
  decoder.accept({ type: "speaker", label: "A", audioProcessedMs: 950 });
  decoder.accept({
    type: "speechComplete",
    turnId: 0,
    audioProcessedMs: 1000,
    transcript: "A short sentence.",
  });
  decoder.accept({ type: "speechEnd", turnId: 0, audioProcessedMs: 900 });
  const finals = events.filter((e) => e.type === "final");
  assert.deepEqual(
    finals.map((e) => e.speaker),
    ["A", null],
  );
  assert.equal(finals[1].endMs, 900);
});

test("speaker labels follow preceding event spans even when their processing position is outside detected turn bounds", () => {
  const events: TranscriptEvent[] = [];
  const d = new TranscriptDecoder("spans", (e) => events.push(e));
  for (const event of [
    { type: "speechStart", turnId: 90, audioProcessedMs: 0 },
    { type: "transcript", transcript: "First words." },
    { type: "speechEnd", turnId: 90, audioProcessedMs: 100 },
    { type: "speaker", label: "A", audioProcessedMs: 700 },
    { type: "speechStart", turnId: -3, audioProcessedMs: 200 },
    { type: "transcript", transcript: "Second words." },
    { type: "speaker", label: "B", audioProcessedMs: 210 },
    { type: "speechEnd", turnId: -3, audioProcessedMs: 250 },
    {
      type: "speechComplete",
      turnId: -3,
      transcript: "Second words.",
      audioProcessedMs: 800,
    },
    {
      type: "speechComplete",
      turnId: 90,
      transcript: "First words.",
      audioProcessedMs: 1000,
    },
  ])
    d.accept(event);
  const finals = events.filter((e) => e.type === "final");
  assert.deepEqual(
    finals.map((e) => [e.turnId, e.speaker, e.sourceOrder]),
    [
      [-3, "B", 1],
      [90, "A", 0],
    ],
  );
  assert.equal(finals[1].endMs, 100);
});

test("overlapping or unlabeled spans cannot inherit a confidently retained earlier voice", () => {
  function decode(input: Record<string, unknown>[]) {
    const events: TranscriptEvent[] = [];
    const d = new TranscriptDecoder("ambiguous", (e) => events.push(e));
    for (const event of input) d.accept(event);
    return events.filter((e) => e.type === "final");
  }
  const start = { type: "speechStart", turnId: 1, audioProcessedMs: 0 },
    a = { type: "speaker", label: "A", audioProcessedMs: 10 };
  const complete = {
    type: "speechComplete",
    turnId: 1,
    transcript: "A complete turn.",
    audioProcessedMs: 50,
  };
  const overlapping = decode([
    start,
    a,
    { type: "speechStart", turnId: 2, audioProcessedMs: 20 },
    { type: "speaker", label: "B", audioProcessedMs: 30 },
    { type: "speechEnd", turnId: 1, audioProcessedMs: 40 },
    complete,
    { type: "speechEnd", turnId: 2, audioProcessedMs: 45 },
    { ...complete, turnId: 2 },
  ]);
  assert.deepEqual(
    overlapping.map((e) => e.speaker),
    [null, null],
  );
  for (const uncertain of [
    { type: "speaker", label: " ", audioProcessedMs: 20 },
    { type: "speaker", label: "B", audioProcessedMs: NaN },
    { type: "transcript", transcript: "New unlabeled words." },
  ])
    assert.equal(decode([start, a, uncertain, complete])[0].speaker, null);
  const covered = decode([
    start,
    { type: "transcript", transcript: "First" },
    a,
    { type: "transcript", transcript: "First and second" },
    a,
    complete,
  ]);
  assert.equal(covered[0].speaker, "A");
});

test("completion processing position never fills a missing speech-end boundary", () => {
  const events: TranscriptEvent[] = [];
  const d = new TranscriptDecoder("missing-end", (e) => events.push(e));
  d.accept({ type: "speechStart", turnId: 7, audioProcessedMs: 0 });
  d.accept({ type: "speaker", label: "A", audioProcessedMs: 40 });
  d.accept({
    type: "speechComplete",
    turnId: 7,
    transcript: "Complete words.",
    audioProcessedMs: 900,
  });
  d.accept({ type: "speechStart", turnId: 2, audioProcessedMs: 1000 });
  d.accept({ type: "speaker", label: "B", audioProcessedMs: 1100 });
  d.accept({
    type: "speechComplete",
    turnId: 2,
    transcript: "Next turn.",
    audioProcessedMs: 1200,
  });
  const finals = events.filter((e) => e.type === "final");
  assert.equal(finals[0].endMs, null);
  assert.equal(finals[1].speaker, "B");
  assert.equal(finals[1].sourceOrder, 1);
});
