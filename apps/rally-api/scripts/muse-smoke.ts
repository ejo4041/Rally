// Explicit paid integration check. Never included in npm test.
import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Room,AudioSource,AudioFrame,LocalAudioTrack,TrackPublishOptions,TrackSource,dispose} from '@livekit/rtc-node';
import {createApplication} from '../src/app.ts';
import {loadEnvironment,environmentConfig} from '../src/config.ts';
import assert from 'node:assert/strict';
loadEnvironment();
if(process.env.RALLY_SMOKE_APPROVED!=='1')throw new Error('Set RALLY_SMOKE_APPROVED=1 only for an explicitly budgeted test (at most $0.15).');
const fixture=process.env.RALLY_SMOKE_PCM||'/tmp/rally-public-audio/input.pcm';
if(!existsSync(fixture))throw new Error('Provide a licensed mono PCM16/16kHz fixture in RALLY_SMOKE_PCM.');
const pcm=readFileSync(fixture).subarray(0,30*32000);
const run=randomUUID(),dir=resolve(`test-results/muse-${run}`);mkdirSync(dir,{recursive:true});
const media=spawn(resolve('.data/bin/livekit-server'),['--dev','--bind','127.0.0.1','--port','17881','--node-ip','127.0.0.1'],{stdio:'ignore'});
const config={...environmentConfig(),paidEnabled:true,dbPath:resolve(dir,'usage.sqlite'),livekitUrl:'ws://127.0.0.1:17881',livekitKey:'devkey',livekitSecret:'secret',buildBudget:.15,meetingBudget:.15,assessmentMs:100000};
const api=createApplication(config),server=api.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`;let cookie='',meetingId='',failure:string|null=null;
const request=(path:string,method='GET',body?:unknown)=>fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
const room=new Room();let source:AudioSource|undefined;
try{
 for(let n=0;n<50;n++){try{await fetch('http://127.0.0.1:17881');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 const signup=await request('/auth/signup','POST',{username:'smoke',password:randomUUID()});cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const created=await request('/meetings','POST',{title:'Licensed audio integration check',agenda:'Decide the software release date, identify remaining launch tasks, and allocate owners. Redirect unrelated reading or anecdotes.',durationMinutes:5});
 const meeting=await created.json();meetingId=meeting.id;assert.equal(meeting.phase,'ready',meeting.error);
 const started=await request(`/meetings/${meetingId}/start`,'POST',{consented:true});const start=await started.json();assert.equal(started.status,200,JSON.stringify(start));
 await room.connect(start.connection.url,start.connection.token,{autoSubscribe:false,dynacast:false});source=new AudioSource(16000,1,200);
 const track=LocalAudioTrack.createAudioTrack('licensed-fixture',source);await room.localParticipant!.publishTrack(track,new TrackPublishOptions({source:TrackSource.SOURCE_MICROPHONE}));
 await new Promise(r=>setTimeout(r,500));
 for(let i=0;i<pcm.length;i+=640){const frame=new Int16Array(320);const part=pcm.subarray(i,i+640);for(let n=0;n<part.length/2;n++)frame[n]=part.readInt16LE(n*2);await source.captureFrame(new AudioFrame(frame,16000,1,320));}
 await source.waitForPlayout();await new Promise(r=>setTimeout(r,2000));
 await request(`/meetings/${meetingId}/commands`,'POST',{type:'request_guidance'});
 const ended=await request(`/meetings/${meetingId}/end`,'POST');assert.equal(ended.status,202);
 let saved;for(let n=0;n<200;n++){saved=await (await request(`/meetings/${meetingId}`)).json();if(['ready','failed'].includes(saved.reportStatus))break;await new Promise(r=>setTimeout(r,1000));}
 writeFileSync(resolve(dir,'meeting.json'),JSON.stringify(saved,null,2));assert.equal(saved.reportStatus,'ready',saved.error);assert.ok(saved.turns.length>0);
 console.log(JSON.stringify({run,phase:saved.phase,turns:saved.turns.length,speakers:[...new Set(saved.turns.map((t:{speaker:string})=>t.speaker))],health:saved.assessment?.health,interventions:saved.interventions.length,reportStatus:saved.reportStatus,overall:saved.report?.overall}));
}catch(error){failure=error instanceof Error?error.message:String(error);console.error(failure);process.exitCode=1;}
finally{
 if(meetingId){try{await request(`/meetings/${meetingId}/end`,'POST');}catch{}}
 await source?.close();await room.disconnect();await api.close();
 // Read through the public usage API before stopping HTTP (database closed by api.close).
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(config.dbPath);const rows=db.prepare('SELECT status,cost,estimate,body FROM usage').all();const usage=rows.map(r=>({...JSON.parse(String(r.body)),status:r.status,cost:r.cost,reserved:r.estimate}));db.close();
 const summary={run,at:new Date().toISOString(),fixture:'Previously licensed LibriSpeech reference PCM; see public-audio-benchmark.md',failure,batchCost:usage.reduce((s,r)=>s+(r.cost||0),0),unknown:usage.filter(r=>r.status!=='known').length,usage};writeFileSync(resolve(dir,'usage.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({evidence:dir,batchCost:summary.batchCost,unknown:summary.unknown}));
 server.close();media.kill('SIGTERM');await dispose();
}
