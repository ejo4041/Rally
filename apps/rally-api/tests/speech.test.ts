import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApplication } from "./support/application.ts";
import { SpeechOutput, type SpeechEngine } from "../src/speech.ts";
import type {
  Meeting,
  TranscriptEvent,
  Media,
  Snapshot,
} from "../src/contracts.ts";
import { defaultSpeech, speechSettingsSchema } from "../src/speech-config.ts";
import { modelSettings } from "../src/muse.ts";
function audio() {
  const pcm = Buffer.alloc(32000);
  for (let i = 0; i < 16000; i++)
    pcm.writeInt16LE(
      Math.round(3000 * Math.sin((2 * Math.PI * 440 * i) / 16000)),
      i * 2,
    );
  const wav = Buffer.alloc(pcm.length + 44);
  wav.write("RIFF");
  pcm.copy(wav, 44);
  return {
    pcm,
    wav,
    sampleRate: 16000,
    seconds: 1,
    model: "facebook/mms-tts-eng",
    revision: "c71de0fe7204c83f1c10820a7d696d0b450048ba",
  };
}
const settle = () => new Promise<void>((r) => setImmediate(r));
test("speech configuration requires a compatible Meta adapter, checkpoint pin and audio format", () => {
  assert.deepEqual(speechSettingsSchema.parse({}), defaultSpeech);
  for (const speech of [
    { adapter: "third-party-tts" },
    { model: "someone/voice" },
    { revision: "main" },
    { sampleRate: 24000 },
    { model: "facebook/mms-tts-spa" },
    { endpoint: "https://example.test/tts" },
  ])
    assert.throws(() => modelSettings(JSON.stringify({ speech })));
  const selected = {
    ...defaultSpeech,
    model: "facebook/mms-tts-spa",
    revision: "a".repeat(40),
  };
  assert.deepEqual(
    modelSettings(JSON.stringify({ speech: selected })).speech,
    selected,
  );
});
test("speech provenance follows the injected adapter identity instead of assuming the default checkpoint", async () => {
  const m = meeting("m"),
    identity = { ...defaultSpeech, revision: "b".repeat(40) };
  const output = new SpeechOutput(
    {
      identity,
      async start() {},
      async synthesize() {
        return { ...audio(), revision: identity.revision };
      },
      close() {},
    },
    () => m,
  );
  await settle();
  const item = {
    id: randomUUID(),
    at: Date.now(),
    text: "Selected voice",
    kind: "clarify",
    epoch: 1,
  };
  m.interventions.push(item);
  output.offer(m.id, item);
  const job = output.create(m.id, item.id, 1);
  await settle();
  assert.equal(output.status().revision, identity.revision);
  assert.equal(output.get(m.id, job.id).state, "ready");
  output.close();
});
const meeting = (id: string) =>
  ({
    id,
    phase: "live",
    paused: false,
    epoch: 1,
    interventions: [],
  }) as unknown as Meeting;
