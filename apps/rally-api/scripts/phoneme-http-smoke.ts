// Real local Meta phone synthesis through an isolated authenticated speech API.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {PhonemeSpeech} from '../../../experiments/phoneme-speech/adapter.mjs';
import {createApplication} from '../tests/support/application.ts';
import type {TranscriptEvent} from '../src/contracts.ts';
if(process.env.RALLY_PHONEME_HTTP_APPROVED!=='1')throw Error('Explicit real local-model gate required');
const output=resolve('test-results/phoneme-http-v2-20261102');if(existsSync(output))throw Error('Retain existing result; no automatic repetition');mkdirSync(output,{recursive:true});
let final:(event:TranscriptEvent)=>void=()=>{};
const speechEngine=new PhonemeSpeech({python:'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:'/srv/hackathon/models/meta-fastspeech2'});
const app=createApplication({dbPath:':memory:',assessmentMs:100000,speechEngine,
 media:{open:async()=>({connection:async()=>({url:'ws://fixture',token:'fixture',room:'fixture'}),send:async()=>{},close:async()=>{}})},
 providers:{prepare:async()=>({objective:'Review evidence',topics:[{id:'review',title:'Review',outcome:'Review evidence',minutes:2,status:'pending'}],durationMinutes:3,wrapMinutes:1}),
 openASR:async(_m,callbacks)=>{final=callbacks.onEvent;return {sessionId:'source',send(){},end:async()=>{},close(){},sentSeconds:0,processedMs:0};},
 assess:async snapshot=>({health:3,reason:'Review evidence',issues:[],evidence:[snapshot.turns[0].id],progress:'Review',intervention:{text:'Meta supports this meeting. Follow the agenda and the evidence.',kind:'checkpoint',evidence:[snapshot.turns[0].id]},plan:null,planReason:''}),
 }});
const server=app.app.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
const request=(path:string,method='GET',body?:unknown,cookie='')=>fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
try {
 const cookies:string[]=[];
 for(const username of ['phone_host','other_host']){const response=await request('/fixture/signup','POST',{username,password:'offline-fixture-password'});assert.equal(response.status,201);cookies.push(response.headers.get('set-cookie')!.split(';')[0]);}
 const [owner,other]=cookies;
 for(let n=0;n<100;n++){const status=await(await request('/speech/status','GET',undefined,owner)).json();if(status.ready)break;await new Promise(resolve=>setTimeout(resolve,100));}
 const status=await(await request('/speech/status','GET',undefined,owner)).json();assert.equal(status.ready,true);assert.equal(status.model,'facebook/fastspeech2-en-ljspeech');
 const created=await(await request('/meetings','POST',{agenda:'Review evidence',durationMinutes:3},owner)).json();
 assert.equal((await request(`/meetings/${created.id}/start`,'POST',{consented:true},owner)).status,200);
 final({type:'final',sessionId:'source',turnId:0,text:'We need to review the evidence.',speaker:'A'});
 const assessed=await(await request(`/meetings/${created.id}/commands`,'POST',{type:'request_guidance'},owner)).json();
 const intervention=assessed.interventions[0];assert.equal(intervention.text,'Meta supports this meeting. Follow the agenda and the evidence.');
 const response=await request(`/meetings/${created.id}/speech`,'POST',{interventionId:intervention.id,epoch:assessed.epoch},owner);assert.equal(response.status,202);const job=await response.json();
 let ready:any;
 for(let n=0;n<100;n++){ready=await(await request(`/meetings/${created.id}/speech/${job.id}`,'GET',undefined,owner)).json();if(ready.state==='ready')break;assert.notEqual(ready.state,'failed');await new Promise(resolve=>setTimeout(resolve,50));}
 assert.equal(ready.state,'ready');
 const audioPath=`/meetings/${created.id}/speech/${job.id}/audio`;
 assert.equal((await request(audioPath,'GET',undefined,other)).status,404);
 const audioResponse=await request(audioPath,'GET',undefined,owner);assert.equal(audioResponse.status,200);const audio=Buffer.from(await audioResponse.arrayBuffer());assert.equal(audio.toString('ascii',0,4),'RIFF');assert.ok(audio.length>32000);writeFileSync(resolve(output,'approved.wav'),audio);
 await request(`/meetings/${created.id}/commands`,'POST',{type:'pause'},owner);
 assert.equal((await request(audioPath,'GET',undefined,owner)).status,409);
 const snapshot=await(await request(`/meetings/${created.id}`,'GET',undefined,owner)).json();assert.equal(snapshot.turns[0].text,'We need to review the evidence.');assert.equal(snapshot.interventions[0].text,intervention.text);
 const evidence={at:new Date().toISOString(),passed:true,scope:'Real local Meta acoustic/vocoder through local authenticated Express/SQLite approved-speech flow; injected ASR/reasoning/media, test-only login fixture. No human meeting, production MFA or remote audibility test.',model:status.model,revision:status.revision,sampleRate:audio.readUInt32LE(24),wavBytes:audio.length,ownerIsolation:true,canonicalTextPreserved:true,pauseRevokesAudio:true,providerCalls:0};writeFileSync(resolve(output,'result.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{await app.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
