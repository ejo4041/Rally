// Transport-only acceptance check of current connector; no model/provider imports.
import {readFileSync,writeFileSync} from 'node:fs';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {leaveTeamsMeeting} from '../src/teams-summary.ts';
import {DatabaseSync} from 'node:sqlite';
import {connectTeamsBrowser} from '../src/teams-browser.ts';
import {sceneFor} from '../../../packages/rally-presence/scene.ts';
import type {Meeting} from '../src/contracts.ts';
if(process.env.RALLY_WRAPUP_TRANSPORT_CHECK!=='1')throw Error('Explicit transport check gate required');
const prior=JSON.parse(readFileSync(new URL('../../../artifacts/feedback/teams-wrapup-rehearsal-second.json',import.meta.url),'utf8'));
const db=new DatabaseSync('/srv/hackathon/rally-deployed/state/rally.sqlite',{readOnly:true});
const active=db.prepare('SELECT body FROM meetings').all().map(r=>JSON.parse(String(r.body))).filter(m=>m.phase==='live'||m.reportStatus==='processing');if(active.length)throw Error('Active meeting/report; skip transport check');
const m:Meeting=JSON.parse(String(db.prepare('SELECT body FROM meetings WHERE id=?').get(prior.meetingId)!.body));db.close();m.wrapUp={state:'processing',chat:'pending'};
const evidence:Record<string,unknown>={at:new Date().toISOString(),scope:'Authorized transport-only wrap-up check using prior private report',modelCalls:0,paidCost:0,meetingId:m.id};
let call:Awaited<ReturnType<typeof connectTeamsBrowser>>|undefined;
try{
 call=await connectTeamsBrowser(readFileSync(new URL('../../../artifacts/feedback/teams-wrapup-invite.txt',import.meta.url),'utf8').trim(),new AbortController().signal,state=>console.log('Transport state:',state),m,{scene:()=>sceneFor(m),voice:()=>{}});
 console.log('Connected; finishing animation will remain for at least13seconds.');await new Promise(r=>setTimeout(r,2000));
 let manualResult:unknown;
 if(process.env.RALLY_TRANSPORT_INSPECT==='1'){
   const debug=await chromium.connectOverCDP('http://127.0.0.1:9227');const page=debug.contexts()[0].pages()[0];
   await page.getByRole('button',{name:'Chat',exact:true}).waitFor({state:'visible',timeout:10000});
   const composer=page.locator('[contenteditable=true][role=textbox]').filter({visible:true}).first();if(!await composer.isVisible())await page.getByRole('button',{name:'Chat',exact:true}).click();
   await composer.fill('Rally is preparing the meeting notes. Summary: ');await composer.press('Control+k');
   console.log('Link dialog:',JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('input, [role=dialog], button')).filter(e=>e.getClientRects().length&&(e.tagName==='INPUT'||e.getAttribute('role')==='dialog'||/^(Insert|Cancel|Save)$/.test(e.textContent||''))).map(e=>({tag:e.tagName,role:e.getAttribute('role'),label:e.getAttribute('aria-label'),placeholder:e.getAttribute('placeholder'),id:e.id,text:e.tagName==='BUTTON'?e.textContent:null})))));
   const flag=new URL('../../../artifacts/feedback/link-inspect-done.json',import.meta.url);
   for(let n=0;n<300&&!existsSync(flag);n++)await new Promise(r=>setTimeout(r,500));
   if(existsSync(flag))manualResult=JSON.parse(readFileSync(flag,'utf8'));else manualResult={chat:'unavailable',left:await leaveTeamsMeeting(page)};
 }
 const start=Date.now();const result=(manualResult??await call.finish!(prior.wrapUp.summaryUrl)) as {chat:string;left:boolean};evidence.finishMs=Date.now()-start;evidence.result=result;evidence.passed=typeof result==='object'&&result.chat==='sent'&&result.left&&Number(evidence.finishMs)>=13000;console.log('Result:',JSON.stringify(evidence));
}finally{await call?.close();writeFileSync(new URL('../../../artifacts/feedback/teams-wrapup-transport.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');}
