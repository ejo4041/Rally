// Explicit, bounded production-schema model experiment; no audio or platform join.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {Store} from '../src/store.ts';
import {createMuse} from '../src/muse.ts';
import {defaults} from '../src/config.ts';
import {LiveMonitor} from '../src/realtime.ts';
import type {Meeting,Snapshot} from '../src/contracts.ts';
if(process.env.RALLY_REALTIME_BENCHMARK!=='1')throw Error('Requires RALLY_REALTIME_BENCHMARK=1; maximum $0.15 batch');
const secrets=parseEnv(readFileSync('/srv/hackathon/rally-deployed/config/api.env','utf8'));
const dir=new URL('../test-results/',import.meta.url);mkdirSync(dir,{recursive:true});
const store=new Store(new URL('realtime-benchmark-'+Date.now()+'.sqlite',dir).pathname);
const providers=createMuse(store,{...defaults,paidEnabled:true,reportReserve:0,meetingBudget:.15,buildBudget:.15},{key:secrets.MODEL_API_KEY});
const monitor=new LiveMonitor(store),results:any[]=[];
try{
 for(const [name,minutes,elapsed,text] of [
  ['useful-exploration',30,600,'The API retry strategy may also solve our final reliability topic. Can we explore that connection for a moment?'],
  ['deadline-pressure',15,720,'The API retry strategy may also solve our final reliability topic. Can we explore that connection for a moment?'],
  ['on-track',30,600,'Let us decide the release scope. The retry fix is mandatory, then we can assign the validation owner.'],
  ['unrelated-detour',15,720,'Forget release planning. Let me explain my weekend vacation and the history of every hotel I considered.'],
 ] as const){
 const m={participants:[],createdAt:Date.now(),originalPlan:null,endedAt:null,progress:'',speakerNames:{},assessment:null,reportStatus:'none',report:null,error:null,gaps:[],id:name,userId:'benchmark',title:'Release readiness',agenda:'Decide scope and owner',phase:'live',epoch:1,paused:false,startedAt:Date.now()-elapsed*1000,durationMinutes:minutes,interventions:[],revisions:[],plan:{objective:'Agree release scope and validation owner before the deadline',durationMinutes:minutes,wrapMinutes:1,topics:[{id:'scope',title:'Release scope',outcome:'Choose required changes',minutes:minutes-4,status:'active'},{id:'owner',title:'Validation owner',outcome:'Assign validation',minutes:3,status:'pending'}]}} as Meeting;
 monitor.ingest(m.id,'bench',1,text);const context=monitor.context({meeting:m,turns:[],elapsedSeconds:elapsed} as Snapshot);const start=performance.now();
 try{const decision=await providers.checkLive!(context,m,AbortSignal.timeout(18000));results.push({name,latencyMs:performance.now()-start,valid:true,withinDeadline:performance.now()-start<=8000,decision});}
 catch(error){results.push({name,latencyMs:performance.now()-start,valid:false,error:error instanceof Error?error.message:'failed'});break;}
 }
}finally{
 const usage=store.db.prepare('SELECT status,cost,body FROM usage').all() as {status:string;cost:number|null;body:string}[];
 const report={at:new Date().toISOString(),scope:'Synthetic text, production live schema; no ASR, TTS or meeting join',budget:.15,results,usage:usage.map(r=>JSON.parse(r.body)),knownCost:usage.reduce((s,r)=>s+(r.cost??0),0),unknown:usage.filter(r=>r.status!=='known').length};
 writeFileSync(new URL('../../../docs/research/realtime-model-benchmark.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await monitor.close();store.close();
}
