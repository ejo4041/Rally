import test from "node:test";
import assert from "node:assert/strict";
import { PlayoutClock } from "../src/playout-clock.ts";
test("local output clock starts on observed signal, with split PCM samples preserved", () => {
  const clock = new PlayoutClock();
  assert.equal(clock.observe(Buffer.alloc(640)), undefined);
  assert.equal(clock.observe(Buffer.from([0xff])), undefined);
  assert.equal(clock.observe(Buffer.from([0x7f, ...Buffer.alloc(638)])), 20);
  assert.equal(clock.observe(Buffer.alloc(640)), 40);
});

test("sink underrun cannot prepay progress for subsequently queued audio", () => {
  const c = new PlayoutClock(),
    tone = Buffer.alloc(3200);
  for (let i = 0; i < tone.length; i += 2) tone.writeInt16LE(1000, i);
  assert.equal(c.observe(tone, 3200), 100);
  assert.equal(c.observe(Buffer.alloc(64000), 3200), 100);
  assert.equal(c.observe(tone.subarray(0, 640), 6400), 120);
});
