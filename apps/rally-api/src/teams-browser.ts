import { PlayoutClock } from './playout-clock.ts';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import type {TeamsConnector} from './teams-live.ts';

// Transport only: all model calls and accounting remain in the meeting engine.
export const connectTeamsBrowser:TeamsConnector=async(url,signal,onState)=>{
 const {chromium}=await import('playwright');
 const state=await mkdtemp(join(tmpdir(),'rally-teams-'));
 let child:ChildProcess|undefined,browser:Awaited<ReturnType<typeof chromium.connectOverCDP>>|undefined;
 let receiver:ChildProcess|undefined,player:ChildProcess|undefined;
 let renew:ReturnType<typeof setInterval>|undefined,inspect:ReturnType<typeof setInterval>|undefined;
 let closed=false,connected=false,checking=false;
 const audioEnv:NodeJS.ProcessEnv={...process.env};
 const kill=async(proc:ChildProcess|undefined)=>{
  if(!proc || !proc.pid || proc.exitCode!==null || proc.signalCode!==null)return;
  proc.kill('SIGTERM');
  const timer=setTimeout(()=>proc.kill('SIGKILL'),2000);
  await once(proc,'exit').catch(()=>{});clearTimeout(timer);
 };
 let closePromise:Promise<void>|undefined;
 const close=():Promise<void>=>{
  if(closePromise)return closePromise;
  closePromise=(async()=>{closed=true;connected=false;clearInterval(renew);clearInterval(inspect);
  signal.removeEventListener('abort',abort);
  await Promise.allSettled([kill(receiver),kill(player)]);
  await browser?.close().catch(()=>{});
  if(child?.pid){try{process.kill(-child.pid,'SIGTERM');}catch{}}
  await kill(child);await rm(state,{recursive:true,force:true});
  })();return closePromise;
 };
 const abort=()=>{void close();};signal.addEventListener('abort',abort,{once:true});
 try{
  signal.throwIfAborted();
  await writeFile(join(state,'meeting.url'),url,{mode:0o600});
  signal.throwIfAborted();if(closed)throw new Error('Teams closed');
  child=spawn(process.execPath,[fileURLToPath(new URL('../../../experiments/teams-web-client/session.mjs',import.meta.url))],{env:{...process.env,RALLY_TEAMS_STATE:state,RALLY_TEAMS_DEBUG_PORT:'9227',RALLY_PLAYWRIGHT_MODULE:new URL('../node_modules/playwright/index.mjs',import.meta.url).href},stdio:'ignore',detached:true});
  child.on('error',()=>{connected=false;});child.on('exit',()=>{connected=false;});
  const deadline=Date.now()+60000;
  while(!browser && Date.now()<deadline){
   signal.throwIfAborted();if(closed)throw new Error('Teams closed');
   try{browser=await chromium.connectOverCDP('http://127.0.0.1:9227',{timeout:1000});}catch{await delay(250,undefined,{signal});}
  }
  if(!browser)throw new Error('Teams browser startup timed out');
  if(closed){await browser.close();throw new Error('Teams canceled');}
  Object.assign(audioEnv,JSON.parse(await readFile(join(state,'audio-env.json'),'utf8')));
  const heartbeat=()=>writeFile(join(state,'join-deadline.json'),JSON.stringify({deadline:Date.now()+90000}),{mode:0o600});
  await heartbeat();renew=setInterval(()=>{void heartbeat().catch(()=>{connected=false;void close();});},20000);renew.unref();
  const page=browser.contexts()[0].pages()[0];
  await page.getByPlaceholder('Type your name',{exact:true}).waitFor({timeout:45000});
  signal.throwIfAborted();
  const warning=page.getByRole('button',{name:'Continue without audio or video',exact:true});if(await warning.isVisible().catch(()=>false))await warning.click();
  await page.getByPlaceholder('Type your name',{exact:true}).fill('Rally');
  await page.locator('[data-tid="toggle-video"]').uncheck({timeout:3000}).catch(()=>{});
  await page.getByRole('radio',{name:'Computer audio',exact:true}).check();
  const mic=page.locator('[data-tid="toggle-mute"]');if(!(await mic.isChecked()))await mic.check();
  signal.throwIfAborted();await page.getByRole('button',{name:/^Join (now|meeting)$/i}).first().click({timeout:10000});onState('lobby');
  const isConnected=()=>page.evaluate(()=>((window as any).__rallyPeers||[]).some((p:any)=>p.connectionState==='connected')&&[...document.querySelectorAll('button')].some(b=>/^(Leave|Hang up)(\b|$)/i.test(b.getAttribute('aria-label')||b.textContent||'')));
  const admissionDeadline=Date.now()+300000;
  while(!connected && Date.now()<admissionDeadline){signal.throwIfAborted();if(closed)throw new Error('Teams closed');connected=await isConnected();if(!connected)await delay(500,undefined,{signal});}
  if(!connected)throw new Error('Teams admission timed out');
  inspect=setInterval(()=>{
   if(checking||closed)return;checking=true;
   const timer=setTimeout(()=>{connected=false;},5000);
   void isConnected().then(value=>{connected=value;}).catch(()=>{connected=false;}).finally(()=>{clearTimeout(timer);checking=false;});
  },2000);inspect.unref();
  return {
   alive:()=>!closed&&connected,
   receive(audio,gap){
    receiver=spawn('parec',['--device=rally_teams_in.monitor','--raw','--format=s16le','--rate=16000','--channels=1','--latency-msec=20'],{env:audioEnv,stdio:['ignore','pipe','ignore']});
    let pending=Buffer.alloc(0),last=performance.now();
    receiver.stdout!.on('data',(bytes:Buffer)=>{
     const now=performance.now();if(now-last>1000){pending=Buffer.alloc(0);connected=false;gap('Teams audio stalled');return;}last=now;
     pending=Buffer.concat([pending,bytes]);
     if(pending.length>32000){pending=Buffer.alloc(0);connected=false;gap('Teams audio backlog discarded');return;}
     while(pending.length>=640){audio(pending.subarray(0,640));pending=pending.subarray(640);}
    });
    receiver.on('error',()=>{connected=false;gap('Teams audio capture failed');});
    receiver.on('exit',()=>{if(!closed){connected=false;gap('Teams audio capture stopped');}});
    return ()=>{void kill(receiver);};
   },
   async play(chunks,playSignal,beforeAudio,onProgress){
    if(closed||!connected)throw new Error('Teams disconnected');
    const clock=new PlayoutClock();
    let measured=0,lastProgress=0,written=0;
    const monitor=onProgress?spawn('parec',['--device=rally_teams_out.monitor','--raw','--format=s16le','--rate=16000','--channels=1','--latency-msec=20'],{env:audioEnv,stdio:['ignore','pipe','ignore']}):undefined;
    monitor?.on('error',()=>{});
    monitor?.stdout!.on('data',(data:Buffer)=>{const value=clock.observe(data);if(value===undefined||playSignal.aborted)return;measured=Math.min(value,written/32);if(performance.now()-lastProgress>=200){lastProgress=performance.now();onProgress?.(measured);}});
    const proc=spawn('paplay',['--device=rally_teams_out','--raw','--format=s16le','--rate=16000','--channels=1','--latency-msec=20'],{env:audioEnv,stdio:['pipe','ignore','ignore']});player=proc;
    let failed:Error|undefined;proc.on('error',e=>failed=e);proc.stdin!.on('error',e=>failed=e);
    const completion=once(proc,'exit');void completion.catch(()=>{});
    const stop=()=>{proc.kill('SIGTERM');};playSignal.addEventListener('abort',stop,{once:true});
    try{
     let started=false;
     for await(const part of chunks){playSignal.throwIfAborted();if(!connected||closed||failed)throw failed||new Error('Teams disconnected');if(!started){beforeAudio();started=true;}written+=part.length;if(!proc.stdin!.write(part))await once(proc.stdin!,'drain',{signal:playSignal});}
     proc.stdin!.end();const [code]=await completion;if(measured>0)onProgress?.(measured);if(code!==0||failed)throw failed||new Error('Teams playback failed');
    }finally{playSignal.removeEventListener('abort',stop);await kill(proc);await kill(monitor);if(player===proc)player=undefined;}
   },close,
  };
 }catch(error){await close();throw error;}
};
