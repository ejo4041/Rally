import {sampleGreeting} from '../../../packages/rally-speech/greeting.mts';
import {demoClips} from './demo-audio-manifest.ts';
import type {DemoAudio,DemoClip,AudioProgress} from './demo-audio.ts';
import type {RecordView, Plan, Report, Turn} from './api-types.ts';
export const sampleAgenda='Review the cache rollout, resolve the mobile sign-in blocker, and agree on launch conditions, owners and next steps.';
export const dialogue = [
 ['Alex','Let’s review the cache rollout. The canary is healthy, but we still need to decide whether the release is ready.'],
 ['Priya','The new cache cut the ninety-fifth percentile response time from four hundred milliseconds to one hundred and eighty in the staging benchmark.'],
 ['Sam','The error rate is steady. I would still like a rollback threshold written down before we expand traffic.'],
 ['Alex','Good point. The mobile sign-in regression is our remaining blocker. We cannot ship that to customers.'],
 ['Priya','I will fix the mobile sign-in regression by Tuesday and add a regression test to the authentication suite.'],
 ['Sam','Could someone update the launch checklist? We have not agreed who owns that yet.'],
 ['Rally','The regression has an owner and a Tuesday target. Checklist ownership is still open. Should launch depend on the regression passing?'],
 ['Alex','Yes. We agree to launch only after the mobile regression passes. We have not chosen a launch date.'],
 ['Sam','Agreed. Keep the launch date open and the checklist owner unassigned until someone accepts it.'],
 ['Priya','For the canary, we can compare the request latency and error budget against the existing release in the same region.'],
 ['Sam','I can write up the rollback thresholds. I need to check the baseline before I can commit to a deadline.'],
 ['Alex','Thanks, Sam. The owner is confirmed, but the deadline is still open. We should not invent one in the notes.'],
 ['Priya','Did anyone see the new developer conference schedule? The distributed systems session sounds interesting.'],
 ['Sam','Yes, though let’s save that for later. We still need to check the release gates.'],
 ['Rally','One release gate is confirmed: the mobile regression must pass. Sam owns the rollback thresholds with no agreed deadline. The launch checklist still needs an owner.'],
 ['Alex','Hey Rally, what did we decide about launch?'],
 ['Rally','The team agreed to launch only after the mobile sign-in regression passes. There is no agreed launch date, and the checklist owner remains unconfirmed.'],
 ['Priya','That matches my understanding. My fix and its regression test are due Tuesday.'],
 ['Sam','I will document the rollback thresholds. The checklist assignment still needs a follow-up.'],
 ['Alex','Exactly. Let’s keep those open questions visible rather than treating them as completed work.'],
 ['Rally','Ready to wrap up: a conditional launch decision, two assigned actions, and two open details. End the meeting when you are ready to review the sample report.'],
] as const;
export class DemoSimulator {
 records=new Map<string,RecordView>(); private cursor=new Map<string,number>();private offset=new Map<string,number>();private gaps=new Map<string,number>();private serial=0;
 private playback:DemoAudio|null=null;private activeId:string|null=null;private announced=new Set<string>();private turnStarted=new Map<string,number>();private asks=new Map<string,{key:string;asset:'ask-early'|'ask-late'|'greeting';replyId:string}>();
 attachAudio(playback:DemoAudio){this.playback=playback;}
 visible(id:string|null){if(id===this.activeId)return;this.playback?.stop();this.activeId=id;}
 pauseReplay(id:string,paused:boolean){if(paused){const m=this.records.get(id);if(m)m.speechStatus=null;this.muted.add(id);if(this.activeId===id)this.playback?.pause();}else{this.muted.delete(id);this.playback?.resume();}}
 private speech(m:RecordView,replyId:string,text:string,status:AudioProgress){
  if(!this.playback?.enabled){m.speechStatus=null;return;}
  m.speechStatus={id:replyId,interventionId:replyId,epoch:m.epoch,at:this.now(),destination:'browser',text,state:status.failed?'failed':status.done?'completed':status.audible?'playing':'preparing',...(status.failed?{error:'Prerecorded audio unavailable; text replay continues.'}:{}),playedMs:status.playedMs};
 }
 requestGuidance(m:RecordView){const i=this.cursor.get(m.id)||0;if(dialogue[i]?.[0]==='Rally'){this.cursor.set(m.id,i+1);this.offset.set(m.id,0);this.playback?.stop();}const early=m.turns.length<8,asset=early?'ask-early':'ask-late';const text=demoClips[asset].text;const reply=this.reply(m,text);this.asks.set(m.id,{key:reply.id,asset,replyId:reply.id});}
 dismiss(m:RecordView){this.asks.delete(m.id);const i=this.cursor.get(m.id)||0;if(dialogue[i]?.[0]==='Rally'){this.cursor.set(m.id,i+1);this.offset.set(m.id,0);}if(this.activeId===m.id)this.playback?.stop();if(m.speechStatus)m.speechStatus={...m.speechStatus,state:'canceled',at:this.now()};}
 private reportDue=new Map<string,number>(); muted=new Set<string>();
 private now:()=>number;
 constructor(now=()=>Date.now()) {this.now=now;const m=this.create({title:'Cache rollout · sample completed meeting',agenda:sampleAgenda,durationMinutes:15});this.complete(m);}
 create(body:Record<string,unknown>){const id='demo-'+(++this.serial);const m:RecordView={id,userId:'demo-user',title:String(body.title||'Release readiness'),agenda:String(body.agenda||sampleAgenda),durationMinutes:Number(body.durationMinutes)||15,participants:[],createdAt:this.now(),phase:'ready',plan:null,originalPlan:null,revisions:[],startedAt:null,endedAt:null,paused:false,epoch:0,progress:'',speakerNames:{'sample:A':'Alex','sample:B':'Priya','sample:C':'Sam'},assessment:null,interventions:[],reportStatus:'none',report:null,error:null,gaps:[],turns:[],moderationMode:(body.moderationMode as RecordView['moderationMode'])||'balanced'};m.plan=this.plan(m);m.originalPlan=structuredClone(m.plan);this.records.set(id,m);this.cursor.set(id,0);this.offset.set(id,0);return m;}
 plan(m:RecordView):Plan {const wrap=Math.min(2,m.durationMinutes/5),part=(m.durationMinutes-wrap)/3;return {objective:m.agenda,durationMinutes:m.durationMinutes,wrapMinutes:wrap,topics:[{id:'readiness',title:'Readiness and performance',outcome:'Review the fictional cache rollout evidence.',minutes:part,status:'pending'},{id:'blockers',title:'Blockers and release gates',outcome:'Confirm the sign-in blocker and launch condition.',minutes:part,status:'pending'},{id:'owners',title:'Owners and next steps',outcome:'Distinguish assigned work from unresolved details.',minutes:part,status:'pending'}]};}
 start(m:RecordView,greetingEnabled=false){const first=m.startedAt===null;this.activeId=m.id;m.phase='live';m.startedAt??=this.now();if(first&&greetingEnabled&&!m.greetingAttemptedAt){m.greetingEnabled=true;m.greetingAttemptedAt=this.now();const reply=this.reply(m,sampleGreeting,'welcome');this.asks.set(m.id,{key:reply.id,asset:'greeting',replyId:reply.id});}m.epoch++;m.progress='Simulated discussion starting · no audio or AI connection.';}
 partial(id:string){const m=this.records.get(id),i=this.cursor.get(id)||0;if(!m||m.phase!=='live'||this.muted.has(id)||dialogue[i]?.[0]==='Rally')return '';return dialogue[i]?.[1].slice(0,this.offset.get(id)||0)||'';}
 step(){for(const m of this.records.values()){
  if(m.reportStatus==='processing'&&this.now()>=(this.reportDue.get(m.id)||Infinity)){m.report=this.report(m);m.reportStatus='ready';}
  if(m.phase!=='live'||(this.playback&&this.activeId!==m.id))continue;
  if(this.muted.has(m.id)){this.playback?.pause();continue;}this.playback?.resume();
  const ask=this.asks.get(m.id);if(ask){
   if(m.paused){this.asks.delete(m.id);this.playback?.stop();}
   else if(this.playback){const clip=demoClips[ask.asset],status=this.playback.progress(ask.key,clip);this.speech(m,ask.replyId,clip.text,status);if(!status.done)continue;this.asks.delete(m.id);}
   else this.asks.delete(m.id);
  }
  const i=this.cursor.get(m.id)||0,entry=dialogue[i];if(!entry){m.progress='Sample conversation complete. End meeting to review the report.';continue;}
  if(entry[0]==='Rally'&&(m.paused||(m.moderationMode==='passive'&&i!==16)||(m.moderationMode==='balanced'&&i===14))){this.cursor.set(m.id,i+1);this.offset.set(m.id,0);this.playback?.stop();continue;}
  const gap=this.gaps.get(m.id)||0;if(gap>0){this.gaps.set(m.id,gap-1);continue;}
  const key=m.id+'-turn-'+i,clip=(demoClips as Record<string,DemoClip>)['turn-'+i];
  let status:AudioProgress|undefined;
  if(this.playback&&!this.turnStarted.has(key))this.turnStarted.set(key,this.now());
  if(this.playback)status=this.playback.progress(key,clip,(this.offset.get(m.id)||0)/entry[1].length);
  const n=status?Math.floor(status.fraction*entry[1].length):(this.offset.get(m.id)||0)+8;this.offset.set(m.id,n);
  if(entry[0]==='Rally'&&!this.announced.has(key)){this.reply(m,entry[1]);this.announced.add(key);}
  if(entry[0]==='Rally'&&status){const reply=m.interventions.at(-1)!;this.speech(m,reply.id,entry[1],status);}
  if(status?.done||(!status&&n>=entry[1].length)){if(entry[0]!=='Rally')this.addTurn(m,i,entry[0],entry[1],this.turnStarted.get(key));this.cursor.set(m.id,i+1);this.offset.set(m.id,0);this.gaps.set(m.id,3);}
 }}
 private addTurn(m:RecordView,i:number,speaker:string,text:string,at?:number){m.turns.push({id:m.id+'-turn-'+i,sessionId:'sample',turnId:i,revision:1,text,speaker:'sample:'+({Alex:'A',Priya:'B',Sam:'C'}[speaker]||'A'),startMs:at!==undefined?Math.max(0,at-(m.startedAt??at)):i*6000,endMs:at!==undefined?Math.max(0,this.now()-(m.startedAt??at)):i*6000+5000});m.progress=`Sample turn ${i+1} of ${dialogue.length} · fictional release readiness discussion`;if(m.plan){m.plan.topics.forEach((t,j)=>t.status=j<Math.floor(i/7)?'done':j===Math.min(2,Math.floor(i/7))?'active':'pending');}}
 reply(m:RecordView,text:string,kind='checkpoint'){const item={id:m.id+'-reply-'+m.interventions.length,at:this.now(),text,kind};m.interventions.push(item);if(kind==='welcome')return item;m.assessment={health:4,reason:'Scripted sample: release condition clear; some action details remain unresolved.',issues:['missing_action_details'],evidence:m.turns.slice(-2).map(t=>t.id),progress:m.progress,intervention:{text,kind:'checkpoint',evidence:m.turns.slice(-2).map(t=>t.id)},plan:null,planReason:''};m.assessmentAt=this.now();return item;}
 end(m:RecordView){if(this.activeId===m.id)this.playback?.stop();this.asks.delete(m.id);if(m.speechStatus)m.speechStatus={...m.speechStatus,state:'canceled',at:this.now()};m.phase='ended';m.endedAt=this.now();m.reportStatus='processing';this.offset.set(m.id,0);this.reportDue.set(m.id,this.now()+1400);}
 complete(m:RecordView){dialogue.forEach(([speaker,text],i)=>speaker==='Rally'?this.reply(m,text):this.addTurn(m,i,speaker,text));m.startedAt=this.now()-150000;m.endedAt=this.now();m.phase='ended';m.report=this.report(m);m.reportStatus='ready';this.cursor.set(m.id,dialogue.length);}
 report(m:RecordView):Report {const ids=(...indices:number[])=>indices.map(i=>m.id+'-turn-'+i).filter(id=>m.turns.some(t=>t.id===id));const decision=ids(7,8),fix=ids(4,17),rollback=ids(10,18),open=ids(5,8);return {summary:'Synthetic sample report, based only on the scripted turns finalized in this browser. '+(decision.length?'Launch is conditional on the mobile regression passing. ':'No launch decision has appeared yet. ')+(fix.length?'Priya owns the sign-in fix. ':'')+(rollback.length?'Sam owns the rollback thresholds. ':''),overall:m.turns.length?4:null,coverage:m.turns.length?5:0,scores:['goal_progress','focus','pacing','actionable_outcomes','participation'].map(category=>({category:category as Report['scores'][number]['category'],score:m.turns.length?4:null,reason:'Illustrative sample score, not a model evaluation.',evidence:m.turns.slice(-1).map(t=>t.id)})),decisions:decision.length?[{text:'Launch only after the mobile sign-in regression passes.',owner:null,dueDate:null,status:'reported_agreement',evidence:decision,followup:'none',followupPrompt:null}]:[],actions:[...(fix.length?[{text:'Fix mobile sign-in and add a regression test.',owner:m.speakerNames['sample:B']||'Priya',dueDate:'Tuesday (relative date from sample)',status:'reported_agreement' as const,evidence:fix,followup:'ticket' as const,followupPrompt:'Draft an authentication regression task.'}]:[]),...(rollback.length?[{text:'Document canary rollback thresholds.',owner:m.speakerNames['sample:C']||'Sam',dueDate:null,status:'reported_agreement' as const,evidence:rollback,followup:'none' as const,followupPrompt:null}]:[])],unresolved:open.length?['Launch checklist owner is unconfirmed.','Launch date remains open.','Rollback threshold deadline is not agreed.']:['End this sample after more conversation to see additional fictional outcomes.'],speakerTips:[],focusTime:{onTopicSeconds:null,offTopicSeconds:null,unknownSeconds:null,note:'Playback is scripted; real focus time and model latency are not measured.'}};}
}
