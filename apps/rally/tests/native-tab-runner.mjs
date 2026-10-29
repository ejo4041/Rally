// Optional Linux integration test. Uses its own display and window manager;
// never attaches to the Teams display, logs into a platform or calls a model.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const xvfb=spawn('Xvfb',['-displayfd','3','-screen','0','1440x900x24','-nolisten','tcp'],{stdio:['ignore','ignore','ignore','pipe']});
let manager,child,timer;
const cleanup=()=>{clearTimeout(timer);child?.kill('SIGTERM');manager?.kill('SIGTERM');xvfb.kill('SIGTERM');};
process.once('SIGINT',cleanup);process.once('SIGTERM',cleanup);
try{
 const display=await new Promise((resolve,reject)=>{let data='';const deadline=setTimeout(()=>reject(new Error('Test display startup timed out')),10000);const fail=error=>{clearTimeout(deadline);reject(error);};xvfb.once('error',fail);xvfb.once('exit',()=>fail(new Error('Test display exited')));xvfb.stdio[3].on('data',chunk=>{data+=chunk;if(data.includes('\n')){clearTimeout(deadline);resolve(':'+data.trim());}});});
 const env={...process.env,DISPLAY:display};manager=spawn(process.env.RALLY_TEST_WINDOW_MANAGER||'openbox',[],{env,stdio:'ignore'});await once(manager,'spawn');
 await new Promise(resolve=>setTimeout(resolve,500));if(manager.exitCode!==null)throw new Error('Test window manager exited; check its dependencies');
 child=spawn(process.execPath,[process.argv[2]||'tests/native-tab-browser.mjs'],{env,stdio:'inherit'});timer=setTimeout(()=>child.kill('SIGTERM'),process.env.RALLY_TEST_SOAK_MINUTES?Math.min(56*60000,(Number(process.env.RALLY_TEST_SOAK_MINUTES)+1)*60000):45000);const [code]=await once(child,'exit');process.exitCode=code??1;
}catch(error){console.error('Native capture check unavailable:',error.message);process.exitCode=1;}finally{cleanup();}
