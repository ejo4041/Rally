import { api, type RecordView } from './api.ts';
import type { LiveEvent } from '../../rally-api/src/contracts.ts';
import type { LiveCheck } from '../../rally-api/src/realtime.ts';
import { ReadAlong } from './readalong.ts';
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
type Extension={id:string;minutes:number;state:string;reason?:string;deadline:number};
export class RallyDisplay {
 private meeting:RecordView|null=null;
 private reading=new ReadAlong();
 private history:LiveCheck[]=[];
 private lastAccepted:LiveCheck|null=null;
 private cursor:number|null=null;
 private loading=false;
 private generation=0;
 private historyKey='';
 private extensionKey='';
 private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 constructor(private refresh:()=>Promise<void>,private fail:(error:unknown)=>void) {
  el<HTMLDetailsElement>('rally-history').addEventListener('toggle',()=>{if(el<HTMLDetailsElement>('rally-history').open)void this.loadHistory();});
  el('rally-history-more').onclick=()=>void this.loadHistory(true);
  setInterval(()=>{if(this.meeting){this.freshness();this.words();}},250);
 }
 clear(){this.meeting=null;this.reading.clear();this.history=[];this.lastAccepted=null;this.cursor=null;this.generation++;this.loading=false;this.historyKey='';this.extensionKey='';el('rally-history-items').replaceChildren();el('rally-history-status').textContent='';el<HTMLDetailsElement>('rally-history').open=false;}
 render(meeting:RecordView) {
  if(this.meeting?.id!==meeting.id)this.clear();
  this.meeting=meeting;
  if(meeting.monitor?.status==='accepted'&&(!this.lastAccepted||meeting.monitor.sequence>=this.lastAccepted.sequence))this.lastAccepted=meeting.monitor;
  const speech=meeting.speechStatus;
  if(speech?.id&&speech.text)this.reading.restore(speech.id,speech.text);
  if(speech && ['completed','canceled','failed'].includes(speech.state))this.reading.finish(speech.id,speech.state);
  this.freshness();this.words();this.extension();
  const check=meeting.monitor,key=check?`${check.sequence}:${check.status}`:'';
  if(key!==this.historyKey){this.historyKey=key;if(el<HTMLDetailsElement>('rally-history').open)void this.loadHistory();}
 }
 event(event:LiveEvent) {
  if(event.type==='speech.status') {
   const s=event.data as RecordView['speechStatus'];if(!s||s.epoch<(this.meeting?.epoch??0))return;
   const current=this.meeting?.speechStatus;if(current&&(current.id!==s.id||(['completed','canceled','failed'].includes(current.state)&&['preparing','playing'].includes(s.state))))return;
   if(s.state==='preparing'&&s.text)this.reading.prepare(s.id,s.text);
   if(s.destination==='teams'&&s.state==='playing'&&s.progressSource==='local-playout'&&typeof s.playedMs==='number')this.reading.clock(s.id,s.playedMs,true);
   if(['completed','canceled','failed'].includes(s.state))this.reading.finish(s.id,s.state);
   this.words();
  }
  if(['moderator.control','meeting.ended','capture.gap'].includes(event.type))this.stop();
 }
 playback(id:string,playedMs:number,running:boolean){this.reading.clock(id,playedMs,running);this.words();}
 stop(){const id=this.reading.view().id;if(id)this.reading.finish(id,'canceled');this.words();}
 private freshness() {
  const m=this.meeting;if(!m)return;
  const c=m.monitor,age=c?Math.max(0,Date.now()-c.capturedAt):Infinity;
  const fresh=c?.status==='accepted'&&age<=20000&&m.phase==='live'&&!m.paused;
  const feeling=fresh?c.decision?.feeling??'neutral':'neutral';
  el('rally-display').dataset.feeling=feeling;
  el('rally-feeling').textContent=m.phase==='ended'?'Finished':m.paused?'Paused':fresh?feeling:c?.status==='checking'?'Checking':c?.status==='waiting'?'Listening':c?'Awaiting fresh check':'Listening';
  if(c){
   const decision=c.decision??this.lastAccepted?.decision;
   el('health').textContent=decision?.health==null?'Unscored':`Health ${decision.health}/5${fresh?'':' · previous'}`;
   el('rally-freshness').textContent=`Check ${c.sequence} · ${c.status} · snapshot ${Math.floor(age/1000)}s ago${c.latencyMs!=null?` · ${(c.latencyMs/1000).toFixed(1)}s assessment`:''}`;
   el('assessment-note').textContent=c.decision?.observation||c.reason||(c.status==='checking'&&decision?.observation?`Previous observation: ${decision.observation}`:'')||(c.status==='checking'?'Reading the latest conversation.':c.status==='waiting'?'Waiting for conversation.':'No new assessment to show.');
  }else{
   el('rally-freshness').textContent=m.assessmentAt?`Last assessment ${Math.max(0,Math.floor((Date.now()-m.assessmentAt)/1000))}s ago`:'Waiting for the first assessment';
  }
 }
 private words() {
  if(!this.meeting)return;
  const v=this.reading.view();
  if(!v.id||!v.text){el('readalong-note').hidden=true;return;}
  const animated=v.animated&&!this.reduced.matches;
  const target=el('guidance');
  if(animated){
   const words=v.text.trim().split(/\s+/);
   const html=words.map((word,index)=>`<span class="read-word${index<v.spokenWords?' spoken':''}">${escape(word)}</span>`).join(' ');
   if(target.innerHTML!==html)target.innerHTML=html;
  }else if(target.childElementCount||target.textContent!==v.text)target.textContent=v.text;
  el('readalong-note').hidden=!animated;
  el('readalong-note').textContent=v.terminal?'Playback finished · approximate read-along':'Approximate read-along';
 }
 private extension() {
  const proposal=(this.meeting as RecordView & {extension?:Extension})?.extension;
  const key=proposal?`${proposal.id}:${proposal.state}`:'';if(key===this.extensionKey)return;this.extensionKey=key;
  const box=el('rally-extension');box.hidden=proposal?.state!=='pending';if(!proposal||proposal.state!=='pending'){box.replaceChildren();return;}
  box.innerHTML=`<p><strong>Extend by ${escape(proposal.minutes)} minutes?</strong><br>${escape(proposal.reason)}</p><div class="actions"><button type="button" data-confirm="true" class="secondary">Confirm extra time</button><button type="button" data-confirm="false" class="text">Keep current end time</button></div>`;
  for(const button of box.querySelectorAll<HTMLButtonElement>('button'))button.onclick=()=>{
   const id=this.meeting!.id,generation=this.generation;for(const b of box.querySelectorAll<HTMLButtonElement>('button'))b.disabled=true;
   void api(`/meetings/${id}/extension`,'POST',{proposalId:proposal.id,accept:button.dataset.confirm==='true'}).then(()=>generation===this.generation?this.refresh():undefined).catch(this.fail).finally(()=>{if(generation===this.generation)for(const b of box.querySelectorAll<HTMLButtonElement>('button'))b.disabled=false;});
  };
 }
 private async loadHistory(append=false) {
  if(!this.meeting||this.loading||(append&&this.cursor===null))return;
  this.loading=true;const id=this.meeting.id,generation=this.generation;
  el('rally-history-status').textContent='Loading checks…';
  try{
   const page=await api<{items:LiveCheck[];nextCursor:number|null}>(`/meetings/${id}/checks${append?`?before=${this.cursor}`:''}`);
   if(generation!==this.generation)return;
   const combined=new Map((append?this.history:[]).map(c=>[c.id,c]));for(const c of page.items)combined.set(c.id,c);
   this.history=[...combined.values()].sort((a,b)=>b.sequence-a.sequence);this.cursor=page.nextCursor;
   const revisions=this.meeting.revisions||[];
   el('rally-history-items').innerHTML=this.history.map(c=>`<article class="rally-check"><header><span>Check ${c.sequence} · ${escape(c.status)}</span><time>${escape(new Date(c.capturedAt).toLocaleTimeString())}</time></header><p>${escape(c.decision?.observation||c.reason||'No action taken.')}</p><p class="small muted">${c.decision?.health==null?'Unscored':`Health ${c.decision.health}/5`} · ${c.decision?.intervention?'Intervention considered':'No spoken intervention'}${c.latencyMs!=null?` · ${(c.latencyMs/1000).toFixed(1)}s`:''}</p></article>`).join('')+revisions.map(r=>`<article class="rally-check rally-agenda-change"><header><span>Agenda change</span><time>${escape(new Date(r.at).toLocaleTimeString())}</time></header><p>${escape(r.reason)}</p></article>`).join('');
   el('rally-history-status').textContent=this.history.length?'Only concise observations are retained; no internal model reasoning.':'No checks recorded yet.';
   el('rally-history-more').hidden=this.cursor===null;
  }catch(error){if(generation===this.generation)el('rally-history-status').textContent=error instanceof Error?error.message:'Check history unavailable.';}
  finally{if(generation===this.generation)this.loading=false;}
 }
}
