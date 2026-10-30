import test from "node:test";
import assert from "node:assert/strict";
import { sceneFor } from "../../../packages/rally-presence/scene.ts";
import type { Meeting } from "../src/contracts.ts";
import { assessmentContext } from "../src/assessment-context.ts";
import {
  initialPresence,
  actuate,
  axes,
} from "../../../packages/rally-presence/state.ts";

test("streaming scene uses actual speech lifecycle, topic focus and original duration", () => {
  const m = {
    id: "m",
    epoch: 2,
    captureEpoch: 2,
    captureSource: "teams",
    phase: "live",
    paused: false,
    startedAt: 1000,
    endedAt: null,
    durationMinutes: 5,
    revisions: [],
    plan: {
      topics: [
        { id: "a", title: "Scope", minutes: 2, status: "active" },
        { id: "b", title: "Owners", minutes: 2, status: "pending" },
      ],
    },
    monitor: {
      decision: {
        focus: {
          intendedTopicId: "a",
          detour: "Phone recommendations",
          evidence: ["s:1"],
        },
      },
    },
    speechStatus: {
      id: "v",
      interventionId: "i",
      text: "Let us return to launch scope.",
      state: "playing",
      at: 2000,
      startedAt: 1900,
    },
  } as unknown as Meeting;
  const scene = sceneFor(m, 2100);
  assert.equal(scene.speech?.text, m.speechStatus?.text);
  assert.equal(scene.speechOwner, "teams");
  assert.equal(scene.current, "Scope");
  assert.equal(scene.next, "Return to Scope");
  assert.equal(scene.durationMinutes, 5);
  m.speechStatus!.state = "completed";
  assert.equal(sceneFor(m).speech?.state, "completed");
  m.paused = true;
  assert.equal(sceneFor(m).speech, null);
});
test("live emotion context supplies valid force bounds and no transcript/account history", () => {
  const m = {
    id: "m",
    progress: "",
    interventions: [],
    gaps: [],
    startedAt: 0,
    durationMinutes: 5,
    presence: initialPresence(0),
  } as unknown as Meeting;
  const forces = Object.fromEntries(
    axes.map((a) => [a, a === "worry" ? 0.4 : null]),
  );
  m.presence = actuate(m.presence!, forces as any, "s:1@revision", 0);
  const context = assessmentContext(
    { meeting: m, turns: [], elapsedSeconds: 1 },
    1000,
  );
  const worry = context.meeting.emotions.worry;
  assert.ok(worry.value > 0);
  assert.equal(worry.increaseTo100, 1);
  assert.equal(worry.decreaseToZero, -worry.value / 100);
  assert.ok(!("userId" in context.meeting));
});
