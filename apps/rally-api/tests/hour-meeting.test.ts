import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.ts";
import { Meetings } from "../src/meetings.ts";
import { Engine } from "../src/engine.ts";
import { defaults } from "../src/config.ts";
import { categories, type LiveEvent, type Plan, type Providers, type Snapshot } from "../src/contracts.ts";
import type { LiveCheck, LiveContext, LiveDecision } from "../src/realtime.ts";
import { SpeechOutput } from "../src/speech.ts";
import type { SpeechOffer } from "../src/live-speech.ts";
import { axes, values } from "../../../packages/rally-presence/state.ts";
import { sceneFor } from "../../../packages/rally-presence/scene.ts";

// Accelerated transcript/control replay, deliberately denser than a typical call.
// These fixtures exercise the real engine/SQLite/monitor/provider boundaries;
// they do not model network latency, acoustic accuracy, TTS or camera endurance.
for (const durationMinutes of [30, 60]) {
  test(`${durationMinutes}-minute dense replay bounds live evidence and retains the complete corrected report transcript`, async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1_800_000_000_000 });
    const store = new Store(":memory:");
    store.db.prepare("INSERT INTO users VALUES(?,?,?)").run("host", "host", "fixture");
    const plan: Plan = {
      objective: "Agree scope, assign owners, and review delivery risks",
      durationMinutes,
      wrapMinutes: 1,
      topics: [
        { id: "scope", title: "Scope", outcome: "Choose scope", minutes: durationMinutes / 3, status: "active" },
        { id: "owners", title: "Owners", outcome: "Assign owners", minutes: durationMinutes / 3, status: "pending" },
        { id: "risks", title: "Risks", outcome: "Record mitigations", minutes: durationMinutes / 3 - 1, status: "pending" },
      ],
    };
    const expected = new Map<string, { text: string; revision: number }>();
    const sources: { id: string; callbacks: Parameters<Providers["openASR"]>[1]; ended: boolean; packets: number }[] = [];
    const interventions: LiveEvent[] = [];
    const contexts: LiveContext[] = [];
    let reportInput: Snapshot | undefined, correctionAtCheck = false, correctedId = "", mediaCloses = 0;
    let replayingAffect = false, replayedCommands = 0, regroupedCommands = 0, maxConcerns = 0;
    const previouslyCited = new Set<string>();
    let inputAudio: (bytes: Uint8Array) => void = () => {};
    const finalize = (source: typeof sources[number], turnId: number, text: string) => {
      const id = `${source.id}:${turnId}`, prior = expected.get(id);
      source.callbacks.onEvent({ type: "final", sessionId: source.id, turnId, sourceOrder: turnId, text, speaker: turnId % 2 ? "A" : "B" });
      expected.set(id, { text, revision: (prior?.revision ?? 0) + 1 });
    };
    const providers: Providers = {
      prepare: async () => structuredClone(plan),
      assess: async () => { throw new Error("Realtime replay must not call legacy assessment"); },
      openASR: async (_m, callbacks) => {
        const source = { id: `source-${sources.length + 1}`, callbacks, ended: false, packets: 0 };
        sources.push(source);
        return {
          sessionId: source.id,
          send() { assert.equal(source.ended, false); source.packets++; },
          async end() { source.ended = true; callbacks.onClose(); },
          close() { source.ended = true; },
          sentSeconds: 0,
          processedMs: 0,
        };
      },
      checkLive: async (context) => {
        contexts.push(structuredClone(context));
        assert.ok(context.finals.length <= 20);
        assert.ok(context.finals.reduce((n, turn) => n + turn.text.length, 0) <= 8000);
        assert.ok(context.partials.length <= 2);
        assert.ok(context.partials.every((turn) => turn.text.length <= 4000));
        assert.ok(context.moderator.length <= 4);
        assert.ok((context.concerns?.length ?? 0) <= 16);
        assert.ok((context.gaps?.length ?? 0) <= 3);
        assert.ok(!JSON.stringify(context).includes('"consumed":'), "the growing evidence ledger must not enter model context");
        assert.ok(!("turns" in context.meeting) && !("revisions" in context.meeting) && !("report" in context.meeting));
        for (const turn of context.finals) assert.equal(turn.text, expected.get(turn.id)?.text, "finalized evidence must remain complete");
        const latest = context.finals.at(-1)!;
        const step = context.meeting.elapsedSeconds / 10;
        const reusable = context.finals.filter((turn) => previouslyCited.has(turn.id));
        // Repeat a consumed citation every two minutes; every four minutes
        // regroup two old citations. Neither may renew the emotion drive.
        replayingAffect = step % 12 === 0 && reusable.length > 0;
        const affectEvidence = replayingAffect
          ? reusable.slice(step % 24 === 0 ? -2 : -1).map((turn) => turn.id)
          : [latest.id];
        for (const id of affectEvidence) previouslyCited.add(id);
        const oldConcern = step % 3 === 0 ? context.concerns?.find((concern) => !concern.resolved) : undefined;
        const decision: LiveDecision = {
          health: 4, feeling: "focused", observation: "The current agenda item is progressing",
          progress: `Reviewed ${context.meeting.elapsedSeconds} seconds`, concern: "", evidence: [latest.id],
          intervention: context.meeting.elapsedSeconds % 300 === 0 ? { kind: "checkpoint", text: "Confirm the owner and next action before moving on." } : null,
          agendaChange: null, extension: null, extensionConsent: null,
          affect: {
            forces: Object.fromEntries(axes.map((axis) => [axis, axis === "worry"
              ? step % 2 ? context.emotions!.worry.increaseTo100 : context.emotions!.worry.decreaseToZero
              : null])),
            evidence: affectEvidence,
            rationale: "Synthetic alternating dependency concern and recovery",
          },
          concerns: [
            { id: `active-${step}`, description: `Review the dependency in ${latest.id}`, resolved: false, evidence: [latest.id] },
            { id: oldConcern?.id ?? `resolved-${step}`, description: `Synthetic resolution recorded against ${latest.id}`, resolved: true, evidence: [latest.id] },
          ],
        };
        const boundary = durationMinutes * 20;
        if (context.meeting.elapsedSeconds === boundary || context.meeting.elapsedSeconds === boundary * 2) {
          const first = context.meeting.elapsedSeconds === boundary;
          decision.agendaChange = {
            reason: first ? "Scope agreed; assign owners" : "Owners assigned; review risks",
            order: null, additions: [], evidence: [latest.id],
            updates: [
              { id: first ? "scope" : "owners", minutes: null, status: "done" },
              { id: first ? "owners" : "risks", minutes: null, status: "active" },
            ],
          };
        }
        if (correctionAtCheck) {
          correctionAtCheck = false;
          correctedId = latest.id;
          finalize(sources.at(-1)!, latest.turnId, `CORRECTED: approval is still pending. ${latest.text}`);
        }
        return decision;
      },
      report: async (snapshot) => {
        reportInput = structuredClone(snapshot);
        return {
          summary: "Synthetic full-session report", decisions: [], actions: [], unresolved: [], speakerTips: [],
          scores: categories.map((category) => ({ category, score: null, reason: "Synthetic fixture does not score participants", evidence: [] })),
          focusTime: { onTopicSeconds: null, offTopicSeconds: null, unknownSeconds: durationMinutes * 60, note: "Synthetic transcript replay" },
        };
      },
    };
    const meetings = new Meetings(store, providers);
    const speech = new SpeechOutput(undefined, (id) => meetings.get(id));
    const offers: SpeechOffer[] = [];
    const offer = speech.offer.bind(speech);
    t.mock.method(speech, "offer", (id: string, value: SpeechOffer) => {
      offers.push(value);
      offer(id, value);
    });
    const engine = new Engine(meetings, {
      open: async (_m, audio) => {
        inputAudio = audio;
        return {
          connection: async () => ({ url: "ws://fixture", token: "fixture", room: "fixture" }),
          send: async (event) => { if (event.type === "intervention") interventions.push(event); },
          close: async () => { mediaCloses++; },
        };
      },
    }, { ...defaults, realtimeEnabled: true, assessmentMs: 86_400_000 }, speech);
    t.after(async () => { await engine.close(); speech.close(); store.close(); });
    const meeting = await meetings.create("host", { title: "Dense replay", agenda: plan.objective, durationMinutes });
    assert.equal(meeting.phase, "ready");
    const started = await engine.start(meeting, true);
    const steps = durationMinutes * 6, pauseAt = steps / 2;
    const text = (step: number, turn: number) => `Minute ${Math.floor(step / 6)} turn ${turn}: ` + "The proposed scope needs a named owner, a delivery date, and a mitigation for the dependency. ".repeat(5);
    for (let step = 1; step <= steps; step++) {
      t.mock.timers.tick(10_000);
      engine.heartbeat(meetings.get(meeting.id), started.connection.captureToken);
      const source = sources.at(-1)!;
      inputAudio(new Uint8Array(640));
      finalize(source, step * 2, text(step, step * 2));
      const provisional = step === 9 ? "LONG_PROVISIONAL ".repeat(750) : text(step, step * 2 + 1);
      for (const length of [20, 80, provisional.length]) source.callbacks.onEvent({ type: "partial", sessionId: source.id, turnId: step * 2 + 1, text: provisional.slice(0, length) });
      if (step === pauseAt) await engine.command(meetings.get(meeting.id), { type: "pause" });
      if (step === pauseAt + 2) await engine.command(meetings.get(meeting.id), { type: "resume" });
      correctionAtCheck = step === 42;
      replayingAffect = false;
      const priorPresence = meetings.get(meeting.id).presence;
      await engine.tick(meeting.id);
      const assessed = meetings.get(meeting.id);
      assert.ok((assessed.concerns?.length ?? 0) <= 16);
      assert.ok((assessed.concerns?.filter((concern) => !concern.resolved).length ?? 0) <= 8);
      assert.ok((assessed.concerns?.filter((concern) => concern.resolved).length ?? 0) <= 8);
      maxConcerns = Math.max(maxConcerns, assessed.concerns?.length ?? 0);
      assert.ok(assessed.presence);
      assert.deepEqual(assessed.presence.rejected, [], "endpoint hints produce valid emotion commands throughout the replay");
      assert.ok(Object.values(values(assessed.presence, Date.now())).every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
      assert.equal(new Set(assessed.presence.consumed).size, assessed.presence.consumed!.length);
      if (replayingAffect) {
        assert.equal(assessed.monitor!.status, "accepted");
        assert.deepEqual(assessed.presence, priorPresence, "accepted replay must not alter trajectory or renew its expired lease");
        assert.ok(assessed.presence.channels.worry.expires <= Date.now());
        replayedCommands++;
        if (assessed.monitor!.decision!.affect!.evidence.length === 2) regroupedCommands++;
      }
      // The 55-minute handoff can occur during the tick; only the current source
      // may finalize the next turn. A late old-source event must be ignored.
      const current = sources.at(-1)!;
      if (current !== source) {
        const count = meetings.turns(meeting.id).length;
        source.callbacks.onEvent({ type: "final", sessionId: source.id, turnId: 999999, text: "STALE ROTATED SOURCE", speaker: "A" });
        assert.equal(meetings.turns(meeting.id).length, count);
        inputAudio(new Uint8Array(640));
      }
      finalize(current, step * 2 + 1, text(step, step * 2 + 1));
      current.callbacks.onEvent({ type: "partial", sessionId: current.id, turnId: step * 2 + 1, text: "LATE PARTIAL MUST NOT RESURRECT" });
      if (step % 30 === 0) {
        const id = `${current.id}:${step * 2 + 1}`;
        finalize(current, step * 2 + 1, `Confirmed correction: ${expected.get(id)!.text}`);
      }
    }
    const current = meetings.get(meeting.id);
    assert.equal(current.phase, "live");
    assert.equal(current.error, null);
    assert.deepEqual(current.originalPlan, plan);
    assert.deepEqual(current.plan!.topics.map((topic) => topic.status), ["done", "done", "active"]);
    assert.equal(current.revisions.length, 2);
    assert.equal(current.durationMinutes, durationMinutes);
    assert.equal(current.plan!.durationMinutes, durationMinutes);
    assert.equal(contexts.length, steps - 2, "pause suppresses provider calls without losing the clock");
    assert.equal(maxConcerns, 16, "both persistent concern-memory buckets reach their cap during the replay");
    assert.ok(contexts.some((context) => context.concerns?.length === 16));
    assert.ok(replayedCommands >= durationMinutes / 2 - 1);
    assert.ok(regroupedCommands >= Math.floor(durationMinutes / 4));
    assert.ok(contexts.some((c) => c.partials.some((p) => p.prefixLength! > 8000 && p.text.length === 4000)));
    assert.ok(contexts.at(-1)!.finals.length < 20, "dense recent speech reaches the character bound");
    assert.ok(!contexts.at(-1)!.finals.some((turn) => turn.id === "source-1:2"));
    assert.ok(contexts.every((c) => c.partials.every((p) => !p.text.includes("LATE PARTIAL"))));
    assert.ok(interventions.length >= durationMinutes / 5 - 1, "accepted guidance reaches the speech-offer boundary");
    assert.equal(offers.length, interventions.length);
    assert.deepEqual(offers.map((item) => item.id), current.interventions.map((item) => item.id));
    assert.ok(offers.every((item) => item.checkId && item.speakBy === item.snapshotAt! + 10_000));
    const history: LiveCheck[] = [];
    let cursor: number | undefined;
    do {
      const page = engine.monitor.history(meeting.id, cursor);
      assert.ok(page.items.length <= 50);
      history.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    assert.equal(history.length, steps);
    assert.equal(new Set(history.map((check) => check.sequence)).size, steps);
    assert.equal(history.filter((check) => check.status === "paused").length, 2);
    assert.equal(history.filter((check) => check.status === "rejected").length, 1);
    const consumed = history.filter((check) => check.status === "accepted")
      .flatMap((check) => check.affectEvidenceKey!.split("|"));
    assert.deepEqual(new Set(current.presence!.consumed), new Set(consumed), "the persistent ledger retains exactly accepted evidence revisions across the entire meeting");
    assert.equal(current.presence!.consumed!.length, steps - 3 - replayedCommands);
    assert.ok(current.presence!.consumed!.some((key) => key.startsWith("source-1:2@")), "early evidence remains consumed after falling out of live context");
    assert.ok(!("consumed" in sceneFor(current).presence), "renderer trajectories exclude accumulated evidence");
    assert.ok(correctedId && expected.get(correctedId)!.revision === 2);
    assert.equal(sources.length, durationMinutes === 60 ? 2 : 1);
    assert.ok(sources.every((source) => source.packets > 0));
    if (durationMinutes === 60) {
      assert.equal(sources[0].ended, true);
      assert.equal(current.gaps.length, 1);
    }
    sources.at(-1)!.callbacks.onEvent({ type: "partial", sessionId: sources.at(-1)!.id, turnId: 999998, text: "UNFINALIZED CLAIM MUST NOT ENTER REPORT" });
    await engine.end(meetings.get(meeting.id));
    await Promise.all([...engine.reports.values()]);
    assert.equal(meetings.get(meeting.id).reportStatus, "ready");
    assert.ok(reportInput);
    assert.equal(reportInput.turns.length, steps * 2);
    assert.equal(reportInput.turns.reduce((n, turn) => n + turn.text.length, 0), [...expected.values()].reduce((n, turn) => n + turn.text.length, 0));
    for (const turn of reportInput.turns) assert.deepEqual({ text: turn.text, revision: turn.revision }, expected.get(turn.id));
    assert.equal(reportInput.turns[0].id, "source-1:2");
    assert.ok(!JSON.stringify(reportInput).includes("UNFINALIZED CLAIM"));
    assert.ok(!("monitor" in reportInput.meeting) && !("concerns" in reportInput.meeting) && !("presence" in reportInput.meeting));
    assert.equal(reportInput.meeting.revisions.length, 2);
    assert.equal(reportInput.elapsedSeconds, durationMinutes * 60);
    assert.ok(sources.every((source) => source.ended));
    assert.equal(mediaCloses, 1);
    await engine.remove(meetings.get(meeting.id));
    assert.equal(engine.monitor.history(meeting.id).items.length, 0, "meeting deletion also deletes check history");
    assert.equal(meetings.turns(meeting.id).length, 0);
  });
}
