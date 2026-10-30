import { test } from "node:test";
import assert from "node:assert/strict";
import {
  axes,
  initialPresence,
  actuate,
  evaluate,
  type Axis,
} from "../../../packages/rally-presence/state.ts";
const commands = (worry: number | null) =>
  Object.fromEntries(
    axes.map((a) => [a, a === "worry" ? worry : null]),
  ) as Record<Axis, number | null>;
test("duplicate evidence cannot ratchet or extend lease", () => {
  const s = actuate(initialPresence(0), commands(0.1), "a@1", 0);
  assert.equal(actuate(s, commands(0.8), "a@1", 5000), s);
  assert.equal(s.channels.worry.target, 10);
});
test("reversal can release concern fully without teleporting", () => {
  const s = actuate(initialPresence(0), commands(0.8), "a@1", 0);
  const r = actuate(s, commands(-0.8), "b@1", 10000);
  assert.ok(r.channels.worry.value > 79);
  assert.equal(r.channels.worry.target, 0);
  assert.ok(evaluate(r.channels.worry, 20000).value < 0.01);
});
test("expired movement holds and preserves episode anchor", () => {
  const s = actuate(initialPresence(0), commands(0.1), "a@1", 0);
  assert.deepEqual(
    evaluate(s.channels.worry, 20000).value,
    evaluate(s.channels.worry, 90000).value,
  );
  const r = actuate(s, commands(0.1), "b@1", 20000);
  assert.equal(r.channels.worry.target, 10);
});
test("analytic trajectory independent of sampling", () => {
  const s = actuate(initialPresence(0), commands(0.5), "a", 0).channels.worry;
  const direct = evaluate(s, 1000),
    split = evaluate(evaluate(s, 500), 1000);
  assert.ok(Math.abs(direct.value - split.value) < 1e-9);
});
test("replaying an older citation group after intervening evidence cannot renew a drive", () => {
  const first = actuate(initialPresence(0), commands(0.1), "a@1", 0);
  const second = actuate(first, commands(0.4), "b@1", 10000);
  assert.equal(actuate(second, commands(0.9), "a@1", 20000), second);
  assert.equal(actuate(second, commands(0.9), "b@1|a@1", 20000), second);
});
test("tangent, repair and relapse retain continuous position and increasing recurrence pressure", () => {
  let s = initialPresence(0);
  const sequence = [0.1, 0.4, -0.1, -0.2, 0.4, 0.6];
  const expected = [10, 40, 30, 20, 60, 80];
  for (let i = 0; i < sequence.length; i++) {
    const before = evaluate(s.channels.worry, i * 15000).value;
    s = actuate(s, commands(sequence[i]), `turn-${i}@1`, i * 15000);
    assert.ok(
      Math.abs(s.channels.worry.value - before) < 1e-8,
      "command cannot teleport",
    );
    assert.ok(
      Math.abs(
        evaluate(s.channels.worry, (i + 1) * 15000).value - expected[i],
      ) < 0.5,
      "scenario follows repair and relapse",
    );
  }
});
test("a contradictory positive load is reported rather than secretly moving downward", () => {
  const s = actuate(initialPresence(0), commands(0.8), "a@1", 0);
  const r = actuate(s, commands(0.2), "b@1", 10000);
  assert.deepEqual(r.rejected, ["worry"]);
  assert.equal(r.channels.worry.target, 80);
});
