import test from 'node:test';
import assert from 'node:assert/strict';
import {VoiceSequence} from '../../../packages/rally-presence/voice.ts';
test('a restarted capture accepts its first voice frame while rejecting delayed previous-session frames',()=>{
 const sequence=new VoiceSequence();
 assert.equal(sequence.accept({captureEpoch:1,sequence:1000}),true);
 assert.equal(sequence.accept({captureEpoch:2,sequence:0}),true);
 assert.equal(sequence.accept({captureEpoch:1,sequence:1001}),false);
 assert.equal(sequence.accept({captureEpoch:2,sequence:0}),false);
 assert.equal(sequence.accept({captureEpoch:2,sequence:1}),true);
});
