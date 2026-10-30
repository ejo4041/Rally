import {api,APIError,type Meeting} from './api.ts';
import type {SharedReport} from '../../rally-api/src/report-sharing.ts';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const words=(s:string)=>s.replaceAll('_',' ');
export function setupReportSharing(current:()=>Meeting|undefined,fail:(e:unknown)=>void) {
 let generation=0,ownerId='';
 async function recipients() {
  const id=ownerId,epoch=generation,rows=await api<{id:string;username:string}[]>(`/meetings/${id}/report-shares`);
  if(epoch!==generation||ownerId!==id)return;
  $('report-recipient-list').innerHTML=rows.map(r=>`<div class="history-row"><strong>${esc(r.username)}</strong><button class="secondary" data-revoke-report="${esc(r.id)}">Revoke access</button></div>`).join('')||'<p>No recipients yet.</p>';
 }
 $('share-report').onclick=()=>{const m=current();if(!m)return;ownerId=m.id;$('report-share-status').textContent='';$<HTMLDialogElement>('report-sharing-dialog').showModal();return recipients().catch(fail);};
 $('report-share-form').onsubmit=async e=>{
  e.preventDefault();const id=ownerId,username=$<HTMLInputElement>('report-recipient').value;
  try{await api(`/meetings/${id}/report-shares`,'POST',{username});$<HTMLFormElement>('report-share-form').reset();$('report-share-status').textContent='Access granted. The recipient can find it under Shared with you.';await recipients();}catch(e){$('report-share-status').textContent=e instanceof Error?e.message:'Sharing failed';}
 };
 $('report-recipient-list').onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-revoke-report]');if(!b)return;return api(`/meetings/${ownerId}/report-shares/${b.dataset.revokeReport}`,'DELETE').then(recipients).catch(fail);};
 $('export-pdf').onclick=()=>{
  const m=current();if(!m)return;const b=$<HTMLButtonElement>('export-pdf');b.disabled=true;
  return (async()=>{const r=await fetch(`/api/meetings/${m.id}/report.pdf`,{credentials:'include'});if(!r.ok){const body=await r.json();throw new APIError(body.error??'PDF export failed',r.status);}const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=`rally-report-${m.id}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);})().catch(fail).finally(()=>{b.disabled=false;b.textContent='Export PDF';});
 };
 $('shared-reports').onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-shared-report]');if(!b)return;const epoch=generation;return api<SharedReport>(`/shared-reports/${b.dataset.sharedReport}`).then(view=>{
  if(epoch!==generation)return;
  $('shared-report-title').textContent=view.title;$<HTMLAnchorElement>('shared-report-pdf').href=`/api/shared-reports/${view.id}/pdf`;
  const r=view.report;
  const outcomes=(title:string,rows:typeof r.actions)=>`<h3>${title}</h3>${rows.map(x=>`<section class="report-item"><p>${esc(x.text)}</p><p class="small muted">${esc(words(x.status))} · Owner: ${esc(x.owner??'Unassigned')} · Due: ${esc(x.dueDate??'Unspecified')}</p></section>`).join('')||'<p>None recorded.</p>'}`;
  $('shared-report-body').innerHTML=`<p class="small muted">Read-only shared report and cited excerpts. AI interpretations, not independently verified agreement.</p><p>${esc(r.summary)}</p><h3>Overall ${r.overall??'Unscored'} · ${r.coverage}/5 categories assessed</h3>${r.scores.map(s=>`<p><strong>${esc(words(s.category))}: ${s.score??'Unknown'}</strong> · ${esc(s.reason)}</p>`).join('')}${outcomes('Decisions',r.decisions)}${outcomes('Due-outs',r.actions)}<h3>Unresolved</h3><ul>${r.unresolved.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>None identified.</li>'}</ul><h3>Speaker notes</h3>${r.speakerTips.map(s=>`<p><strong>${esc(view.speakerNames[s.speakerId]??s.speakerId)}</strong></p>${s.tips.map(t=>`<p>${esc(t.text)}</p>`).join('')}`).join('')||'<p>None.</p>'}<h3>Host annotations</h3>${view.reportNotes.map(n=>`<p>${esc(n.text)}</p>`).join('')||'<p>None.</p>'}<details><summary>Cited transcript excerpts</summary>${view.sources.map(t=>`<article class="turn"><strong>${esc(view.speakerNames[t.speaker??'']??'Unknown speaker')}</strong><p>${esc(t.text)}${t.excerptTruncated?' [Excerpt shortened]':''}</p></article>`).join('')}${view.sourcesOmitted?'<p>Additional cited sources omitted from this bounded view.</p>':''}</details>`;
  $<HTMLDialogElement>('shared-report-dialog').showModal();
 }).catch(fail);};
 return {
  async refresh(){const epoch=generation,rows=await api<{id:string;title:string;owner:string;available:boolean}[]>('/shared-reports');if(epoch!==generation)return;$('shared-reports').innerHTML=rows.map(r=>`<button class="history-row" data-shared-report="${esc(r.id)}" ${r.available?'':'disabled'}><span><strong>${esc(r.title)}</strong><small>Shared by ${esc(r.owner)}${r.available?'':' · Owner is updating the report'}</small></span></button>`).join('')||'<p class="small muted">No reports shared with you yet.</p>';},
  render(m:Meeting){const available=m.phase==='ended'&&m.reportStatus==='ready'&&!!m.report&&!m.reportStale;for(const id of ['share-report','export-pdf'])$<HTMLButtonElement>(id).disabled=!available;},
  clear(){generation++;ownerId='';$<HTMLFormElement>('report-share-form').reset();for(const id of ['shared-reports','shared-report-body','shared-report-title','report-recipient-list','report-share-status'])$(id).textContent='';$<HTMLAnchorElement>('shared-report-pdf').removeAttribute('href');}
 };
}
