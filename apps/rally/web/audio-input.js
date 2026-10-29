globalThis.RallyAudioInput={
 async acquire({mode='microphone',includeMicrophone=true,devices=navigator.mediaDevices,onEnded=()=>{}}={}){
  const streams=[];let closed=false;
  const close=()=>{closed=true;for(const stream of streams)for(const track of stream.getTracks()){track.onended=null;track.stop();}};
  try{
   if(mode==='meeting-tab'){
    if(!devices?.getDisplayMedia)throw new Error('Meeting-tab audio needs a desktop browser with tab audio sharing.');
    const display=await devices.getDisplayMedia({video:{displaySurface:'browser'},audio:{suppressLocalAudioPlayback:false},systemAudio:'exclude',selfBrowserSurface:'exclude',surfaceSwitching:'exclude',monitorTypeSurfaces:'exclude'});streams.push(display);
    if(display.getVideoTracks()[0]?.getSettings().displaySurface!=='browser')throw new Error('Choose the meeting browser tab, rather than a screen or window.');
    if(!display.getAudioTracks().some(t=>t.readyState==='live'))throw new Error('No tab audio was shared. Choose the meeting tab and enable Share tab audio.');
   }else if(mode!=='microphone')throw new Error('Unknown audio source.');
   if(mode==='microphone'||includeMicrophone){
    if(!devices?.getUserMedia)throw new Error('Microphone capture needs HTTPS and a supported browser.');
    const mic=await devices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});streams.push(mic);
    if(!mic.getAudioTracks().some(t=>t.readyState==='live'))throw new Error('The microphone has no live audio track.');
   }
   if(streams.some(stream=>stream.getTracks().some(track=>track.readyState!=='live')))throw new Error('Audio sharing ended during setup. Choose the meeting tab again.');
   for(const stream of streams)for(const track of stream.getTracks())track.onended=()=>{if(!closed){close();onEnded();}};
   return{streams,close};
  }catch(error){close();throw error;}
 }
};
