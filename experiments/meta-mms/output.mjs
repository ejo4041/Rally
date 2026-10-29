import {spawn} from 'node:child_process';

// Playback consumes normalized model output. Text selection and host state are
// checked by the caller's authoritative canSpeak callback before each stage.
export function createSpeechOutput({engine,play,canSpeak,onPlayback=()=>{},now=()=>performance.now(),echoTailMs=400}){
 if(!Number.isFinite(echoTailMs)||echoTailMs<0||echoTailMs>2000)throw new Error('Invalid echo tail.');
 let current=null,generation=0,echoUntil=0;
 function cancel(){
  generation++;const previous=current;current=null;
  if(previous){if(previous.playing)echoUntil=now()+echoTailMs;previous.abort.abort();}
 }
 async function present(utterance,{signal}={}){
  cancel();const mine=generation,job={abort:new AbortController(),playing:false};current=job;
  const active=()=>current===job&&generation===mine&&!job.abort.signal.aborted;
  const stop=()=>{if(current===job)cancel();};signal?.addEventListener('abort',stop,{once:true});
  const event=state=>onPlayback({id:utterance.id,epoch:utterance.epoch,state});
  try{
   if(signal?.aborted){stop();return'canceled';}
   if(!await canSpeak(utterance)||!active())return'canceled';
   const audio=await engine.synthesize(utterance.text,{signal:job.abort.signal});
   if(!active()||!await canSpeak(utterance)||!active())return'canceled';
   job.playing=true;event('speaking');
   await play(audio,{signal:job.abort.signal});
   if(!active())return'canceled';
   event('completed');return'completed';
  }catch{
   if(!active())return'canceled';event('failed');return'failed';
  }finally{
   signal?.removeEventListener('abort',stop);
   if(job.playing)echoUntil=Math.max(echoUntil,now()+echoTailMs);
   if(current===job)current=null;
  }
 }
 return{present,cancel,isEchoRisk:()=>!!current?.playing||now()<echoUntil,close(){cancel();engine.close();}};
}

// Raw PCM goes through stdin, never a temporary file or command-string shell.
// A caller must explicitly choose a sink; default host output is never used.
export function pulsePlayback({sink,env=process.env,spawnProcess=spawn,timeoutMs=35000}){
 if(typeof sink!=='string'||!/^[a-zA-Z0-9_.-]{1,100}$/.test(sink))throw new Error('Choose an explicit PulseAudio sink.');
 return(audio,{signal}={})=>new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new Error('Playback canceled.'));return;}
  if(audio.sampleRate!==16000||!Buffer.isBuffer(audio.pcm)||!audio.pcm.length||audio.pcm.length%2||audio.pcm.length>960000){reject(new Error('Invalid mono 16 kHz PCM.'));return;}
  const child=spawnProcess('paplay',['--raw','--format=s16le','--rate=16000','--channels=1','--latency-msec=40',`--device=${sink}`],{env,stdio:['pipe','ignore','ignore']});
  let done=false;
  const finish=error=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
  const abort=()=>{child.stdin.destroy();child.kill('SIGKILL');finish(new Error('Playback canceled.'));};
  const timer=setTimeout(()=>{child.stdin.destroy();child.kill('SIGKILL');finish(new Error('Playback timed out.'));},timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});
  child.once('error',()=>finish(new Error('PulseAudio playback unavailable.')));
  child.once('close',code=>finish(code===0?null:new Error('PulseAudio playback failed.')));
  child.stdin.on('error',()=>{child.kill('SIGKILL');finish(new Error('PulseAudio input closed.'));});
  child.stdin.end(audio.pcm);
 });
}
