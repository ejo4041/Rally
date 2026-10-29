import test from 'node:test';
import assert from 'node:assert/strict';
import {attachSession} from '../src/live.js';
import {createMeeting} from '../src/core.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Socket extends EventTarget{
  readyState=1;messages=[];
  send(value){this.messages.push(JSON.parse(value));}
  command(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}));}
  close(){if(this.readyState===3)return;this.readyState=3;this.dispatchEvent(new Event('close'));}
}
async function fixture({failAccounting=false,invalidFirstDecision=false}={}){
  const m={...createMeeting({agenda:['Release'],participants:['Priya'],minutes:2,wrapMinutes:.5}),version:0};
  const socket=new Socket(),jobs=[];let handlers,released=false,concurrent=0,maxConcurrent=0;
  const calls=[];
  const repository={async save(m){m.version++;},async costs(){await sleep(8);return{total:0,unknown:0};},async usage(){if(failAccounting)throw new Error('storage unavailable');},async release(){released=true;},async renew(){return true;}};
  const services={throttleMs:80,async openASR(env,callbacks){handlers=callbacks;return{sentSeconds:0,processedMs:0,sessionId:'s',send(){},end(){callbacks.onEvent({type:'final',sessionId:'s',turnId:99,text:'Priya owns rollback by Thursday.'},'s');callbacks.onClose();},close(){}};},async moderate(env,snapshot){calls.push(snapshot.turns.map(t=>t.text));concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);await sleep(25);concurrent--;if(invalidFirstDecision&&calls.length===1)return{usage:{durationMs:25},decision:{intervene:true,kind:'redirect',spoken_text:'An invalid citation.',evidence_turn_ids:['missing'],outcomes:[]}};const final=snapshot.turns.find(t=>t.turnId===99);return{usage:{durationMs:25},decision:{intervene:false,kind:'none',spoken_text:'',evidence_turn_ids:[],outcomes:final?[{type:'action',text:'Run rollback.',owner:'Priya',due_date:'Thursday',evidence_turn_ids:[final.id]}]:[]}};}};
  attachSession(socket,m,repository,{RALLY_PAID_ENABLED:'1',MODEL_API_KEY:'test-only-not-a-real-key'}, {waitUntil(p){jobs.push(p.catch(()=>{}));}},'lease',services);
  socket.command({type:'start',consented:true});
  for(let i=0;i<40&&!socket.messages.some(m=>m.type==='ready');i++)await sleep(5);
  assert.ok(socket.messages.some(m=>m.type==='ready'));
  return{m,socket,calls,final(id,text){handlers.onEvent({type:'final',sessionId:'s',turnId:id,text},'s');},get maxConcurrent(){return maxConcurrent;},get released(){return released;},async stop(){socket.command({type:'end'});for(let i=0;i<80&&socket.readyState!==3;i++)await sleep(5);await Promise.all(jobs);}};
}
test('rapid finals coalesce into one request, and a trailing final gets analyzed without further speech',async()=>{
  const f=await fixture();f.final(1,'First topic.');f.final(2,'Second topic.');await sleep(18);f.final(3,'New owner mentioned.');f.socket.command({type:'review'});f.socket.command({type:'review'});await sleep(200);
  assert.equal(f.maxConcurrent,1,'budget preflight must not permit parallel paid calls');assert.ok(f.calls.some(turns=>turns.includes('New owner mentioned.')),'trailing final must not be dropped');
  const count=f.calls.length;f.final(4,'A last new deadline.');await sleep(130);assert.ok(f.calls.length>count);await f.stop();
});
test('end drains a final ASR commitment into a non-speaking proposal',async()=>{
  const f=await fixture();f.final(1,'Deciding the release.');f.final(2,'A follow-up is needed.');await sleep(15);await f.stop();assert.equal(f.m.phase,'ended');assert.ok(f.m.turns.some(t=>t.turnId===99));assert.ok(f.m.outcomes.some(o=>o.owner==='Priya'&&o.dueDate==='Thursday'&&o.status==='proposed'));assert.ok(f.released);assert.equal(f.socket.readyState,3);
});
test('accounting failure still ends capture, clears ownership and closes the client',async()=>{
  const f=await fixture({failAccounting:true});await f.stop();assert.equal(f.m.phase,'ended');assert.equal(f.m.accountingWarning,true);assert.ok(f.released);assert.equal(f.socket.readyState,3);
});
test('finalized evidence received during speech is evaluated after playback ends',async()=>{
  const f=await fixture();const opening=f.m.interventions.find(u=>u.kind==='opening');f.socket.command({type:'playback',id:opening.id,state:'speaking'});await sleep(10);f.final(1,'One relevant turn.');f.final(2,'Another relevant turn.');await sleep(30);assert.equal(f.calls.length,0);f.socket.command({type:'playback',id:opening.id,state:'completed'});await sleep(100);assert.ok(f.calls.length>=1);await f.stop();
});
test('explicit host review can recover from invalid reasoning when accounting and budget are known',async()=>{
  const f=await fixture({invalidFirstDecision:true});f.final(1,'One turn.');f.final(2,'Another turn.');await sleep(100);assert.equal(f.calls.length,1);f.socket.command({type:'review'});await sleep(120);assert.equal(f.calls.length,2,'Manual review should perform a budget-checked retry rather than silently do nothing');await f.stop();
});
