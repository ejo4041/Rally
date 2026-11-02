// One bounded, non-retrying ASR measurement using the production Muse adapter.
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';
import {Store} from '../src/store.ts';
import {createMuse,modelSettings} from '../src/muse.ts';
import {defaults} from '../src/config.ts';
import type {Meeting,ASRSession,TranscriptEvent} from '../src/contracts.ts';
if(process.env.RALLY_TTS_ASR_APPROVED!=='1')throw Error('Explicit ASR measurement gate required');
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Expected input audio and new output directory');
const dir=resolve(output);if(existsSync(dir))throw Error('Result retained; no overwrite or automatic repeat');
const pcm=execFileSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-i',resolve(input),'-ac','1','-ar','16000','-f','s16le','-'],{maxBuffer:4000000});
if(!pcm.length||pcm.length>1920000)throw Error('Use at most 60 seconds of audio');
mkdirSync(dir,{recursive:true,mode:0o700});
const store=new Store(resolve(dir,'usage.sqlite'));
const env=parseEnv(readFileSync('/srv/hackathon/rally-deployed/config/api.env','utf8'));
const providers=createMuse(store,{...defaults,paidEnabled:true,buildBudget:.02,meetingBudget:.02},{key:env.MODEL_API_KEY,settings:modelSettings(env.RALLY_MODEL_CONFIG||'{}')});
// ASR accounting needs only these identifiers; no application record or account is created.
const meeting={id:'tts-reference',userId:'offline-measurement'} as Meeting;
const events:TranscriptEvent[]=[];let failure:string|undefined,session:ASRSession|undefined;
const result:Record<string,unknown>={startedAt:new Date().toISOString(),state:'running',inputSeconds:pcm.length/32000,provider:'muse-voice-transcribe-1.0',automaticRetries:0};
const save=()=>writeFileSync(resolve(dir,'result.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});save();
try {
 session=await providers.openASR(meeting,{onEvent:event=>events.push(event),onError:()=>{failure='ASR transport or provider failure';},onClose:()=>{}});
 const start=performance.now();
 for(let offset=0;offset<pcm.length;offset+=640){
  if(failure)throw Error(failure);
  await new Promise(r=>setTimeout(r,Math.max(0,start+offset/32-performance.now())));
  session.send(pcm.subarray(offset,offset+640));
 }
 await session.end();if(failure)throw Error(failure);
 const turns=new Map<string,Extract<TranscriptEvent,{type:'final'}>>();
 for(const event of events)if(event.type==='final')turns.set(`${event.sessionId}:${event.turnId}`,event);
 result.state='completed';result.turns=[...turns.values()];result.hypothesis=[...turns.values()].map(event=>event.text).join(' ');
} catch(error){result.state='failed';result.error=error instanceof Error?error.message:'Unknown ASR failure';process.exitCode=1;}
finally {
 if(session)session.close();await new Promise(r=>setTimeout(r,100));
 const rows=store.db.prepare('SELECT status,cost,body FROM usage').all() as {status:string;cost:number|null;body:string}[];
 result.usage={calls:rows.length,knownCost:rows.reduce((sum,row)=>sum+(row.cost??0),0),unknown:rows.filter(row=>row.status==='unknown').length,running:rows.filter(row=>row.status==='running').length,rows:rows.map(row=>JSON.parse(row.body))};
 result.endedAt=new Date().toISOString();save();store.close();console.log(JSON.stringify({state:result.state,inputSeconds:result.inputSeconds,usage:result.usage}));
}
