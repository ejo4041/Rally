import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {repo} from '../src/store.js';
import {createMeeting,addFinal,markdown} from '../src/core.js';
import {editTeamsRecord,reviewTeamsRecord} from '../src/teams-review.js';

async function fixture(t,{turnCount=22}={}){
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'review-test'}});t.after(()=>mf.dispose());const db=await mf.getD1Database('DB');
 for(const name of ['0000_rally','0001_teams','0002_teams_transcription'])for(const sql of(await readFile(`drizzle/${name}.sql`,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(sql).run();
 const repository=repo(db),m=createMeeting({title:'Teams transcript',agenda:['Recorded Teams discussion'],minutes:3,wrapMinutes:.5});m.kind='teams';m.phase='ended';m.paused=true;m.source={state:'left',transcriptionState:'stopped'};
 for(let i=0;i<turnCount;i++)addFinal(m,{sessionId:'teams-session',turnId:i,transcript:i===0?'Priya will run rollback by Thursday.':`Discussion ${i}`,speaker:null});
 await repository.create(m);const env={RALLY_PAID_ENABLED:'1',MODEL_API_KEY:'test-only-no-network'};
 const edit=async data=>{const m=await repository.get(data.meetingId||mId);return editTeamsRecord(repository,m.id,{version:m.version,...data});};const mId=m.id;
 const setup=()=>edit({action:'setup',title:'Release planning',agenda:['Decide release'],participants:['Priya','Sam'],desiredOutcome:'A release decision'});
 const review=async()=>{const saved=await repository.get(m.id);return reviewTeamsRecord(env,repository,m.id,{version:saved.version,consented:true});};
 return{db,repository,m,env,edit,setup,review};
}
function response(outcomes=[],extra={}){return new Response(JSON.stringify({usage:{prompt_tokens:100,completion_tokens:100},choices:[{finish_reason:'stop',message:{content:JSON.stringify({intervene:false,kind:'none',spoken_text:'',evidence_turn_ids:[],outcomes,...extra})}}]}),{status:200});}
const action={type:'action',text:'Run rollback.',owner:'Priya',due_date:'Thursday',evidence_turn_ids:['teams-session:0']};

test('saved Teams review sends all turns, reserves before sending, requires confirmation and reuses unchanged reviews',async t=>{
 const f=await fixture(t);let calls=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls++;assert.equal(url,'https://api.meta.ai/v1/chat/completions');const body=JSON.parse(options.body),context=JSON.parse(body.messages[1].content);
  assert.equal(context.finalized_turns.length,22);assert.equal(context.finalized_turns[0].id,'teams-session:0');assert.equal(context.finalized_turns[0].speaker,calls===1?'unknown':'Sam');assert.match(body.messages[0].content,/retrospective review/);
  assert.equal((await f.repository.costs()).unknown,1,'request must be durably reserved before fetch');return response([action]);
 });
 await assert.rejects(f.review(),/Save the meeting agenda/);assert.equal(calls,0);await f.setup();
 let result=await f.review();assert.equal(result.cached,false);assert.equal(calls,1);assert.equal(result.meeting.review.turnCount,22);assert.equal(result.meeting.outcomes[0].status,'proposed');assert.equal(result.meeting.interventions.length,0);
 assert.match(markdown(result.meeting),/retrospective proposal review; no live moderation/);
 assert.equal((await f.repository.costs()).unknown,0);assert.equal((await f.repository.usageList()).length,1);
 result=await f.review();assert.equal(result.cached,true);assert.equal(calls,1);
 const outcome=result.meeting.outcomes[0];await f.edit({action:'confirm',id:outcome.id,owner:'Priya',dueDate:'Thursday'});
 assert.equal((await f.repository.get(f.m.id)).outcomes[0].status,'confirmed');
 await assert.rejects(f.edit({action:'setup',agenda:['Release'],participants:['Sam']}),/Keep the owners/);
 await f.edit({action:'speaker',turnId:'teams-session:0',name:'Sam'});let saved=await f.repository.get(f.m.id);assert.equal(saved.outcomes[0].status,'disputed');assert.equal(saved.review.stale,true);
 await f.edit({action:'reject',id:outcome.id});saved=await f.repository.get(f.m.id);assert.equal(saved.outcomes[0].status,'rejected');
 result=await f.review();assert.equal(calls,2);assert.equal(result.meeting.outcomes.length,1);assert.equal(result.meeting.outcomes[0].status,'rejected','review must not resurrect dismissed proposals');
});

