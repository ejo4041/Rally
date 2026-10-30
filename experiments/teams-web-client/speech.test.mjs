import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamsSpeech,diagnosticText} from './speech.mjs';
const env={PULSE_SERVER:'unix:/tmp/test-only-pulse'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Teams speech sends the fixed Meta diagnostic only after host permission, then shields playback',async()=>{
 let allowed=false,generated=0,finish;
 const speech=createTeamsSpeech({env,canSpeak:async()=>allowed,
  engine:{async start(){},async synthesize(text){generated++;assert.equal(text,diagnosticText);return{};},close(){}},
  play:()=>new Promise(resolve=>finish=resolve),
 });
 assert.equal(await speech.diagnostic(),'canceled');assert.equal(generated,0);
 allowed=true;const pending=speech.diagnostic();await tick();assert.equal(speech.shielded(),true);
 finish();assert.equal(await pending,'completed');assert.equal(speech.shielded(),true);
 speech.close();assert.equal(await speech.diagnostic(),'canceled');
});
test('losing permission during synthesis prevents virtual microphone playback',async()=>{
 let allowed=true,finish,plays=0;
 const speech=createTeamsSpeech({env,canSpeak:async()=>allowed,
  engine:{async start(){},synthesize:()=>new Promise(resolve=>finish=resolve),close(){}},play:async()=>plays++,
 });
 const pending=speech.diagnostic();await tick();assert.equal(speech.shielded(),false);
 allowed=false;finish({});assert.equal(await pending,'canceled');assert.equal(plays,0);speech.close();
});
test('leave closes the engine and aborts playback; late completion cannot report success',async()=>{
 let finish,aborted=false,closes=0;
 const speech=createTeamsSpeech({env,canSpeak:async()=>true,
  engine:{async start(){},async synthesize(){return{};},close(){closes++;}},
  play:(_audio,{signal})=>new Promise(resolve=>{finish=resolve;signal.addEventListener('abort',()=>aborted=true);}),
 });
 const pending=speech.diagnostic();await tick();speech.close();speech.close();
 assert.equal(aborted,true);finish();assert.equal(await pending,'canceled');assert.equal(closes,1);
});
test('no default-host audio output is accepted',()=>{
 assert.throws(()=>createTeamsSpeech({env:{},canSpeak:async()=>true}),/private Teams/);
});
