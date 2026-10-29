import test from 'node:test';
import assert from 'node:assert/strict';
import {runSpeechQueue} from './runner.mjs';
import {REVISION} from './speech.mjs';
test('queue runner loads first, uses approved text and posts one normalized audio result',async()=>{
 const controller=new AbortController();let loaded=false,closed=false,polls=0,generated=0,finished;
 const engine={async start(){loaded=true;},async synthesize(text){generated++;assert.equal(text,'Approved text.');return{sampleRate:16000,pcmBase64:'AAAA'};},close(){closed=true;}};
 const api=async(action,data)=>{
  assert.ok(loaded);
  if(action==='poll'){assert.equal(data.revision,REVISION);return{job:++polls===1?{id:'one',text:'Approved text.'}:null};}
  if(action==='finish'){finished=data;controller.abort();return{ok:true};}
  throw new Error('Unexpected operation');
 };
 await runSpeechQueue({api,engine,signal:controller.signal,sleep:()=>new Promise(r=>setImmediate(r))});assert.equal(generated,1);assert.equal(finished.pcmBase64,'AAAA');assert.equal(finished.sampleRate,16000);assert.equal(closed,true);
});
test('loss of host permission aborts local synthesis without retrying',async()=>{
 const controller=new AbortController();let polls=0,generated=0,aborted=false;
 const engine={async start(){},synthesize(text,{signal}){generated++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new Error('canceled'));},{once:true}));},close(){}};
 const api=async(action)=>{
  if(action==='fail')return{};
  if(action==='poll'){polls++;if(polls===1)return{job:{id:'one',text:'Approved'}};if(polls===2)throw new Error('network');if(polls>3)controller.abort();return{job:null};}
  throw new Error('Canceled generation must never finish');
 };
 await runSpeechQueue({api,engine,signal:controller.signal,sleep:()=>new Promise(r=>setImmediate(r))});assert.equal(aborted,true);assert.equal(generated,1);
});
test('stop during startup cancels loading without advertising readiness',async()=>{
 const controller=new AbortController();let rejectLoad,polls=0;
 const engine={start(){queueMicrotask(()=>controller.abort());return new Promise((resolve,reject)=>rejectLoad=reject);},close(){rejectLoad?.(new Error('startup canceled'));}};
 await runSpeechQueue({api:async()=>{polls++;},engine,signal:controller.signal});assert.equal(polls,0);
});

test('completion while a poll is in flight cannot requeue the previous job',async()=>{
 const controller=new AbortController();let releaseAudio,releasePoll,started=false,polls=0,generated=0;
 const audio=new Promise(resolve=>releaseAudio=resolve);
 const engine={async start(){},synthesize(){generated++;started=true;return audio;},close(){}};
 const api=async(action,data)=>{
  if(action==='finish')return{};
  if(action==='poll'){
   polls++;
   if(polls===1)return{job:{id:'first',text:'Approved text.'}};
   if(polls===2){assert.equal(data.currentId,'first');return new Promise(resolve=>releasePoll=resolve);}
   controller.abort();return{job:null};
  }
  return{};
 };
 const run=runSpeechQueue({api,engine,signal:controller.signal,sleep:()=>new Promise(r=>setImmediate(r))});
 while(!releasePoll)await new Promise(r=>setImmediate(r));
 assert.equal(started,true);releaseAudio({sampleRate:16000,pcmBase64:'AAAA'});
 await new Promise(r=>setImmediate(r));releasePoll({job:{id:'first',state:'generating'}});
 await run;assert.equal(generated,1,'in-flight status result must not become a fresh claim');
});

test('a canceled model is warmed again before advertising readiness',async()=>{
 const controller=new AbortController();let warm=false,starts=0,polls=0,generated=0;
 const engine={async start(){starts++;warm=true;},synthesize(text,{signal}){generated++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{warm=false;reject(new Error('canceled'));},{once:true}));},close(){warm=false;}};
 const api=async(action)=>{
  if(action!=='poll')return{};
  polls++;if(polls>=3)controller.abort();assert.equal(warm,true,'only a loaded model may advertise readiness');
  if(polls===1)return{job:{id:'one',text:'Approved'}};
  if(polls===2)return{job:{id:'one',state:'canceled'}};
  controller.abort();return{job:null};
 };
 await runSpeechQueue({api,engine,signal:controller.signal,sleep:()=>new Promise(r=>setImmediate(r))});
 assert.equal(generated,1);assert.ok(starts>=2);
});
