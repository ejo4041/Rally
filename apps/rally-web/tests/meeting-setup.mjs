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
 const create=async title=>{const response=await page.request.post(base+'/api/meetings',{data:{title,agenda:'Review release readiness',durationMinutes:10}});assert.equal(response.status(),201);return response.json();};
 const first=await create('First meeting invite');await page.locator('#refresh-history').click();await page.locator(`#history [data-meeting="${first.id}"]`).click();await page.locator('#audio-mode').selectOption('teams');
 const invite='https://teams.microsoft.com/l/meetup-join/synthetic-first-invite';await page.locator('#live-teams-link').fill(invite);await page.locator('#consent').check();assert.equal(await page.locator('#start').isEnabled(),true);
 await page.locator('#back').click();const second=await create('New meeting invite must be blank');await page.locator('#refresh-history').click();await page.locator(`#history [data-meeting="${second.id}"]`).click();await page.waitForFunction(title=>document.querySelector('#meeting-title').textContent===title,second.title);
 assert.equal(await page.locator('#live-teams-link').inputValue(),'','A previous meeting invite must never carry into another meeting');
 assert.equal(await page.locator('#consent').isChecked(),false);assert.equal(await page.locator('#start').isEnabled(),false);
 await page.locator('#consent').check();await page.locator('#live-teams-link').fill('https://example.org/meeting');assert.equal(await page.locator('#start').isEnabled(),false);
 await page.locator('#live-teams-link').fill('https://teams.microsoft.com/meet/123456789?p=synthetic');assert.equal(await page.locator('#start').isEnabled(),true);
 let joins=0;await page.route('**/api/meetings/'+second.id+'/teams/connect',route=>{joins++;return route.fulfill({status:503,json:{error:'Synthetic join click reached the server'}});});
 await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Synthetic join click reached the server'));assert.equal(joins,1);
 await page.locator('#back').click();await page.request.post(base+'/api/test/prepare-failure',{data:{enabled:true}});const failed=await create('Preparation failure is visible');
 await page.locator('#refresh-history').click();await page.locator(`#history [data-meeting="${failed.id}"]`).click();await page.locator('#audio-mode').selectOption('teams');await page.locator('#live-teams-link').fill(invite);await page.locator('#consent').check();assert.equal(await page.locator('#start').isEnabled(),false);
 assert.match(await page.locator('#join-requirements').textContent(),/agenda preparation failed/i);assert.match(await page.locator('#join-requirements').textContent(),/Fixture agenda failure/);
 await page.locator('#back').click();
 await page.route('**/api/meetings/'+failed.id,route=>route.fulfill({json:{...failed,turns:[],error:'Unknown provider costs must be reconciled before further paid work'}}));
 await page.locator(`#history [data-meeting="${failed.id}"]`).click();await page.waitForFunction(()=>document.querySelector('#join-requirements').textContent.includes('unconfirmed charge'));
 assert.equal(await page.locator('#start').isEnabled(),false);assert.match(await page.locator('#join-requirements').textContent(),/provider billing/);
 await page.unroute('**/api/meetings/'+failed.id);await page.locator('#back').click();await page.locator(`#history [data-meeting="${failed.id}"]`).click();await page.waitForFunction(()=>document.querySelector('#meeting-title').textContent==='Preparation failure is visible');
 await page.locator('#live-teams-link').fill(invite);await page.locator('#consent').check();
 await page.request.post(base+'/api/test/prepare-failure',{data:{enabled:false}});await page.locator('#prepare').click();await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 assert.equal(await page.locator('#join-requirements').isVisible(),false);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#start').isEnabled(),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,scope:'New meeting clears old invite; valid/invalid invite and consent gating; Join click reaches the endpoint; failed preparation explains disabled Join and explicit prepare recovery; desktop/mobile; isolated fixture providers, no paid calls or real platform joins'}));

}catch(error){if(page)console.error(JSON.stringify({url:page.url(),errors,homeVisible:await page.locator('#home').isVisible(),meetingVisible:await page.locator('#meeting').isVisible()}));throw error;}
finally{await browser?.close();for(const c of children.reverse())c.kill('SIGTERM');await Promise.all(children.map(c=>c.exitCode!==null?null:new Promise(r=>{c.once('exit',r);setTimeout(()=>{c.kill('SIGKILL');r();},2000).unref();})));}
