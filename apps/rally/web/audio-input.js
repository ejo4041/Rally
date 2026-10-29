globalThis.RallyAudioInput={
 async acquire({mode='microphone',includeMicrophone=true,devices=navigator.mediaDevices,onEnded=()=>{},signal}={}){
  const streams=[];let closed=false;
  const abort=()=>close();
  const close=()=>{closed=true;signal?.removeEventListener('abort',abort);for(const stream of streams)for(const track of stream.getTracks()){track.onended=null;if(track.readyState==='live')track.stop();}};
  const ensureOpen=()=>{if(closed||signal?.aborted){const error=new Error('Audio selection canceled.');error.name='AbortError';throw error;}};
  signal?.addEventListener('abort',abort,{once:true});
  try{
   ensureOpen();
   if(mode==='meeting-tab'){
    if(!devices?.getDisplayMedia)throw new Error('Meeting-tab audio needs a desktop browser with tab audio sharing.');
    const display=await devices.getDisplayMedia({video:{displaySurface:'browser'},audio:{suppressLocalAudioPlayback:false},systemAudio:'exclude',selfBrowserSurface:'exclude',surfaceSwitching:'exclude',monitorTypeSurfaces:'exclude'});streams.push(display);ensureOpen();
    if(display.getVideoTracks()[0]?.getSettings().displaySurface!=='browser')throw new Error('Choose the meeting browser tab, rather than a screen or window.');
    if(!display.getAudioTracks().some(t=>t.readyState==='live'))throw new Error('No tab audio was shared. Choose the meeting tab and enable Share tab audio.');
   }else if(mode!=='microphone')throw new Error('Unknown audio source.');
   if(mode==='microphone'||includeMicrophone){
    if(!devices?.getUserMedia)throw new Error('Microphone capture needs HTTPS and a supported browser.');
    const mic=await devices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});streams.push(mic);ensureOpen();
    if(!mic.getAudioTracks().some(t=>t.readyState==='live'))throw new Error('The microphone has no live audio track.');
   }
   if(streams.some(stream=>stream.getTracks().some(track=>track.readyState!=='live')))throw new Error('Audio sharing ended during setup. Choose the meeting tab again.');
   for(const stream of streams)for(const track of stream.getTracks())track.onended=()=>{if(!closed){close();onEnded();}};
   return{streams,close};
  }catch(error){close();throw error;}
 },
 async check({mode='microphone',includeMicrophone=true,signal,onLevel=()=>{},onFinished=()=>{},durationMs=15000}={}){
  let capture,context,frame,timer,closed=false;
  const close=(reason='stopped')=>{if(closed)return;closed=true;clearTimeout(timer);cancelAnimationFrame(frame);signal?.removeEventListener('abort',abort);capture?.close();if(context&&context.state!=='closed')void context.close().catch(()=>{});onFinished(reason);};
  const abort=()=>close('stopped');signal?.addEventListener('abort',abort,{once:true});
  try{
   if(signal?.aborted){close();return{close};}
   capture=await this.acquire({mode,includeMicrophone,signal,onEnded:()=>close('sharing-ended')});
   if(closed){capture.close();return{close};}
   context=new AudioContext();await context.resume();if(closed)return{close};
   const meters=capture.streams.map((stream,index)=>{const analyser=context.createAnalyser();analyser.fftSize=1024;context.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(analyser);return{analyser,samples:new Float32Array(analyser.fftSize),source:mode==='meeting-tab'&&index===0?'tab':'microphone',peak:0};});
   const update=()=>{if(closed)return;for(const meter of meters){meter.analyser.getFloatTimeDomainData(meter.samples);const rms=Math.sqrt(meter.samples.reduce((sum,value)=>sum+value*value,0)/meter.samples.length);meter.peak=Math.max(meter.peak,rms);onLevel({source:meter.source,rms,peak:meter.peak});}frame=requestAnimationFrame(update);};
   timer=setTimeout(()=>close('complete'),Math.max(1000,Math.min(15000,durationMs)));update();return{close};
  }catch(error){close('error');throw error;}
 }
};
