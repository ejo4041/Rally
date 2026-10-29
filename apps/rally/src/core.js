export const LIMITS={maxMinutes:55,maxTurns:1600,maxOutcomes:100,maxText:4000,cooldownMs:60000};
export class AppError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const text=(value,max=240)=>String(value??'').trim().slice(0,max);
export function createMeeting(input,id=crypto.randomUUID(),now=Date.now()){
  const title=text(input.title,120)||'A meeting worth having';
  const agenda=(Array.isArray(input.agenda)?input.agenda:String(input.agenda||'').split('\n')).map(v=>text(v)).filter(Boolean).slice(0,10);
  if(!agenda.length)throw new AppError('Add at least one agenda item.');
  const minutes=Number(input.minutes??30),wrapMinutes=Number(input.wrapMinutes??5);
  if(!Number.isFinite(minutes)||minutes<1||minutes>LIMITS.maxMinutes)throw new AppError('Choose a meeting length from 1 to 55 minutes.');
  if(!Number.isFinite(wrapMinutes)||wrapMinutes<=0||wrapMinutes>=minutes)throw new AppError('Wrap-up must be shorter than the meeting.');
  const participants=(Array.isArray(input.participants)?input.participants:String(input.participants||'').split(',')).map(v=>text(v,60)).filter(Boolean).slice(0,12);
  const opening=text(input.opening,650)||`Let’s make this time count. We’re here to ${agenda[0].toLowerCase()}. I’ll help keep us on track and ask us to confirm decisions, owners, and dates. You can pause me at any time.`;
  return {id,title,agenda,participants,minutes,wrapMinutes,opening,desiredOutcome:text(input.desiredOutcome,400),kind:input.kind==='walkthrough'?'walkthrough':'live',createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),phase:'draft',paused:false,currentAgenda:0,startedAt:null,endedAt:null,demoOffsetMs:0,epoch:0,turns:[],outcomes:[],interventions:[],speakerNames:{},lastPresentedAt:null,wrapTriggered:false,checkpointItems:[],consented:false};
}
export function elapsedMs(m,now=Date.now()){return m.startedAt?Math.max(0,(m.endedAt?Date.parse(m.endedAt):now)-Date.parse(m.startedAt)+m.demoOffsetMs):0;}
export function turnKey(sessionId,turnId){return `${sessionId}:${String(turnId)}`;}
export function addFinal(m,{sessionId,turnId,transcript,speaker=null,source='asr',receivedAt=Date.now(),echoRisk=false}){
  const value=text(transcript,LIMITS.maxText);if(!value)return null;
  const id=turnKey(sessionId,turnId),existing=m.turns.find(t=>t.id===id);
  if(existing?.text===value)return null;
  if(m.turns.length>=LIMITS.maxTurns&&!existing)throw new AppError('Transcript limit reached; end this meeting.',409);
  const turn={id,sessionId,turnId,text:value,speaker:speaker?text(speaker,40):null,revision:(existing?.revision||0)+1,source,receivedAt:new Date(receivedAt).toISOString(),echoRisk};
  if(existing){
    m.turns[m.turns.indexOf(existing)]=turn;
    for(const o of m.outcomes)if(o.evidence.some(e=>e.turnId===id))o.status=o.status==='confirmed'?'disputed':'proposed';
    m.epoch++;
  }else m.turns.push(turn);
  // Canonical order within a provider session; receipt order alone is not source order.
  const sessions=[...new Set(m.turns.map(t=>t.sessionId))];
  m.turns.sort((a,b)=>sessions.indexOf(a.sessionId)-sessions.indexOf(b.sessionId)||Number(a.turnId)-Number(b.turnId));
  return turn;
}
export const evidenceFor=(m,ids)=>ids.map(id=>{const t=m.turns.find(x=>x.id===id);if(!t||t.echoRisk)throw new AppError('Evidence is missing or may contain Rally’s own voice.');return{turnId:t.id,revision:t.revision,quote:t.text};});
export function validateDecision(m,d){
  if(!d||typeof d!=='object'||typeof d.intervene!=='boolean'||typeof d.spoken_text!=='string'||!Array.isArray(d.evidence_turn_ids)||!Array.isArray(d.outcomes)||!['none','redirect','clarify','decision','checkpoint'].includes(d.kind))throw new AppError('Moderator returned an invalid decision.');
  if(d.outcomes.length>5)throw new AppError('Too many proposed outcomes.');
  evidenceFor(m,d.evidence_turn_ids);
  if(d.intervene&&(!text(d.spoken_text,240)||!d.evidence_turn_ids.length))throw new AppError('Intervention lacks text or evidence.');
  const outcomes=d.outcomes.map(o=>{
    if(!o||!['action','decision'].includes(o.type)||!text(o.text,400)||!Array.isArray(o.evidence_turn_ids)||!o.evidence_turn_ids.length)throw new AppError('Invalid proposed outcome.');
    const owner=o.owner===null?null:text(o.owner,60)||null,date=o.due_date===null?null:text(o.due_date,100)||null;
    if(owner&&!m.participants.includes(owner))throw new AppError('Proposed owner is not in the participant roster.');
    return {type:o.type,text:text(o.text,400),owner,dueDate:date,evidence:evidenceFor(m,o.evidence_turn_ids)};
  });
  return {intervene:d.intervene,kind:d.kind,spokenText:d.intervene?text(d.spoken_text,240):'',evidence:evidenceFor(m,d.evidence_turn_ids),outcomes};
}
export function applyDecision(m,d,now=Date.now()){
  const v=validateDecision(m,d);
  for(const o of v.outcomes){
    if(m.outcomes.length>=LIMITS.maxOutcomes)break;
    const duplicate=m.outcomes.find(x=>x.type===o.type&&x.text.toLowerCase()===o.text.toLowerCase());
    if(!duplicate)m.outcomes.push({id:crypto.randomUUID(),...o,status:'proposed',confirmation:null,createdAt:new Date(now).toISOString()});
  }
  return v;
}
export function confirmOutcome(m,id,{owner,dueDate,actor='Host',note='Explicit host confirmation'}={},now=Date.now()){
  const o=m.outcomes.find(x=>x.id===id);if(!o)throw new AppError('Outcome not found.',404);
  if(owner!==undefined)o.owner=text(owner,60)||null;
  if(dueDate!==undefined)o.dueDate=text(dueDate,100)||null;
  if(o.type==='action'&&(!o.owner||!o.dueDate))throw new AppError('Confirm an owner and deadline first.');
  if(o.owner&&!m.participants.includes(o.owner))throw new AppError('Choose an owner from the participant roster.');
  for(const e of o.evidence){const t=m.turns.find(v=>v.id===e.turnId);if(!t||t.revision!==e.revision||t.echoRisk)throw new AppError('Evidence changed. Review this proposal before confirming.');}
  o.status='confirmed';o.confirmation={actor:text(actor,80),source:'host_explicit',note:text(note,300),at:new Date(now).toISOString()};
  return o;
}
export function canSpeak(m,now=Date.now(),priority=false){return ['live','wrapping'].includes(m.phase)&&!m.paused&&(priority||m.lastPresentedAt===null||now-m.lastPresentedAt>=LIMITS.cooldownMs);}
export function utterance(m,textValue,kind='prompt',now=Date.now()){
  const u={id:crypto.randomUUID(),text:text(textValue,650),kind,epoch:m.epoch,state:'queued',createdAt:new Date(now).toISOString()};
  m.interventions.push(u);m.interventions=m.interventions.slice(-100);return u;
}
export function control(m,command,now=Date.now()){
  if(command.type==='start'){
    if(m.phase!=='draft')throw new AppError('This meeting has already started.',409);
    if(command.consented!==true)throw new AppError('Participant consent is required before capture.');
    m.consented=true;m.phase='live';m.startedAt=new Date(now).toISOString();
  }else if(command.type==='pause'){
    if(!['live','wrapping'].includes(m.phase))throw new AppError('Meeting is not live.',409);
    m.paused=true;m.epoch++;
  }else if(command.type==='resume'){
    if(!['live','wrapping'].includes(m.phase))throw new AppError('Meeting is not live.',409);
    m.paused=false;m.epoch++;
  }else if(command.type==='dismiss')m.epoch++;
  else if(command.type==='end'){
    m.phase='ended';m.endedAt=new Date(now).toISOString();m.paused=true;m.epoch++;
  }else if(command.type==='agenda'){
    const i=Number(command.index);if(!Number.isInteger(i)||i<0||i>=m.agenda.length)throw new AppError('Invalid agenda item.');
    m.currentAgenda=i;m.epoch++;
  }else if(command.type==='demo_clock'){
    if(!['live','wrapping'].includes(m.phase))throw new AppError('Start the meeting first.');
    m.demoOffsetMs=Math.max(0,m.minutes*60000-m.wrapMinutes*60000-elapsedMs(m,now)+m.demoOffsetMs);
    m.demoClockUsed=true;
  }else if(command.type==='speaker'){
    if(!m.participants.includes(command.name))throw new AppError('Choose a roster name.');
    m.speakerNames[text(command.label,200)]=command.name;m.epoch++;
  }else throw new AppError('Unknown host command.');
  m.updatedAt=new Date(now).toISOString();
  if(['pause','dismiss','end','agenda','speaker'].includes(command.type))for(const u of m.interventions)if(['queued','speaking'].includes(u.state))u.state='canceled';
  return m;
}
export function scorecard(m,now=Date.now()){
  return {decisions:m.outcomes.filter(o=>o.type==='decision'&&o.status==='confirmed').length,
    actions:m.outcomes.filter(o=>o.type==='action'&&o.status==='confirmed'&&o.owner&&o.dueDate).length,
    unresolved:m.outcomes.filter(o=>!['confirmed','rejected'].includes(o.status)).length,elapsedSeconds:Math.round(elapsedMs(m,now)/1000),plannedSeconds:m.minutes*60};
}
export function wrapText(m){const pending=m.outcomes.filter(o=>!['confirmed','rejected'].includes(o.status)).length;return `We have ${m.wrapMinutes} minutes remaining. Let’s confirm our decisions, owners, and deadlines.${pending?` There ${pending===1?'is one unresolved item':`are ${pending} unresolved items`} to review.`:''}`;}
export function timeCheckpoint(m,now=Date.now()){
  if(m.phase!=='live'||m.wrapTriggered||!canSpeak(m,now)||m.checkpointItems.includes(m.currentAgenda))return null;
  const beforeWrap=(m.minutes-m.wrapMinutes)*60000,elapsed=elapsedMs(m,now);
  if(elapsed>=beforeWrap||elapsed<(m.currentAgenda+1)*beforeWrap/m.agenda.length)return null;
  return {index:m.currentAgenda,text:`We’ve reached the time reserved for ${m.agenda[m.currentAgenda]}. Are we ready to move on, or should we adjust the plan?`};
}
export function markdown(m){
  const clean=s=>String(s??'').replaceAll('\r','').replaceAll('\u0000','');
  return [`# ${clean(m.title)}`,'',`Mode: ${m.kind==='walkthrough'?'SCRIPTED WALKTHROUGH — not a live meeting':m.kind==='teams'?(m.review?'Teams transcript — retrospective proposal review; no live moderation':'Teams transcript — no moderation performed'):'Live meeting'}`,`Started: ${m.startedAt||'Not started'}`,m.review?`Retrospective review: ${m.review.at}; ${m.review.turnCount} finalized turns; ${m.review.stale?'context has changed since review':'host confirmation required'}.`:'',m.kind==='teams'?`Teams result: ${m.source.state}; transcription: ${m.source.transcriptionState}. Times describe the job window, including lobby time; individual speech times were not recorded.`:'',m.demoClockUsed?'Demo clock was advanced; elapsed presentation time is compressed.':'','## Confirmed outcomes','',...m.outcomes.filter(o=>o.status==='confirmed').map(o=>`- **${o.type}**: ${clean(o.text)}${o.owner?` — ${clean(o.owner)}`:''}${o.dueDate?`, due ${clean(o.dueDate)}`:''} (explicitly confirmed by ${clean(o.confirmation?.actor)}; evidence ${o.evidence.map(e=>e.turnId).join(', ')})`),'','## Unresolved / proposed','',...m.outcomes.filter(o=>o.status!=='confirmed').map(o=>`- [${o.status}] ${clean(o.text)} — owner: ${clean(o.owner||'unresolved')}; date: ${clean(o.dueDate||'unresolved')}`),'','## Transcript','',...m.turns.map(t=>`- [${t.id} r${t.revision}] ${clean(m.speakerNames[`turn:${t.id}`]||m.speakerNames[t.speaker]||t.speaker||'Unknown speaker')}: ${clean(t.text)}`),''].join('\n');
}
