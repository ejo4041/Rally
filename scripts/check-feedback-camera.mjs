// Own the shared runner lock before opening its camera. Never disrupt another call.
import {spawn} from 'node:child_process';import {once} from 'node:events';import {acquireTeamsLock} from '../experiments/teams-common/lock.mjs';
const root=new URL('../',import.meta.url).pathname;let release,web,probe;
try{try{release=await acquireTeamsLock();}catch{console.log(JSON.stringify({skipped:true,reason:'Teams runner/device ownership is busy'}));process.exitCode=0;}
 if(release){web=spawn(process.execPath,['scripts/dev.mjs'],{cwd:root+'apps/rally-web',env:{...process.env,RALLY_WEB_PORT:'5197',RALLY_API_URL:'http://127.0.0.1:9'},stdio:'ignore'});for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:5197/renderer.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 probe=spawn(process.execPath,['video-check.mjs'],{cwd:root+'experiments/teams-presence',env:process.env,stdio:'inherit'});const [code]=await once(probe,'exit');if(code)process.exitCode=code;}
}finally{web?.kill('SIGTERM');release?.();}
