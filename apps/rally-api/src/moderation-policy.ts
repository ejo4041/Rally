import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Meeting } from './contracts.ts';
export const moderationModeSchema=z.enum(['passive','balanced','proactive']);
export type ModerationMode=z.infer<typeof moderationModeSchema>;
export type AddressedRequest={id:string;text:string;key:string};
// A conservative vocative/question detector, not a general command executor.
// Raleigh is accepted only in the direct-address position (common ASR spelling).
export function addressedRequest(finals:{id:string;text:string;prefixLength?:number}[],partials:{id:string;text:string;prefixLength?:number}[]):AddressedRequest|null {
 const sources=[...finals.slice(-5).map(s=>({...s,finalized:true})),...partials.map(s=>({...s,finalized:false}))];
 for(const source of sources.reverse()) {
  const text=source.text,pattern=/\b(?:(?:hey|hi|hello|okay|ok)\s+)?(?:rally|raleigh)[,!.?\s]+(?:how|what|why|when|where|who|are|can|could|would|will|do|did|have|please|summari[sz]e|recap|tell|remind|explain|help|give|show|answer|listen)\b/gi;
  let match:RegExpExecArray|null,last:AddressedRequest|null=null;
  while((match=pattern.exec(text))) {
   const before=text.slice(0,match.index).trimEnd();
   if(before && !/[.!?,;:]$/.test(before))continue;
   const tail=text.slice(match.index),sentenceEnd=tail.slice(match[0].length).search(/[.!?](?:\s|$)/);
   const request=(sentenceEnd<0?tail:tail.slice(0,match[0].length+sentenceEnd+1)).trim().slice(0,1000);
   const offset=Math.max(0,(source.prefixLength??text.length)-text.length)+match.index;
   last={id:source.id,text:request,key:createHash('sha256').update(source.id+':addressed:'+offset).digest('hex')};
  }
  if(last)return last;
  if(source.finalized && /^(?:(?:hey|hi|hello|okay|ok|uh)\s+)?(?:rally|raleigh)[.!?,\s]*$/i.test(text.trim()))return {id:source.id,text:text.trim(),key:createHash('sha256').update(source.id+':addressed:0').digest('hex')};
 }
 return null;
}

export function allowIntervention(m:Meeting,text:string,evidence:string[],request:AddressedRequest|null) {
 const direct=!!request && !(m.addressedRequestsHandled??[]).includes(request.key) && evidence.includes(request.id);
 if(m.paused)return {allowed:false,direct:false};
 if(m.moderationMode==='passive' && !direct)return {allowed:false,direct:false};
 const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const repeated=m.interventions.slice(-4).some(i=>Date.now()-i.at<90000 && normalize(i.text)===normalize(text));
 return {allowed:direct || !repeated,direct};
}
