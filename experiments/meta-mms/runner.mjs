import {modelConfig} from '../../apps/rally/src/models.js';
import {MMSSpeech} from './speech.mjs';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export async function runSpeechQueue({api,engine,signal,sleep=ms=>new Promise(r=>setTimeout(r,ms)),runnerId=randomUUID(),speech=modelConfig().speech}){
 let current=null;const stop=()=>{current?.abort.abort();engine.close();};signal.addEventListener('abort',stop,{once:true});
 try{
  if(signal.aborted)return;await engine.start();
  while(!signal.aborted){
   try{
    const result=await api('poll',{runnerId,model:speech.model,revision:speech.revision,...(current?{currentId:current.id}:{})});
    if(current){
     if(!result.job||result.job.state!=='generating')current.abort.abort();
    }else if(result.job){
     const job={...result.job,abort:new AbortController()};current=job;
     job.task=(async()=>{
      try{
       const audio=await engine.synthesize(job.text,{signal:job.abort.signal});
       if(!job.abort.signal.aborted&&!signal.aborted)await api('finish',{runnerId,id:job.id,sampleRate:audio.sampleRate,pcmBase64:audio.pcmBase64});
      }catch{
       if(!signal.aborted)await api('fail',{runnerId,id:job.id}).catch(()=>{});
      }finally{if(current===job)current=null;}
     })();
    }
   }catch{
    // A failed poll cannot establish continued host permission. Cancel local
    // work and leave the durable job to expire; no hidden generation retries.
    current?.abort.abort();
   }
   await sleep(current?250:1000);
  }
 }catch(error){if(!signal.aborted)throw error;}finally{
  const pending=current;pending?.abort.abort();engine.close();await pending?.task;signal.removeEventListener('abort',stop);
 }
}

async function main(){
 const env={...process.env};
 const envPath=process.env.RALLY_ENV_FILE||resolve(fileURLToPath(new URL('../../.env.local',import.meta.url)));
 for(const line of (await readFile(envPath,'utf8')).split(/\r?\n/)){
  const match=line.match(/^([A-Z_]+)=(.*)$/);if(match&&!Object.hasOwn(env,match[1]))env[match[1]]=match[2].trim().replace(/^(['"])(.*)\1$/,'$2');
 }
 const origin=env.RALLY_RUNNER_ORIGIN||env.RALLY_TEAMS_SITE_URL;
 if(!origin||!env.RALLY_TEAMS_BRIDGE_SECRET)throw new Error('Configure the runner origin and existing bridge secret.');
 const base=new URL(origin);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw new Error('Use HTTPS or a local loopback preview.');
 const controller=new AbortController();for(const name of ['SIGTERM','SIGINT'])process.once(name,()=>controller.abort());
 const speech=modelConfig(env).speech;
 const engine=new MMSSpeech({model:speech.model,revision:speech.revision,python:env.RALLY_MMS_PYTHON||'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:env.RALLY_MMS_MODEL_DIR||'/srv/hackathon/models/mms-tts-eng',onReady:()=>console.log('Pinned Meta MMS model loaded; starting speech queue polling.')});
 const api=async(action,body)=>{
  const response=await fetch(new URL(`/api/speech/runner/${action}`,base),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Rally-Bridge':env.RALLY_TEAMS_BRIDGE_SECRET,...(env.RALLY_SITES_SERVICE_TOKEN?{'OAI-Sites-Authorization':`Bearer ${env.RALLY_SITES_SERVICE_TOKEN}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Speech bridge request failed.');return response.json();
 };
 await runSpeechQueue({api,engine,signal:controller.signal,speech});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Meta MMS runner stopped. Check the model, origin and bridge configuration.');process.exitCode=1;});
