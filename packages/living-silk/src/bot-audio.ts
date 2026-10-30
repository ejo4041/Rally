import {BAND_RANGES,silentBotVoice,type BotVoiceFrame,type VoiceBands} from './contracts';
import {spectralBandPower} from './spectral';
const liveTrack=(track:MediaStreamTrack)=>track.readyState==='live';
const follow=(value:number,target:number,dt:number,attack:number,release:number)=>value+(target-value)*(1-Math.exp(-dt/(target>value?attack:release)));
/** Borrows a bot track; never plays, stops or takes ownership of that track. */
export class BotAudioInput {
 private context:AudioContext|null=null;
 private source:MediaStreamAudioSourceNode|null=null;
 private analyser:AnalyserNode|null=null;
 private sink:GainNode|null=null;
 private track:MediaStreamTrack|null=null;
 private epoch=0;
 private disposed=false;
 private last=0;
 private level=0;
 private phrase=0;
 private bands:VoiceBands=[0,0,0,0,0];
 private wave=new Float32Array(2048);
 private spectrum=new Float32Array(1024);
 private ended=()=>this.disconnect();
 async enable():Promise<void>{
  if(this.disposed)throw Error('Bot audio input is disposed');
  const context=this.context??=new AudioContext();
  await context.resume();
  if(!this.disposed&&context.state!=='running')throw Error('Resume bot audio from a user gesture');
 }
 async connect(track:MediaStreamTrack):Promise<void>{
  if(this.disposed)throw Error('Bot audio input is disposed');
  if(track.kind!=='audio'||track.readyState==='ended')throw TypeError('Expected a live bot audio track');
  this.disconnect();const epoch=this.epoch;
  const context=this.context??=new AudioContext();
  await context.resume();
  if(this.disposed||epoch!==this.epoch)return;
  if(context.state!=='running')throw Error('Resume bot audio from a user gesture');
  if(!liveTrack(track))throw Error('Bot audio track ended while connecting');
  try{
   this.analyser=context.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=0;
   this.source=context.createMediaStreamSource(new MediaStream([track]));
   this.sink=context.createGain();this.sink.gain.value=0;
   this.source.connect(this.analyser);this.analyser.connect(this.sink);this.sink.connect(context.destination);
   this.track=track;track.addEventListener('ended',this.ended);
  }catch(error){this.disconnect();throw error}
 }
 get connected(){return this.track!==null}
 sample(now:number,sensitivity=2):BotVoiceFrame{
  const dt=this.last?Math.max(0,Math.min(.1,now-this.last)):1/60;this.last=now;
  const active=this.track?.readyState==='live'&&!this.track.muted&&this.track.enabled&&this.context?.state==='running';
  let rms=0;
  if(active&&this.analyser){this.analyser.getFloatTimeDomainData(this.wave);this.analyser.getFloatFrequencyData(this.spectrum);for(const v of this.wave)rms+=v*v;rms=Math.sqrt(rms/this.wave.length)}
  const gain=Number.isFinite(sensitivity)?Math.min(10,Math.max(.05,sensitivity)):2;
  const target=active?1-Math.exp(-rms*gain*9):0;
  this.level=follow(this.level,target,dt,.03,.14);this.phrase=follow(this.phrase,target,dt,.08,.35);
  BAND_RANGES.forEach(([low,high],i)=>{const energy=active&&this.context?Math.sqrt(spectralBandPower(this.spectrum,this.context.sampleRate,2048,low,high)):0;this.bands[i]=follow(this.bands[i],1-Math.exp(-energy*gain*16),dt,.03,.14)});
  return {level:this.level,phrase:this.phrase,bands:[...this.bands],timestamp:now,sourceEpoch:this.epoch};
 }
 disconnect():BotVoiceFrame{
  this.epoch++;this.track?.removeEventListener('ended',this.ended);this.track=null;
  this.source?.disconnect();this.analyser?.disconnect();this.sink?.disconnect();this.source=null;this.analyser=null;this.sink=null;
  this.level=0;this.phrase=0;this.bands=[0,0,0,0,0];this.last=0;
  return silentBotVoice(this.epoch,performance.now()/1000);
 }
 async dispose(){if(this.disposed)return;this.disposed=true;this.disconnect();const context=this.context;this.context=null;if(context&&context.state!=='closed')await context.close()}
}
