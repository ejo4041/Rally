// Bounded real HTTP/MFA/SQLite/LiveKit recovery check; injected providers and synthetic microphone only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const {TOTP,Secret}=createRequire(new URL('../../rally-api/package.json',import.meta.url))('otpauth');
const root=fileURLToPath(new URL('../',import.meta.url));
const webPort=19374,apiPort=19375,mediaPort=19376,base=`http://127.0.0.1:${webPort}`;
const children=[];let browser;
function run(command,args,env={}) {
 const child=spawn(command,args,{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 let tail='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>tail=(tail+b).slice(-2000));
 child.on('error',error=>tail=error.message);child.diagnostics=()=>tail;children.push(child);return child;
}
async function ready(url,child) {
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw Error(child.diagnostics());try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw Error('Fixture startup timed out: '+child.diagnostics());
}
try {
 const media=run(process.env.RALLY_TEST_LIVEKIT_BINARY||resolve(root,'../rally-api/.data/bin/livekit-server'),['--dev','--bind','127.0.0.1','--node-ip','127.0.0.1','--config-body',`port: ${mediaPort}\nrtc:\n  tcp_port: 19377\n  port_range_start: 19378\n  port_range_end: 19388\n`]);
 await ready(`http://127.0.0.1:${mediaPort}`,media);
 const api=run(process.execPath,['tests/fixture.ts'],{RALLY_WEB_PORT:String(webPort),RALLY_TEST_API_PORT:String(apiPort),RALLY_TEST_MEDIA_PORT:String(mediaPort)});
 await ready(`http://127.0.0.1:${apiPort}/api/health`,api);
 const web=run(process.execPath,['scripts/dev.mjs'],{RALLY_WEB_PORT:String(webPort),RALLY_API_URL:`http://127.0.0.1:${apiPort}`});await ready(base,web);
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
 page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.recoveryStreams=[];
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
   const context=new AudioContext(),osc=context.createOscillator(),gain=context.createGain(),dest=context.createMediaStreamDestination();osc.frequency.value=440;gain.gain.value=.2;osc.connect(gain).connect(dest);osc.start();await context.resume();window.recoveryStreams.push(dest.stream);return dest.stream;
  }});
 });
 await page.goto(base);
 await page.locator('#username').fill('frontend_test');await page.locator('#password').fill('fixture-password-only');await page.locator('#auth-submit').click();
 await page.locator('#enrollment-secret').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#enrollment-secret').textContent.length>0);
 const secret=await page.locator('#enrollment-secret').textContent();
 await page.locator('#mfa-code').fill(new TOTP({secret:Secret.fromBase32(secret),algorithm:'SHA1',digits:6,period:30}).generate());await page.locator('#mfa-submit').click();
 await page.locator('#recovery-continue').click();await page.locator('#workspace').waitFor({state:'visible'});
 const request=(path,data)=>data===undefined?page.request.get(base+'/api'+path):page.request.post(base+'/api'+path,{data});
 const m=await(await request('/meetings',{title:'Recovery acceptance',agenda:'Check explicit capture recovery',durationMinutes:10})).json();
 await page.goto(base+'/#meeting/'+m.id);await page.waitForFunction(()=>document.querySelector('#phase').textContent==='Ready');
 await page.locator('#audio-mode').selectOption('microphone');await page.locator('#consent').check();await page.locator('#start').click();
 await page.waitForFunction(()=>document.querySelector('#capture-label').textContent.includes('Listening'));
 await page.waitForFunction(()=>document.querySelectorAll('.turn').length===1);
 const first=await(await request('/test/state')).json();assert.ok(first.totalBytes>=16000);assert.ok(first.energy>1000000);
 console.log('Recovery browser: capture received');
 await page.reload();await page.waitForFunction(()=>document.querySelector('#phase').textContent==='Live');
 await page.locator('#audio-mode').selectOption('microphone');await page.locator('#consent').check();await page.locator('#start').click();
 await page.waitForFunction(()=>document.querySelector('#capture-label').textContent.includes('Listening'));
 assert.equal((await(await request('/test/state')).json()).speechSessions,first.speechSessions);
 console.log('Recovery browser: reload reattached without new ASR');
 await page.route(`**/api/meetings/${m.id}/heartbeat`,route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Fixture lease refused; reconnect explicitly.'})}));
 // Exercise the immediate renewal on reattachment instead of waiting for the periodic timer.
 await page.reload();await page.waitForFunction(()=>document.querySelector('#phase').textContent==='Live');
 await page.locator('#audio-mode').selectOption('microphone');await page.locator('#consent').check();await page.locator('#start').click();
 await page.waitForFunction(()=>document.querySelector('#connection-status').textContent.includes('Audio disconnected'));
 assert.equal(await page.evaluate(()=>recoveryStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true);
 assert.equal((await(await request('/meetings/'+m.id)).json()).reportStatus,'none');
 assert.equal((await(await request('/test/state')).json()).speechSessions,first.speechSessions);
 await page.unroute(`**/api/meetings/${m.id}/heartbeat`);
 await page.locator('#restart-session').check();await page.locator('#consent').check();await page.locator('#start').click();
 await page.waitForFunction(()=>document.querySelector('#capture-label').textContent.includes('Listening'));
 await page.waitForFunction(()=>document.querySelectorAll('.turn').length===3);
 assert.equal((await(await request('/test/state')).json()).speechSessions,first.speechSessions+1);
 console.log('Recovery browser: refusal stopped tracks; explicit restart recovered');
 await page.locator('#end').click();await page.waitForFunction(()=>document.querySelector('#report-status').textContent==='Failed');
 assert.equal(await page.evaluate(()=>recoveryStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true);
 await page.locator('#retry-report').click();await page.waitForFunction(()=>document.querySelector('#report-status').textContent==='Ready');
 const saved=await(await request('/meetings/'+m.id)).json();assert.equal(saved.turns.length,4);assert.equal((await(await request('/test/state')).json()).reportedTurns,4);
 assert.deepEqual(errors,[]);
 await mkdir(resolve(root,'test-results'),{recursive:true});await page.screenshot({path:resolve(root,'test-results/recovery-browser.png'),fullPage:false});
 const result={at:new Date().toISOString(),passed:true,scope:'Real local HTTP/MFA/SQLite/LiveKit with synthetic browser microphone and injected providers; no Teams/human or paid provider calls.',paidModelCalls:0,platformJoins:0,checks:{actualAudioReceived:true,reloadDoesNotDuplicateASR:true,leaseRefusalStopsTracks:true,noAutomaticReportOrASRRestart:true,explicitRestartRecovers:true,endStopsTracks:true,finalDrainTurns:4,reportFailureVisible:true,explicitReportRetry:true},browserErrors:errors};
 await writeFile(resolve(root,'test-results/recovery-browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
} finally {
 await browser?.close();
 for(const child of children.reverse())if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,2000))]);if(child.exitCode===null)child.kill('SIGKILL');}
}
