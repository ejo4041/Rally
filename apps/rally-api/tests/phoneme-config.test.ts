import test from 'node:test';
import assert from 'node:assert/strict';
import {configuredSpeech} from '../src/speech.ts';

test('phoneme-trained Meta adapter is opt-in, declares actual provenance and rejects unresolved text before spawning',async t=>{
 const names=['RALLY_SPEECH_ADAPTER','RALLY_EXPERIMENTAL_PHONEMES','RALLY_PHONE_OVERRIDES'];
 const before=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 t.after(()=>{for(const name of names){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}});
 process.env.RALLY_SPEECH_ADAPTER='fastspeech2-local';delete process.env.RALLY_EXPERIMENTAL_PHONEMES;
 assert.throws(()=>configuredSpeech(),/experimental opt-in/);
 process.env.RALLY_EXPERIMENTAL_PHONEMES='1';process.env.RALLY_PHONE_OVERRIDES='{}';
 const engine=configuredSpeech()!;
 assert.equal(engine.identity?.model,'facebook/fastspeech2-en-ljspeech');
 assert.equal(engine.identity?.revision,'a3e3e5e2e62bb7ca7514b11aa469e9c5b01a20bf');
 assert.equal(engine.identity?.sampleRate,16000);
 await assert.rejects(engine.synthesize('Read the record.',{signal:new AbortController().signal}),/explicit normalization or pronunciation/);
 engine.close();
 process.env.RALLY_PHONE_OVERRIDES='{"Meta":"not a phoneme"}';
 assert.throws(()=>configuredSpeech(),/ARPABET/);
});
