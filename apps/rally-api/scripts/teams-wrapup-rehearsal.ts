// Explicitly authorized live operator rehearsal. Secrets/invite stay in ignored artifacts.
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium,type Page} from 'playwright';
import {TOTP,Secret} from 'otpauth';
import {createUser} from '../src/auth.ts';
import type {Store} from '../src/store.ts';
import type {Meeting} from '../src/contracts.ts';
if(process.env.RALLY_WRAPUP_REHEARSAL!=='1')throw Error('Explicit rehearsal gate required');
const base='https://rally.tail703f9e.ts.net',db=new DatabaseSync('/srv/hackathon/rally-deployed/state/rally.sqlite'),store={db} as Store;
db.exec('PRAGMA foreign_keys=ON');
const username='wrapup_'+randomBytes(5).toString('hex'),password=randomBytes(24).toString('hex'),user=await createUser(store,username,password),id=randomUUID();
const plan={objective:'Verify the graceful Teams ending.',topics:[{id:'test',title:'Check wrap-up animation and summary link',outcome:'Confirm spinner, link and departure.',minutes:4,status:'active' as const}],durationMinutes:5,wrapMinutes:1};
const m:Meeting={id,userId:user.id,title:'Teams wrap-up rehearsal · October 30',agenda:'Short live validation of the wrap-up animation, authenticated summary link and graceful departure. Moderation is paused for this transport test.',participants:[],durationMinutes:5,createdAt:Date.now(),phase:'ready',plan,originalPlan:plan,revisions:[],startedAt:null,endedAt:null,paused:true,epoch:0,progress:'',speakerNames:{},assessment:null,interventions:[],reportStatus:'none',report:null,error:null,gaps:[],moderationMode:'passive',speechEnabled:false};
db.prepare('INSERT INTO meetings VALUES(?,?,?)').run(id,user.id,JSON.stringify(m));
const evidence:Record<string,unknown>={at:new Date().toISOString(),meetingId:id,scope:'Authorized short Teams wrap-up rehearsal',passed:false,liveJoinAttempt:1,moderationPaused:true,ttsEnabled:false};
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined,connected=false;
async function request(path:string,body?:unknown){return page!.evaluate(async({path,body})=>{const r=await fetch('/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const value=await r.json();if(!r.ok)throw Error(value.error??'API request failed');return value;},{path,body});}
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP rally.tail703f9e.ts.net '+(process.env.RALLY_PUBLIC_RELAY_IP||'209.177.145.192')]});page=await browser.newPage();await page.goto(base);await page.locator('#username').fill(username);await page.locator('#password').fill(password);await page.locator('#auth-submit').click();await page.locator('#enrollment-secret').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#enrollment-secret')!.textContent!.length>0);const secret=await page.locator('#enrollment-secret').textContent();await page.locator('#mfa-code').fill(new TOTP({secret:Secret.fromBase32(secret!),digits:6,period:30,algorithm:'SHA1'}).generate());await page.locator('#mfa-submit').click();await page.locator('#recovery-continue').click();await page.locator('#workspace').waitFor({state:'visible'});
 await request(`/meetings/${id}/teams/connect`,{meetingUrl:readFileSync(new URL('../../../artifacts/feedback/teams-wrapup-invite.txt',import.meta.url),'utf8').trim(),consented:true});
 let last='';for(let n=0;n<150;n++){const status=await request(`/meetings/${id}/teams/status`);if(status.state!==last){last=status.state;console.log('Teams state:',last);}if(last==='connected'){connected=true;break;}if(['failed','left'].includes(last))throw Error('Teams join failed');await new Promise(r=>setTimeout(r,2000));}
 if(!connected)throw Error('Rehearsal admission timed out');evidence.connected=true;console.log('Connected. Will end Rally in 25 seconds.');
 await new Promise(r=>setTimeout(r,25000));const endingAt=Date.now();const finished=await request(`/meetings/${id}/end`,{});evidence.endRequestMs=Date.now()-endingAt;evidence.wrapUp=finished.wrapUp;evidence.callState=finished.callState;
 for(let n=0;n<45;n++){const current=await request(`/meetings/${id}`);if(current.reportStatus!=='processing'){evidence.reportStatus=current.reportStatus;evidence.finalizedTurns=current.turns.length;break;}await new Promise(r=>setTimeout(r,1000));}
 if(evidence.reportStatus==='ready'){await request(`/meetings/${id}/report-shares`,{username:'rally_admin'});evidence.sharedWithAdmin=true;}
 evidence.passed=finished.wrapUp?.chat==='sent'&&finished.wrapUp?.leaveConfirmed===true&&finished.callState==='left';
 console.log('Wrap-up:',JSON.stringify({chat:finished.wrapUp?.chat,leaveConfirmed:finished.wrapUp?.leaveConfirmed,state:finished.callState,endMs:evidence.endRequestMs,report:evidence.reportStatus}));
}finally{
 try{if(page&&connected){const current=await request(`/meetings/${id}`);if(current.phase==='live')await request(`/meetings/${id}/end`,{});}}catch{}
 await browser?.close();
 // Retain private rehearsal report and auditable usage. Revoke operator sessions.
 db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
 const rows=db.prepare('SELECT id,status,cost,body FROM usage WHERE meeting_id=?').all(id);evidence.usage=rows.map(r=>({id:r.id,status:r.status,cost:r.cost,body:JSON.parse(String(r.body))}));evidence.batchKnownCost=rows.reduce((sum,r)=>sum+Number(r.cost??0),0);evidence.unknownCostRows=rows.filter(r=>r.status!=='known').length;
 evidence.operatorAccount={username,retainedForPrivateReport:true,sessionsRevoked:true};
 writeFileSync(new URL('../../../artifacts/feedback/teams-wrapup-rehearsal.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');db.close();
}
