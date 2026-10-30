import {createRequire} from 'node:module';
const {TOTP,Secret}=createRequire(new URL('../../rally-api/package.json',import.meta.url))('otpauth');
// Actual browser + Express + SQLite + LiveKit. Synthetic audio/providers only.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const children=[];let browser;
const base='http://127.0.0.1:5176';
function start(cmd,args,env={}){const child=spawn(cmd,args,{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});children.push(child);child.stderr.on('data',()=>{});child.stdout.on('data',()=>{});return child;}
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Fixture unavailable '+url);}
try{
 start('/srv/hackathon/rally-deployed/bin/livekit-server',['--dev','--bind','127.0.0.1','--port','18990','--node-ip','127.0.0.1']);await ready('http://127.0.0.1:18990');
 start(process.execPath,['tests/fixture.ts'],{RALLY_TEST_STREAMING:'1',RALLY_WEB_PORT:'5176',RALLY_TEST_API_PORT:'3106',RALLY_TEST_MEDIA_PORT:'18990'});await ready('http://127.0.0.1:3106/api/health');
 start(process.execPath,['scripts/dev.mjs'],{RALLY_WEB_PORT:'5176',RALLY_API_URL:'http://127.0.0.1:3106'});await ready(base);
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{const context=new AudioContext();const osc=context.createOscillator();const dest=context.createMediaStreamDestination();osc.connect(dest);osc.start();await context.resume();return dest.stream;}});});
 await page.goto(base);
 await page.locator('#username').fill('frontend_test');await page.locator('#password').fill('fixture-password-only');await page.locator('#auth-submit').click();
 await page.locator('#enrollment-secret').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#enrollment-secret').textContent.length>0);
 const secret=await page.locator('#enrollment-secret').textContent();
 await page.locator('#mfa-code').fill(new TOTP({secret:Secret.fromBase32(secret),digits:6,period:30,algorithm:'SHA1'}).generate());await page.locator('#mfa-submit').click();
 await page.locator('#recovery-continue').waitFor({state:'visible'});await page.locator('#recovery-continue').click();await page.locator('#workspace').waitFor({state:'visible'});
 const id=await page.evaluate(async()=>{
  const req=async(path,body)=>{const r=await fetch('/api'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error(path+': '+r.status);return r.json();};
  const m=await req('/meetings',{title:'Streaming test',agenda:'Agree owner',participants:['Alice'],durationMinutes:10});await req(`/meetings/${m.id}/prepare`,{});return m.id;
 });
 await page.goto(base+'/#meeting/'+id);await page.reload();
 await page.locator('#consent').check();await page.locator('#start').click();
 await page.waitForFunction(()=>document.querySelector('#phase').textContent==='Live');
 await page.waitForFunction(()=>document.querySelector('#transcript').textContent.includes('Priya'));
 await page.locator('#request-guidance').click();
 await page.waitForFunction(()=>document.querySelector('#speech-status').textContent.includes('playing'));
 await page.waitForFunction(()=>[...document.querySelectorAll('audio')].some(a=>a.srcObject&&!a.paused&&a.currentTime>0));
 const snapshot=await(await page.request.get(base+`/api/meetings/${id}`)).json();
 assert.equal(snapshot.speechStatus.state,'playing');assert.equal(snapshot.audioExclusions.length,1);
 assert.match(await page.locator('#guidance').textContent(),/^Let's get back on track\./);
 await page.locator('#stop-speaking').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('audio')].every(a=>a.paused||!a.srcObject));
 await page.waitForFunction(()=>document.querySelector('#speech-status').textContent.includes('canceled'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,actualLiveKitPlayback:true,stop:true,coverageRecorded:true,providers:'synthetic'}));
}finally{await browser?.close();for(const child of children.reverse()){child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,2000))]);if(child.exitCode===null)child.kill('SIGKILL');}}
