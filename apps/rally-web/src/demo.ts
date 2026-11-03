import {setupTheme} from './theme.ts';
import {setupMascot} from './mascot.ts';
import {turns,outcomes,visibleTurn,initialReplay,advance,makeExport,type Approach} from './demo-data.ts';
setupTheme(); setupMascot().show();
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let {cursor,playing}=initialReplay(),timer:ReturnType<typeof setTimeout>|undefined,partial='',approach:Approach='balanced';
const labels:Record<string,string>={};
function stop(){clearTimeout(timer);playing=false;$('play').textContent=cursor===turns.length?'Replay sample':'Play sample';}
function stage(name:string){stop();partial='';render();for(const id of ['plan','conversation','report'])$(id).hidden=id!==name;document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(b=>{b.setAttribute('aria-current',String(b.dataset.stage===name));});}
function text(parent:HTMLElement,tag:string,value:string){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
function render(){
 const list=$('transcript');list.replaceChildren();
 turns.slice(0,cursor).forEach((turn,i)=>{
  if(!visibleTurn(i,approach))return;
  const row=document.createElement('article');row.id='turn-'+i;row.className=turn.speaker==='Rally'?'turn rally-turn':'turn';
  text(row,'strong',labels[turn.speaker]||turn.speaker);text(row,'small',` · sample turn ${i+1}${turn.speaker==='Rally'?' · authored Rally reply':''}`);
  text(row,'p',turn.text);
  if(turn.speaker!=='Rally'){
   const btn=text(row,'button','Identify speaker') as HTMLButtonElement;btn.className='identify';btn.onclick=()=>{
    const form=document.createElement('form'),input=document.createElement('input');input.value=labels[turn.speaker]||turn.speaker;input.maxLength=40;input.required=true;input.setAttribute('aria-label','Speaker label');
    const save=document.createElement('button');save.textContent='Save label';save.type='submit';form.append(input,save);btn.replaceWith(form);input.focus();
    form.onsubmit=e=>{e.preventDefault();labels[turn.speaker]=input.value.trim()||turn.speaker;render();};
   };
  }list.append(row);
 });
 if(partial){const row=document.createElement('article');row.className='turn partial';text(row,'strong','Sample partial · not finalized');text(row,'p',partial);list.append(row);}
 $('progress').textContent=`${cursor} of ${turns.length} sample turns finalized${cursor===turns.length?' · replay complete':''}`;
 ($('next') as HTMLButtonElement).disabled=cursor===turns.length;
 $('mode-note').textContent=approach==='passive'?'Passive sample: Rally replies are hidden; transcript and evidence remain available.':approach==='proactive'?'Proactive sample: authored replies are shown with a visual focus cue. No model is deciding when to intervene.':'Balanced sample: authored Rally replies appear at their scripted turns.';
 list.dataset.approach=approach;
}
function tick(){if(!playing)return;if(cursor>=turns.length){stop();return;}const turn=turns[cursor];if(!visibleTurn(cursor,approach)){cursor=advance(cursor);render();timer=setTimeout(tick,150);return;}
 let end=0;const stream=()=>{if(!playing)return;end=Math.min(turn.text.length,end+9);partial=turn.text.slice(0,end);render();if(end<turn.text.length)timer=setTimeout(stream,80);else{partial='';cursor=advance(cursor);render();timer=setTimeout(tick,700);}};stream();}
 document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(b=>b.onclick=()=>stage(b.dataset.stage!));
 $('prepare').onclick=()=>{$('agenda-preview').textContent=$<HTMLTextAreaElement>('agenda').value;$('prepared').hidden=false;};
 $('play').onclick=()=>{if(playing){stop();partial='';render();return;}if(cursor===turns.length)cursor=0;playing=true;$('play').textContent='Pause sample';tick();};
 $('next').onclick=()=>{stop();partial='';cursor=advance(cursor);render();};
 $('reset').onclick=()=>{stop();partial='';cursor=0;render();};
 $('finish').onclick=()=>{partial='';stage('report');};
 $<HTMLSelectElement>('approach').onchange=()=>{stop();partial='';approach=$<HTMLSelectElement>('approach').value as Approach;render();};
 for(const outcome of outcomes){const card=document.createElement('article');card.className='outcome';text(card,'h3',outcome.title);text(card,'p',outcome.text);for(const index of outcome.evidence){const btn=text(card,'button',`View source · turn ${index+1}`) as HTMLButtonElement;btn.onclick=()=>{partial='';cursor=turns.length;stage('conversation');render();const row=$('turn-'+index);row.scrollIntoView({block:'center',behavior:'instant'});row.tabIndex=-1;row.focus();};}$('outcomes').append(card);}
 $('export').onclick=()=>{const blob=new Blob([JSON.stringify(makeExport($<HTMLTextAreaElement>('agenda').value,$<HTMLTextAreaElement>('host-note').value,labels),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rally-synthetic-sample.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('print').onclick=()=>window.print();
 window.addEventListener('pagehide',stop);stage('plan');render();
