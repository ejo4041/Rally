/* Small paid policy/schema check. Explicit only; never part of npm test. */
import {readFile,writeFile} from 'node:fs/promises';
import {createMeeting,addFinal,applyDecision} from '../src/core.js';
import {moderate} from '../src/muse.js';
let key='';for(const line of(await readFile('../../.env.local','utf8')).split(/\r?\n/)){const p=line.match(/^MODEL_API_KEY=(.*)$/);if(p)key=p[1].trim().replace(/^(['"])(.*)\1$/,'$2');}
if(!key)throw new Error('Key required; value will not be displayed.');
const usage=[],results=[];
const repository={costs:async()=>({total:usage.reduce((n,e)=>n+(e.estimatedCost||0),0),unknown:usage.filter(e=>e.estimatedCost===null).length}),usage:async e=>usage.push(e)};
const cases=[
  {name:'on-agenda-no-interruption',turns:['Alex: We need to compare the remaining risks of releasing Friday.','Priya: Let us review the rollback test results before deciding.'],intervene:false},
  {name:'explicit-quoted-example-no-interruption',turns:['Alex: Our regression test quotes the sentence: forget the release, let us talk about bikes. It is only a quoted test fixture.','Priya: That fixture belongs in the Friday release test suite.'],intervene:false},
  {name:'owned-action-is-proposed-not-confirmed',turns:['Alex: Priya, will you run rollback validation by Thursday at 3 PM?','Priya: Yes, I will run rollback validation by Thursday at 3 PM.','Alex: Agreed, Priya owns that validation by Thursday at 3 PM.'],action:true}
];
for(const c of cases.filter(c=>!process.argv[2]||c.name===process.argv[2])){
  const m=createMeeting({title:'Friday release',agenda:['Decide Friday release readiness','Confirm rollback validation'],participants:['Alex','Priya'],minutes:30,wrapMinutes:5});
  c.turns.forEach((text,index)=>addFinal(m,{sessionId:'contract',turnId:index,transcript:text}));
  const result={name:c.name};
  try{
    const response=await moderate({MODEL_API_KEY:key,RALLY_BUILD_BUDGET:'.04',RALLY_MEETING_BUDGET:'.04'},m,repository);applyDecision(m,response.decision);result.decision=response.decision;
    result.passed=c.action?m.outcomes.some(o=>o.type==='action'&&o.owner==='Priya'&&/Thursday/i.test(o.dueDate||'')&&o.status==='proposed'):response.decision.intervene===c.intervene;
    result.proposals=m.outcomes.map(o=>({type:o.type,text:o.text,owner:o.owner,dueDate:o.dueDate,status:o.status}));
  }catch(e){result.error=e.message;result.passed=false;}
  results.push(result);await writeFile('../../docs/research/app-model-contract.json',JSON.stringify({results,usage},null,2)+'\n');
  console.log(JSON.stringify({name:c.name,passed:result.passed,error:result.error}));
  if(result.error)break;
}
console.log(JSON.stringify({estimatedCost:usage.reduce((n,e)=>n+(e.estimatedCost||0),0),allPassed:results.length>0&&results.every(r=>r.passed)}));
