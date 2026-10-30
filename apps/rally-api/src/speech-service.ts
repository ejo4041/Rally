import { randomUUID } from 'node:crypto';
import type { Store } from './store.ts';
import { HttpError } from './auth.ts';
import { SeamlessSpeech, type SpeechRequest } from './seamless.ts';
export type SpeechMetadata = {model:string;adapter:string;sampleRate:number;channels:number;format:string;revision:null};
export interface TextToSpeech {
 readonly identity: SpeechMetadata;
 stream(input:SpeechRequest,signal:AbortSignal,format?:'pcm'|'wav',onCache?:(cached:boolean|null)=>void):AsyncIterable<Buffer>;
 synthesize(input:SpeechRequest,signal:AbortSignal,onCache?:(cached:boolean|null)=>void):Promise<Buffer>;
}
export class SpeechService {
 private store:Store;private adapter:TextToSpeech;private enabled:boolean;
 constructor(store:Store,adapter:TextToSpeech,enabled:boolean) {
  this.store=store;this.adapter=adapter;this.enabled=enabled;
  store.db.exec("CREATE TABLE IF NOT EXISTS speech_usage(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,meeting_id TEXT,at INTEGER NOT NULL,body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS speech_usage_account_time ON speech_usage(user_id,at); UPDATE speech_usage SET body=json_set(body,'$.state','interrupted') WHERE json_extract(body,'$.state')='pending';");
 }
 status(){return {...this.adapter.identity,enabled:this.enabled,ready:this.enabled,transport:'livekit',billing:'AWS infrastructure; cost not supplied'};}
 usage(userId:string){return (this.store.db.prepare('SELECT body FROM speech_usage WHERE user_id=? ORDER BY at DESC LIMIT 200').all(userId) as {body:string}[]).map(r=>JSON.parse(r.body));}
 private reserve(userId:string,meetingId?:string){
  if(!this.enabled)throw new HttpError('Provider speech is disabled',403);
  const now=Date.now();
  const recent=this.store.db.prepare('SELECT count(*) AS count FROM speech_usage WHERE user_id=? AND at>?').get(userId,now-3600000) as {count:number};
  const global=this.store.db.prepare('SELECT count(*) AS count FROM speech_usage WHERE at>?').get(now-86400000) as {count:number};
  if(recent.count>=60 || global.count>=500)throw new HttpError('Speech request allowance exhausted',429);
  const row={id:randomUUID(),at:now,meetingId:meetingId??null,...this.adapter.identity,state:'pending',bytes:0,seconds:null as number|null,firstByteMs:null as number|null,cached:null as boolean|null,cost:null,billing:'AWS infrastructure; cost unknown'};
  this.store.db.prepare('INSERT INTO speech_usage VALUES(?,?,?,?,?)').run(row.id,userId,meetingId??null,now,JSON.stringify(row));
  return row;
 }
 async *stream(userId:string,input:SpeechRequest,signal:AbortSignal,meetingId?:string):AsyncGenerator<Buffer>{
  signal.throwIfAborted();
  const row=this.reserve(userId,meetingId);
  try {
   for await(const part of this.adapter.stream(input,signal,'pcm',cached=>row.cached=cached)) {
    row.firstByteMs??=Date.now()-row.at;row.bytes+=part.length;yield part;
   }
   row.state='completed';
  } catch(error){row.state=signal.aborted?'canceled':'failed';throw error;}
  finally{if(row.state==='pending')row.state='canceled';row.seconds=row.bytes/32000;this.store.db.prepare('UPDATE speech_usage SET body=? WHERE id=?').run(JSON.stringify(row),row.id);}
 }
 async synthesize(userId:string,input:SpeechRequest,signal:AbortSignal){
  signal.throwIfAborted();
  const row=this.reserve(userId);row.format='wav';
  try{const wav=await this.adapter.synthesize(input,signal,cached=>row.cached=cached);row.bytes=wav.length;row.state='completed';return wav;}
  catch(error){row.state=signal.aborted?'canceled':'failed';throw error;}
  finally{this.store.db.prepare('UPDATE speech_usage SET body=? WHERE id=?').run(JSON.stringify(row),row.id);}
 }
}
export function configuredTTS():TextToSpeech {
 const concurrency=Number(process.env.RALLY_TTS_CONCURRENCY||1);
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw new Error('Invalid speech concurrency');
 return new SeamlessSpeech(process.env.RALLY_TTS_TOKEN||'',undefined,fetch,concurrency);
}
