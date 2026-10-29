// Offline signal checks for browser input rates. No microphone, meeting or
// model connection is opened, and no waveform is saved.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.goto(process.env.RALLY_TEST_URL||'http://127.0.0.1:8792');
 const cases=await page.evaluate(async()=>{
  const cases=[];
  for(const inputRate of[16000,44100,48000,96000])for(const toneHz of(inputRate===16000?[1000,6000]:[1000,6000,10000])){
   const seconds=2,context=new OfflineAudioContext(1,inputRate*seconds,inputRate);await context.audioWorklet.addModule('/pcm-worklet.js');
   const pcm=new AudioWorkletNode(context,'rally-pcm'),source=context.createBufferSource(),buffer=context.createBuffer(1,inputRate*seconds,inputRate),samples=buffer.getChannelData(0),frames=[];
   for(let i=0;i<samples.length;i++)samples[i]=.2*Math.sin(2*Math.PI*toneHz*i/inputRate);source.buffer=buffer;pcm.port.onmessage=event=>{if(event.data.type==='pcm')frames.push(new Int16Array(event.data.buffer));};source.connect(pcm).connect(context.destination);source.start();const started=performance.now();await context.startRendering();await new Promise(resolve=>setTimeout(resolve,30));
   const length=frames.reduce((sum,frame)=>sum+frame.length,0),data=new Int16Array(length);let offset=0;for(const frame of frames){data.set(frame,offset);offset+=frame.length;}
   const outputHz=toneHz<=8000?toneHz:16000-toneHz,skip=2560;let re=0,im=0;
   for(let i=skip;i<data.length;i++){re+=data[i]/32768*Math.cos(2*Math.PI*outputHz*i/16000);im+=data[i]/32768*Math.sin(2*Math.PI*outputHz*i/16000);}
   cases.push({inputRate,toneHz,outputHz,outputRate:16000,frames:frames.length,frameSamples:frames[0]?.length,sampleCount:length,amplitude:2*Math.hypot(re,im)/(data.length-skip),offlineRenderMs:performance.now()-started});pcm.disconnect();
  }
  return cases;
 });
 for(const row of cases){assert.equal(row.frames,25);assert.equal(row.frameSamples,1280);assert.equal(row.sampleCount,32000);if(row.toneHz===1000)assert.ok(row.amplitude>.18&&row.amplitude<.21,JSON.stringify(row));if(row.toneHz===6000)assert.ok(row.amplitude>.13,JSON.stringify(row));if(row.toneHz===10000)assert.ok(row.amplitude<.01,JSON.stringify(row));}
 const report={testedAt:new Date().toISOString(),passed:true,inputAmplitude:.2,source:'synthetic tones through the actual browser PCM worklet in OfflineAudioContext',cases,paidModelCalls:0,realPlatformCall:false,rawAudioSaved:false};await mkdir('test-results',{recursive:true});await writeFile('test-results/audio-quality-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
