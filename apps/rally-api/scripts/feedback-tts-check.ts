// One new uncached synthetic utterance, no playback, no platform join; AWS cost remains unknown.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {SeamlessSpeech} from '../src/seamless.ts';
if(process.env.RALLY_FEEDBACK_TTS_PROBE!=='1')throw Error('Operator gate required for one non-retrying speech check');
const dir=new URL('../../../artifacts/feedback/',import.meta.url);mkdirSync(dir,{recursive:true});const output=new URL('tts-check.json',dir);
if(existsSync(output))throw Error('Probe result already exists; no automatic repeat');
writeFileSync(output,JSON.stringify({status:'pending',cost:null,billing:'AWS infrastructure unknown'}));
const env=parseEnv(readFileSync('/srv/hackathon/rally-deployed/config/api.env','utf8'));const voice=new SeamlessSpeech(env.RALLY_TTS_TOKEN||'');
const text='Priya will verify rollback by Friday at noon. Accessibility ownership is still unresolved.';const chunks:Buffer[]=[];const start=performance.now();let firstByteMs:number|null=null,cached:boolean|null=null;
try{for await(const chunk of voice.stream({input:text},AbortSignal.timeout(30000),'pcm',v=>cached=v)){firstByteMs??=Math.round(performance.now()-start);chunks.push(chunk);}const pcm=Buffer.concat(chunks);writeFileSync(new URL('production-voice-synthetic.pcm',dir),pcm);const result={at:new Date().toISOString(),status:'completed',text,model:voice.identity.model,adapter:voice.identity.adapter,revision:null,firstByteMs,totalMs:Math.round(performance.now()-start),seconds:pcm.length/32000,cached,cost:null,billing:'AWS infrastructure cost not supplied',playback:false,platformJoins:0};writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));}catch(error){writeFileSync(output,JSON.stringify({at:new Date().toISOString(),status:'failed',firstByteMs,cached,cost:null,billing:'AWS infrastructure cost unknown',error:error instanceof Error?error.message:'Unknown'},null,2));throw error;}
