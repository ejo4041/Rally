import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createPhonemePlanner} from '../../packages/rally-speech/phonemes.mjs';
import {wav} from '../meta-mms/speech.mjs';

export const MODEL='facebook/fastspeech2-en-ljspeech';
export const REVISION='a3e3e5e2e62bb7ca7514b11aa469e9c5b01a20bf';
const refusal=(code,message)=>Object.assign(Error(message),{code});
// Experimental opt-in capability. Phones reach a phone-trained Meta acoustic
// model. Existing MMS/Seamless paths are never given ARPABET as ordinary text.
export class PhonemeSpeech {
 constructor({python,modelDirectory,worker=fileURLToPath(new URL('../meta-fastspeech2/worker.py',import.meta.url)),phoneOverrides={},startTimeoutMs=45000,synthesisTimeoutMs=20000}={}) {
  if(!python||!modelDirectory)throw Error('Configure phoneme worker Python and pinned model directory');
  this.plan=createPhonemePlanner({overrides:phoneOverrides});
  Object.assign(this,{python,modelDirectory,worker,startTimeoutMs,synthesisTimeoutMs});
  this.identity={model:MODEL,revision:REVISION,sampleRate:16000};
  this.verifiedChild=null;
 }
 isReady(){const child=this.child;return !!child&&this.verifiedChild===child&&child.exitCode===null&&!child.killed&&!child.stdin.destroyed&&!child.stdout.destroyed;}
 async start(){
  if(this.ready)return this.ready;
  const child=spawn(this.python,[this.worker,'--model-directory',this.modelDirectory,'--model-id',MODEL,'--model-revision',REVISION],{stdio:['pipe','pipe','ignore'],env:{...process.env,HF_HUB_OFFLINE:'1',TOKENIZERS_PARALLELISM:'false'}});
  this.child=child;
  this.ready=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{reject(refusal('PHONEME_TIMEOUT','Phoneme model startup timed out'));if(this.child===child)this.close();},this.startTimeoutMs);
   const fail=()=>{clearTimeout(timer);reject(Error('Phoneme model stopped'));if(this.child===child)this.close();};
   child.once('exit',fail);child.once('error',fail);
   child.stdin.on('error',fail);child.stdout.on('error',fail);
   createInterface({input:child.stdout}).on('error',fail).on('line',line=>{
    if(this.child!==child)return;
    try{
     if(line.length>1400000)throw Error('Phoneme worker response limit');
     const message=JSON.parse(line);
     if(message.type==='ready'){
      if(message.model!==MODEL||message.revision!==REVISION||message.sampleRate!==16000||message.inputKind!=='arpabet')throw Error('Wrong phoneme backend identity or capability');
      this.verifiedChild=child;clearTimeout(timer);resolve(message);return;
     }
     if(message.type==='error'&&!message.id){clearTimeout(timer);reject(Error('Phoneme model load failed'));this.close();return;}
     const pending=this.pending;if(!pending||message.id!==pending.id)return;
     if(message.type==='error'){pending.reject(Error('Phoneme synthesis failed: '+message.code));return;}
     if(message.type!=='audio')throw Error('Unexpected phoneme worker response');
     const pcm=Buffer.from(message.pcmBase64||'','base64');
     if(message.model!==MODEL||message.revision!==REVISION||message.sampleRate!==16000||!pcm.length||pcm.length%2||pcm.length>960000||!Number.isFinite(message.seconds)||Math.abs(pcm.length/32000-message.seconds)>.001||!Number.isFinite(message.synthesisMs))throw Error('Invalid phoneme model audio');
     pending.resolve({...message,pcm,wav:wav(pcm,16000)});
    }catch(error){this.pending?.reject(error);clearTimeout(timer);reject(error);this.close();}
   });
  });return this.ready;
 }
 async synthesize(text,{signal}={}){
  if(signal?.aborted)throw Error('Speech canceled');
  let plan;
  try{plan=this.plan(text);}catch(error){throw refusal('PHONEME_INPUT',error.message);}
  if(!plan.supported)throw refusal('PHONEME_INPUT','Phoneme input needs explicit normalization or pronunciation: '+plan.issues.map(issue=>issue.reason).join(', '));
  if(this.busy)throw refusal('PHONEME_BUSY','Phoneme model is already generating speech');
  this.busy=true;const cancel=()=>this.close();signal?.addEventListener('abort',cancel,{once:true});
  try{
   await this.start();if(signal?.aborted)throw Error('Speech canceled');
   const child=this.child;if(!child||child.exitCode!==null||child.killed)throw Error('Phoneme model stopped');
   return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{reject(refusal('PHONEME_TIMEOUT','Phoneme synthesis timed out'));this.close();},this.synthesisTimeoutMs);
    const finish=fn=>value=>{clearTimeout(timer);this.pending=null;fn(value);};
    const id=randomUUID();this.pending={id,resolve:finish(resolve),reject:finish(reject)};
    child.stdin.write(JSON.stringify({id,text:plan.canonicalText,phones:plan.phones,sentences:plan.sentences,inputKind:'arpabet'})+'\n',error=>{if(error&&this.child===child){this.pending?.reject(Error('Phoneme worker input failed'));this.close();}});
   });
  }finally{signal?.removeEventListener('abort',cancel);this.busy=false;}
 }
 close(){const child=this.child;this.child=null;this.verifiedChild=null;this.ready=null;this.pending?.reject(Error('Speech canceled'));this.pending=null;if(child){child.stdin.destroy();child.kill('SIGKILL');}}
}
