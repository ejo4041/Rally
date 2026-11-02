// Short matched-text comparison. No speaker cloning; hosted output uses Rally's voice.
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createRequire} from 'node:module';
import {MMSSpeech,wav} from '../experiments/meta-mms/speech.mjs';
const require=createRequire(new URL('../apps/rally-api/package.json',import.meta.url));
const {SeamlessSpeech}=require('./src/seamless.ts');
if(process.env.RALLY_JOBS_TTS_APPROVED!=='1')throw Error('Explicit one-request hosted speech gate required');
const dir=new URL('../artifacts/feedback/jobs-tts-pilot/',import.meta.url);await mkdir(dir,{recursive:true});
const resultPath=new URL('synthesis.json',dir);
try{await stat(resultPath);throw Error('Existing result retained; no automatic repetition');}catch(error){if(error.code!=='ENOENT')throw error;}
const text="Thank you. I'm honored to be with you today for your commencement from one of the finest universities in the world.";
const result={at:new Date().toISOString(),state:'running',text,scope:'Short same-text comparison against podcast copy of Jobs Stanford address; not verified identical to YouTube stream, no speaker imitation.',mms:null,seamless:null};
const save=()=>writeFile(resultPath,JSON.stringify(result,null,2)+'\n');await save();
const mms=new MMSSpeech({python:'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:'/srv/hackathon/models/mms-tts-eng'});
try {
 const cold=performance.now();await mms.start();const warm=performance.now();const audio=await mms.synthesize(text);
 await writeFile(new URL('mms.wav',dir),audio.wav);result.mms={model:audio.model,revision:audio.revision,seconds:audio.seconds,loadMs:warm-cold,wholeAudioReadyMs:performance.now()-warm,streaming:false,phrases:audio.phrases,apiCalls:0};await save();
 const env=parseEnv(await readFile('/srv/hackathon/rally-deployed/config/api.env','utf8'));const voice=new SeamlessSpeech(env.RALLY_TTS_TOKEN||'');
 let firstByteMs=null,cached=null;const start=performance.now(),parts=[];
 result.seamless={state:'pending',cost:null,billing:'AWS infrastructure unknown',requests:1};await save();
 for await(const part of voice.stream({input:text},AbortSignal.timeout(30000),'pcm',v=>cached=v)){firstByteMs??=performance.now()-start;parts.push(part);}
 const pcm=Buffer.concat(parts);await writeFile(new URL('seamless.wav',dir),wav(pcm,16000));
 result.seamless={state:'completed',model:voice.identity.model,revision:null,firstByteMs,totalMs:performance.now()-start,seconds:pcm.length/32000,cached,cost:null,billing:'AWS infrastructure unknown',requests:1};result.state='completed';await save();
 console.log(JSON.stringify({state:result.state,mmsSeconds:result.mms.seconds,seamless:result.seamless}));
} catch(error){result.state='failed';result.error=error.message;if(result.seamless?.state==='pending')result.seamless={...result.seamless,state:'failed',error:typeof error.status==='number'?`HTTP adapter status ${error.status}`:'Speech request failed',cost:null};await save();throw error;}finally{mms.close();}
