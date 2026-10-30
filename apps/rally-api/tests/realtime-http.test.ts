import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "./support/application.ts";
import type { TranscriptEvent, LiveEvent } from "../src/contracts.ts";
import type { LiveContext, LiveDecision } from "../src/realtime.ts";
import { SeamlessSpeech } from "../src/seamless.ts";
const observation = (context: LiveContext): LiveDecision => ({
  health: 4,
  feeling: "curious",
  observation: "Useful exploration",
  progress: "One candidate",
  concern: "",
  evidence: [context.partials[0]?.id ?? context.finals[0]?.id].filter(Boolean),
  intervention: null,
  agendaChange: null,
  extension: null,
  extensionConsent: null,
});
async function waitFor(check: () => boolean | Promise<boolean>) {
  for (let i = 0; i < 150; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail("Timed out waiting for public state");
}
async function fixture(
  t: any,
  options: {
    teams?: boolean;
    check?: (c: LiveContext) => Promise<LiveDecision>;
    holdSpeech?: boolean;
  } = {},
) {
  let emit: (event: TranscriptEvent) => void = () => {},
    incoming: (data: Uint8Array) => void = () => {},
    release = () => {};
  const contexts: LiveContext[] = [],
    events: LiveEvent[] = [],
    received: Uint8Array[] = [];
  const api = createApplication({
    dbPath: ":memory:",
    paidEnabled: true,
    realtimeEnabled: true,
    teamsDuplexEnabled: true,
    assessmentMs: 25,
    captureLeaseMs: 1000000,
    teamsConnector: async () => ({
      alive: () => true,
      receive: (audio) => {
        incoming = audio;
        return () => {};
      },
      play: async (chunks, _signal, before) => {
        for await (const chunk of chunks) before();
      },
      close: async () => {},
    }),
    tts: new SeamlessSpeech(
      "fixture",
      undefined,
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(640));
              if (options.holdSpeech) release = () => {release=()=>{};try{controller.close();}catch(error){if((error as NodeJS.ErrnoException).code!=='ERR_INVALID_STATE')throw error;}};
              else controller.close();
            },
          }),
        ),
    ),
    media: {
      open: async (_meeting, audio) => {
        if (!options.teams) incoming = audio;
        return {
          connection: async () => ({
            url: "ws://fixture",
            token: "fixture",
            room: "fixture",
          }),
          send: async (e) => {
            events.push(e);
          },
          close: async () => {},
          play: async (_job, chunks, _signal, before) => {
            for await (const chunk of chunks) before();
          },
        };
      },
    },
    providers: {
      prepare: async () => ({
        objective: "Choose candidates",
        topics: [
          {
            id: "one",
            title: "Candidates",
            outcome: "Choose",
            minutes: 9,
            status: "active",
          },
        ],
        durationMinutes: 10,
        wrapMinutes: 1,
      }),
      openASR: async (_m, c) => {
        emit = c.onEvent;
        return {
          sessionId: "s",
          send(data) {
            received.push(data);
          },
          end: async () => {},
          close() {},
          sentSeconds: 0,
          processedMs: 0,
        };
      },
      checkLive: async (c) => {
        contexts.push(c);
        return options.check ? options.check(c) : observation(c);
      },
    },
  });
  const server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  t.after(async () => {
    release();
    await api.close();
    await new Promise<void>((r) => server.close(() => r()));
  });
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  let cookie = "";
  const req = (
    path: string,
    body?: unknown,
    override?: string,
    method?: string,
  ) =>
    fetch(base + path, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        cookie: override ?? cookie,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const signup = await req("/fixture/signup", {
    username: "owner",
    password: "fixture-password",
  });
  cookie = signup.headers.get("set-cookie")!.split(";")[0];
  const created = await req("/meetings", {
    title: "Realtime",
    agenda: "Choose candidates",
    durationMinutes: 10,
    participants: ["Alice"],
  });
  assert.equal(created.status, 201);
  const m = await created.json();
  if (options.teams) {
    assert.equal(
      (
        await req(`/meetings/${m.id}/teams/connect`, {
          meetingUrl: "https://teams.microsoft.com/meet/fixture",
          consented: true,
        })
      ).status,
      202,
    );
    await waitFor(
      async () =>
        (await (await req(`/meetings/${m.id}/teams/status`)).json()).state ===
        "connected",
    );
  } else
    assert.equal(
      (await req(`/meetings/${m.id}/start`, { consented: true })).status,
      200,
    );
  return {
    id: m.id,
    req,
    contexts,
    events,
    received,
    emit: (e: TranscriptEvent) => emit(e),
    incoming: (b: Uint8Array) => incoming(b),
    release: () => release(),
    snapshot: async () => (await req(`/meetings/${m.id}`)).json(),
  };
}
test("HTTP live checks read cumulative speech before finalization; owner history and pause remain authoritative", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const f = await fixture(t);
  let text = "";
  for (let i = 1; i <= 9; i++) {
    t.mock.timers.tick(10000);
    text += " candidate" + i;
    f.emit({ type: "partial", sessionId: "s", turnId: 1, text });
    await waitFor(() => f.contexts.some((c) => c.partials[0]?.text === text));
  }
  const snapshot = await f.snapshot();
  assert.equal(snapshot.turns.length, 0);
  assert.ok(f.contexts.length >= 9);
  assert.ok(f.contexts.at(-1)!.meeting.elapsedSeconds >= 90);
  assert.equal(f.contexts.at(-1)!.partials.length, 1);
  const history = await (await f.req(`/meetings/${f.id}/checks`)).json();
  assert.ok(history.items.some((c: any) => c.status === "accepted"));
  const other = await f.req("/fixture/signup", {
    username: "other",
    password: "fixture-password",
  });
  const otherCookie = other.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await f.req(`/meetings/${f.id}/checks`, undefined, otherCookie)).status,
    404,
  );
  await f.req(`/meetings/${f.id}/commands`, { type: "pause" });
  const calls = f.contexts.length;
  await waitFor(() =>
    f.events.some((e) => e.type === "meeting.status" && (e.data as any).paused),
  );
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(f.contexts.length, calls);
  await f.req("/auth/logout", {});
  assert.equal((await f.req(`/meetings/${f.id}/checks`)).status, 401);
});
test("HTTP Teams keeps real participant bytes while Rally finishes its own utterance", async (t) => {
  const f = await fixture(t, {
    teams: true,
    holdSpeech: true,
    check: async (c) => ({
      ...observation(c),
      intervention: { kind: "redirect", text: "Choose the next candidate." },
    }),
  });
  f.emit({
    type: "partial",
    sessionId: "s",
    turnId: 1,
    text: "This unrelated topic keeps going",
  });
  await waitFor(
    async () => (await f.snapshot()).speechStatus?.state === "playing",
  );
  f.incoming(new Uint8Array([4, 3, 2, 1]));
  assert.deepEqual([...f.received.at(-1)!], [4, 3, 2, 1]);
  const during = await f.snapshot();
  assert.equal((during.audioExclusions ?? []).length, 0);
  const speechId = during.speechStatus.id;
  f.emit({
    type: "partial",
    sessionId: "s",
    turnId: 1,
    text: "Actually this relates to the agenda",
  });
  await waitFor(() => f.contexts.length >= 2);
  assert.equal((await f.snapshot()).speechStatus.id, speechId);
  f.release();
  await waitFor(() =>
    f.events.some(
      (e) =>
        e.type === "speech.status" &&
        (e.data as any).id === speechId &&
        (e.data as any).state === "completed",
    ),
  );
});
test("HTTP extension requires exact owner confirmation and cannot be replayed", async (t) => {
  const f = await fixture(t, {
    check: async (c) => ({
      ...observation(c),
      extension: { minutes: 5, reason: "Time for another candidate" },
    }),
  });
  f.emit({ type: "partial", sessionId: "s", turnId: 1, text: "We need time" });
  await waitFor(async () => !!(await f.snapshot()).extension);
  const proposal = (await f.snapshot()).extension;
  assert.equal((await f.snapshot()).plan.durationMinutes, 10);
  assert.equal(
    (
      await f.req(`/meetings/${f.id}/extension`, {
        proposalId: "wrong",
        accept: true,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.req(`/meetings/${f.id}/extension`, {
        proposalId: proposal.id,
        accept: true,
      })
    ).status,
    200,
  );
  assert.equal((await f.snapshot()).plan.durationMinutes, 15);
  assert.equal(
    (
      await f.req(`/meetings/${f.id}/extension`, {
        proposalId: proposal.id,
        accept: true,
      })
    ).status,
    409,
  );
});

test("HTTP logout revokes an in-flight browser decision before it can speak", async (t) => {
  let resolve!: (d: LiveDecision) => void, snapshot!: LiveContext;
  const f = await fixture(t, {
    check: async (c) => {
      snapshot = c;
      return new Promise((r) => (resolve = r));
    },
  });
  f.emit({ type: "partial", sessionId: "s", turnId: 1, text: "A tangent" });
  await waitFor(() => !!resolve);
  await f.req("/auth/logout", {});
  resolve({
    ...observation(snapshot),
    intervention: { kind: "redirect", text: "Late request must not play" },
  });
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(
    f.events.some((e) => e.type === "speech.status"),
    false,
  );
  const login = await f.req("/fixture/login", {
    username: "owner",
    password: "fixture-password",
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const saved = await (
    await f.req(`/meetings/${f.id}`, undefined, cookie)
  ).json();
  assert.equal(saved.phase, "interrupted");
  assert.equal(saved.interventions.length, 0);
});
test("HTTP spoken extension needs finalized explicit agreement after the proposal", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const f = await fixture(t, {
    check: async (c) => ({
      ...observation(c),
      extension: c.extension
        ? null
        : { minutes: 5, reason: "Finish candidate" },
      extensionConsent:
        c.extension && c.finals.some((turn) => turn.id === "s:2")
          ? { proposalId: c.extension.id, evidence: "s:2" }
          : null,
    }),
  });
  f.emit({ type: "partial", sessionId: "s", turnId: 1, text: "Need time" });
  await waitFor(async () => !!(await f.snapshot()).extension);
  t.mock.timers.tick(10000);
  f.emit({
    type: "partial",
    sessionId: "s",
    turnId: 2,
    text: "Yes, extend by 5 minutes.",
  });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal((await f.snapshot()).plan.durationMinutes, 10);
  f.emit({
    type: "final",
    sessionId: "s",
    turnId: 2,
    text: "Yes, I agree to extend by 5 minutes.",
    speaker: "A",
    startMs: 5000,
    endMs: 9000,
  });
  await new Promise((r) => setTimeout(r, 60));
  assert.equal((await f.snapshot()).extension.state, "pending");
  const proposal = (await f.snapshot()).extension;
  assert.equal(
    (
      await f.req(`/meetings/${f.id}/extension/presented`, {
        proposalId: proposal.id,
      })
    ).status,
    200,
  );
  t.mock.timers.tick(10000);
  f.emit({
    type: "final",
    sessionId: "s",
    turnId: 2,
    text: "Yes, I agree to extend by 5 minutes.",
    speaker: "A",
    startMs: 15000,
    endMs: 19000,
  });
  await waitFor(
    async () => (await f.snapshot()).extension.state === "confirmed",
  );
  assert.equal((await f.snapshot()).plan.durationMinutes, 15);
  assert.equal((await f.snapshot()).extension.confirmation.method, "spoken");
});

test("HTTP conflicting spoken replies leave extension pending", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const f = await fixture(t, {
    check: async (c) => ({
      ...observation(c),
      extension: c.extension
        ? null
        : { minutes: 5, reason: "Finish candidate" },
      extensionConsent:
        c.extension && c.finals.some((turn) => turn.id === "s:2")
          ? { proposalId: c.extension.id, evidence: "s:2" }
          : null,
    }),
  });
  f.emit({ type: "partial", sessionId: "s", turnId: 1, text: "Need time" });
  await waitFor(async () => !!(await f.snapshot()).extension);
  const proposal = (await f.snapshot()).extension;
  await f.req(`/meetings/${f.id}/extension/presented`, {
    proposalId: proposal.id,
  });
  t.mock.timers.tick(10000);
  f.emit({
    type: "final",
    sessionId: "s",
    turnId: 3,
    text: "No, I have to leave.",
    speaker: "B",
    startMs: 6000,
    endMs: 9000,
  });
  f.emit({
    type: "final",
    sessionId: "s",
    turnId: 2,
    text: "Yes, I agree to extend by 5 minutes.",
    speaker: "A",
    startMs: 5000,
    endMs: 6000,
  });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal((await f.snapshot()).extension.state, "pending");
  assert.equal((await f.snapshot()).plan.durationMinutes, 10);
});

test("ordinary live host plan edits cannot increase the deadline", async (t) => {
  const f = await fixture(t);
  const m = await f.snapshot();
  const plan = { ...m.plan, durationMinutes: 15, wrapMinutes: 6 };
  const blocked = await f.req(
    `/meetings/${f.id}/plan`,
    plan,
    undefined,
    "PATCH",
  );
  assert.equal(blocked.status, 409);
  assert.equal((await f.snapshot()).plan.durationMinutes, 10);
});

test("an extension voice delivery is bound to the exact requested minutes", async (t) => {
  const f = await fixture(t, {
    check: async (c) => ({
      ...observation(c),
      extension: { minutes: 5, reason: "Finish agenda" },
      intervention: { text: "Choose another candidate.", kind: "checkpoint" },
    }),
  });
  f.emit({ type: "partial", sessionId: "s", turnId: 1, text: "Need time" });
  await waitFor(async () => (await f.snapshot()).interventions.length > 0);
  const m = await f.snapshot();
  assert.match(
    m.interventions[0].text,
    /Can everyone stay for another 5 minutes\?/,
  );
  assert.equal(m.extension.utteranceId, m.interventions[0].id);
});

test("interrupted host plan edits cannot bypass extension confirmation", async (t) => {
  const f = await fixture(t);
  await f.req("/auth/logout", {});
  const login = await f.req("/fixture/login", {
    username: "owner",
    password: "fixture-password",
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const m = await (await f.req(`/meetings/${f.id}`, undefined, cookie)).json();
  assert.equal(m.phase, "interrupted");
  const blocked = await f.req(
    `/meetings/${f.id}/plan`,
    { ...m.plan, durationMinutes: 15, wrapMinutes: 6 },
    cookie,
    "PATCH",
  );
  assert.equal(blocked.status, 409);
});

test("disputed extension blocks plan edits until reconfirmed without trapping recovery", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const f = await fixture(t, {
    check: async (c) => ({
      ...observation(c),
      extension: c.extension
        ? null
        : { minutes: 5, reason: "Finish candidate" },
      extensionConsent:
        c.extension && c.finals.some((turn) => turn.id === "s:2")
          ? { proposalId: c.extension.id, evidence: "s:2" }
          : null,
    }),
  });
  f.emit({ type: "partial", sessionId: "s", turnId: 1, text: "Need time" });
  await waitFor(async () => !!(await f.snapshot()).extension);
  const p = (await f.snapshot()).extension;
  await f.req(`/meetings/${f.id}/extension/presented`, { proposalId: p.id });
  t.mock.timers.tick(10000);
  f.emit({
    type: "final",
    sessionId: "s",
    turnId: 2,
    text: "Yes, I agree to extend by 5 minutes.",
    speaker: "A",
    startMs: 5000,
    endMs: 6000,
  });
  await waitFor(
    async () => (await f.snapshot()).extension.state === "confirmed",
  );
  f.emit({
    type: "final",
    sessionId: "s",
    turnId: 2,
    text: "No, I cannot extend by 5 minutes.",
    speaker: "A",
    startMs: 5000,
    endMs: 6000,
  });
  await waitFor(
    async () => (await f.snapshot()).extension.state === "disputed",
  );
  const m = await f.snapshot();
  assert.equal(
    (
      await f.req(
        `/meetings/${f.id}/plan`,
        { ...m.plan, durationMinutes: 10, wrapMinutes: 1 },
        undefined,
        "PATCH",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.req(`/meetings/${f.id}/extension`, {
        proposalId: p.id,
        accept: true,
      })
    ).status,
    200,
  );
  assert.equal((await f.snapshot()).plan.durationMinutes, 15);
});

test("accepted continuous affect and concern memory survive later checking without replay", async (t) => {
  const f = await fixture(t, {
    check: async (c) => ({
      ...observation(c),
      affect: {
        forces: {
          joy: 0.2,
          curiosity: null,
          worry: 0.1,
          irritation: null,
          sadness: null,
          confidence: null,
          energy: null,
          sass: null,
        },
        evidence: [c.partials[0]?.id ?? c.finals[0]?.id],
        rationale: "Initial drift",
      },
      focus: {
        intendedTopicId: "one",
        detour: "Side question",
        evidence: [c.partials[0]?.id ?? c.finals[0]?.id],
      },
      concerns: [
        {
          id: "drift",
          description: "Side question remains open",
          resolved: false,
          evidence: [c.partials[0]?.id ?? c.finals[0]?.id],
        },
      ],
    }),
  });
  f.emit({
    type: "partial",
    sessionId: "s",
    turnId: 1,
    text: "Can we discuss phones?",
  });
  await waitFor(async () => !!(await f.snapshot()).presence);
  const first = await f.snapshot();
  assert.equal(first.presenceFocus.detour, "Side question");
  assert.equal(first.concerns[0].id, "drift");
  assert.equal(first.progress, "One candidate");
  const expires = first.presence.channels.worry.expires;
  await waitFor(() => f.contexts.length >= 3);
  const next = await f.snapshot();
  assert.equal(next.presence.channels.worry.expires, expires);
  assert.equal(next.presenceFocus.detour, "Side question");
  assert.equal(f.contexts.at(-1)?.concerns?.[0].id, "drift");
});

test("corrected provisional evidence clears persisted focus, concerns and emotion drive", async (t) => {
  let answer = true;
  const f = await fixture(t, {
    check: async (c) =>
      answer
        ? {
            ...observation(c),
            affect: {
              forces: {
                joy: null,
                curiosity: null,
                worry: 0.4,
                irritation: 0.2,
                sadness: null,
                confidence: null,
                energy: null,
                sass: null,
              },
              evidence: ["s:1"],
              rationale: "Drift",
            },
            focus: {
              intendedTopicId: "one",
              detour: "Phones",
              evidence: ["s:1"],
            },
            concerns: [
              {
                id: "drift",
                description: "Phones",
                resolved: false,
                evidence: ["s:1"],
              },
            ],
          }
        : observation(c),
  });
  f.emit({
    type: "partial",
    sessionId: "s",
    turnId: 1,
    text: "We should discuss phones",
  });
  await waitFor(async () => !!(await f.snapshot()).presenceFocus);
  answer = false;
  f.emit({
    type: "partial",
    sessionId: "s",
    turnId: 1,
    text: "Actually discuss launch scope",
  });
  const m = await f.snapshot();
  assert.equal(m.presenceFocus, null);
  assert.deepEqual(m.concerns, []);
  assert.equal(m.presence.channels.worry.force, 0);
});

test("changing one emotion never replaces provenance for an untouched axis", async (t) => {
  let stage = 0;
  const f = await fixture(t, {
    check: async (c) => ({
      ...observation(c),
      affect: {
        forces: {
          joy: stage ? 0.2 : null,
          curiosity: null,
          worry: stage ? null : 0.4,
          irritation: null,
          sadness: null,
          confidence: null,
          energy: null,
          sass: null,
        },
        evidence: [stage ? "s:2" : "s:1"],
        rationale: "Independent channels",
      },
    }),
  });
  f.emit({
    type: "partial",
    sessionId: "s",
    turnId: 1,
    text: "Discuss phones instead",
  });
  await waitFor(
    async () => !!(await f.snapshot()).presence?.channels.worry.force,
  );
  stage = 1;
  f.emit({
    type: "partial",
    sessionId: "s",
    turnId: 2,
    text: "We made another useful decision",
  });
  await waitFor(
    async () => (await f.snapshot()).presence?.channels.joy.force === 0.2,
  );
  f.emit({
    type: "partial",
    sessionId: "s",
    turnId: 1,
    text: "Discuss launch scope instead",
  });
  const m = await f.snapshot();
  assert.equal(m.presence.channels.worry.force, 0);
  assert.equal(m.presence.channels.joy.force, 0.2);
});
