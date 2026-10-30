// Transport-only acceptance check of current connector; no model/provider imports.
import {readFileSync,writeFileSync} from 'node:fs';
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
 const start=Date.now();const result=await call.finish!(prior.wrapUp.summaryUrl);evidence.finishMs=Date.now()-start;evidence.result=result;evidence.passed=typeof result==='object'&&result.chat==='sent'&&result.left&&Number(evidence.finishMs)>=13000;console.log('Result:',JSON.stringify(evidence));
}finally{await call?.close();writeFileSync(new URL('../../../artifacts/feedback/teams-wrapup-transport.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');}
