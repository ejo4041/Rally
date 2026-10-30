const { chromium } = await import(process.env.RALLY_PLAYWRIGHT_MODULE || '../teams-audio/node_modules/playwright/index.mjs');
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, chmod, stat, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url));
const state=process.env.RALLY_TEAMS_STATE || path.join(dir,'state');
const debugPort=Number(process.env.RALLY_TEAMS_DEBUG_PORT || 9226);
const startupDeadline=Date.now()+90000;
await mkdir(state,{recursive:true,mode:0o700}); await chmod(state,0o700);
await rm(path.join(state,'join-deadline.json'),{force:true});
const pulseDir=process.env.RALLY_TEAMS_STATE ? path.join(state,"pulse") : `${process.env.XDG_RUNTIME_DIR}/rally-teams-pulse`;
await mkdir(pulseDir,{recursive:true,mode:0o700});
const pulseFile=path.join(state,'pulse.pa');
await writeFile(pulseFile,`load-module module-native-protocol-unix socket=${pulseDir}/native auth-anonymous=0\nload-module module-null-sink sink_name=rally_teams_in rate=48000 channels=1 channel_map=mono sink_properties=device.description=Rally_Teams_Speaker\nload-module module-null-sink sink_name=rally_teams_out rate=48000 channels=1 channel_map=mono sink_properties=device.description=Rally_Speech_Playback\nload-module module-remap-source master=rally_teams_out.monitor source_name=rally_teams_mic channels=1 master_channel_map=mono channel_map=mono source_properties=device.description=Rally_Virtual_Microphone\nset-default-sink rally_teams_in\nset-default-source rally_teams_mic\n`,{mode:0o600});
const pulse=spawn('pulseaudio',['-n',`--file=${pulseFile}`,'--daemonize=no','--exit-idle-time=-1','--use-pid-file=no'],{stdio:['ignore','ignore','pipe']});
pulse.stderr.on('data',()=>{});
const env={...process.env,PULSE_SERVER:`unix:${pulseDir}/native`,PULSE_SINK:'rally_teams_in',PULSE_SOURCE:'rally_teams_mic'};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<50;i++){try{execFileSync('pactl',['info'],{env,stdio:'ignore'});break;}catch{if(i===49)throw new Error('Private PulseAudio failed to start');await wait(100);}}
const xvfb=spawn('Xvfb',['-displayfd','3','-screen','0','1440x900x24','-nolisten','tcp'],{stdio:['ignore','ignore','pipe','pipe']});
xvfb.stderr.on('data',()=>{});
const display=await new Promise((resolve,reject)=>{let data='';const timer=setTimeout(()=>reject(new Error('Xvfb startup timeout')),10000);xvfb.stdio[3].on('data',b=>{data+=b;if(data.includes('\n')){clearTimeout(timer);resolve(':'+data.trim());}});xvfb.on('error',reject);});
Object.assign(env,{DISPLAY:display});
await writeFile(path.join(state,'audio-env.json'),JSON.stringify({PULSE_SERVER:env.PULSE_SERVER,PULSE_SINK:env.PULSE_SINK,PULSE_SOURCE:env.PULSE_SOURCE,DISPLAY:display}),{mode:0o600});
let context,shuttingDown=false;
async function shutdown(code=0){if(shuttingDown)return;shuttingDown=true;clearInterval(guard);try{await context?.close();}finally{xvfb.kill('SIGTERM');pulse.kill('SIGTERM');await writeFile(path.join(state,'status.json'),JSON.stringify({running:false,stoppedAt:new Date().toISOString()}));process.exit(code);}}
process.on('SIGTERM',()=>void shutdown());process.on('SIGINT',()=>void shutdown());
const guard=setInterval(async()=>{try{const d=JSON.parse(await readFile(path.join(state,'join-deadline.json'),'utf8'));if(Date.now()>d.deadline){console.log('Three-minute meeting test deadline reached; leaving and closing client.');for(const p of context?.pages()||[]){await p.getByRole('button',{name:/^(Leave|Hang up)(\b|$)/i}).first().click({timeout:2000}).catch(()=>{});}await shutdown();}}catch{if(process.env.RALLY_TEAMS_STATE && Date.now()>startupDeadline)await shutdown(1);}},1000);
try{
 context=await chromium.launchPersistentContext(path.join(state,'profile'),{headless:false,executablePath:'/home/hack/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',env,viewport:{width:1440,height:900},permissions:['microphone','camera'],args:['--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${debugPort}`,'--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--disable-dev-shm-usage']});
 await chmod(path.join(state,'profile'),0o700);
 await context.addInitScript(()=>{window.__rallyPeers=[];const Original=window.RTCPeerConnection;window.RTCPeerConnection=class extends Original{constructor(...a){super(...a);window.__rallyPeers.push(this);}};});
 const page=context.pages()[0]||await context.newPage();
 let url='https://teams.microsoft.com/';
 try{url=(await readFile(path.join(state,'meeting.url'),'utf8')).trim();}catch{}
 const parsed=new URL(url);if(parsed.protocol!=='https:'||!['teams.microsoft.com','teams.cloud.microsoft'].includes(parsed.hostname))throw new Error('Use an official work/school Teams meeting URL');
 await writeFile(path.join(state,'status.json'),JSON.stringify({running:true,browser:'headed Chromium',debugPort,meetingJoined:false,startedAt:new Date().toISOString()}),{mode:0o600});
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 console.log('Normal Teams client opened; no join has been requested. No ACS, app-registration, or Muse credentials used.');
 await new Promise(resolve=>context.on('close',resolve));
 await shutdown();
}catch(e){console.error(String(e.message).replace(/https?:\/\/\S+/g,'[URL omitted]'));await shutdown(1);}
