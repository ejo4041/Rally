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
