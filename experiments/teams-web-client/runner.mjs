import {chromium} from '../teams-audio/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {transcribe,pulseSource} from './transcribe.mjs';
const env={...parseEnv(await readFile('../../.env.local','utf8')),...process.env};
const runnerId=randomUUID();const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let current,closing=false,quitting=false;
async function api(action,data={}){
 const url=new URL('/api/teams/runner/'+action,env.RALLY_TEAMS_SITE_URL);
 if(url.protocol!=='https:'||!url.hostname.endsWith('.chatgpt.site'))throw new Error('Invalid Site origin');
 const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json','X-Rally-Bridge':env.RALLY_TEAMS_BRIDGE_SECRET,'OAI-Sites-Authorization':`Bearer ${env.RALLY_SITES_SERVICE_TOKEN}`},body:JSON.stringify({runnerId,...data})});
 if(!response.ok)throw new Error('Site operation HTTP '+response.status);
 return response.json();
}
function unit(action){execFileSync('systemctl',['--user',action,'rally-teams-web-client.service'],{stdio:'ignore'});}
async function finish(state='left',reason='stop_requested'){
 if(closing||!current)return;closing=true;const c=current;
 clearTimeout(c.timer);c.abort.abort();c.meter?.kill('SIGTERM');
 // Stop sending audio first, drain finalized text, then close the client.
 try{if(c.asrOpening){try{c.asr=await c.asrOpening;}catch(e){c.failedUsage=e.usage;}}if(c.asr)await c.asr.stop();await c.events;
 if(c.reserved){const s=c.asr?.stats()||c.failedUsage||{};await api('transcription-finish',{id:c.id,sentSeconds:s.sentSeconds||0,processedMs:s.processedMs||0,sessionAcknowledged:!!s.sessionId,notOpened:!c.asrOpening,failed:state==='failed'||!!s.failed});}
 }catch{console.error('Transcription accounting or final transcript needs reconciliation. No automatic retry.');}
 try{await c.page?.getByRole('button',{name:/^(Leave|Hang up)(\b|$)/i}).first().click({timeout:1500});}catch{}
 try{unit('stop');}catch{}
 await c.browser?.close().catch(()=>{});
 await api('update',{id:c.id,state}).catch(()=>{});
 const stats=c.asr?.stats()||c.failedUsage||{};console.log(JSON.stringify({event:'meeting-ended',jobId:c.id,state,reason,asr:{stopReason:stats.stopReason,socketCloseCode:stats.socketCloseCode,providerErrorCode:stats.providerErrorCode,maxPendingBytes:stats.maxPendingBytes,sentSeconds:stats.sentSeconds,processedMs:stats.processedMs,failed:stats.failed}}));
 current=null;closing=false;
}
async function launch(job){
 current={...job,preparing:true,level:0,abort:new AbortController(),events:Promise.resolve()};const c=current;
 console.log(JSON.stringify({event:'meeting-starting',jobId:c.id,deadlineUTC:new Date(c.deadline).toISOString()}));
 c.timer=setTimeout(()=>void finish('left','test_deadline'),Math.max(1,job.deadline-Date.now()));
 await writeFile('state/meeting.url',job.meetingUrl,{mode:0o600});
 // The daemon has a separate hard deadline and closes even if this runner dies.
 unit('start');
 for(let i=0;i<60;i++){if(current!==c||closing)return;try{c.browser=await chromium.connectOverCDP('http://127.0.0.1:9226');break;}catch{await sleep(500);}}
 if(!c.browser)throw new Error('Browser startup timeout');
 if(current!==c||closing){await c.browser.close().catch(()=>{});return;}
 c.page=c.browser.contexts()[0].pages()[0];
 await c.page.getByPlaceholder('Type your name',{exact:true}).waitFor({timeout:45000});
 if(current!==c||closing) return;
 const warning=c.page.getByRole('button',{name:'Continue without audio or video',exact:true});if(await warning.isVisible().catch(()=>false))await warning.click();
 await c.page.getByPlaceholder('Type your name',{exact:true}).fill('Rally audio test');
 await c.page.locator('[data-tid="toggle-video"]').uncheck({timeout:3000}).catch(()=>{});
 await c.page.getByRole('radio',{name:'Computer audio',exact:true}).check();
 const mic=c.page.locator('[data-tid="toggle-mute"]');if(!(await mic.isChecked()))await mic.check();
 if(current!==c||closing)return;
 await writeFile('state/join-deadline.json',JSON.stringify({deadline:c.deadline}),{mode:0o600});
 await c.page.getByRole('button',{name:/^Join (now|meeting)$/i}).first().click({timeout:10000});
 c.preparing=false;
}
async function inspect(){
 const c=current;if(!c||closing||!c.page)return;
 const connected=await c.page.evaluate(()=>(window.__rallyPeers||[]).some(p=>p.connectionState==='connected')&&[...document.querySelectorAll('button')].some(b=>/^(Leave|Hang up)(\b|$)/i.test(b.getAttribute('aria-label')||b.textContent)));
 const state=connected?'connected':'lobby';
 await api('update',{id:c.id,state,inputLevel:c.level});
 if(connected&&!c.transcribe&&!c.meter){const audioEnv={...process.env,...JSON.parse(await readFile('state/audio-env.json','utf8'))};c.meter=pulseSource(audioEnv);c.meter.stdout.on('data',b=>{let sum=0;for(let i=0;i+1<b.length;i+=2)sum+=(b.readInt16LE(i)/32768)**2;c.level=Math.min(1,Math.sqrt(sum/Math.max(1,b.length/2))*4);});c.meter.on('error',()=>void finish('failed'));}
 if(connected&&c.transcribe&&!c.asr&&!c.reserved){
   const reservation=await api('transcription-start',{id:c.id});c.reserved=true;
   if(current!==c||closing){await api('transcription-finish',{id:c.id,sentSeconds:0,processedMs:0,notOpened:true});return;}
   const audioEnv={...process.env,...JSON.parse(await readFile('state/audio-env.json','utf8'))};
   try{c.asrOpening=transcribe({key:env.MODEL_API_KEY,config:reservation.transcription,signal:c.abort.signal,seconds:Math.max(1,reservation.maxSeconds),source:()=>pulseSource(audioEnv),onLevel:n=>c.level=n,onEvent:e=>{
     if(e.type!=='partial'&&e.type!=='final')return;
     const data=e.type==='final'?{final:{sessionId:e.sessionId,turnId:Number(e.turnId),text:e.text||'',speaker:e.speaker||null},partial:''}:{partial:e.text||''};
     // Serialize final turns; partial updates are intentionally limited to 1/s.
     if(!data.final&&Date.now()-(c.lastPartial||0)<1000)return;c.lastPartial=Date.now();
     c.events=c.events.then(()=>api('transcription',{id:c.id,...data})).catch(()=>{void finish('failed','transcript_write_failed');});
   }});c.asr=await c.asrOpening;if(current!==c||closing){await c.asr.stop();return;}c.asr.done.then(()=>{if(!closing&&current===c)void finish(c.asr.stats().failed?'failed':'left','asr_session_ended');});}
   catch(e){c.failedUsage=e.usage;throw e;}
 }
}
async function tick(){
 const result=await api('poll',{transport:'teams-web',credentialsConfigured:true,transcriptionReady:!!env.MODEL_API_KEY});
 if(current){if(!result.job||result.job.id!==current.id||result.job.leaveRequested||!['joining','lobby','connected'].includes(result.job.state))return finish('left',result.job?.leaveRequested?'host_leave':'job_no_longer_active');if(current.preparing)return api('update',{id:current.id,state:'joining'});return inspect();}
 if(result.job?.claimed){const job=result.job;void launch(job).catch(()=>{if(current?.id===job.id)void finish('failed','browser_start_failed');});}
}
process.on('SIGTERM',()=>{quitting=true;void finish().finally(()=>process.exit());});
process.on('SIGINT',()=>{quitting=true;void finish().finally(()=>process.exit());});
// A crash/restart never resumes or rejoins a prior meeting.
try{unit('stop');}catch{}
console.log('Normal Teams queue runner ready; transcription requires host opt-in.');
while(!quitting){try{await tick();}catch{if(current)await finish('failed','queue_operation_failed');console.error('Queue operation unavailable; active client closed.');}await sleep(2500);}
