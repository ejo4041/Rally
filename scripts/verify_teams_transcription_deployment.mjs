// Read-only protected checks. Never joins a meeting or starts a model session.
import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const env=parseEnv(await readFile(new URL('.env.local',root),'utf8'));
const base='https://rally-meeting-moderator.excavator3496.chatgpt.site';
async function get(path){
 const response=await fetch(base+path,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'OAI-Sites-Authorization':`Bearer ${env.RALLY_SITES_SERVICE_TOKEN}`,Origin:base}});
 if(!response.ok)throw new Error(`Protected ${path} returned HTTP ${response.status}`);
 return response.json();
}
const [status,costs,usage,config]=await Promise.all(['/api/teams/status','/api/costs','/api/usage','/api/config'].map(get));
const active=!!status.job&&['queued','joining','lobby','connected','leaving'].includes(status.job.state);
const result={checkedAt:new Date().toISOString(),phase:process.argv[2]||'preflight',url:base,
 online:status.online,transport:status.transport||'acs',transcriptionReady:!!status.transcriptionReady,
 credentialsConfigured:status.credentialsConfigured,activeJob:active,jobState:status.job?.state||null,
 transcriptSchemaPresent:!!status.job&&Object.hasOwn(status.job,'transcript'),
 baseline:Number(costs.baseline),hostedSpend:Number(costs.total),unknown:Number(costs.unknown||0),
 liveAvailable:config.liveAvailable,usageCount:usage.events.length,usageIds:usage.events.map(e=>e.id),paidCallsByCheck:0};
if(active)throw new Error('An active Teams test exists; leave the current configuration in place.');
if(process.argv[2]==='ready'){
 if(!status.online||status.transport!=='teams-web'||!status.transcriptionReady)throw new Error('Normal Teams transcription runner is not ready.');
 if(!config.liveAvailable)throw new Error('Hosted Muse configuration is not enabled.');
}
const path=new URL(`docs/research/teams-transcription-${result.phase}-check.json`,root);
await writeFile(path,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,usageIds:undefined,evidence:fileURLToPath(path)}));