test("only current approved prompts produce bounded Meta audio; cancellation blocks late results and new epochs", async () => {
  const m = meeting("m");
  let resolve: (v: ReturnType<typeof audio>) => void = () => {},
    calls = 0,
    aborted = false;
  const engine: SpeechEngine = {
    async start() {},
    synthesize(_text, { signal }) {
      calls++;
      signal.addEventListener("abort", () => (aborted = true));
      return new Promise((r) => (resolve = r));
    },
    close() {},
  };
  const output = new SpeechOutput(engine, () => m);
  await settle();
  const item = {
    id: randomUUID(),
    at: Date.now(),
    text: "Current prompt",
    kind: "clarify",
    epoch: 1,
  };
  m.interventions.push(item);
  output.offer(m.id, item);
  assert.throws(() => output.create(m.id, randomUUID(), 1), /eligible/);
  assert.equal(calls, 0);
  const first = output.create(m.id, item.id, 1);
  assert.equal(output.create(m.id, item.id, 1).id, first.id);
  assert.equal(calls, 1);
  output.cancel(m.id);
  m.epoch++;
  assert.equal(aborted, true);
  resolve(audio());
  await settle();
  assert.equal(output.get(m.id, first.id).state, "canceled");
  assert.throws(() => output.audio(m.id, first.id), /no longer/);
  assert.throws(() => output.create(m.id, item.id, 2), /eligible/);
  output.close();
});
test("one synthesis at a time, provenance validation and shield deadlines remain local to a meeting", async () => {
  const meetings = new Map([
    ["a", meeting("a")],
    ["b", meeting("b")],
  ]);
  let resolve: (v: ReturnType<typeof audio>) => void = () => {};
  const engine: SpeechEngine = {
    async start() {},
    synthesize() {
      return new Promise((r) => (resolve = r));
    },
    close() {},
  };
  const output = new SpeechOutput(engine, (id) => meetings.get(id)!);
  await settle();
  const prompts = [...meetings.values()].map((m) => {
    const p = {
      id: randomUUID(),
      at: Date.now(),
      text: "Prompt",
      kind: "clarify",
      epoch: 1,
    };
    m.interventions.push(p);
    output.offer(m.id, p);
    return p;
  });
  const a = output.create("a", prompts[0].id, 1);
  assert.throws(() => output.create("b", prompts[1].id, 1), /busy/);
  resolve(audio());
  await settle();
  assert.equal(output.get("a", a.id).state, "ready");
  assert.equal(output.shielded("a"), false);
  output.playback("a", a.id, "playing");
  assert.equal(output.shielded("a"), true);
  assert.equal(output.shielded("b"), false);
  output.playback("a", a.id, "completed");
  assert.throws(() => output.playback("a", a.id, "playing"), /not ready/);
  assert.throws(() => output.audio("a", a.id), /no longer/);
  await new Promise((r) => setTimeout(r, 850));
  assert.equal(output.shielded("a"), false);
  const b = output.create("b", prompts[1].id, 1);
  resolve({ ...audio(), model: "unrelated-model" });
  await settle();
  assert.equal(output.get("b", b.id).state, "failed");
  assert.throws(() => output.audio("b", b.id), /no longer/);
  output.close();
});

test("canceled jobs expire and an older expiry cannot revoke a replacement job", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100000 });
  const m = meeting("m");
  const output = new SpeechOutput(
    {
      async start() {},
      async synthesize() {
        return audio();
      },
      close() {},
    },
    () => m,
  );
  await settle();
  function offer() {
    const item = {
      id: randomUUID(),
      at: Date.now(),
      text: "Current prompt",
      kind: "clarify",
      epoch: 1,
    };
    m.interventions.push(item);
    output.offer(m.id, item);
    return output.create(m.id, item.id, 1);
  }
  const old = offer();
  await settle();
  output.cancel(m.id);
  t.mock.timers.tick(20000);
  const replacement = offer();
  await settle();
  t.mock.timers.tick(55001);
  assert.equal(output.get(m.id, replacement.id).state, "ready");
  output.cancel(m.id);
  t.mock.timers.tick(20000);
  assert.throws(() => output.get(m.id, replacement.id), /not found/);
  assert.throws(() => output.get(m.id, old.id), /not found/);
  output.close();
});

