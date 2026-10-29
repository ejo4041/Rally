import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { teamsApi, teamsMeetingUrl } from '../src/teams.js';

test('Teams links reject credentials, arbitrary destinations, unsupported personal links and empty paths',()=>{
  assert.equal(teamsMeetingUrl('https://teams.microsoft.com/l/meetup-join/example?context=x#fragment'),'https://teams.microsoft.com/l/meetup-join/example?context=x');
  for (const url of ['http://teams.microsoft.com/meet/x','https://teams.microsoft.com.evil.test/meet/x','https://x:y@teams.microsoft.com/meet/x','https://teams.live.com/meet/x','https://teams.microsoft.com/','https://teams.microsoft.com:8080/meet/x']) assert.throws(()=>teamsMeetingUrl(url));
});

test('Teams queue encrypts one-time tokens, claims once, enforces singleton and host departure, without model calls',async t=>{
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'teams-test'}});t.after(()=>mf.dispose());
  const db=await mf.getD1Database('DB');
  for(const sql of (await Promise.all(['0000_rally','0001_teams','0002_teams_transcription'].map(n=>readFile('drizzle/'+n+'.sql','utf8')))).join('\n').split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(sql).run();
  const env={DB:db,RALLY_TEAMS_BRIDGE_SECRET:'local-test-secret'};
  let now=100_000;
  const call=(path,data={},secret)=>teamsApi(new Request('http://localhost/api/teams/'+path,{method:path==='status'?'GET':'POST',headers:secret?{'X-Rally-Bridge':secret}:{}}),env,data,now);
  const poll=()=>call('runner/poll',{runnerId:'test-runner-1',credentialsConfigured:false},'local-test-secret');
  const join={meetingUrl:'https://teams.microsoft.com/meet/123?context=x',token:'ephemeral-token-do-not-leak',consented:true};
  await assert.rejects(call('join',join),/offline/);
  await assert.rejects(call('runner/poll',{runnerId:'test-runner-1'},'wrong-secret'),/authentication/);
  await poll();
  await assert.rejects(call('join',{...join,consented:false}),/consent/);
  await assert.rejects(call('join',{...join,token:''}),/Azure calling/);
  const first=await call('join',join);
  const stored=await db.prepare('SELECT token_cipher FROM teams_jobs WHERE id=?').bind(first.job.id).first();
  assert.ok(stored.token_cipher&&!stored.token_cipher.includes(join.token));
  assert.ok(!JSON.stringify(await call('status')).includes(join.token));
  await assert.rejects(call('join',join),/already has an active/);
  const claimed=await poll();assert.equal(claimed.job.token,join.token);assert.equal(claimed.job.claimed,true);
  assert.equal((await db.prepare('SELECT token_cipher FROM teams_jobs WHERE id=?').bind(first.job.id).first()).token_cipher,null);
  assert.ok(!(await poll()).job.token,'Repeated polling cannot return token again');
  await assert.rejects(call('runner/poll',{runnerId:'second-runner'},'local-test-secret'),/already online/);
  await call('runner/update',{runnerId:'test-runner-1',id:first.job.id,state:'connected',inputLevel:0.2},'local-test-secret');
  assert.equal((await call('status')).job.state,'connected');
  await call('leave',{id:first.job.id});assert.equal((await poll()).job.leaveRequested,true);
  await call('runner/update',{runnerId:'test-runner-1',id:first.job.id,state:'left'},'local-test-secret');
  assert.equal((await call('status')).job.state,'left');
  const races=await Promise.allSettled([call('join',join),call('join',join)]);
  assert.equal(races.filter(r=>r.status==='fulfilled').length,1,'Concurrent invitations must not launch two paid calls');
  const active=races.find(r=>r.status==='fulfilled').value.job;
  await call('leave',{id:active.id});assert.equal((await poll()).job,null);
  await call('join',join);now+=61_000;await poll();
  const expired=(await call('status')).job;assert.equal(expired.state,'failed');assert.match(expired.message,/Verify Rally has left/);
  const expiredStored=await db.prepare('SELECT token_cipher FROM teams_jobs WHERE id=?').bind(expired.id).first();assert.equal(expiredStored.token_cipher,null);
});
