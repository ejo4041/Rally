// Operator validation: public HTTPS, real MFA and deployed PDF sandbox; synthetic records only.
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,type Page} from 'playwright';
import {TOTP,Secret} from 'otpauth';
import {createUser} from '../src/auth.ts';
import {audit} from '../src/security.ts';
import type {Store} from '../src/store.ts';
import {categories,type Meeting,type Report,type Turn} from '../src/contracts.ts';
if(process.env.RALLY_FEEDBACK_DEPLOYED_SMOKE!=='1')throw Error('Operator gate required on deployment host');
const base='https://rally.tail703f9e.ts.net',db=new DatabaseSync('/srv/hackathon/rally-deployed/state/rally.sqlite'),store={db} as Store,users:{id:string;username:string;password:string}[]=[],meetingId=randomUUID();
db.exec('PRAGMA foreign_keys=ON');
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
const evidence:Record<string,unknown>={at:new Date().toISOString(),passed:false,scope:'Public HTTPS and deployed API/PDF sandbox with disposable synthetic accounts/report',modelCalls:0,platformJoins:0};
async function login(page:Page,username:string,password:string){await page.goto(base);await page.locator('#username').fill(username);await page.locator('#password').fill(password);await page.locator('#auth-submit').click();await page.locator('#enrollment-secret').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#enrollment-secret')!.textContent!.length>0);assert.equal(await page.locator('#mfa-code').getAttribute('name'),'totp');const secret=await page.locator('#enrollment-secret').textContent();await page.locator('#mfa-code').fill(new TOTP({secret:Secret.fromBase32(secret!),digits:6,period:30,algorithm:'SHA1'}).generate());await page.locator('#mfa-submit').click();await page.locator('#recovery-continue').waitFor({state:'visible'});await page.locator('#recovery-continue').click();await page.locator('#workspace').waitFor({state:'visible'});}
try{
 for(let i=0;i<2;i++){const username='feedback_'+randomBytes(6).toString('hex'),password=randomBytes(20).toString('hex'),user=await createUser(store,username,password);users.push({...user,password});}
 const report:Report={summary:'Synthetic post-deployment validation. No real meeting content.',decisions:[],actions:[{text:'Verify the synthetic release.',owner:null,dueDate:null,status:'proposal',evidence:['probe:0'],followup:'none',followupPrompt:null}],unresolved:['Owner remains unassigned.'],scores:categories.map(category=>({category,score:4,reason:'Synthetic fixture, not a measured meeting.',evidence:['probe:0']})),speakerTips:[],focusTime:{onTopicSeconds:null,offTopicSeconds:null,unknownSeconds:null,note:'Synthetic validation.'},overall:4,coverage:5};
 const m:Meeting={id:meetingId,userId:users[0].id,title:'Synthetic deployment report check',agenda:'Validate private report access and PDF export.',participants:[],durationMinutes:5,createdAt:Date.now(),phase:'ended',plan:null,originalPlan:null,revisions:[],startedAt:Date.now()-10000,endedAt:Date.now(),paused:false,epoch:1,progress:'',speakerNames:{},assessment:null,interventions:[],reportStatus:'ready',report,reportStale:false,error:null,gaps:[],moderationMode:'balanced'};
 m.interventions=[{id:'synthetic-rally-response',at:Date.now(),text:'Synthetic Rally response: owner is still unassigned.',kind:'clarify'}];
 m.speechStatus={id:'synthetic-voice',interventionId:'synthetic-rally-response',epoch:1,at:Date.now(),state:'canceled',destination:'teams'};
 db.prepare('INSERT INTO meetings VALUES(?,?,?)').run(m.id,m.userId,JSON.stringify(m));const turn:Turn={id:'probe:0',sessionId:'probe',turnId:0,revision:1,text:'We propose checking this synthetic release. Owner is not assigned.',speaker:null,startMs:0,endMs:2000};db.prepare('INSERT INTO turns VALUES(?,?,?)').run(m.id,turn.id,JSON.stringify(turn));
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP rally.tail703f9e.ts.net '+(process.env.RALLY_PUBLIC_RELAY_IP||'209.177.145.192')]});
 const owner=await browser.newContext(),page=await owner.newPage();await login(page,users[0].username,users[0].password);evidence.mfaLogin=true;evidence.semanticOTP=true;
 const cookies=await owner.cookies();assert.ok(cookies.some(c=>c.name==='rally_session'&&c.secure&&c.httpOnly));evidence.secureCookie=true;
 assert.equal(await page.evaluate(async password=>(await fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'disabled_signup_probe',password})})).status,users[0].password),403);evidence.closedRegistration=true;
 const picker=page.locator('#workspace [data-theme-selector]');await picker.selectOption('dark');await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.reload();await page.locator('#workspace').waitFor({state:'visible'});assert.equal(await picker.inputValue(),'dark');await picker.selectOption('light');await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');evidence.appearanceSelector=true;evidence.appearancePersists=true;
 const icon=await page.evaluate(async()=>{const r=await fetch('/favicon.svg');return {status:r.status,type:r.headers.get('content-type')};});assert.equal(icon.status,200);assert.match(icon.type??'',/image\/svg\+xml/);evidence.favicon=true;
 let releasePrepare;const gate=new Promise<void>(resolve=>releasePrepare=resolve);let prepareCalls=0;
 await page.route('**/api/meetings',async route=>{if(route.request().method()!=='POST')return route.continue();prepareCalls++;await gate;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic loading-state validation only'})});});
 assert.equal(await page.locator('.meta-product-grid .meta-badge').count(),3);evidence.metaAttribution=true;
 await page.locator('#new-meeting').click();await page.locator('#create-form [name=title]').fill('Synthetic loading validation');await page.locator('#create-form [name=agenda]').fill('No actual prepare request is sent.');await page.locator('#create-submit').click();
 await page.waitForFunction(()=>document.querySelector('#create-submit')?.getAttribute('aria-busy')==='true');assert.match(await page.locator('#create-submit').textContent()??'',/Preparing your plan/);
 await page.locator('#create-form').evaluate(el=>el.dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true})));assert.equal(prepareCalls,1);releasePrepare!();
 await page.waitForFunction(()=>document.querySelector('#create-error')?.textContent?.includes('Synthetic loading-state validation only'));await page.waitForFunction(()=>!document.querySelector('#create-submit')?.classList.contains('is-loading'));evidence.loadingFailureRecovery=true;evidence.duplicateSubmitBlocked=true;
 await page.locator('#create-dialog [data-close]').click();await page.goto(base+'/#meeting/'+m.id);await page.waitForFunction(agenda=>document.querySelector('#source-agenda')?.textContent===agenda,m.agenda);assert.equal(await page.locator('#source-agenda').textContent(),m.agenda);
 await page.locator('[data-rally-response]').waitFor();assert.match(await page.locator('#rally-replies').textContent()??'',/Synthetic Rally response/);assert.match(await page.locator('#rally-replies').textContent()??'',/Canceled or interrupted/);assert.doesNotMatch(await page.locator('#transcript').textContent()??'',/Synthetic Rally response/);evidence.rallyResponseLog=true;
 const download=page.waitForEvent('download');await page.locator('#export-pdf').click();const file=await download;await file.saveAs(new URL('../../../artifacts/feedback/deployed-report.pdf',import.meta.url).pathname);assert.equal(readFileSync(new URL('../../../artifacts/feedback/deployed-report.pdf',import.meta.url)).subarray(0,5).toString(),'%PDF-');evidence.deployedPDF=true;
 await page.locator('#share-report').click();await page.locator('#report-recipient').fill(users[1].username);await page.locator('#report-share-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#report-share-status')!.textContent!.includes('Access granted'));
 const recipient=await browser.newContext(),other=await recipient.newPage();await login(other,users[1].username,users[1].password);await other.locator(`[data-shared-report="${m.id}"]`).click();await other.locator('#shared-report-dialog').waitFor({state:'visible'});assert.equal(await other.locator('#shared-report-title').textContent(),m.title);evidence.accountSharing=true;
 assert.equal(await other.evaluate(async id=>(await fetch('/api/meetings/'+id)).status,m.id),404);evidence.fullMeetingDenied=true;
 await page.locator('[data-revoke-report]').click();await page.waitForFunction(()=>document.querySelector('#report-recipient-list')!.textContent!.includes('No recipients'));
 assert.equal(await other.evaluate(async id=>(await fetch('/api/shared-reports/'+id)).status,m.id),404);evidence.revocation=true;evidence.passed=true;
}finally{
 await browser?.close();db.prepare('DELETE FROM meetings WHERE id=?').run(meetingId);
 for(const user of users){for(const table of ['sessions','auth_challenges','recovery_codes','account_tokens','user_security'])db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(user.id);db.prepare('DELETE FROM audit WHERE actor=? OR target=?').run(user.id,user.id);db.prepare('DELETE FROM users WHERE id=?').run(user.id);}
 db.prepare('DELETE FROM audit WHERE target=?').run(meetingId);evidence.temporaryRecordsRemoved=true;audit(store,null,'operator.feedback_validation',null,{passed:evidence.passed,modelCalls:0});db.close();
 writeFileSync(new URL(process.env.RALLY_FEEDBACK_SMOKE_OUTPUT??'../../../docs/research/loading-replies-deployed.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}
