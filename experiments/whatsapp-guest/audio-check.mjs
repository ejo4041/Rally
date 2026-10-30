import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGuest} from './guest.mjs';
const guest=await createGuest({seconds:30});let player,recorder;const chunks=[];
const server=createServer((req,res)=>res.end('<title>Local WhatsApp runner audio check</title>'));
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));await guest.page.goto('http://127.0.0.1:'+server.address().port);
 recorder=spawn('parec',['--device=rally_whatsapp_in.monitor','--format=s16le','--rate=16000','--channels=1'],{env:guest.env,stdio:['ignore','pipe','ignore']});recorder.stdout.on('data',b=>{chunks.push(b);if(chunks.length>50)chunks.shift();});
 await guest.page.evaluate(async()=>{const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});const context=new AudioContext();await context.resume();const analyser=context.createAnalyser();analyser.fftSize=8192;context.createMediaStreamSource(stream).connect(analyser);const tone=context.createOscillator(),gain=context.createGain();gain.gain.value=.2;tone.frequency.value=880;tone.connect(gain).connect(context.destination);tone.start();window.check={context,stream,analyser,tone};});
 const wave=Buffer.alloc(44+48000*2*4);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(48000,24);wave.writeUInt32LE(96000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);for(let i=0;i<48000*4;i++)wave.writeInt16LE(Math.round(.2*32767*Math.sin(2*Math.PI*440*i/48000)),44+2*i);
 const file=guest.dir+'/tone.wav';await writeFile(file,wave,{mode:0o600});player=spawn('paplay',['--device=rally_whatsapp_out',file],{env:guest.env,stdio:'ignore'});
 await new Promise(r=>setTimeout(r,1500));
 const microphone=await guest.page.evaluate(()=>{const a=check.analyser,w=new Float32Array(a.fftSize),bins=new Float32Array(a.frequencyBinCount);a.getFloatTimeDomainData(w);a.getFloatFrequencyData(bins);let peak=0;for(let i=1;i<bins.length;i++)if(bins[i]>bins[peak])peak=i;return{rms:Math.sqrt(w.reduce((n,v)=>n+v*v,0)/w.length),peakHz:peak*check.context.sampleRate/a.fftSize};});
 const data=Buffer.concat(chunks).subarray(-32000);let sum=0,re=0,im=0;for(let i=0;i<data.length/2;i++){const x=data.readInt16LE(i*2)/32768;sum+=x*x;re+=x*Math.cos(2*Math.PI*880*i/16000);im+=x*Math.sin(2*Math.PI*880*i/16000);}const incoming={rms:Math.sqrt(sum/(data.length/2)),amplitude880:2*Math.hypot(re,im)/(data.length/2)};
 assert.ok(microphone.rms>.03);assert.ok(Math.abs(microphone.peakHz-440)<20);assert.ok(incoming.amplitude880>.08);
 player.kill('SIGTERM');await new Promise(r=>setTimeout(r,600));const afterStop=await guest.page.evaluate(()=>{const w=new Float32Array(check.analyser.fftSize);check.analyser.getFloatTimeDomainData(w);return Math.sqrt(w.reduce((n,v)=>n+v*v,0)/w.length);});assert.ok(afterStop<.005);
 const report={testedAt:new Date().toISOString(),passed:true,microphone,incoming,microphoneAfterStopRms:afterStop,whatsappCallJoined:false,paidModelCalls:0,rawAudioSaved:false,source:'synthetic local tones in the isolated WhatsApp browser/audio runner'};await mkdir(new URL('./test-results/',import.meta.url),{recursive:true});await writeFile(new URL('./test-results/audio-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{player?.kill('SIGTERM');recorder?.kill('SIGTERM');await guest.close();await new Promise(r=>server.close(r));}
