import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {repo} from '../src/store.js';
import {createMeeting,utterance} from '../src/core.js';
import {MMS_REVISION} from '../src/speech.js';
async function fixture(t){
 const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:{DB:'speech-test'},bindings:{RALLY_MMS_ENABLED:'1',RALLY_TEAMS_BRIDGE_SECRET:'speech-test-secret'}});t.after(()=>mf.dispose());const db=await mf.getD1Database('DB');
 for(const name of ['0000_rally','0001_teams','0002_teams_transcription','0003_mms_speech'])for(const sql of(await readFile(`drizzle/${name}.sql`,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(sql).run();
 const request=(p,data,secret,headers={})=>mf.dispatchFetch('http://localhost/api/speech/'+p,{...(data?{method:'POST',body:JSON.stringify(data)}:{}),headers:{'Content-Type':'application/json',...(secret?{'X-Rally-Bridge':secret}:{}),...headers}});
 const runnerId='speech-test-runner',poll=(extra={},secret='speech-test-secret')=>request('runner/poll',{runnerId,revision:MMS_REVISION,...extra},secret);
 const repository=repo(db),m=createMeeting({agenda:['Release'],minutes:3,wrapMinutes:.5});m.phase='live';m.consented=true;const u=utterance(m,'Could we return to the release decision?');await repository.create(m);
 const create=()=>request('create',{meetingId:m.id,utteranceId:u.id,epoch:u.epoch});const finish=(id,extra={})=>request('runner/finish',{id,runnerId,sampleRate:16000,pcmBase64:Buffer.alloc(3200,1).toString('base64'),...extra},'speech-test-secret');
 return{db,m,u,repository,request,poll,create,finish};
}
test('speech queue authenticates the pinned runner and only synthesizes server-approved utterances',async t=>{
 const f=await fixture(t);assert.equal((await f.create()).status,503);assert.equal((await f.poll({},'wrong')).status,403);assert.equal((await f.poll({revision:'wrong'})).status,409);assert.equal((await f.poll()).status,200);
 assert.equal((await f.poll({runnerId:'competing-runner'})).status,409);
 assert.equal((await f.request('create',{text:'Arbitrary text',test:true})).status,400);
 let response=await f.create();assert.equal(response.status,200);const {job}=await response.json();assert.ok(!('text' in job));assert.equal((await(await f.create()).json()).job.id,job.id);
 const claimed=(await(await f.poll()).json()).job;assert.equal(claimed.text,f.u.text);assert.equal(claimed.state,'generating');assert.equal((await(await f.poll()).json()).job,null,'claimed job cannot be claimed twice');
 assert.equal((await f.finish(job.id,{sampleRate:48000})).status,400);assert.equal((await f.finish(job.id,{pcmBase64:'bad!!'})).status,400);assert.equal((await f.finish(job.id)).status,200);
 const audio=await f.request('audio/'+job.id);assert.equal(audio.status,200);assert.equal(audio.headers.get('Content-Type'),'audio/wav');const bytes=Buffer.from(await audio.arrayBuffer());assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt32LE(24),16000);assert.equal(bytes.length,3244);
 await f.request('cancel',{id:job.id});assert.equal((await f.request('audio/'+job.id)).status,409);const row=await f.db.prepare('SELECT * FROM speech_jobs WHERE id=?').bind(job.id).first();assert.equal(row.audio,null);assert.equal(row.text,'');assert.equal(row.slot,null);assert.equal((await f.finish(job.id)).status,409);
 assert.equal((await f.repository.usageList()).length,0);
});
test('host pause/epoch changes invalidate pending audio and expiration removes access',async t=>{
 const f=await fixture(t);await f.poll();const {job}=await(await f.create()).json();await f.poll();const m=await f.repository.get(f.m.id);m.paused=true;m.epoch++;await f.repository.save(m);
 assert.equal((await f.finish(job.id)).status,409);assert.equal((await f.db.prepare('SELECT state FROM speech_jobs WHERE id=?').bind(job.id).first()).state,'canceled');
 const next=(await(await f.request('create',{test:true})).json()).job;await f.poll();await f.finish(next.id);await f.db.prepare('UPDATE speech_jobs SET deadline=0 WHERE id=?').bind(next.id).run();assert.equal((await f.request('audio/'+next.id)).status,404);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM speech_jobs WHERE id=?').bind(next.id).first()).n,0);
});
test('test voice uses a fixed phrase and blocks cross-origin requests',async t=>{
 const f=await fixture(t);await f.poll();assert.equal((await f.request('create',{test:true},null,{Origin:'https://other.example'})).status,403);const {job}=await(await f.request('create',{test:true})).json();assert.ok(job.id);const claimed=(await(await f.poll()).json()).job;assert.match(claimed.text,/Hello, I am Rally/);
 const response=await f.request('create',{test:true});assert.equal(response.status,409);
});
