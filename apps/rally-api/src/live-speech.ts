import { randomUUID } from 'node:crypto';
import type { Meeting } from './contracts.ts';
import { interventionSpeech } from './seamless.ts';
export type SpeechOffer = { id: string; text: string; epoch: number; at: number; checkId?:string; snapshotAt?:number; speakBy?:number; evidenceValid?:()=>boolean };
export type SpeechState = {
  id: string; interventionId: string; epoch: number; at: number;
  state: 'preparing'|'playing'|'completed'|'canceled'|'failed';
  destination: 'browser'|'teams'; error?: string; text?:string; checkId?:string; snapshotAt?:number; startedAt?:number; completedAt?:number; playedMs?:number; progressSource?:'local-playout'|'unavailable'; evidenceSuperseded?:boolean;
};
type Job = { offer: SpeechOffer; state: SpeechState; abort: AbortController; shieldUntil: number; task?: Promise<void> };
export type SpeechHooks = {
 current(id: string): Meeting;
 stream(text: string, signal: AbortSignal, meetingId: string): AsyncIterable<Buffer>;
 play(meetingId: string, job: SpeechState, chunks: AsyncIterable<Buffer>, signal: AbortSignal, beforeAudio: () => void, onProgress?:(playedMs:number)=>void): Promise<void>;
 event(meetingId: string, state: SpeechState): void;
 shield(meetingId: string, window: {id:string;start:number;end:number}): void;
};
// One approved utterance per meeting. Provider bytes never authorize playback.
export class LiveSpeech {
 private jobs = new Map<string,Job>();
 private hooks: SpeechHooks;
 constructor(hooks: SpeechHooks) { this.hooks=hooks; }
 status(id:string) { const state=this.jobs.get(id)?.state;return state ? {...state} : null; }
 private valid(id:string, job:Job) {
  const m=this.hooks.current(id);
  return this.jobs.get(id)===job && !job.abort.signal.aborted && m.phase==='live' && !m.paused && m.epoch===job.offer.epoch && (job.state.startedAt!==undefined || (m.interventions.some(item=>item.id===job.offer.id) && Date.now()<=(job.offer.speakBy??job.offer.at+30000) && (job.offer.evidenceValid?.()??true)));
 }
 isActive(id:string) {return ['preparing','playing'].includes(this.jobs.get(id)?.state.state??'');}
 invalidateEvidence(id:string) {const job=this.jobs.get(id);if(!job)return;if(job.state.startedAt===undefined)this.cancel(id);else {job.state.evidenceSuperseded=true;this.hooks.event(id,{...job.state});}}
 private update(id:string,job:Job,state:SpeechState['state'],error?:string) {
  job.state={...job.state,state,at:Date.now(),...(error ? {error}: {})};this.hooks.event(id,{...job.state});
 }
 offer(id:string, offer:SpeechOffer) {
  if(this.jobs.get(id)?.offer.id===offer.id) return;
  if(this.isActive(id))return;
  const m=this.hooks.current(id);
  const job:Job={offer,abort:new AbortController(),shieldUntil:0,state:{id:randomUUID(),interventionId:offer.id,epoch:offer.epoch,at:Date.now(),state:'preparing',text:interventionSpeech(offer.text),checkId:offer.checkId,snapshotAt:offer.snapshotAt,progressSource:'unavailable',destination:m.captureSource==='teams'?'teams':'browser'}};
  this.jobs.set(id,job);
  if (!this.valid(id,job) || Date.now()-offer.at>30000) {this.cancel(id);return;}
  this.update(id,job,'preparing');
  job.task=this.run(id,job);
 }
 private async run(id:string,job:Job) {
  const timeout=setTimeout(()=>job.abort.abort(),40000);
  const firstAudioDeadline=setTimeout(()=>{if(job.state.startedAt===undefined && this.jobs.get(id)===job)this.cancel(id);},Math.max(0,(job.offer.speakBy??job.offer.at+30000)-Date.now()));
  try {
   const source=this.hooks.stream(interventionSpeech(job.offer.text),job.abort.signal,id);
   const self=this;
   async function* bounded() {
    let bytes=0;
    for await(const chunk of source) {
     if(!self.valid(id,job)) throw new Error('Speech no longer current');
     bytes+=chunk.length;if(bytes>960000)throw new Error('Speech exceeds 30 seconds');
     yield chunk;
    }
   }
   await this.hooks.play(id,job.state,bounded(),job.abort.signal,()=>{
    if(!this.valid(id,job))throw new Error('Speech no longer current');
    if(job.state.startedAt!==undefined)return;
    const start=Date.now();job.state.startedAt=start;job.shieldUntil=start+42000;
    this.hooks.shield(id,{id:job.state.id,start,end:job.shieldUntil});
    this.update(id,job,'playing');
   },playedMs=>{if(!this.valid(id,job)||job.state.state!=='playing'||!Number.isFinite(playedMs)||playedMs<0)return;job.state.playedMs=Math.max(job.state.playedMs??0,playedMs);job.state.progressSource='local-playout';this.hooks.event(id,{...job.state});});
   if(this.valid(id,job)){job.state.completedAt=Date.now();this.update(id,job,'completed');}
  } catch {
   if(this.jobs.get(id)===job && job.state.state!=='canceled')this.update(id,job,'failed','Voice unavailable. The prompt remains visible.');
  } finally {
   clearTimeout(timeout);clearTimeout(firstAudioDeadline);job.abort.abort();job.shieldUntil=Math.min(job.shieldUntil,Date.now()+800);
  }
 }
 shielded(id:string) {return (this.jobs.get(id)?.shieldUntil??0)>Date.now();}
 cancel(id:string) {
  const job=this.jobs.get(id);if(!job)return;
  job.abort.abort();job.shieldUntil=Math.min(job.shieldUntil,Date.now()+800);
  if(['preparing','playing'].includes(job.state.state))this.update(id,job,'canceled');
 }
 forget(id:string) {this.cancel(id);this.jobs.delete(id);}
 async close() {const jobs=[...this.jobs.entries()];for(const [id]of jobs)this.cancel(id);await Promise.allSettled(jobs.map(([,j])=>j.task));this.jobs.clear();}
}
