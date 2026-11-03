import {APIError,type RecordView} from './api-types.ts';
import {DemoSimulator} from './demo-simulator.ts';
export * from './api-types.ts';
export const simulator=new DemoSimulator();
const clone=<T>(value:T)=>structuredClone(value);
const shares=new Map<string,{id:string;username:string}[]>();
const wait=()=>new Promise(resolve=>setTimeout(resolve,220));
export async function api<T>(path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<T>{
 if(signal?.aborted)throw new DOMException('Canceled','AbortError');
 const b=(body||{}) as Record<string,unknown>;let result:unknown;
 if(path==='/auth/me')result={id:'demo-user',username:'Demo workspace',role:'user'};
 else if(path==='/auth/logout')result={};
 else if(path==='/shared-reports'||path==='/usage')result=[];
 else if(path==='/speech/status')result={enabled:false,ready:false,transport:'demo'};
 else if(path==='/teams/status')result={enabled:false,online:false,busy:false,uncertain:false,job:null};
 else if(path==='/meetings'&&method==='GET')result=[...simulator.records.values()].reverse();
 else if(path==='/meetings'&&method==='POST'){await wait();result=simulator.create(b);}
 else {
  const match=path.match(/^\/meetings\/([^/]+)(.*)$/);const m=match&&simulator.records.get(match[1]);if(!m)throw new APIError('This action is unavailable in the simulated workspace.',404);const tail=match![2];
  if(!tail&&method==='GET')result=m;
  else if(!tail&&method==='DELETE'){simulator.records.delete(m.id);result={};}
  else if(tail==='/prepare'){await wait();m.plan=simulator.plan(m);m.phase='ready';result=m;}
  else if(tail==='/start'){simulator.start(m,b.greetingEnabled===true);result=m;}
  else if(tail==='/end'){simulator.end(m);result=m;}
  else if(tail==='/plan'){m.plan=b as RecordView['plan'];result=m;}
  else if(tail==='/speakers'){if(b.name)m.speakerNames[String(b.speakerId)]=String(b.name);else delete m.speakerNames[String(b.speakerId)];m.reportStale=m.reportStatus==='ready';result=m;}
  else if(tail==='/moderation'){m.moderationMode=b.mode as RecordView['moderationMode'];result=m;}
  else if(tail==='/sharing')result={enabled:false};
  else if(tail==='/commands'){
   if(b.type==='pause'){m.paused=true;simulator.dismiss(m);}if(b.type==='resume')m.paused=false;
   if(b.type==='request_guidance'&&!m.paused)simulator.requestGuidance(m);if(b.type==='dismiss')simulator.dismiss(m);
   if(b.type==='voice_on'||b.type==='voice_off')m.speechEnabled=b.type==='voice_on';result=m;
  }
  else if(tail==='/report/retry'){m.report=simulator.report(m);m.reportStatus='ready';m.reportStale=false;result=m;}
  else if(tail==='/report'&&method==='PATCH'){m.reportNotes??=[];m.reportNotes.push({at:Date.now(),text:String(b.note)});result=m;}
  else if(tail.startsWith('/checks'))result={items:[],nextCursor:null};
  else if(tail==='/report-shares'&&method==='GET')result=shares.get(m.id)||[];
  else if(tail==='/report-shares'&&method==='POST'){const rows=shares.get(m.id)||[];rows.push({id:crypto.randomUUID(),username:String(b.username)});shares.set(m.id,rows);result={};}
  else if(tail.startsWith('/report-shares/')&&method==='DELETE'){shares.set(m.id,(shares.get(m.id)||[]).filter(r=>r.id!==tail.split('/').at(-1)));result={};}
  else throw new APIError('This action is unavailable in the simulated workspace.',400);
 }
 return clone(result) as T;
}
