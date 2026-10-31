// Two non-retrying real Muse checks over explicitly synthetic long-turn evidence.
import {readFileSync,mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
import {Store} from '../src/store.ts';
import {Meetings} from '../src/meetings.ts';
import {createMuse,modelSettings} from '../src/muse.ts';
import {LiveMonitor} from '../src/realtime.ts';
import {defaults} from '../src/config.ts';
import type {Turn} from '../src/contracts.ts';
if(process.env.RALLY_LONG_TURN_MODEL_APPROVED!=='1')throw Error('Explicit authorization required');
const name=process.env.RALLY_LONG_TURN_CHECK_NAME||'long-turn-model-20261031';if(!/^[a-z0-9-]{1,60}$/.test(name))throw Error('Use a bounded result basename');
const dir=new URL(`../test-results/${name}/`,import.meta.url);
if(existsSync(dir))throw Error('Existing result retained; no automatic retry');
mkdirSync(dir,{recursive:true,mode:0o700});
const env=parseEnv(readFileSync('/srv/hackathon/rally-deployed/config/api.env','utf8'));
const store=new Store(new URL('usage.sqlite',dir).pathname),monitor=new LiveMonitor(store);
store.db.prepare('INSERT INTO users VALUES(?,?,?)').run('long-turn','long-turn','offline-only');
const settings=modelSettings(env.RALLY_MODEL_CONFIG||'{}');
// This standalone check never generates a final report; keep its unused reserve small.
settings.report.maxOutputTokens=1024;
const provider=createMuse(store,{...defaults,paidEnabled:true,meetingBudget:.15,buildBudget:.15,reportReserve:0},{key:env.MODEL_API_KEY,settings});
const meetings=new Meetings(store,provider);const results:any[]=[];let passed=false,error;
try{
 const meeting=await meetings.create('long-turn',{title:'Synthetic long-turn evaluation',agenda:'Decide release condition and identify rollback owner and deadline. Preserve uncertainty.',durationMinutes:10});
 assert.equal(meeting.phase,'ready');meeting.phase='live';meeting.startedAt=Date.now()-120000;meetings.save(meeting);
 const text='Earlier source material is not all present in a bounded live excerpt. '+ 'We are discussing the checklist and preserving its source. '.repeat(200)+'. Release remains conditional on actual rollback verification. Priya proposes doing the check Thursday at three; we have not heard explicit acceptance. Rally, what remains unresolved?';
 let turns:Turn[]=[{id:'long:1',sessionId:'long',turnId:1,revision:1,text,speaker:null,startMs:0,endMs:110000}];
 monitor.finalReader=()=>turns;
 for(const corrected of [false,true]){
  if(corrected)turns=[{...turns[0],revision:2,text:text.replace('Priya proposes doing the check Thursday at three; we have not heard explicit acceptance.','Correction: Sam explicitly accepts the rollback check Thursday at three. The actual result remains pending.')}];
  const snapshot={meeting,turns,elapsedSeconds:120};let accepted=false;
  await monitor.check(snapshot,(context,signal)=>provider.checkLive!(context,meeting,signal),()=>meeting,check=>{if(check.status!=='checking')results.push({corrected,...check});},()=>{accepted=true;});
  assert.equal(accepted,true,'Real long-window decision did not meet validity/deadline checks');
 }
 assert.ok(turns[0].text.length>8000);passed=true;
}catch(e){error=e instanceof Error?e.message:'Model check failed';process.exitCode=1;}
finally{
 await monitor.close();const rows=store.db.prepare('SELECT body,status,cost FROM usage').all() as any[];
 const report={at:new Date().toISOString(),passed,error,syntheticInput:true,realMuse:true,meetingJoined:false,museKnownCost:rows.reduce((n,row)=>n+(row.cost??0),0),unknownCosts:rows.filter(row=>row.status==='unknown').length,checks:results,usage:rows.map(row=>JSON.parse(row.body))};
 writeFileSync(new URL('result.json',dir),JSON.stringify(report,null,2)+'\n',{mode:0o600});store.close();console.log(JSON.stringify({passed,error,museKnownCost:report.museKnownCost,unknownCosts:report.unknownCosts,checks:results.map(check=>({status:check.status,latencyMs:check.latencyMs}))}));
}
