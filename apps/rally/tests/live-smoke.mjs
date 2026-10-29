/* Explicit paid integration test. Never run as part of npm test. */
import {Miniflare} from 'miniflare';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
let key='';
for(const line of(await readFile('../../.env.local','utf8')).split(/\r?\n/)){const match=line.match(/^MODEL_API_KEY=(.*)$/);if(match)key=match[1].trim().replace(/^(['"])(.*)\1$/,'$2');}
assert.ok(key,'Configured key required; value is never displayed.');
const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:{DB:'live-smoke'},bindings:{MODEL_API_KEY:key,RALLY_LOCAL:'1',RALLY_PAID_ENABLED:'1',RALLY_MEETING_BUDGET:'0.10',RALLY_BUILD_BUDGET:'0.10'}});
const messages=[];let ws;
try{
  const db=await mf.getD1Database('DB');for(const sql of(await readFile('drizzle/0000_rally.sql','utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(sql).run();
  const call=async(path,body)=>mf.dispatchFetch('http://localhost'+path,body?{method:'POST',body:JSON.stringify(body)}:{});
  const created=await call('/api/meetings',{title:'Live API integration — known reference audio',agenda:['Decide Friday software release','Confirm rollback next steps'],participants:['Alex','Priya','Sam'],minutes:2,wrapMinutes:.5});const {meeting}=await created.json();assert.ok(meeting);
  const response=await mf.dispatchFetch(`http://localhost/api/meetings/${meeting.id}/connect`,{headers:{Upgrade:'websocket'}});assert.equal(response.status,101);ws=response.webSocket;ws.accept();
  const waits=[];const until=(predicate,ms=20000)=>new Promise((resolve,reject)=>{const check=()=>{const result=messages.find(predicate);if(result){clearTimeout(timer);waits.splice(waits.indexOf(check),1);resolve(result);}};const timer=setTimeout(()=>reject(new Error('Timed out waiting for application event.')),ms);waits.push(check);check();});
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);messages.push(m);if(m.type==='speak')ws.send(JSON.stringify({type:'playback',id:m.utterance.id,state:'shown'}));for(const check of [...waits])check();});
  ws.send(JSON.stringify({type:'start',consented:true}));await until(m=>m.type==='ready');
  const pcm=await readFile('/tmp/rally-public-audio/input.pcm');const start=performance.now();
  for(let offset=0;offset<pcm.length;offset+=2560){await new Promise(r=>setTimeout(r,Math.max(0,start+offset/32-performance.now())));const frame=pcm.subarray(offset,offset+2560);ws.send(frame.buffer.slice(frame.byteOffset,frame.byteOffset+frame.byteLength));}
  await new Promise(r=>setTimeout(r,Math.max(0,start+pcm.length/32-performance.now())+1000));
  ws.send(JSON.stringify({type:'end'}));await until(m=>m.type==='state'&&m.meeting.phase==='ended');
  const events=(await(await call('/api/usage')).json()).events;
  const saved=(await(await call(`/api/meetings/${meeting.id}`)).json()).meeting;
  await writeFile('../../docs/research/app-live-smoke.json',JSON.stringify({at:new Date().toISOString(),scenario:'Known licensed audiobook input under artificial release agenda; no physical microphone or audible output.',turns:saved.turns,interventions:saved.interventions,notices:messages.filter(m=>m.type==='notice'),usage:events},null,2)+'\n');
  assert.ok(saved.turns.length>=3,'Real ASR finals required');assert.ok(events.some(e=>e.model==='muse-spark-1.3'),'Real reasoning call required');
  assert.ok(saved.interventions.some(u=>u.kind==='redirect'),'A real model redirect should reach the application');
  assert.ok(events.every(e=>e.estimatedCost!==null),'Cost must be known for each completed test call');
  console.log(JSON.stringify({passed:true,turns:saved.turns.length,interventions:saved.interventions.map(u=>({kind:u.kind,text:u.text,presentation:u.presentation})),calls:events.length,estimatedCost:events.reduce((sum,e)=>sum+(e.estimatedCost||0),0)}));
}finally{try{ws?.close();}catch{}await mf.dispose();}