test('consent, disabled processing, stale versions, unknown costs and budget prevent sending',async t=>{
 const f=await fixture(t);await f.setup();let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return response();});const m=await f.repository.get(f.m.id);
 await assert.rejects(reviewTeamsRecord(f.env,f.repository,m.id,{version:m.version}),/permission/);
 await assert.rejects(reviewTeamsRecord({...f.env,RALLY_PAID_ENABLED:'0'},f.repository,m.id,{version:m.version,consented:true}),/disabled/);
 await assert.rejects(reviewTeamsRecord(f.env,f.repository,m.id,{version:m.version-1,consented:true}),/changed/);
 await assert.rejects(reviewTeamsRecord({...f.env,RALLY_BUILD_BUDGET:'.00001'},f.repository,m.id,{version:m.version,consented:true}),/forecast/);
 await f.repository.usage({id:'unknown-charge',meetingId:m.id,createdAt:new Date().toISOString(),model:'asr',status:'unknown',estimatedCost:null});
 await assert.rejects(f.review(),/forecast/);assert.equal(calls,0);assert.equal((await f.repository.usageList()).length,1);
});

test('concurrent review, edit and deletion are excluded while a paid request is in flight',async t=>{
 const f=await fixture(t);await f.setup();let finish,started;const ready=new Promise(r=>started=r),wait=new Promise(r=>finish=r);let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;started();await wait;return response([action]);});
 const pending=f.review();await ready;
 try{
  await assert.rejects(f.review(),/busy/);await assert.rejects(f.edit({action:'speaker',turnId:'teams-session:0',name:'Priya'}),/busy/);await assert.rejects(f.repository.remove(f.m.id),/active meeting/);assert.equal(calls,1);
 }finally{finish();await pending;}
 assert.equal((await f.repository.get(f.m.id)).review.stale,false);
});

test('invalid evidence consumes one recorded request but cannot create proposals or a cached review',async t=>{
 const f=await fixture(t);await f.setup();t.mock.method(globalThis,'fetch',async()=>response([{...action,evidence_turn_ids:['invented']}]))
 await assert.rejects(f.review(),/Evidence is missing/);const m=await f.repository.get(f.m.id);assert.equal(m.outcomes.length,0);assert.equal(m.review,undefined);assert.equal((await f.repository.usageList()).length,1);assert.equal((await f.repository.costs()).unknown,0);
 assert.ok(await f.repository.lease(m.id,'after-error'));await f.repository.release(m.id,'after-error');
});

test('network failure leaves a durable unknown charge and blocks another paid attempt',async t=>{
 const f=await fixture(t);await f.setup();let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('offline');});
 await assert.rejects(f.review(),/failed or timed out/);assert.equal((await f.repository.costs()).unknown,1);await assert.rejects(f.review(),/forecast/);assert.equal(calls,1);
});

test('reservation write failure prevents sending and reconciliation failure preserves accounting protection',async t=>{
 const f=await fixture(t);await f.setup();let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return response([action]);});
 const originalReserve=f.repository.reserveReasoning;f.repository.reserveReasoning=async()=>{throw new Error('storage unavailable');};await assert.rejects(f.review(),/storage unavailable/);assert.equal(calls,0);f.repository.reserveReasoning=originalReserve;
 f.repository.finishReasoning=async()=>{throw new Error('storage unavailable');};await assert.rejects(f.review(),e=>e.accountingFailure===true);assert.equal(calls,1);assert.equal((await f.repository.get(f.m.id)).accountingWarning,true);assert.equal((await f.repository.costs()).unknown,1);
 await assert.rejects(f.review(),/Reconcile/);assert.equal(calls,1);
});

