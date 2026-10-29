import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {repo} from '../src/store.js';
import {createMeeting} from '../src/core.js';

test('private-workspace API and WebSocket walkthrough persist, confirm, export and delete without paid calls',async t=>{
  const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:{DB:'test'},bindings:{RALLY_LOCAL:'1',RALLY_PAID_ENABLED:'0'}});t.after(()=>mf.dispose());
  const db=await mf.getD1Database('DB');for(const sql of (await readFile('drizzle/0000_rally.sql','utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(sql).run();
  const request=(path,options={})=>mf.dispatchFetch('http://localhost'+path,options);
  assert.equal((await request('/')).status,200);
  assert.equal((await request('/api/config')).status,200);
  assert.equal((await request('/api/meetings',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'})).status,403);
  assert.equal((await request('/api/meetings',{method:'POST',body:JSON.stringify({agenda:['Decide'],minutes:5,wrapMinutes:5})})).status,400);
  const created=await request('/api/meetings',{method:'POST',body:JSON.stringify({kind:'walkthrough',minutes:30,wrapMinutes:5})});assert.equal(created.status,201);const {meeting}=await created.json();
  const response=await request(`/api/meetings/${meeting.id}/connect`,{headers:{Upgrade:'websocket'}});assert.equal(response.status,101);
  const ws=response.webSocket;ws.accept();const messages=[];const waiting=[];
  ws.addEventListener('message',event=>{const data=JSON.parse(event.data);messages.push(data);for(const f of [...waiting])f();});
  const until=(predicate)=>new Promise((resolve,reject)=>{const check=()=>{const value=messages.find(predicate);if(value){clearTimeout(timeout);waiting.splice(waiting.indexOf(check),1);resolve(value);}};const timeout=setTimeout(()=>reject(new Error('Timed out waiting for event: '+JSON.stringify(messages.slice(-3)))),6000);waiting.push(check);check();});
  const command=value=>ws.send(JSON.stringify(value));
  command({type:'start',consented:true});await until(m=>m.type==='ready');
  ws.send(new ArrayBuffer(2560));await new Promise(r=>setTimeout(r,20));assert.ok(!messages.some(m=>m.type==='notice'&&m.message==='Invalid control message.'),'Worker binary frames must not be parsed as control JSON');
  assert.equal((await request(`/api/meetings/${meeting.id}`,{method:'DELETE'})).status,409);
  for(let i=0;i<6;i++){command({type:'walkthrough_next'});await until(m=>m.type==='state'&&m.meeting.turns.length===i+1);}
  const latest=messages.filter(m=>m.type==='state').at(-1).meeting;assert.equal(latest.outcomes.length,2);assert.ok(latest.outcomes.every(o=>o.status==='proposed'));
  command({type:'pause'});await until(m=>m.type==='state'&&m.meeting.paused);command({type:'resume'});await until(m=>m.type==='state'&&!m.meeting.paused&&m.meeting.epoch>=2);
  const action=latest.outcomes.find(o=>o.type==='action');command({type:'confirm',id:action.id,owner:'Priya',dueDate:'Thursday at 3 PM'});await until(m=>m.type==='state'&&m.meeting.outcomes.some(o=>o.id===action.id&&o.status==='confirmed'));
  command({type:'demo_clock'});await until(m=>m.type==='state'&&m.meeting.demoClockUsed);
  command({type:'end'});await until(m=>m.type==='state'&&m.meeting.phase==='ended');ws.close();
  const saved=(await(await request(`/api/meetings/${meeting.id}`)).json()).meeting;assert.equal(saved.turns.length,6);assert.equal(saved.outcomes.find(o=>o.id===action.id).status,'confirmed');
  const exported=await(await request(`/api/meetings/${meeting.id}/export`)).text();assert.match(exported,/SCRIPTED WALKTHROUGH/);assert.match(exported,/explicitly confirmed by/);assert.match(exported,/compressed/);
  assert.equal((await(await request('/api/usage')).json()).events.length,0);
  // Release happens immediately after state emission; allow queued cleanup to settle.
  await new Promise(r=>setTimeout(r,100));
  assert.equal((await request(`/api/meetings/${meeting.id}`,{method:'DELETE'})).status,200);assert.equal((await request(`/api/meetings/${meeting.id}`)).status,404);
  const store=repo(db),warning=createMeeting({agenda:['Accounting recovery'],minutes:2,wrapMinutes:.5});warning.accountingWarning=true;await store.create(warning);assert.equal((await store.costs()).unknown,1);await store.remove(warning.id);assert.equal((await store.costs()).unknown,1,'Deleting a meeting must not erase its unresolved accounting warning');
});
