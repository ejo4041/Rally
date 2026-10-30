// Two bounded real-model checks of the new moderation prompt; no audio/TTS or meeting join.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {Store} from '../src/store.ts';
import {createMuse,modelSettings} from '../src/muse.ts';
import {defaults} from '../src/config.ts';
import {LiveMonitor,liveDecisionSchema} from '../src/realtime.ts';
import {allowIntervention} from '../src/moderation-policy.ts';
import type {Meeting,Turn} from '../src/contracts.ts';
import {initialPresence} from '../../../packages/rally-presence/state.ts';
if(process.env.RALLY_FEEDBACK_PROBE!=='1')throw Error('Operator gate required; maximum $0.15, no automatic retries');
const dir=new URL('../../../artifacts/feedback/model-check/',import.meta.url);mkdirSync(dir,{recursive:true});
if(existsSync(new URL('result.json',dir)))throw Error('Completed check exists; refusing automatic repeat');
const store=new Store(new URL('usage.sqlite',dir).pathname);
if(Number(store.db.prepare('SELECT count(*) AS n FROM usage').get()!.n))throw Error('Usage exists; audit before another attempt');
const env=parseEnv(readFileSync('/srv/hackathon/rally-deployed/config/api.env','utf8'));
const settings=modelSettings();settings.report.maxOutputTokens=1024;
const provider=createMuse(store,{...defaults,paidEnabled:true,meetingBudget:.15,buildBudget:.15,reportReserve:0},{key:env.MODEL_API_KEY,settings});
const monitor=new LiveMonitor(store),now=Date.now();
const m={id:'feedback-model-check',userId:'synthetic-benchmark',title:'Synthetic release review',createdAt:now,agenda:'Decide release and remaining work',phase:'live',epoch:1,paused:false,participants:[],speakerNames:{},startedAt:now-120000,endedAt:null,durationMinutes:5,progress:'Release decision is complete; rollback verification remains',originalPlan:null,assessment:null,interventions:[],revisions:[],gaps:[],reportStatus:'none',report:null,error:null,presence:initialPresence(now),moderationMode:'passive',plan:{objective:'Decide release and remaining work',durationMinutes:5,wrapMinutes:1,topics:[{id:'review',title:'Release review',outcome:'Decide',minutes:2,status:'done'},{id:'actions',title:'Actions',outcome:'Assign owners and dates',minutes:2,status:'active'}]}} as Meeting;m.originalPlan=structuredClone(m.plan);
const turns:Turn[]=[{id:'probe:0',sessionId:'probe',turnId:0,revision:1,text:'We agree to ship on Monday. Sam will verify rollback by Tuesday.',speaker:'A',startMs:0,endMs:3000}];
const results:unknown[]=[];
try{
 for(const scenario of [{name:'addressed recap in passive mode',text:'Hey Rally, what did we decide and who owns rollback verification?'},{name:'ambient discussion stays quiet in passive mode',text:'Before we move on, I enjoyed the coffee this morning.'}]){
  const evidence={id:'probe:1',sessionId:'probe',turnId:1,revision:1,text:scenario.text,speaker:'A',startMs:90000,endMs:93000};
  const context=monitor.context({meeting:m,turns:[...turns,evidence],elapsedSeconds:120});const start=performance.now();
  const decision=liveDecisionSchema.parse(await provider.checkLive!(context,m,AbortSignal.timeout(18000)));
  const policy=decision.intervention?allowIntervention(m,decision.intervention.text,decision.evidence,context.addressedRequest??null):{allowed:false,direct:false};
  results.push({scenario:scenario.name,latencyMs:Math.round(performance.now()-start),decision,policy,addressed:!!context.addressedRequest});
 }
}finally{
 const rows=store.db.prepare('SELECT id,status,cost,estimate,body FROM usage').all();const known=rows.reduce((s,r)=>s+(typeof r.cost==='number'?r.cost:0),0),unknown=rows.filter(r=>r.cost===null).length;
 writeFileSync(new URL('result.json',dir),JSON.stringify({at:new Date().toISOString(),budgetCeiling:.15,results,usage:rows.map(r=>({id:r.id,status:r.status,cost:r.cost,estimate:r.estimate,...JSON.parse(String(r.body))})),knownCost:known,unknownCostCalls:unknown},null,2));store.close();console.log(JSON.stringify({checks:results.length,knownCost:known,unknownCostCalls:unknown}));
}
