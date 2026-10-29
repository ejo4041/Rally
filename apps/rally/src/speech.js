import {AppError} from './core.js';
import {modelConfig} from './models.js';
export const MMS_MODEL='facebook/mms-tts-eng';
export const MMS_REVISION='c71de0fe7204c83f1c10820a7d696d0b450048ba';
const TEST_TEXT='Hello, I am Rally. Let us confirm our decisions, owners, and deadlines.';
const publicJob=row=>row&&({id:row.id,state:row.state,deadline:row.deadline});
async function bridge(request,env){
 if(!env.RALLY_TEAMS_BRIDGE_SECRET)throw new AppError('The speech bridge is not configured.',503);
 const digest=async text=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
 const [a,b]=await Promise.all([digest(env.RALLY_TEAMS_BRIDGE_SECRET),digest(request.headers.get('X-Rally-Bridge')||'')]);
 let different=0;for(let i=0;i<a.length;i++)different|=a[i]^b[i];
 if(different)throw new AppError('Runner authentication required.',403);
}
async function validMeeting(db,row){
 if(!row.meeting_id)return true;
 const found=await db.prepare('SELECT payload FROM meetings WHERE id=?').bind(row.meeting_id).first();
 if(!found)return false;const m=JSON.parse(found.payload);
 return ['live','wrapping'].includes(m.phase)&&!m.paused&&m.epoch===row.epoch&&m.interventions.some(u=>u.id===row.utterance_id&&u.epoch===row.epoch&&!['canceled','completed','failed','shown'].includes(u.state));
}
function wave(pcm){
 const bytes=new Uint8Array(44+pcm.length),view=new DataView(bytes.buffer),write=(offset,text)=>{for(let i=0;i<text.length;i++)bytes[offset+i]=text.charCodeAt(i);};
 write(0,'RIFF');view.setUint32(4,36+pcm.length,true);write(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,pcm.length,true);bytes.set(pcm,44);return bytes.buffer;
}
export async function speechApi(request,env,data={},now=Date.now()){
 const path=new URL(request.url).pathname,db=env.DB,speech=modelConfig(env).speech;
 if(env.RALLY_MMS_ENABLED!=='1'){
  if(path==='/api/speech/status'&&request.method==='GET')return{online:false,model:speech.model};
  throw new AppError('Meta MMS voice is disabled. The prompt remains visible.',503);
 }
 await db.prepare("DELETE FROM speech_jobs WHERE deadline<?").bind(now).run();
 const active=await db.prepare('SELECT * FROM speech_jobs WHERE slot=1').first();
 if(active&&!await validMeeting(db,active))await db.prepare("UPDATE speech_jobs SET state='canceled',slot=NULL,text='',audio=NULL WHERE id=?").bind(active.id).run();
 const runner=await db.prepare('SELECT * FROM speech_runner WHERE id=1').first();
 const online=!!runner&&runner.heartbeat>=now-30000&&runner.revision===speech.revision;
 if(path==='/api/speech/status'&&request.method==='GET')return{online,model:speech.model,revision:speech.revision};
 if(path==='/api/speech/create'&&request.method==='POST'){
  if(!online)throw new AppError('The Meta MMS voice server is offline. The prompt remains visible.',503);
  if(Object.hasOwn(data,'text'))throw new AppError('Speech text must come from an approved moderator utterance.');
  let text=TEST_TEXT,meetingId=null,utteranceId=crypto.randomUUID(),epoch=0;
  if(data.test!==true){
   const found=await db.prepare('SELECT payload FROM meetings WHERE id=?').bind(String(data.meetingId||'')).first();
   if(!found)throw new AppError('Meeting not found.',404);const m=JSON.parse(found.payload);
   const u=m.interventions.find(u=>u.id===data.utteranceId&&u.epoch===data.epoch);
   if(!u||!['live','wrapping'].includes(m.phase)||m.paused||m.epoch!==data.epoch||['canceled','completed','failed','shown'].includes(u.state))throw new AppError('This moderator utterance is no longer current.',409);
   text=u.text;meetingId=m.id;utteranceId=u.id;epoch=m.epoch;
   const existing=await db.prepare('SELECT * FROM speech_jobs WHERE meeting_id=? AND utterance_id=? AND epoch=?').bind(meetingId,utteranceId,epoch).first();
   if(existing){if(!['queued','generating','ready'].includes(existing.state))throw new AppError('This voice request has ended.',409);return{job:publicJob(existing)};}
  }
  if(typeof text!=='string'||!text.trim()||text.length>650)throw new AppError('Moderator text exceeds the voice limit.');
  const row=await db.prepare("INSERT OR IGNORE INTO speech_jobs(id,slot,meeting_id,utterance_id,epoch,text,state,created_at,deadline) VALUES(?,1,?,?,?,?,'queued',?,?) RETURNING *").bind(crypto.randomUUID(),meetingId,utteranceId,epoch,text,now,now+60000).first();
  if(!row)throw new AppError('The voice server is busy. The prompt remains visible.',409);return{job:publicJob(row)};
 }
 if(path==='/api/speech/cancel'&&request.method==='POST'){
  await db.prepare("UPDATE speech_jobs SET state='canceled',slot=NULL,text='',audio=NULL WHERE id=?").bind(String(data.id||'')).run();return{ok:true};
 }
 const match=path.match(/^\/api\/speech\/(jobs|audio)\/([a-zA-Z0-9-]+)$/);
 if(match&&request.method==='GET'){
  const row=await db.prepare('SELECT * FROM speech_jobs WHERE id=?').bind(match[2]).first();
  if(!row)throw new AppError('Voice request expired.',404);
  if(!await validMeeting(db,row)){await db.prepare("UPDATE speech_jobs SET state='canceled',slot=NULL,text='',audio=NULL WHERE id=?").bind(row.id).run();throw new AppError('Moderator output was canceled.',409);}
  if(match[1]==='jobs')return{job:publicJob(row)};
  if(row.state!=='ready'||!row.audio)throw new AppError('Voice audio is not ready.',409);
  return new Response(new Uint8Array(row.audio),{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(!path.startsWith('/api/speech/runner/'))throw new AppError('Unknown voice operation.',404);
 await bridge(request,env);if(request.method!=='POST')throw new AppError('POST required.',405);
 const runnerId=String(data.runnerId||'');if(!/^[a-zA-Z0-9-]{8,80}$/.test(runnerId))throw new AppError('Invalid voice runner identity.');
 if(path==='/api/speech/runner/poll'){
  if(data.revision!==speech.revision||(data.model||MMS_MODEL)!==speech.model)throw new AppError('Load the pinned Meta MMS checkpoint before polling.',409);
  const heartbeat=await db.prepare('INSERT INTO speech_runner(id,runner_id,heartbeat,revision) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET runner_id=excluded.runner_id,heartbeat=excluded.heartbeat,revision=excluded.revision WHERE speech_runner.runner_id=excluded.runner_id OR speech_runner.heartbeat<? RETURNING id').bind(runnerId,now,speech.revision,now-30000).first();
  if(!heartbeat)throw new AppError('Another voice runner is online.',409);
  if(data.currentId){const current=await db.prepare('SELECT * FROM speech_jobs WHERE id=? AND runner_id=?').bind(data.currentId,runnerId).first();return{job:publicJob(current)};}
  const row=await db.prepare("UPDATE speech_jobs SET state='generating',runner_id=? WHERE id=(SELECT id FROM speech_jobs WHERE slot=1 AND state='queued') AND state='queued' RETURNING *").bind(runnerId).first();
  return{job:row?{...publicJob(row),text:row.text}:null};
 }
 const row=await db.prepare('SELECT * FROM speech_jobs WHERE id=? AND runner_id=?').bind(String(data.id||''),runnerId).first();
 if(!row||row.state!=='generating'||!await validMeeting(db,row))throw new AppError('Voice output was canceled or expired.',409);
 if(path==='/api/speech/runner/finish'){
  const encoded=data.pcmBase64;if(data.sampleRate!==16000||typeof encoded!=='string'||!encoded.length||encoded.length>1280000||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new AppError('Invalid MMS audio.');
  let raw;try{raw=atob(encoded);}catch{throw new AppError('Invalid MMS audio.');}
  if(!raw.length||raw.length%2||raw.length>960000)throw new AppError('Invalid MMS audio.');
  const audio=wave(Uint8Array.from(raw,c=>c.charCodeAt(0)));
  await db.prepare("UPDATE speech_jobs SET state='ready',text='',audio=? WHERE id=? AND state='generating'").bind(audio,row.id).run();return{ok:true};
 }
 if(path==='/api/speech/runner/fail'){
  await db.prepare("UPDATE speech_jobs SET state='failed',slot=NULL,text='',audio=NULL WHERE id=?").bind(row.id).run();return{ok:true};
 }
 throw new AppError('Unknown voice runner operation.',404);
}
