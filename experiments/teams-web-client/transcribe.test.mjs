import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {transcribe} from './transcribe.mjs';
class Socket extends EventTarget {
 static OPEN=1;readyState=1;bufferedAmount=0;frames=0;
 constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
 message(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}));}
 send(data){if(typeof data==='string'){const value=JSON.parse(data);if(value.authorization)this.message({sessionId:'fixture-session'});if(value.type==='endStream'){this.message({type:'speechComplete',turnId:1,transcript:'Final on stop.'});this.close();}}else{assert.equal(data.byteLength,640);this.frames++;this.message({audioProcessedMs:this.frames*20});}}
 close(){if(this.readyState===3)return;this.readyState=3;this.dispatchEvent(new Event('close'));}
}
function producer(){const p=new EventEmitter();p.stdout=new PassThrough();p.killed=false;p.kill=()=>{p.killed=true;p.emit('close');};queueMicrotask(()=>p.stdout.write(Buffer.alloc(32000)));return p;}
test('20ms frames obey total cap and final text drains on stop, without model calls',async t=>{
 const original=globalThis.WebSocket;globalThis.WebSocket=Socket;t.after(()=>globalThis.WebSocket=original);let p;const finals=[];
 const session=await transcribe({key:'fake',seconds:.1,source:()=>p=producer(),onEvent:e=>{if(e.type==='final')finals.push(e.text);}});
 await session.done;assert.equal(session.stats().sentSeconds,.1);assert.equal(session.stats().processedMs,100);assert.ok(p.killed);assert.deepEqual(finals,['Final on stop.']);
});
test('host cancellation kills audio source and ends the provider session',async t=>{
 const original=globalThis.WebSocket;globalThis.WebSocket=Socket;t.after(()=>globalThis.WebSocket=original);const abort=new AbortController();let p;
 const session=await transcribe({key:'fake',seconds:180,signal:abort.signal,source:()=>p=producer()});abort.abort();await session.done;assert.ok(p.killed);assert.ok(session.stats().sentSeconds<1);
});
test('closed handshake records unknown cost and never starts audio capture',async t=>{
 const original=globalThis.WebSocket;class Reject extends Socket{send(){this.close();}}globalThis.WebSocket=Reject;t.after(()=>globalThis.WebSocket=original);
 await assert.rejects(transcribe({key:'fake',source:()=>{throw new Error('must not run');}}),error=>{assert.equal(error.usage.estimatedCost,null);return true;});
});

test('timer jitter cannot accumulate a two-second audio backlog',async()=>{
 const {framesDue}=await import('./audio-pacing.mjs');
 let sent=0,oldSent=0,peak=0,oldPeak=0;
 const max=180*32000;
 for(let elapsed=20.35;elapsed<150000;elapsed+=20.35){
   const captured=Math.floor(elapsed/20)*640;
   peak=Math.max(peak,captured-sent);oldPeak=Math.max(oldPeak,captured-oldSent);
   sent+=framesDue(elapsed,sent,max)*640;oldSent+=640;
   assert.ok(sent<=captured,'Never send audio faster than real time');
 }
 assert.ok(oldPeak>64000,'Old one-frame timer reproduces the queue failure within 150s');
 assert.ok(peak<=1280,'Clock-based scheduling stays within two frames');
 assert.equal(framesDue(180000,max,max),0,'Cannot exceed the audio cap');
});

test('speech shielding sends silence at the same cadence and never replays excluded audio',async t=>{
 const original=globalThis.WebSocket;let shield=true;const samples=[];
 class ShieldSocket extends Socket{
  send(data){
   if(typeof data!=='string'){
    samples.push(Buffer.from(data));
    if(samples.length===2)shield=false;
   }
   super.send(data);
  }
 }
 globalThis.WebSocket=ShieldSocket;t.after(()=>globalThis.WebSocket=original);
 const actualSource=()=>{const p=new EventEmitter();p.stdout=new PassThrough();p.kill=()=>p.emit('close');queueMicrotask(()=>p.stdout.write(Buffer.alloc(6400,17)));return p;};
 const session=await transcribe({key:'fake',seconds:.1,source:actualSource,shielded:()=>shield});
 await session.done;assert.equal(samples.length,5);
 assert.ok(samples[0].every(b=>b===0));assert.ok(samples[1].every(b=>b===0));
 assert.ok(samples.slice(2).every(frame=>frame.every(b=>b===17)));
 assert.equal(session.stats().sentSeconds,.1);assert.equal(session.stats().shieldedSeconds,.04);
});
