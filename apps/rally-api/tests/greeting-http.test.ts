import test from 'node:test';import assert from 'node:assert/strict';import {createApplication} from './support/application.ts';import {SeamlessSpeech} from '../src/seamless.ts';
for(const enabled of [false,true])test(`Teams welcome HTTP/stream path: opt-in ${enabled}`,async(t)=>{
 const spoken:string[]=[],states:string[]=[];let api:ReturnType<typeof createApplication>;
 api=createApplication({dbPath:':memory:',paidEnabled:true,assessmentMs:60000,
  tts:new SeamlessSpeech('fixture',undefined,async(_url,init)=>{spoken.push(JSON.parse(String(init?.body)).input);return new Response(Buffer.alloc(640));}),
  providers:{prepare:async()=>({objective:'Decide release',topics:[{id:'a',title:'Review features',outcome:'Review',minutes:2,status:'pending'},{id:'b',title:'Assign owners',outcome:'Assign',minutes:2,status:'pending'}],durationMinutes:5,wrapMinutes:1}),openASR:async()=>({sessionId:'fixture',send(){},close(){},end:async()=>{},sentSeconds:0,processedMs:0})},
  media:{open:async()=>({connection:async()=>({url:'ws://fixture',room:'fixture',token:'fixture'}),send:async()=>{},close:async()=>{}})},
  teamsConnector:async(_url,_signal,onState)=>{onState('lobby');return {alive:()=>true,receive:()=>()=>{},play:async(chunks,_abort,before)=>{states.push('play');before();for await(const _ of chunks){}},close:async()=>{}};}
 });const server=api.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));t.after(async()=>{await api.close();await new Promise<void>(r=>server.close(()=>r()));});
 const base=`http://127.0.0.1:${(server.address() as any).port}/api`;let cookie='';const req=(path:string,body?:unknown,c=cookie)=>fetch(base+path,{method:body?'POST':'GET',headers:{cookie:c,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 const signup=await req('/fixture/signup',{username:'welcome_host',password:'fixture-password'});cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const m=await(await req('/meetings',{title:'Welcome fixture',agenda:'Review features and owners',durationMinutes:5})).json();
 const foreign=await req('/fixture/signup',{username:'welcome_other',password:'fixture-password'}),other=foreign.headers.get('set-cookie')!.split(';')[0];
 assert.equal((await req(`/meetings/${m.id}/teams/connect`,{meetingUrl:'https://teams.microsoft.com/meet/test',consented:true,greetingEnabled:true},other)).status,404);
 const body={meetingUrl:'https://teams.microsoft.com/meet/test',consented:true,...(enabled?{greetingEnabled:true}:{})};assert.equal((await req(`/meetings/${m.id}/teams/connect`,body)).status,202);
 let record:any;for(let i=0;i<80;i++){record=await(await req(`/meetings/${m.id}`)).json();if(record.callState==='connected'&&(!enabled||record.speechStatus?.state==='completed'))break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(record.callState,'connected');assert.equal(record.phase,'live');assert.equal(spoken.length,enabled?1:0);assert.equal(states.length,enabled?1:0);
 if(enabled){assert.match(spoken[0],/Hi team, Rally here/);assert.match(spoken[0],/Review features; Assign owners/);assert.ok(record.greetingAttemptedAt);assert.equal(record.interventions[0].kind,'welcome');}
 for(let i=0;i<3;i++)await req(`/meetings/${m.id}/teams/status`);assert.equal(spoken.length,enabled?1:0);
});
