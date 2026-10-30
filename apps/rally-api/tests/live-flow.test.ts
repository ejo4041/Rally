import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplication} from './support/application.ts';
import type {TranscriptEvent, LiveEvent} from '../src/contracts.ts';
import {SeamlessSpeech} from '../src/seamless.ts';

for(const capture of ['browser','teams'] as const) test(`HTTP ${capture} meeting automatically streams approved guidance and emits status even when paused`,async(t)=>{
 let emit:(event:TranscriptEvent)=>void=()=>{};
 const events:LiveEvent[]=[];let spoken='',played=0,browserPlayed=0;
 const call={alive:()=>true,receive:()=>()=>{},play:async(chunks:AsyncIterable<Buffer>,_signal:AbortSignal,before:()=>void)=>{before();for await(const bytes of chunks)played+=bytes.length;},close:async()=>{}};
 const api=createApplication({teamsConnector:async()=>call,dbPath:':memory:',paidEnabled:true,assessmentMs:25,
  tts:new SeamlessSpeech('fixture',undefined,async(_url,init)=>{spoken=JSON.parse(String(init?.body)).input;return new Response(Buffer.alloc(640));}),
  media:{open:async()=>({connection:async()=>({url:'ws://fixture',token:'fixture',room:'fixture'}),send:async e=>{events.push(e);},close:async()=>{},play:async(_job,chunks,_signal,before)=>{before();for await(const b of chunks){played+=b.length;browserPlayed+=b.length;}}})},
  providers:{prepare:async()=>({objective:'Choose owner',topics:[{id:'one',title:'Owner',outcome:'Owner',minutes:8,status:'active'}],durationMinutes:10,wrapMinutes:2}),
   openASR:async(_m,c)=>{emit=c.onEvent;return {sessionId:'s',send(){},end:async()=>{},close(){},sentSeconds:0,processedMs:0};},
   assess:async s=>({health:2,reason:'Need owner',issues:['missing_action_details'],evidence:[s.turns[0].id],progress:'Owner missing',intervention:{text:'Who owns the next step?',kind:'clarify',evidence:[s.turns[0].id]},plan:null,planReason:''}),
  }});
 const server=api.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 t.after(async()=>{await api.close();await new Promise<void>(r=>server.close(()=>r()));});
 const base=`http://127.0.0.1:${(server.address() as any).port}/api`;let cookie='';
 const req=(path:string,body?:unknown)=>fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const signup=await req('/fixture/signup',{username:'live-test',password:'test-password'});cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const created=await req('/meetings',{title:'Planning',agenda:'Choose owner',durationMinutes:10,participants:['Alice']});
 const meeting=await created.json();assert.equal(created.status,201);
 await req(`/meetings/${meeting.id}/prepare`,{});
 if(capture==='teams') {
  assert.equal((await req(`/meetings/${meeting.id}/teams/connect`,{meetingUrl:'https://teams.microsoft.com/meet/fixture',consented:true})).status,202);
  for(let i=0;i<100;i++){if((await(await req(`/meetings/${meeting.id}/teams/status`)).json()).state==='connected')break;await new Promise(r=>setTimeout(r,5));}
  assert.equal((await req(`/meetings/${meeting.id}/start`,{consented:true})).status,409);
 } else assert.equal((await req(`/meetings/${meeting.id}/start`,{consented:true})).status,200);
 emit({type:'final',sessionId:'s',turnId:1,text:'Who will own it?',speaker:'A'});
 for(let n=0;n<100&&!played;n++)await new Promise(r=>setTimeout(r,10));
 assert.equal(played,640);assert.equal(browserPlayed,capture==='teams'?0:640);assert.equal(spoken,'Who owns the next step?');
 const snap=await (await req(`/meetings/${meeting.id}`)).json();assert.equal(snap.speechStatus.state,'completed');assert.equal(snap.audioExclusions.length,1);
 await req(`/meetings/${meeting.id}/commands`,{type:'pause'});const before=events.length;
 await new Promise(r=>setTimeout(r,70));
 assert.ok(events.slice(before).some(e=>e.type==='meeting.status'&&(e.data as any).paused===true));
 if(capture==='teams') {
  await req('/auth/logout',{});
  const login=await req('/fixture/login',{username:'live-test',password:'test-password'});cookie=login.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await(await req(`/meetings/${meeting.id}`)).json()).phase,'live');
  assert.equal((await req(`/meetings/${meeting.id}/teams/leave`,{})).status,200);
  assert.equal((await(await req(`/meetings/${meeting.id}`)).json()).phase,'ended');
 }
 const usage=await(await req('/speech/usage')).json();assert.equal(usage.length,1);assert.equal(usage[0].state,'completed');assert.equal(usage[0].cost,null);
});
