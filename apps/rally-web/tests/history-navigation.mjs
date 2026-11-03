// Real UI/history routing with isolated HTTP/MFA/database fixtures; zero model calls.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const {TOTP,Secret}=createRequire(new URL('../../rally-api/package.json',import.meta.url))('otpauth');
const root=fileURLToPath(new URL('../',import.meta.url));
const port=19474,apiPort=19475,base=`http://127.0.0.1:${port}`,children=[];
let browser,page;
const errors=[];
function run(args,env){const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});let tail='';for(const s of [child.stdout,child.stderr])s.on('data',b=>tail=(tail+b).slice(-1500));child.on('error',()=>{});child.diagnostics=()=>tail;children.push(child);return child;}
async function ready(url,child){for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error(child.diagnostics());try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error(child.diagnostics());}
try{
 const api=run(['tests/fixture.ts'],{RALLY_WEB_PORT:String(port),RALLY_TEST_API_PORT:String(apiPort),RALLY_TEST_REPORT_SUCCESS:'1'});await ready(`http://127.0.0.1:${apiPort}/api/health`,api);
 const web=run(['scripts/dev.mjs'],{RALLY_WEB_PORT:String(port),RALLY_API_URL:`http://127.0.0.1:${apiPort}`});await ready(base,web);
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#username').fill('frontend_test');await page.locator('#password').fill('fixture-password-only');await page.locator('#auth-submit').click();
 await page.locator('#enrollment-secret').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#enrollment-secret').textContent.length>0);
 const secret=await page.locator('#enrollment-secret').textContent();await page.locator('#mfa-code').fill(new TOTP({secret:Secret.fromBase32(secret),algorithm:'SHA1',digits:6,period:30}).generate());await page.locator('#mfa-submit').click();await page.locator('#recovery-continue').click();await page.locator('#workspace').waitFor({state:'visible'});
 const created=await page.request.post(base+'/api/meetings',{data:{title:'Saved meeting navigation',agenda:'Review saved outcomes',durationMinutes:10}});assert.equal(created.status(),201);const m=await created.json();
 const saved=await (await page.request.get(base+'/api/meetings/'+m.id)).json();
 const report={summary:'Saved synthetic report is readable.',decisions:[],actions:[],unresolved:['Assign the follow-up owner.'],scores:[],speakerTips:[],focusTime:{onTopicSeconds:null,offTopicSeconds:null,unknownSeconds:null,note:'Synthetic navigation fixture.'},overall:null,coverage:0};
 let requests=0;await page.route('**/api/meetings/'+m.id,route=>{requests++;return requests===1?route.fulfill({status:503,json:{error:'Temporary saved-record load failure'}}):route.fulfill({json:{...saved,phase:'ended',reportStatus:'ready',report,error:null}});});
 await page.locator('#refresh-history').click();await page.locator(`#history [data-meeting="${m.id}"]`).click();
 await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Temporary saved-record load failure'));
 assert.equal(new URL(page.url()).hash,'#meeting/'+m.id);assert.equal(await page.locator('#home').isVisible(),true);
 await page.locator(`#history [data-meeting="${m.id}"]`).click();
 await page.waitForFunction(()=>!document.querySelector('#meeting').hidden);assert.equal(await page.locator('#meeting-title').textContent(),m.title);
 assert.equal(requests,2);assert.match(await page.locator('#report-body').textContent(),/Saved synthetic report is readable/);
 assert.equal(await page.locator('#report-status').textContent(),'Ready');
 await page.locator('#back').click();await page.waitForFunction(()=>!document.querySelector('#home').hidden);
 await page.locator(`#history [data-meeting="${m.id}"]`).click();
 await page.waitForFunction(()=>!document.querySelector('#meeting').hidden);assert.equal(await page.locator('#meeting-title').textContent(),m.title);
 const createdOther=await page.request.post(base+'/api/meetings',{data:{title:'Different saved meeting',agenda:'Review the failed analysis',durationMinutes:10}});assert.equal(createdOther.status(),201);const other=await createdOther.json();
 const otherSaved=await (await page.request.get(base+'/api/meetings/'+other.id)).json();
 await page.route('**/api/meetings/'+other.id,route=>route.fulfill({json:{...otherSaved,phase:'ended',reportStatus:'failed',error:'Synthetic report failure'}}));
 await page.locator('#back').click();await page.locator('#refresh-history').click();
 await page.locator(`#recent [data-meeting="${other.id}"]`).click();await page.waitForFunction(()=>document.querySelector('#report-status').textContent==='Failed');
 assert.equal(await page.locator('#meeting-title').textContent(),other.title);assert.match(await page.locator('#report-body').textContent(),/Analysis failed/);
 await page.goBack();await page.waitForFunction(()=>!document.querySelector('#home').hidden);
 await page.goForward();await page.waitForFunction(()=>!document.querySelector('#meeting').hidden);
 assert.equal(await page.locator('#meeting-title').textContent(),other.title);
 await page.locator('#back').click();await page.setViewportSize({width:390,height:844});
 await page.locator(`#history [data-meeting="${m.id}"]`).click();await page.waitForFunction(()=>document.querySelector('#report-status').textContent==='Ready');
 assert.equal(await page.locator('#meeting').isVisible(),true);assert.match(await page.locator('#report-body').textContent(),/Saved synthetic report is readable/);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,scope:'Failed GET retry, ready/failed reports, history/sidebar links, back/forward and mobile; real UI, HTTP/MFA/database fixtures; no paid model calls'}));
}catch(error){if(page)console.error(JSON.stringify({url:page.url(),errors,homeVisible:await page.locator('#home').isVisible(),meetingVisible:await page.locator('#meeting').isVisible()}));throw error;}
finally{await browser?.close();for(const c of children.reverse())c.kill('SIGTERM');await Promise.all(children.map(c=>c.exitCode!==null?null:new Promise(r=>{c.once('exit',r);setTimeout(()=>{c.kill('SIGKILL');r();},2000).unref();})));}
