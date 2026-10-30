import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplication} from './support/application.ts';
import {SeamlessSpeech} from '../src/seamless.ts';
import type {TranscriptEvent} from '../src/contracts.ts';
import type {LiveContext} from '../src/realtime.ts';
test('passive mode is enforced in HTTP/live playback; cited Rally question gets one answer and owner can change mode',async(t)=>{
 let emit:(e:TranscriptEvent)=>void=()=>{};const spoken:string[]=[],contexts:LiveContext[]=[];
 const api=createApplication({dbPath:':memory:',realtimeEnabled:true,paidEnabled:true,assessmentMs:40,
  tts:new SeamlessSpeech('fixture',undefined,async(_u,init)=>{spoken.push(JSON.parse(String(init?.body)).input);return new Response(Buffer.alloc(640));}),
  media:{open:async()=>({connection:async()=>({url:'ws://fixture',room:'fixture',token:'fixture'}),send:async()=>{},close:async()=>{},play:async(_job,chunks,_signal,before)=>{before();for await(const _ of chunks){}}})},
  providers:{prepare:async()=>({objective:'Agree release',topics:[{id:'one',title:'Review',outcome:'Decide',minutes:4,status:'active'}],durationMinutes:5,wrapMinutes:1}),
   openASR:async(_m,c)=>{emit=c.onEvent;return {sessionId:'one',send(){},close(){},end:async()=>{},sentSeconds:0,processedMs:0};},
   checkLive:async context=>{contexts.push(context);return {health:4,feeling:'focused',observation:'Reviewing',progress:'Release discussed',concern:'',evidence:[context.addressedRequest?.id??context.finals.at(-1)!.id],intervention:{text:context.addressedRequest?'You agreed to ship Monday.':'Return to the release review.',kind:'checkpoint'},agendaChange:null,extension:null,extensionConsent:null};}
  }});
 const server=api.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));t.after(async()=>{await api.close();await new Promise<void>(r=>server.close(()=>r()));});
 const base=`http://127.0.0.1:${(server.address() as any).port}/api`;let cookie='';
 const req=(path:string,method='GET',body?:unknown,c=cookie)=>fetch(base+path,{method,headers:{cookie:c,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 const signup=await req('/fixture/signup','POST',{username:'host',password:'fixture-password'});cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const m=await (await req('/meetings','POST',{agenda:'Agree release',durationMinutes:5,moderationMode:'passive'})).json();assert.equal(m.moderationMode,'passive');
 await req(`/meetings/${m.id}/start`,'POST',{consented:true});emit({type:'final',sessionId:'one',turnId:1,text:'We agreed to ship Monday.',speaker:'A'});
 await new Promise(r=>setTimeout(r,180));assert.ok(contexts.length);assert.equal(spoken.length,0);assert.equal(contexts[0].moderationMode,'passive');
 emit({type:'final',sessionId:'one',turnId:2,text:'Hey Rally, what did we decide?',speaker:'A'});
 for(let n=0;n<100&&!spoken.length;n++)await new Promise(r=>setTimeout(r,10));assert.deepEqual(spoken,['You agreed to ship Monday.']);
 await new Promise(r=>setTimeout(r,160));assert.equal(spoken.length,1);
 const other=await req('/fixture/signup','POST',{username:'other',password:'fixture-password'}),otherCookie=other.headers.get('set-cookie')!.split(';')[0];
 assert.equal((await req(`/meetings/${m.id}/moderation`,'PATCH',{mode:'proactive'},otherCookie)).status,404);
 const updated=await req(`/meetings/${m.id}/moderation`,'PATCH',{mode:'balanced'});assert.equal(updated.status,200);assert.equal((await updated.json()).moderationMode,'balanced');
 assert.equal((await req(`/meetings/${m.id}/moderation`,'PATCH',{mode:'unbounded'})).status,400);
});
