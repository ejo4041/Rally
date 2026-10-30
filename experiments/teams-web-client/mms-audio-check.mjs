// Offline test of the exact Teams sink/microphone names using a disposable
// PulseAudio daemon. No Teams browser, stored meeting link or model API.
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createTeamsSpeech} from './speech.mjs';
const dir=await mkdtemp(join(tmpdir(),'rally-teams-mms-'));
const env={...process.env,PULSE_SERVER:'unix:'+join(dir,'native')};
let pulse,speech,incoming,microphone,tone;
const children=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const record=device=>{
 const p=spawn('parec',['--device='+device,'--format=s16le','--rate=16000','--channels=1','--latency-msec=40'],{env,stdio:['ignore','pipe','ignore']});children.push(p);
 let recent=Buffer.alloc(0),bytes=0,peakRms=0;
 p.stdout.on('data',b=>{bytes+=b.length;recent=Buffer.concat([recent,b]).subarray(-32000);let sum=0;for(let i=0;i+1<b.length;i+=2)sum+=(b.readInt16LE(i)/32768)**2;peakRms=Math.max(peakRms,Math.sqrt(sum/Math.max(1,b.length/2)));});
 return{clear(){recent=Buffer.alloc(0);},measure(){let sum=0;for(let i=0;i+1<recent.length;i+=2)sum+=(recent.readInt16LE(i)/32768)**2;return{samples:recent.length/2,rms:Math.sqrt(sum/Math.max(1,recent.length/2)),peakRms,totalBytes:bytes};}};
};
const report={startedAt:new Date().toISOString(),passed:false,realPinnedMMS:true,teamsJoined:false,paidModelCalls:0,rawAudioSaved:false,privateDisposableAudio:true};
try{
 await writeFile(join(dir,'pulse.pa'),`load-module module-native-protocol-unix socket=${dir}/native auth-anonymous=0
load-module module-null-sink sink_name=rally_teams_in rate=48000 channels=1 channel_map=mono
load-module module-null-sink sink_name=rally_teams_out rate=48000 channels=1 channel_map=mono
load-module module-remap-source master=rally_teams_out.monitor source_name=rally_teams_mic channels=1 master_channel_map=mono channel_map=mono
`,{mode:0o600});
 pulse=spawn('pulseaudio',['-n','--file='+join(dir,'pulse.pa'),'--daemonize=no','--exit-idle-time=-1','--use-pid-file=no'],{stdio:'ignore'});children.push(pulse);
 for(let n=0;;n++){try{execFileSync('pactl',['info'],{env,stdio:'ignore'});break;}catch{if(n>40)throw Error('Private audio failed');await wait(100);}}
 incoming=record('rally_teams_in.monitor');microphone=record('rally_teams_mic');
 // Independent incoming tone demonstrates output isolation while MMS speaks.
 tone=spawn('paplay',['--raw','--format=s16le','--rate=16000','--channels=1','--device=rally_teams_in'],{env,stdio:['pipe','ignore','ignore']});children.push(tone);tone.stdin.on('error',()=>{});
 const pcm=Buffer.alloc(16000*2*18);for(let i=0;i<pcm.length/2;i++)pcm.writeInt16LE(Math.round(5000*Math.sin(2*Math.PI*880*i/16000)),2*i);tone.stdin.end(pcm);
 let began;const playing=new Promise(resolve=>began=resolve);
 speech=createTeamsSpeech({env,canSpeak:async()=>true,onPlayback:e=>{if(e.state==='speaking')began();}});
 await speech.start();
 const pending=speech.diagnostic();await playing;await wait(1200);
 const during=microphone.measure();assert.ok(during.peakRms>.005,'MMS never reached virtual Teams microphone');
 const incomingDuring=incoming.measure();assert.ok(incomingDuring.rms>.03);
 assert.equal(speech.shielded(),true);speech.cancel();assert.equal(await pending,'canceled');
 await wait(1000);microphone.clear();await wait(400);
 const stopped=microphone.measure(),incomingAfter=incoming.measure();
 assert.ok(stopped.samples>1000);assert.ok(stopped.rms<.005,'Canceled speech still present');assert.ok(incomingAfter.rms>.03,'Incoming path stopped with speech');
 report.passed=true;Object.assign(report,{virtualMicrophoneDuring:during,virtualMicrophoneAfterStop:stopped,incomingDuring,incomingAfterStop:incomingAfter,cancellation:true,inputShieldObserved:true});
}catch(error){report.error=error instanceof Error?error.message:'Local routing failed';process.exitCode=1;}
finally{
 speech?.close();for(const child of children.reverse())if(child.exitCode===null)child.kill('SIGTERM');await wait(250);await rm(dir,{recursive:true,force:true});
 report.endedAt=new Date().toISOString();await mkdir(new URL('./test-results/',import.meta.url),{recursive:true});await writeFile(new URL('./test-results/mms-audio-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
