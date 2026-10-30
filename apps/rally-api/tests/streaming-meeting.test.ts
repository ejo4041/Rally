import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveSpeech } from '../src/live-speech.ts';
import type { Meeting } from '../src/contracts.ts';

test('approved speech streams with the cached opening and cancellation aborts the active delivery', async () => {
 const meeting = {id:'m',userId:'u',phase:'live',paused:false,epoch:1,interventions:[{id:'i',at:Date.now(),text:'Choose an owner.',kind:'clarify'}]} as Meeting;
 let input='', canceled=false, released=false;
 const events: string[]=[];
 const output = new LiveSpeech({
  current:()=>meeting,
  stream:async function*(text,signal){input=text;yield Buffer.alloc(640); await new Promise<void>(resolve=>signal.addEventListener('abort',()=>{canceled=true;resolve();},{once:true}));},
  play:async(_id,_job,chunks,signal,beforeAudio)=>{beforeAudio();for await(const part of chunks){assert.equal(part.length,640);if(signal.aborted)break;}released=true;},
  event:(_id,state)=>events.push(state.state), shield:()=>{},
 });
 output.offer('m',{...meeting.interventions[0],epoch:1});
 await new Promise(r=>setImmediate(r));
 assert.equal(input,'Let\'s get back on track. Choose an owner.');
 assert.equal(output.shielded('m'),true);
 output.cancel('m');
 await new Promise(r=>setImmediate(r));
 assert.equal(canceled,true);assert.equal(released,true);assert.ok(events.includes('playing'));assert.equal(output.status('m')?.state,'canceled');
});

test('new checks and evidence revisions do not replace an utterance already playing',async()=>{
 const m={id:'m',phase:'live',paused:false,epoch:1,interventions:[{id:'one',text:'First',at:Date.now(),kind:'redirect'}]} as Meeting;
 let finish!:()=>void,starts=0;
 const output=new LiveSpeech({current:()=>m,stream:async function*(){yield Buffer.alloc(640);await new Promise<void>(r=>finish=r);},play:async(_id,_job,chunks,_signal,start)=>{for await(const chunk of chunks){start();starts++;}},event:()=>{},shield:()=>{}});
 output.offer('m',{...m.interventions[0],epoch:1});await new Promise(r=>setImmediate(r));
 m.interventions.push({id:'two',text:'Second',at:Date.now(),kind:'redirect'});
 output.offer('m',{...m.interventions[1],epoch:1});output.invalidateEvidence('m');
 assert.equal(output.status('m')?.interventionId,'one');assert.equal(output.status('m')?.state,'playing');
 finish();await new Promise(r=>setImmediate(r));assert.equal(starts,1);assert.equal(output.status('m')?.state,'completed');await output.close();
});

test('expired evidence cannot start delayed first audio',async()=>{
 const m={id:'m',phase:'live',paused:false,epoch:1,interventions:[{id:'i',text:'Late',at:Date.now(),kind:'redirect'}]} as Meeting;
 let release!:()=>void,played=false;
 const output=new LiveSpeech({current:()=>m,stream:async function*(){await new Promise<void>(r=>release=r);yield Buffer.alloc(640);},play:async(_id,_job,chunks,_signal,start)=>{for await(const chunk of chunks){start();played=true;}},event:()=>{},shield:()=>{}});
 let valid=true;
 output.offer('m',{...m.interventions[0],epoch:1,speakBy:Date.now()+10000,evidenceValid:()=>valid});
 await new Promise(r=>setImmediate(r));valid=false;release();await new Promise(r=>setImmediate(r));assert.equal(played,false);assert.equal(output.status('m')?.state,'failed');await output.close();
});

test('expired first-audio deadline releases preparing speech for a fresh check',async()=>{
 const m={id:'m',phase:'live',paused:false,epoch:1,interventions:[{id:'i',text:'Late',at:Date.now(),kind:'redirect'}]} as Meeting;
 const output=new LiveSpeech({current:()=>m,stream:async function*(_text,signal){await new Promise<void>(r=>signal.addEventListener('abort',()=>r(),{once:true}));},play:async(_id,_job,chunks)=>{for await(const part of chunks){}},event:()=>{},shield:()=>{}});
 output.offer('m',{...m.interventions[0],epoch:1,speakBy:Date.now()+10});
 await new Promise(r=>setTimeout(r,30));assert.equal(output.isActive('m'),false);assert.equal(output.status('m')?.state,'canceled');await output.close();
});
