import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {teamsApi} from '../src/teams.js';

test('Browser Teams transcription requires consent and admission, deduplicates turns and records usage once',async t=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'transcript-test'}});t.after(()=>mf.dispose());const db=await mf.getD1Database('DB');
 for(const name of ['0000_rally','0001_teams','0002_teams_transcription'])for(const sql of (await readFile(`drizzle/${name}.sql`,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(sql).run();
 const env={DB:db,RALLY_TEAMS_BRIDGE_SECRET:'test-secret',RALLY_PAID_ENABLED:'1',MODEL_API_KEY:'test-not-used'};let now=100000;
 const call=(p,d={},secret='test-secret')=>teamsApi(new Request('http://localhost/api/teams/'+p,{method:p==='status'?'GET':'POST',headers:{'X-Rally-Bridge':secret}}),env,d,now);
 const runnerId='web-test-runner';const poll=()=>call('runner/poll',{runnerId,transport:'teams-web',credentialsConfigured:true,transcriptionReady:true});
 await poll();const join={meetingUrl:'https://teams.microsoft.com/meet/123',consented:true,transcribe:true};
 await assert.rejects(call('join',join),/Consent to sending/);
 const {job}=await call('join',{...join,transcriptionConsented:true});await poll();
 const data={runnerId,id:job.id};
 await assert.rejects(call('runner/transcription-start',data),/cannot start/);
 await call('runner/update',{...data,state:'connected'});
 await assert.rejects(call('runner/transcription-start',data,'wrong'),/authentication/);
 await call('runner/transcription-start',data);
 await assert.rejects(call('runner/transcription-start',data),/cannot start/);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM usage_events WHERE estimated_cost IS NULL').first()).n,1);
 const turn={sessionId:'asr-test',turnId:1,text:'Andrew will send it Friday.'};
 await call('runner/transcription',{...data,final:turn});await call('runner/transcription',{...data,final:turn});
 let status=await call('status');assert.equal(status.transport,'teams-web');assert.equal(status.job.transcript.length,1);assert.equal(status.job.transcript[0].text,turn.text);
 await call('runner/transcription',{...data,partial:'Next thought'});assert.equal((await call('status')).job.partial,'Next thought');
 await assert.rejects(call('runner/transcription',{...data,final:{...turn,text:'a'.repeat(4001)}}),/Invalid transcript/);
 await call('leave',{id:job.id});
 await assert.rejects(call('runner/transcription',{...data,partial:'late partial'}),/no longer/);
 await call('runner/transcription',{...data,final:{...turn,turnId:2,text:'Final words drained after Leave.'}});
 const usage={...data,sentSeconds:7.78,processedMs:7840,sessionAcknowledged:true};
 await call('runner/transcription-finish',usage);await call('runner/transcription-finish',{...usage,sentSeconds:179});
 const u=await db.prepare('SELECT * FROM usage_events').first();assert.equal(u.estimated_cost,.00035);assert.equal((await db.prepare('SELECT COUNT(*) n FROM usage_events').first()).n,1);
 await call('leave',{id:job.id});await call('runner/update',{...data,state:'left'});status=await call('status');assert.equal(status.job.transcriptionState,'stopped');assert.equal(status.job.partial,'');assert.equal(status.job.transcript.length,2);
 // No further paid reservation when the build budget has insufficient headroom.
 env.RALLY_BUILD_BUDGET='.001';await call('join',{...join,transcriptionConsented:true});const claimed=await poll();const next={runnerId,id:claimed.job.id};await call('runner/update',{...next,state:'connected'});
 await assert.rejects(call('runner/transcription-start',next),/budget/);
});
