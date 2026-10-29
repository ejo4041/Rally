import {AppError} from './core.js';
// The host previews this text before choosing a recipient in WhatsApp. There
// is no messaging API, phone-number storage or automatic send operation.
export function confirmedFollowup(m){
 if(m.phase!=='ended')throw new AppError('End the meeting before preparing its confirmed follow-up.',409);
 const valid=m.outcomes.filter(o=>['action','decision'].includes(o.type)&&o.status==='confirmed'&&o.confirmation?.source==='host_explicit'&&o.evidence?.length&&o.evidence.every(e=>m.turns.some(t=>t.id===e.turnId&&t.revision===e.revision&&!t.echoRisk))&&(o.type!=='action'||(o.owner&&o.dueDate&&m.participants.includes(o.owner))));
 if(!valid.length)throw new AppError('Confirm at least one outcome with current transcript evidence first.',409);
 const clean=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
 const lines=[`Rally follow-up: ${clean(m.title)}`,'','Confirmed by the meeting host:',...valid.map(o=>`• ${o.type==='action'?'Action':'Decision'}: ${clean(o.text)}${o.type==='action'?` — ${clean(o.owner)}, due ${clean(o.dueDate)}`:''}`),'','Only confirmed outcomes are included.'];
 const text=lines.join('\n');if(text.length>6000)throw new AppError('This follow-up is too long for the sharing draft. Use the meeting export instead.',409);
 return{text,confirmedCount:valid.length,excludedCount:m.outcomes.length-valid.length};
}
