import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

export const MODEL='facebook/mms-tts-eng';
export const REVISION='c71de0fe7204c83f1c10820a7d696d0b450048ba';
export function wav(pcm,rate){
 if(!Buffer.isBuffer(pcm)||pcm.length%2||!Number.isInteger(rate)||rate<8000||rate>48000)throw new Error('Invalid mono PCM audio.');
 const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm]);
}

// One local model process, one bounded request. Cancellation terminates model
// work, rather than allowing stale speech to finish and play after an override.
export class MMSSpeech {
 constructor({python,modelDirectory,worker=fileURLToPath(new URL('./worker.py',import.meta.url)),startTimeoutMs=45000,synthesisTimeoutMs=20000,onReady=()=>{}}){
  if(!python||!modelDirectory)throw new Error('Configure the Python environment and pinned model directory.');
  Object.assign(this,{python,modelDirectory,worker,startTimeoutMs,synthesisTimeoutMs,onReady});
 }
 async start(){
  if(this.ready)return this.ready;
  const child=spawn(this.python,[this.worker,'--model-directory',this.modelDirectory],{stdio:['pipe','pipe','ignore'],env:{...process.env,HF_HUB_OFFLINE:'1',TOKENIZERS_PARALLELISM:'false'}});this.child=child;
  this.ready=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{reject(new Error('MMS startup timed out.'));this.close();},this.startTimeoutMs);
   const fail=()=>{clearTimeout(timer);reject(new Error('MMS process stopped.'));if(this.child===child){this.child=null;this.ready=null;this.pending?.reject(new Error('MMS process stopped.'));this.pending=null;}};
   child.once('error',fail);child.once('exit',fail);
   createInterface({input:child.stdout}).on('line',line=>{
    try{
     if(line.length>1400000)throw new Error('MMS response limit exceeded.');
     const message=JSON.parse(line);
     if(message.type==='ready'){
      if(message.model!==MODEL||message.revision!==REVISION)throw new Error('Unexpected MMS model.');
      clearTimeout(timer);this.onReady(message);resolve(message);return;
     }
     if(message.type==='error'&&!message.id){clearTimeout(timer);reject(new Error('MMS model failed to load.'));this.close();return;}
     const pending=this.pending;if(!pending||message.id!==pending.id)return;
     if(message.type==='error')pending.reject(new Error(`MMS speech failed: ${message.code}`));
     else if(message.type==='audio'){
      const pcm=Buffer.from(message.pcmBase64||'','base64');
      if(message.model!==MODEL||message.revision!==REVISION||message.sampleRate!==16000||!Number.isFinite(message.seconds)||!Number.isFinite(message.synthesisMs)||!pcm.length||pcm.length%2||pcm.length>960000||Math.abs(pcm.length/2/message.sampleRate-message.seconds)>.001)throw new Error('Invalid MMS audio.');
      pending.resolve({...message,pcm,wav:wav(pcm,message.sampleRate)});
     }else throw new Error('Unexpected MMS response.');
    }catch(error){this.pending?.reject(error);clearTimeout(timer);reject(error);this.close();}
   });
  });
  return this.ready;
 }
 async synthesize(text,{signal}={}){
  if(typeof text!=='string'||!text.trim()||text.trim().length>650||/[\x00-\x08\x0b-\x1f]/.test(text))throw new Error('Use 1–650 characters of moderator text.');
  if(this.busy)throw new Error('MMS is already generating speech.');
  if(signal?.aborted)throw new Error('Speech canceled.');
  this.busy=true;
  const cancel=()=>this.close();signal?.addEventListener('abort',cancel,{once:true});
  try{
   await this.start();if(signal?.aborted)throw new Error('Speech canceled.');
   return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{reject(new Error('MMS synthesis timed out.'));this.close();},this.synthesisTimeoutMs);
    const finish=fn=>value=>{clearTimeout(timer);this.pending=null;fn(value);};
    const id=randomUUID();this.pending={id,resolve:finish(resolve),reject:finish(reject)};
    this.child.stdin.write(JSON.stringify({id,text:text.trim()})+'\n',error=>{if(error)this.pending?.reject(new Error('MMS input failed.'));});
   });
  }finally{signal?.removeEventListener('abort',cancel);this.busy=false;}
 }
 close(){
  const child=this.child;this.child=null;this.ready=null;this.pending?.reject(new Error('Speech canceled.'));this.pending=null;
  if(child){child.stdin.destroy();child.kill('SIGKILL');}
 }
}
