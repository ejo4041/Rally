import { HttpError } from './auth.ts';
import type { Meeting } from './contracts.ts';
export interface CallAudio {
 alive():boolean;
 receive(audio:(bytes:Uint8Array)=>void,gap:(reason:string)=>void):()=>void;
 play(chunks:AsyncIterable<Buffer>,signal:AbortSignal,beforeAudio:()=>void):Promise<void>;
 close():Promise<void>;
}
export type TeamsConnector = (url:string,signal:AbortSignal,onState:(state:string)=>void)=>Promise<CallAudio>;
type Hooks={current(id:string):Meeting;save(m:Meeting):void;start(m:Meeting):Promise<unknown>;end(m:Meeting):Promise<unknown>;interrupt(m:Meeting):Promise<unknown>;connect:TeamsConnector;renew?(id:string):void};
type Job={starting:boolean;failing:boolean;id:string;state:string;abort:AbortController;call?:CallAudio;task?:Promise<void>;watch?:ReturnType<typeof setInterval>;leaseUntil:number;};
export class TeamsLive {
 private occupied=false;
 private jobs=new Map<string,Job>();private hooks:Hooks;
 constructor(hooks:Hooks){this.hooks=hooks;}
 status(id:string){const j=this.jobs.get(id);return {state:j?.state??'idle',enabled:true};}
 private update(j:Job,state:string){if(this.jobs.get(j.id)!==j)return;j.state=state;const m=this.hooks.current(j.id);m.callState=state;this.hooks.save(m);}
 join(m:Meeting,urlText:string,consented:boolean){
  if(!consented)throw new HttpError('Recording consent required');
  if(!['ready','interrupted'].includes(m.phase)||!m.plan)throw new HttpError('Prepare and review the agenda first',409);
  let url:URL;try{url=new URL(urlText);}catch{throw new HttpError('Invalid Teams invite');}
  if(url.protocol!=='https:'||url.hostname!=='teams.microsoft.com'||url.port||url.username||url.password||!/^\/(l\/meetup-join\/|meet\/)\S+/.test(url.pathname))throw new HttpError('Use a work/school Teams invitation');
  if(this.occupied)throw new HttpError('Teams runner busy',409);
  this.occupied=true;
  const j:Job={starting:true,failing:false,id:m.id,state:'joining',abort:new AbortController(),leaseUntil:Date.now()+90000};
  this.jobs.set(m.id,j);this.update(j,'joining');
  j.task=(async()=>{
   try{
    j.call=await this.hooks.connect(url.href,j.abort.signal,state=>{if(!j.abort.signal.aborted)this.update(j,state);});
    j.abort.signal.throwIfAborted();
    const current=this.hooks.current(m.id);current.captureSource='teams';this.hooks.save(current);
    await this.hooks.start(current);
    if(j.abort.signal.aborted){await this.hooks.interrupt(this.hooks.current(m.id));return;}
    this.update(j,'connected');
    j.watch=setInterval(()=>{
     if(j.call?.alive()){j.leaseUntil=Date.now()+90000;this.hooks.renew?.(j.id);}
     else { void this.fail(j); }
    },2000);j.watch.unref();
   }catch{if(!j.abort.signal.aborted)await this.fail(j);}
   finally{if(j.abort.signal.aborted)await j.call?.close();j.starting=false;if(j.abort.signal.aborted)this.occupied=false;}
  })();
  return this.status(m.id);
 }
 private async fail(j:Job){
  if(j.abort.signal.aborted)return;
  j.failing=true;j.abort.abort();clearInterval(j.watch);
  await this.hooks.interrupt(this.hooks.current(j.id)).catch(()=>{});
  await j.call?.close();this.update(j,'failed');j.failing=false;if(!j.starting)this.occupied=false;
 }
 attach(id:string,audio:(bytes:Uint8Array)=>void,gap:(reason:string)=>void){const call=this.jobs.get(id)?.call;if(!call)throw new HttpError('Teams audio unavailable',503);return call.receive(audio,gap);}
 async play(id:string,chunks:AsyncIterable<Buffer>,signal:AbortSignal,beforeAudio:()=>void){const j=this.jobs.get(id);if(!j?.call||j.state!=='connected'||!j.call.alive())throw new HttpError('Teams not connected',409);await j.call.play(chunks,AbortSignal.any([signal,j.abort.signal]),beforeAudio);}
 async stop(id:string){const j=this.jobs.get(id);if(!j)return;j.abort.abort();clearInterval(j.watch);await j.call?.close();if(j.state!=='failed'&&!j.failing)this.update(j,'left');if(!j.starting&&!j.failing)this.occupied=false;}
 async leave(id:string){await this.stop(id);const j=this.jobs.get(id);await j?.task;const m=this.hooks.current(id);if(m.phase==='live')await this.hooks.end(m);return this.status(id);}
 async close(){for(const id of this.jobs.keys())await this.stop(id);await Promise.allSettled([...this.jobs.values()].map(j=>j.task));}
}
