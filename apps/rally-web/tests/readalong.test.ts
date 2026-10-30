import test from 'node:test';
import assert from 'node:assert/strict';
import { ReadAlong } from '../src/readalong.ts';
test('read-along advances only for a new observed utterance with a playback clock; reconnection remains static',()=>{
 const reading=new ReadAlong();
 reading.prepare('one',"Let's get back on track.");
 assert.equal(reading.view().spokenWords,0);
 reading.clock('one',1000,true);
 assert.equal(reading.view().spokenWords,2);
 reading.clock('one',3000,false);
 assert.equal(reading.view().spokenWords,2);
 reading.finish('one','canceled');
 reading.clock('one',5000,true);
 assert.equal(reading.view().spokenWords,2);
 const restored=new ReadAlong();restored.restore('old','Previously spoken words');
 restored.clock('old',1000,true);
 assert.equal(restored.view().animated,false);
});