test("a coverage-record failure prevents playback acknowledgement and input shielding", async () => {
  const m = meeting("m");
  const output = new SpeechOutput(
    {
      async start() {},
      async synthesize() {
        return audio();
      },
      close() {},
    },
    () => m,
    () => {
      throw Error("Coverage storage failed");
    },
  );
  await settle();
  const p = {
    id: randomUUID(),
    at: Date.now(),
    text: "Approved prompt",
    kind: "clarify",
    epoch: 1,
  };
  m.interventions.push(p);
  output.offer(m.id, p);
  const job = output.create(m.id, p.id, 1);
  await settle();
  assert.throws(
    () => output.playback(m.id, job.id, "playing"),
    /Coverage storage failed/,
  );
  assert.equal(output.shielded(m.id), false);
  assert.equal(output.get(m.id, job.id).state, "ready");
  output.close();
});
test("HTTP speech is owner isolated, generated only from approved text, shields audio and stops on host pause/end", async (t) => {
  let onAudio: (bytes: Uint8Array) => void = () => {},
    final: (e: TranscriptEvent) => void = () => {},
    lastPCM: Uint8Array | undefined,
    spoken = "";
  let reportInput: Snapshot | undefined;
  const plan = {
    objective: "Decide",
    topics: [
      {
        id: "decide",
        title: "Decide",
        outcome: "A decision",
        minutes: 2,
        status: "pending" as const,
      },
    ],
    durationMinutes: 3,
    wrapMinutes: 1,
  };
  const media: Media = {
    async open(_m, a) {
      onAudio = a;
      return {
        async connection() {
          return { url: "ws://fixture", token: "fixture", room: "fixture" };
        },
        async send() {},
        async close() {},
      };
    },
  };
  const app = createApplication({
    dbPath: ":memory:",
    assessmentMs: 60000,
    media,
    speechEngine: {
      async start() {},
      async synthesize(text) {
        spoken = text;
        return audio();
      },
      close() {},
    },
    providers: {
      async prepare() {
        return plan;
      },
      async openASR(_m, c) {
        final = c.onEvent;
        return {
          sessionId: "s",
          send(bytes) {
            lastPCM = bytes;
          },
          async end() {},
          close() {},
          sentSeconds: 0,
          processedMs: 0,
        };
      },
      async assess(s) {
        return {
          health: 3,
          reason: "Clarify owner",
          issues: ["missing_action_details"],
          evidence: [s.turns[0].id],
          progress: "Decision underway",
          intervention: {
            text: "Who owns the check?",
            kind: "clarify",
            evidence: [s.turns[0].id],
          },
          plan: null,
          planReason: "",
        };
      },
      async report(s: Snapshot) {
        reportInput = s;
        throw Error("No paid fixture report");
      },
    },
  });
  const server = app.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  t.after(async () => {
    server.close();
    await app.close();
  });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const req = (path: string, method = "GET", body?: unknown, cookie = "") =>
    fetch(base + path, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const cookies = [];
  for (const username of ["alice", "bravo"]) {
    const r = await req("/fixture/signup", "POST", {
      username,
      password: "fixture-test-password",
    });
    cookies.push(r.headers.get("set-cookie")!.split(";")[0]);
  }
  const [alice, bravo] = cookies;
  assert.equal((await req("/speech/status")).status, 401);
  assert.equal(
    (await (await req("/speech/status", "GET", undefined, alice)).json()).ready,
    true,
  );
  const checked = await req(
    "/speech/test",
    "POST",
    { text: "Untrusted phrase" },
    alice,
  );
  assert.equal(checked.status, 202);
  const diagnostic = await checked.json();
  await settle();
  assert.equal(spoken, "Hi, I am Rally. Let us make this meeting count.");
  assert.equal(
    (await req(`/speech/test/${diagnostic.id}/audio`, "GET", undefined, bravo))
      .status,
    404,
  );
  assert.equal(
    (
      await req(
        `/speech/test/${diagnostic.id}/playback`,
        "POST",
        { state: "canceled" },
        bravo,
      )
    ).status,
    404,
  );
  assert.equal(
    (await req(`/speech/test/${diagnostic.id}/audio`, "GET", undefined, alice))
      .status,
    200,
  );
  assert.equal(
    (
      await req(
        `/speech/test/${diagnostic.id}/playback`,
        "POST",
        { state: "playing" },
        alice,
      )
    ).status,
    200,
  );
  assert.deepEqual(
    await (await req("/meetings", "GET", undefined, alice)).json(),
    [],
  );
  await req(
    `/speech/test/${diagnostic.id}/playback`,
    "POST",
    { state: "canceled" },
    alice,
  );
  assert.equal(
    (await req(`/speech/test/${diagnostic.id}/audio`, "GET", undefined, alice))
      .status,
    409,
  );
  assert.equal((await req("/speech/test", "POST", {}, alice)).status, 429);
  const m = await (
    await req(
      "/meetings",
      "POST",
      { agenda: "Decide", durationMinutes: 3 },
      alice,
    )
  ).json();
  await req(`/meetings/${m.id}/start`, "POST", { consented: true }, alice);
  assert.equal((await req("/speech/test", "POST", {}, alice)).status, 409);
  final({
    type: "final",
    sessionId: "s",
    turnId: 0,
    text: "We need an owner",
    speaker: "A",
  });
  const assessed = await (
    await req(
      `/meetings/${m.id}/commands`,
      "POST",
      { type: "request_guidance" },
      alice,
    )
  ).json();
  const prompt = assessed.interventions.at(-1),
    input = {
      interventionId: prompt.id,
      epoch: assessed.epoch,
      text: "Injected text must not be spoken",
    };
  let job = await (
    await req(`/meetings/${m.id}/speech`, "POST", input, alice)
  ).json();
  await settle();
  assert.equal(spoken, "Who owns the check?");
  for (const path of [
    `/meetings/${m.id}/speech/${job.id}`,
    `/meetings/${m.id}/speech/${job.id}/audio`,
  ])
    assert.equal((await req(path, "GET", undefined, bravo)).status, 404);
  const wav = await req(
    `/meetings/${m.id}/speech/${job.id}/audio`,
    "GET",
    undefined,
    alice,
  );
  assert.equal(wav.headers.get("content-type"), "audio/wav");
  assert.ok(wav.headers.get("cache-control")?.includes("no-store"));
  final({
    type: "final",
    sessionId: "s",
    turnId: 0,
    text: "We need an owner",
    speaker: null,
  });
  assert.equal(
    (
      await (
        await req(`/meetings/${m.id}/speech/${job.id}`, "GET", undefined, alice)
      ).json()
    ).state,
    "canceled",
  );
  assert.equal(
    (
      await req(
        `/meetings/${m.id}/speech/${job.id}/audio`,
        "GET",
        undefined,
        alice,
      )
    ).status,
    409,
  );
  const refreshed = await (
    await req(
      `/meetings/${m.id}/commands`,
      "POST",
      { type: "request_guidance" },
      alice,
    )
  ).json();
  job = await (
    await req(
      `/meetings/${m.id}/speech`,
      "POST",
      {
        interventionId: refreshed.interventions.at(-1).id,
        epoch: refreshed.epoch,
      },
      alice,
    )
  ).json();
  await settle();
  await req(
    `/meetings/${m.id}/speech/${job.id}/playback`,
    "POST",
    { state: "playing" },
    alice,
  );
  let withShield = await (
    await req(`/meetings/${m.id}`, "GET", undefined, alice)
  ).json();
  assert.equal(withShield.audioExclusions.length, 1);
  assert.equal(withShield.audioExclusions[0].id, job.id);
  assert.equal(withShield.audioExclusions[0].reason, "moderator_speech");
  assert.equal(
    withShield.audioExclusions[0].maxEndMs -
      withShield.audioExclusions[0].startMs,
    3000,
  );
  await req(
    `/meetings/${m.id}/speech/${job.id}/playback`,
    "POST",
    { state: "playing" },
    alice,
  );
  withShield = await (
    await req(`/meetings/${m.id}`, "GET", undefined, alice)
  ).json();
  assert.equal(withShield.audioExclusions.length, 1);
  onAudio(new Uint8Array([10, 20, 30, 40]));
  assert.deepEqual(lastPCM, new Uint8Array(4));
  await req(`/meetings/${m.id}/commands`, "POST", { type: "pause" }, alice);
  assert.equal(
    (
      await req(
        `/meetings/${m.id}/speech/${job.id}/audio`,
        "GET",
        undefined,
        alice,
      )
    ).status,
    409,
  );
  assert.equal(
    (await req(`/meetings/${m.id}/speech`, "POST", input, alice)).status,
    409,
  );
  await new Promise((r) => setTimeout(r, 850));
  onAudio(new Uint8Array([10, 20]));
  assert.deepEqual(lastPCM, new Uint8Array([10, 20]));
  await req(`/meetings/${m.id}/end`, "POST", {}, alice);
  await settle();
  assert.equal(reportInput?.meeting.audioExclusions?.[0].id, job.id);
  assert.equal(reportInput?.meeting.audioExclusions?.length, 1);
});
