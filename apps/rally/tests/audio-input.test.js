import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/audio-input.js';
const track=(kind,settings={})=>({kind,readyState:'live',stops:0,getSettings:()=>settings,stop(){this.stops++;this.readyState='ended';}});
const stream=tracks=>({getTracks:()=>tracks,getAudioTracks:()=>tracks.filter(t=>t.kind==='audio'),getVideoTracks:()=>tracks.filter(t=>t.kind==='video')});
test('tab capture requires browser-tab audio and closes every source when sharing ends',async()=>{
 const video=track('video',{displaySurface:'browser'}),remote=track('audio'),mic=track('audio');let ended=0,options;
 const acquired=await RallyAudioInput.acquire({mode:'meeting-tab',includeMicrophone:true,onEnded:()=>ended++,devices:{async getDisplayMedia(value){options=value;return stream([video,remote]);},async getUserMedia(){return stream([mic]);}}});
 assert.equal(options.systemAudio,'exclude');assert.equal(options.selfBrowserSurface,'exclude');assert.equal(acquired.streams.length,2);
 video.onended();assert.equal(ended,1);for(const t of[video,remote,mic])assert.equal(t.stops,1);acquired.close();assert.equal(ended,1);
});
test('missing tab audio or a selected screen fails before requesting the microphone',async()=>{
 for(const surface of ['browser','monitor']){
  const video=track('video',{displaySurface:surface});let micRequests=0;
  await assert.rejects(RallyAudioInput.acquire({mode:'meeting-tab',devices:{async getDisplayMedia(){return stream([video]);},async getUserMedia(){micRequests++;}}}),surface==='browser'?/No tab audio/:/meeting browser tab/);
  assert.equal(video.stops,1);assert.equal(micRequests,0);
 }
});
test('microphone rejection after tab selection stops the capture and tab-only mode needs no mic',async()=>{
 const video=track('video',{displaySurface:'browser'}),remote=track('audio');
 await assert.rejects(RallyAudioInput.acquire({mode:'meeting-tab',devices:{async getDisplayMedia(){return stream([video,remote]);},async getUserMedia(){throw new Error('permission denied');}}}),/permission denied/);assert.equal(remote.stops,1);
 const t=track('audio'),v=track('video',{displaySurface:'browser'});const capture=await RallyAudioInput.acquire({mode:'meeting-tab',includeMicrophone:false,devices:{async getDisplayMedia(){return stream([v,t]);}}});assert.equal(capture.streams.length,1);capture.close();
});
test('a tab that ends during the microphone prompt is refused and every track is stopped',async()=>{
 const v=track('video',{displaySurface:'browser'}),a=track('audio'),mic=track('audio');
 await assert.rejects(RallyAudioInput.acquire({mode:'meeting-tab',devices:{async getDisplayMedia(){return stream([v,a]);},async getUserMedia(){v.readyState='ended';return stream([mic]);}}}),/ended during setup/);assert.equal(a.stops,1);assert.equal(mic.stops,1);
});
test('canceling a pending tab picker releases its late grant without requesting microphone access',async()=>{
 const controller=new AbortController(),v=track('video',{displaySurface:'browser'}),a=track('audio');let resolveDisplay,micRequests=0;
 const request=RallyAudioInput.acquire({mode:'meeting-tab',signal:controller.signal,devices:{getDisplayMedia(){return new Promise(resolve=>resolveDisplay=resolve);},getUserMedia(){micRequests++;}}});
 controller.abort();resolveDisplay(stream([v,a]));await assert.rejects(request,{name:'AbortError'});assert.equal(micRequests,0);assert.equal(v.stops,1);assert.equal(a.stops,1);
});
test('canceling a pending microphone prompt immediately stops tab capture and closes the late microphone',async()=>{
 const controller=new AbortController(),v=track('video',{displaySurface:'browser'}),a=track('audio'),mic=track('audio');let resolveMic;
 const request=RallyAudioInput.acquire({mode:'meeting-tab',signal:controller.signal,devices:{async getDisplayMedia(){return stream([v,a]);},getUserMedia(){return new Promise(resolve=>resolveMic=resolve);}}});
 await Promise.resolve();controller.abort();assert.equal(a.readyState,'ended');resolveMic(stream([mic]));await assert.rejects(request,{name:'AbortError'});assert.equal(a.stops,1);assert.equal(mic.stops,1);
});
