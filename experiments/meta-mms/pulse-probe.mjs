import {execFileSync,spawn} from 'node:child_process';
import {writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {MMSSpeech} from './speech.mjs';
import {createSpeechOutput,pulsePlayback} from './output.mjs';

const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dir=new URL('./test-results/',import.meta.url);
const runtime=await mkdtemp(join(tmpdir(),'rally-mms-pulse-'));
const env={...process.env,PULSE_SERVER:`unix:${runtime}/native`,PULSE_RUNTIME_PATH:runtime};
const daemon=spawn('pulseaudio',['--daemonize=no','--exit-idle-time=-1','--use-pid-file=no','-n',`--load=module-native-protocol-unix socket=${runtime}/native auth-anonymous=1`],{env,stdio:'ignore'});
const sink='rally_mms_probe_'+randomUUID().replaceAll('-','').slice(0,12);
const pactl=args=>execFileSync('pactl',args,{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
let moduleId,record,output;let capture=Buffer.alloc(0);const events=[];
const engine=new MMSSpeech({python:'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:'/srv/hackathon/models/mms-tts-eng'});
function rms(){const bytes=capture.subarray(Math.max(0,capture.length-6400));let sum=0;for(let i=0;i+1<bytes.length;i+=2)sum+=(bytes.readInt16LE(i)/32768)**2;return Math.sqrt(sum/Math.max(1,bytes.length/2));}
try{
 let connected=false;for(let i=0;i<50;i++){try{pactl(['info']);connected=true;break;}catch{await wait(50);}}
 assert.ok(connected,'Isolated PulseAudio daemon must start');
 moduleId=pactl(['load-module','module-null-sink',`sink_name=${sink}`,'rate=16000','channels=1']);
 record=spawn('parec',[`--device=${sink}.monitor`,'--format=s16le','--rate=16000','--channels=1','--latency-msec=40'],{env,stdio:['ignore','pipe','ignore']});record.stdout.on('data',chunk=>{capture=Buffer.concat([capture,chunk]);if(capture.length>16000)capture=capture.subarray(capture.length-16000);});
 await engine.start();
 output=createSpeechOutput({engine,canSpeak:async()=>true,play:pulsePlayback({sink,env}),onPlayback:e=>events.push(e.state)});
 const pending=output.present({id:'synthetic-routing-test',epoch:1,text:'Let us return to the release decision. We need to confirm who owns the rollback check, agree on the deadline, and review the final outcome together.'});
 let activeRms=0;const deadline=Date.now()+20000;
 while(Date.now()<deadline){activeRms=Math.max(activeRms,rms());if(activeRms>.005)break;await wait(40);}
 assert.ok(activeRms>.005,'MMS samples must reach the selected isolated sink');assert.equal(output.isEchoRisk(),true);
 const stopStart=performance.now();output.cancel();assert.equal(await pending,'canceled');const cancellationPromiseMs=Math.round(performance.now()-stopStart);
 await wait(650);const afterStopRms=rms();assert.ok(afterStopRms<.001,'PulseAudio output must be silent after Stop');assert.equal(output.isEchoRisk(),false);assert.deepEqual(events,['speaking']);
 const report={testedAt:new Date().toISOString(),passed:true,model:'facebook/mms-tts-eng',sink:'temporary isolated null sink, unloaded after test',activeRms,afterStopRms,cancellationPromiseMs,stopObservationDelayMs:650,rawCapturedAudioSaved:false,realMeetingJoined:false,physicalAudibilityVerified:false,paidMuseCalls:0,boundary:'Synthetic MMS speech routed through actual paplay/parec on a temporary private device. Physical room echo, Teams transmission and name pronunciation remain unverified.'};
 await mkdir(dir,{recursive:true});await writeFile(new URL('pulse-probe.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{output?.close();engine.close();record?.kill('SIGTERM');if(moduleId)pactl(['unload-module',moduleId]);daemon.kill('SIGTERM');await rm(runtime,{recursive:true,force:true});}
