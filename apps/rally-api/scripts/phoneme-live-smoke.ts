// Actual local Meta synthesis through the common live browser/Teams speech flow.
// Transports and ASR/reasoning are fixtures; no real platform admission or paid calls.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {once} from 'node:events';
import {LocalPhonemeTTS} from '../src/phoneme-tts.ts';
import {PhonemeSpeech} from '../../../experiments/phoneme-speech/adapter.mjs';
import {createApplication} from '../tests/support/application.ts';
import type {TranscriptEvent} from '../src/contracts.ts';
if(process.env.RALLY_PHONEME_LIVE_APPROVED!=='1')throw Error('Explicit local live-flow test gate required');
const dir=resolve('test-results/phoneme-live-v2-20261102');if(existsSync(dir))throw Error('Existing evidence retained');mkdirSync(dir,{recursive:true});
const results=[];
for(const mode of ['browser','teams'] as const){
 let emit:(event:TranscriptEvent)=>void=()=>{},bytes=0,playbackStarted=false;
 const chunks:Buffer[]=[];
 const play=async(parts:AsyncIterable<Buffer>,signal:AbortSignal,before:()=>void)=>{for await(const part of parts){signal.throwIfAborted();if(!playbackStarted){before();playbackStarted=true;}bytes+=part.length;chunks.push(part);}};
 const engine=new PhonemeSpeech({python:'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:'/srv/hackathon/models/meta-fastspeech2'});
 const tts=new LocalPhonemeTTS(engine);
 const api=createApplication({dbPath:':memory:',paidEnabled:true,assessmentMs:100000,tts,
  teamsConnector:async()=>({alive:()=>true,receive:()=>()=>{},play,close:async()=>{}}),
  media:{open:async()=>({connection:async()=>({url:'ws://fixture',token:'fixture',room:'fixture'}),send:async()=>{},close:async()=>{},play:async(_job,parts,signal,before)=>play(parts,signal,before)})},
  providers:{prepare:async()=>({objective:'Review evidence',topics:[{id:'one',title:'Review',outcome:'Review evidence',minutes:2,status:'active'}],durationMinutes:3,wrapMinutes:1}),
   openASR:async(_m,c)=>{emit=c.onEvent;return {sessionId:'fixture',send(){},end:async()=>{},close(){},sentSeconds:0,processedMs:0};},
   assess:async s=>({health:2,reason:'Review',issues:[],evidence:[s.turns[0].id],progress:'Review',intervention:{text:'Meta supports this meeting. Follow the agenda and the evidence.',kind:'checkpoint',evidence:[s.turns[0].id]},plan:null,planReason:''}),
  }});
 const server=api.app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`;let cookie='';
 const request=(path:string,body?:unknown)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 try{
  const login=await request('/fixture/signup',{username:'phone_'+mode,password:'offline-fixture-password'});cookie=login.headers.get('set-cookie')!.split(';')[0];
  const meeting=await(await request('/meetings',{agenda:'Review evidence',durationMinutes:3})).json();
  if(mode==='teams'){
   assert.equal((await request(`/meetings/${meeting.id}/teams/connect`,{meetingUrl:'https://teams.microsoft.com/meet/fixture',consented:true})).status,202);
   for(let i=0;i<100;i++){if((await(await request(`/meetings/${meeting.id}/teams/status`)).json()).state==='connected')break;await new Promise(r=>setTimeout(r,10));}
  }else assert.equal((await request(`/meetings/${meeting.id}/start`,{consented:true})).status,200);
  emit({type:'final',sessionId:'fixture',turnId:0,text:'We should review the evidence.',speaker:'A'});
  const before=performance.now();assert.equal((await request(`/meetings/${meeting.id}/commands`,{type:'request_guidance'})).status,200);
  let snapshot:any;
  for(let i=0;i<200;i++){snapshot=await(await request(`/meetings/${meeting.id}`)).json();if(snapshot.speechStatus?.state==='completed')break;assert.notEqual(snapshot.speechStatus?.state,'failed');await new Promise(r=>setTimeout(r,25));}
  assert.equal(snapshot.speechStatus.state,'completed');assert.ok(bytes>32000);assert.equal(playbackStarted,true);
  assert.equal(snapshot.interventions[0].text,'Meta supports this meeting. Follow the agenda and the evidence.');assert.equal(snapshot.turns[0].text,'We should review the evidence.');
  const usage=await(await request('/speech/usage')).json();assert.equal(usage.length,1);assert.equal(usage[0].adapter,'fastspeech2-local');assert.equal(usage[0].apiCostUSD,0);assert.equal(usage[0].cost,null);
  writeFileSync(resolve(dir,mode+'.pcm'),Buffer.concat(chunks));results.push({mode,passed:true,pcmBytes:bytes,wholeFlowMs:performance.now()-before,usage:usage[0],canonicalTextPreserved:true});
 }finally{await api.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
const evidence={at:new Date().toISOString(),passed:true,results,paidModelCalls:0,realPlatformJoins:0,scope:'Real local Meta phone synthesis through common LiveSpeech and HTTP/SQLite; browser/Teams transport, ASR/reasoning and authentication setup are fixtures. Actual remote audio/camera and MFA are not exercised.'};writeFileSync(resolve(dir,'result.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
