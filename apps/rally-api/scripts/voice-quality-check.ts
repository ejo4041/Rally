// One authored-text hosted sample. Never retries; AWS cost remains unknown.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {SeamlessSpeech} from '../src/seamless.ts';
import {createRequire} from 'node:module';
const {wav}=createRequire(import.meta.url)('../../../experiments/meta-mms/speech.mjs') as {wav(pcm:Buffer,rate:number):Buffer};
if(process.env.RALLY_VOICE_QUALITY_APPROVED!=='1')throw Error('Explicit voice-check gate required');
const directory=new URL('../../../artifacts/feedback/voice-natural-v1/',import.meta.url);mkdirSync(directory,{recursive:true});
const target=new URL('hosted-check.json',directory);if(existsSync(target))throw Error('Voice sample already exists; no automatic repetition');
writeFileSync(target,JSON.stringify({state:'pending',cost:null,billing:'AWS infrastructure unknown'}));
const env=parseEnv(readFileSync('/srv/hackathon/rally-deployed/config/api.env','utf8'));
const voice=new SeamlessSpeech(env.RALLY_TTS_TOKEN||'');
const text='Meta AI supports the meeting. MMS is another voice option. We can release only after verification. The check has not passed yet.';
let firstByteMs:number|null=null,cached:boolean|null=null;const start=performance.now(),parts:Buffer[]=[];
try {
 for await(const part of voice.stream({input:text},AbortSignal.timeout(30000),'pcm',value=>cached=value)){firstByteMs??=Math.round(performance.now()-start);parts.push(part);}
 const pcm=Buffer.concat(parts);writeFileSync(new URL('hosted-after.wav',directory),wav(pcm,16000));
 const evidence={at:new Date().toISOString(),state:'completed',text,model:voice.identity.model,adapter:voice.identity.adapter,revision:null,firstByteMs,totalMs:Math.round(performance.now()-start),seconds:pcm.length/32000,cached,cost:null,billing:'AWS infrastructure unknown',providerRequests:1,apiRetries:0,museCalls:0,platformJoins:0,playback:false,scope:'Real hosted speech with pronunciation expansion; acoustic naturalness requires listener review; provider controls sentence prosody.'};writeFileSync(target,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}catch(error){writeFileSync(target,JSON.stringify({at:new Date().toISOString(),state:'failed',firstByteMs,cached,cost:null,billing:'AWS infrastructure unknown'}));throw error;}
