import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../apps/rally-web/package.json',import.meta.url));
export function callLink(value){
 let url;try{url=new URL(value.trim());}catch{throw Error('Paste an HTTPS WhatsApp call link.');}
 if(url.protocol!=='https:'||url.hostname!=='call.whatsapp.com'||url.port||url.username||url.password||!/^\/(voice|video)\/[A-Za-z0-9_-]{10,100}\/?$/.test(url.pathname)||url.search||url.hash)throw Error('Expected https://call.whatsapp.com/voice/... or /video/...');
 return url.href;
}
export async function createGuest({seconds=180}={}){
 if(!Number.isInteger(seconds)||seconds<1||seconds>180)throw Error('Test duration must be 1–180 seconds.');
 const {chromium}=require('playwright'),dir=await mkdtemp(join(tmpdir(),'rally-whatsapp-'));let browser,xvfb,pulse,closed=false,timer,closePromise;
 const env={...process.env};
 const close=()=>closePromise||=(async()=>{closed=true;clearTimeout(timer);await browser?.close().catch(()=>{});for(const p of [xvfb,pulse])if(p&&p.exitCode===null)p.kill('SIGTERM');await new Promise(r=>setTimeout(r,200));await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});process.removeListener('SIGTERM',signal);process.removeListener('SIGINT',signal);})();
 const signal=()=>void close();process.once('SIGTERM',signal);process.once('SIGINT',signal);
 try{
  const socket=join(dir,'pulse'),config=join(dir,'pulse.pa');
  await writeFile(config,`load-module module-native-protocol-unix socket=${socket} auth-anonymous=0\nload-module module-null-sink sink_name=rally_whatsapp_in rate=48000 channels=1 channel_map=mono\nload-module module-null-sink sink_name=rally_whatsapp_out rate=48000 channels=1 channel_map=mono\nload-module module-remap-source master=rally_whatsapp_out.monitor source_name=rally_whatsapp_mic channels=1 master_channel_map=mono channel_map=mono source_properties=device.description=Rally_WhatsApp_Microphone\nset-default-sink rally_whatsapp_in\nset-default-source rally_whatsapp_mic\n`,{mode:0o600});
  pulse=spawn('pulseaudio',['-n','--file='+config,'--daemonize=no','--exit-idle-time=-1','--use-pid-file=no'],{stdio:'ignore'});pulse.on('error',()=>{});
  Object.assign(env,{PULSE_SERVER:'unix:'+socket,PULSE_SINK:'rally_whatsapp_in',PULSE_SOURCE:'rally_whatsapp_mic'});
  for(let i=0;;i++){try{execFileSync('pactl',['info'],{env,stdio:'ignore'});break;}catch{if(i>=40||closed)throw Error('Private audio startup failed.');await new Promise(r=>setTimeout(r,100));}}
  xvfb=spawn('Xvfb',['-displayfd','3','-screen','0','1440x900x24','-nolisten','tcp'],{stdio:['ignore','ignore','ignore','pipe']});
  env.DISPLAY=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Display startup timed out')),5000);xvfb.once('error',reject);xvfb.stdio[3].once('data',b=>{clearTimeout(timeout);resolve(':'+b.toString().trim());});});
  if(closed)throw Error('Test canceled.');
  browser=await chromium.launch({headless:false,executablePath:process.env.PLAYWRIGHT_CHROMIUM||chromium.executablePath(),env,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream']});
  const context=await browser.newContext({permissions:['microphone'],viewport:{width:1440,height:900}});
  // New ephemeral context, no personal accounts, camera grant, CDP listener or model keys.
  const page=await context.newPage();page.setDefaultTimeout(5000);
  timer=setTimeout(()=>void close(),seconds*1000);timer.unref();
  return{page,context,env,dir,browser,close,closed:()=>closed};
 }catch(error){await close();throw error;}
 finally{if(closed){process.removeListener('SIGTERM',signal);process.removeListener('SIGINT',signal);}}
}