test('Worker API performs saved review, explicit confirmation, correction, export and deletion with mocked Meta only',async t=>{
 const {createFetchMock}=await import('miniflare');const fetchMock=createFetchMock();fetchMock.disableNetConnect();
 fetchMock.get('https://api.meta.ai').intercept({path:'/v1/chat/completions',method:'POST'}).reply(200,JSON.stringify({usage:{prompt_tokens:100,completion_tokens:100},choices:[{finish_reason:'stop',message:{content:JSON.stringify({intervene:false,kind:'none',spoken_text:'',evidence_turn_ids:[],outcomes:[action]})}}]}),{headers:{'Content-Type':'application/json'}});
 const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:{DB:'review-worker'},fetchMock,bindings:{RALLY_PAID_ENABLED:'1',MODEL_API_KEY:'test-only-never-real'}});t.after(()=>mf.dispose());const db=await mf.getD1Database('DB');
 for(const name of ['0000_rally','0001_teams','0002_teams_transcription'])for(const sql of(await readFile(`drizzle/${name}.sql`,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(sql).run();
 const repository=repo(db),m=createMeeting({agenda:['Recorded discussion'],minutes:3,wrapMinutes:.5});m.kind='teams';m.phase='ended';m.source={state:'left',transcriptionState:'stopped'};addFinal(m,{sessionId:'teams-session',turnId:0,transcript:'Priya will run rollback by Thursday.'});await repository.create(m);
 const endpoint=`http://localhost/api/meetings/${m.id}`;
 const post=(path,data,headers={})=>mf.dispatchFetch(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 assert.equal((await post('/record',{action:'setup',version:0,agenda:['Release'],participants:['Priya','Sam']},{Origin:'https://elsewhere.example'})).status,403);
 let result=await post('/record',{action:'setup',version:0,title:'Release',agenda:['Release'],participants:['Priya','Sam']});assert.equal(result.status,200);let saved=(await result.json()).meeting;
 assert.equal((await post('/review',{version:saved.version})).status,400);
 result=await post('/review',{version:saved.version,consented:true});assert.equal(result.status,200);saved=(await result.json()).meeting;assert.equal(saved.outcomes[0].status,'proposed');assert.equal(saved.review.turnCount,1);fetchMock.assertNoPendingInterceptors();
 result=await post('/confirm',{version:saved.version,id:saved.outcomes[0].id,owner:'Priya',dueDate:'Thursday'});assert.equal(result.status,200);saved=(await result.json()).meeting;assert.equal(saved.outcomes[0].status,'confirmed');
 result=await post('/record',{version:saved.version,action:'speaker',turnId:'teams-session:0',name:'Sam'});saved=(await result.json()).meeting;assert.equal(saved.outcomes[0].status,'disputed');
 const exported=await(await mf.dispatchFetch(endpoint+'/export')).text();assert.match(exported,/context has changed/);assert.match(exported,/\[disputed\]/);assert.match(exported,/Sam: Priya will run/);
 assert.equal((await mf.dispatchFetch(endpoint,{method:'DELETE'})).status,200);assert.equal((await repository.usageList()).length,1);
});

test('removing a corrected speaker from the roster disputes confirmed cited decisions',async t=>{
 const f=await fixture(t);await f.setup();await f.edit({action:'speaker',turnId:'teams-session:0',name:'Sam'});
 t.mock.method(globalThis,'fetch',async()=>response([{type:'decision',text:'Run rollback before release.',owner:null,due_date:null,evidence_turn_ids:['teams-session:0']}]));
 const reviewed=await f.review();await f.edit({action:'confirm',id:reviewed.meeting.outcomes[0].id});
 await f.edit({action:'setup',title:'Release',agenda:['Release'],participants:['Priya']});
 const m=await f.repository.get(f.m.id);assert.equal(m.outcomes[0].status,'disputed');assert.equal(m.speakerNames['turn:teams-session:0'],undefined);assert.equal(m.review.stale,true);
});
