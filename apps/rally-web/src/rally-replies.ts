import type {Meeting} from './api.ts';
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function rallyRepliesHTML(m:Meeting) {
 return (m.interventions??[]).map(item=>{
  const speech=m.speechStatus?.interventionId===item.id?m.speechStatus:null;
  const status=speech?({preparing:'Preparing voice',playing:'Speaking',completed:'Playback complete',canceled:'Canceled or interrupted',failed:'Voice failed · text available'}[speech.state]):'Response text';
  return `<article class="rally-reply" data-rally-response="${escape(item.id)}"><div class="turn-meta"><strong>Rally</strong><span class="rally-reply-status">${escape(status)}${speech?' · '+escape(speech.destination==='teams'?'Teams':'Browser'):''}</span><time datetime="${new Date(item.at).toISOString()}">${new Date(item.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time></div><p>${escape(item.text)}</p></article>`;
 }).join('');
}
