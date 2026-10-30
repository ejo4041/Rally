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
 assert.equal(input,'Let’s get back on track. Choose an owner.');
 assert.equal(output.shielded('m'),true);
 output.cancel('m');
 await new Promise(r=>setImmediate(r));
 assert.equal(canceled,true);assert.equal(released,true);assert.ok(events.includes('playing'));assert.equal(output.status('m')?.state,'canceled');
});
