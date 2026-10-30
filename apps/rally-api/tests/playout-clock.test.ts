import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayoutClock} from '../src/playout-clock.ts';
test('local output clock starts on observed signal, with split PCM samples preserved',()=>{
 const clock=new PlayoutClock();assert.equal(clock.observe(Buffer.alloc(640)),undefined);
 assert.equal(clock.observe(Buffer.from([0xff])),undefined);
 assert.equal(clock.observe(Buffer.from([0x7f,...Buffer.alloc(638)])),20);
 assert.equal(clock.observe(Buffer.alloc(640)),40);
});
