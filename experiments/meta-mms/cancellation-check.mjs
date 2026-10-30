// Explicit real-worker check; synthetic text only, offline pinned weights.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MMSSpeech,MODEL,REVISION} from './speech.mjs';
const engine=new MMSSpeech({
 python:process.env.RALLY_MMS_PYTHON||'/srv/hackathon/tools/mms-venv/bin/python',
 modelDirectory:process.env.RALLY_MMS_MODEL_DIR||'/srv/hackathon/models/mms-tts-eng',
});
const adapterSourceSha256=createHash('sha256').update(await readFile(new URL('./speech.mjs',import.meta.url))).digest('hex');
const report={adapterSourceSha256,startedAt:new Date().toISOString(),model:MODEL,revision:REVISION,state:'running',checks:[],paidModelCalls:0,realMeeting:false,rawAudioSaved:false};
async function exited(child){
 if(child.exitCode!==null||child.signalCode!==null)return;
 let timer;
 try{await Promise.race([once(child,'exit'),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Canceled worker remained alive')),5000))]);}
 finally{clearTimeout(timer);}
}
async function canceled(stage){
 if(stage==='pending-request')await engine.start();
 const abort=new AbortController(),started=performance.now();
 const promise=engine.synthesize('Could we return to the release decision and confirm who will check rollback before Thursday at three?',{signal:abort.signal});
 // Observe both outcomes immediately, including unexpected startup failures.
 let settled=false;
 const outcome=promise.then(value=>{settled=true;return{value};},error=>{settled=true;return{error};});
 const deadline=performance.now()+5000;
 while(stage==='pending-request'&&!engine.pending&&!settled){
  assert.ok(performance.now()<deadline,'Speech request did not become pending');
  await new Promise(resolve=>setTimeout(resolve,5));
 }
 if(settled)throw (await outcome).error||Error('Request completed before cancellation');
 const child=engine.child;
 assert.ok(child?.pid,'No real worker process');
 if(stage==='startup')assert.equal(engine.pending,undefined);
 abort.abort();
 const result=await outcome;
 assert.match(result.error?.message||'',/cancel|stopped/i);
 await exited(child);
 assert.equal(engine.child,null);
 assert.equal(engine.busy,false);
 const check={stage,canceled:true,workerExited:true,requestMs:Math.round(performance.now()-started),workerPid:child.pid};
 report.checks.push(check);console.log(JSON.stringify(check));
}
try{
 await canceled('startup');
 await canceled('pending-request');
 const started=performance.now(),audio=await engine.synthesize('Could we return to the release decision?');
 assert.equal(audio.model,MODEL);assert.equal(audio.revision,REVISION);assert.equal(audio.sampleRate,16000);
 assert.ok(audio.seconds>0&&audio.seconds<=30);assert.ok(audio.pcm.length>0);
 let sum=0;for(let i=0;i<audio.pcm.length;i+=2)sum+=(audio.pcm.readInt16LE(i)/32768)**2;
 const rms=Math.sqrt(sum/(audio.pcm.length/2));assert.ok(rms>.005);
 assert.ok(report.checks.every(check=>check.workerPid!==engine.child.pid));
 report.checks.push({stage:'recovery',passed:true,requestMs:Math.round(performance.now()-started),workerPid:engine.child.pid,seconds:audio.seconds,rms});
 report.state='passed';
}catch(error){report.state='failed';report.error=error instanceof Error?error.message:'Local cancellation check failed';process.exitCode=1;}
finally{
 const child=engine.child;engine.close();if(child)await exited(child);
 report.endedAt=new Date().toISOString();
 await mkdir(new URL('./test-results/',import.meta.url),{recursive:true});
 await writeFile(new URL('./test-results/cancellation-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
