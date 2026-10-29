import { chromium } from '../teams-audio/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url));
const env={...process.env,...JSON.parse(await readFile(path.join(dir,'state/audio-env.json'),'utf8'))};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const wav=Buffer.alloc(44+48000*2*6);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);for(let i=0;i<48000*6;i++)wav.writeInt16LE(Math.round(.2*32767*Math.sin(2*Math.PI*440*i/48000)),44+i*2);
const tone=path.join(dir,'state/test-440.wav');await writeFile(tone,wav,{mode:0o600});
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Local synthetic audio routing test</title>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,play,record;let capture=Buffer.alloc(0);
function measure(b){b=b.subarray(Math.max(0,b.length-32000));let sq=0;const n=Math.floor(b.length/2);let r440=0,i440=0,r880=0,i880=0;for(let i=0;i<n;i++){const x=b.readInt16LE(i*2)/32768;sq+=x*x;r440+=x*Math.cos(2*Math.PI*440*i/16000);i440+=x*Math.sin(2*Math.PI*440*i/16000);r880+=x*Math.cos(2*Math.PI*880*i/16000);i880+=x*Math.sin(2*Math.PI*880*i/16000);}return {samples:n,rms:Math.sqrt(sq/Math.max(1,n)),amplitude440:2*Math.hypot(r440,i440)/Math.max(1,n),amplitude880:2*Math.hypot(r880,i880)/Math.max(1,n)};}
try{
 record=spawn('parec',['--device=rally_teams_in.monitor','--format=s16le','--rate=16000','--channels=1','--latency-msec=40'],{env,stdio:['ignore','pipe','pipe']});record.stdout.on('data',b=>{capture=Buffer.concat([capture,b]);if(capture.length>64000)capture=capture.subarray(capture.length-64000);});
 browser=await chromium.launch({headless:false,executablePath:'/home/hack/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',env,args:['--autoplay-policy=no-user-gesture-required','--disable-dev-shm-usage']});
 const context=await browser.newContext({permissions:['microphone']});const page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
 const devices=await page.evaluate(async()=>{const permission=await navigator.mediaDevices.getUserMedia({audio:true,video:false});const available=await navigator.mediaDevices.enumerateDevices();const chosen=available.find(d=>d.kind==='audioinput'&&/Rally_Virtual_Microphone/.test(d.label));permission.getTracks().forEach(t=>t.stop());if(!chosen)throw new Error('Rally virtual microphone is not enumerated');const stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:chosen.deviceId},echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});const ctx=new AudioContext({sampleRate:48000});await ctx.resume();const input=ctx.createMediaStreamSource(stream);const analyser=ctx.createAnalyser();analyser.fftSize=8192;input.connect(analyser);const zero=ctx.createGain();zero.gain.value=0;analyser.connect(zero).connect(ctx.destination);const osc=ctx.createOscillator();osc.frequency.value=880;const gain=ctx.createGain();gain.gain.value=.2;osc.connect(gain).connect(ctx.destination);osc.start();window.probe={ctx,stream,analyser,osc};return {audioInputs:(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput').map(d=>d.label),selected:stream.getAudioTracks()[0].label};});
 play=spawn('paplay',['--device=rally_teams_out',tone],{env,stdio:'ignore'});
 await wait(2000);
 const mic=await page.evaluate(()=>{const a=window.probe.analyser;const wave=new Float32Array(a.fftSize);a.getFloatTimeDomainData(wave);const bins=new Float32Array(a.frequencyBinCount);a.getFloatFrequencyData(bins);let peak=0;for(let i=1;i<bins.length;i++)if(bins[i]>bins[peak])peak=i;const around=hz=>{const k=Math.round(hz*a.fftSize/window.probe.ctx.sampleRate);return Math.max(...bins.slice(k-2,k+3));};return {rms:Math.sqrt(wave.reduce((s,x)=>s+x*x,0)/wave.length),peakHz:peak*window.probe.ctx.sampleRate/a.fftSize,db440:around(440),db880:around(880)};});
 const incoming=measure(capture);play.kill('SIGTERM');await wait(1000);
 const afterStop=await page.evaluate(()=>{const a=window.probe.analyser;const b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);return {rms:Math.sqrt(b.reduce((s,x)=>s+x*x,0)/b.length)};});
 const incomingAfterStop=measure(capture);
 const result={testedAt:new Date().toISOString(),browser:await browser.version(),headed:true,devices,microphone:mic,incoming,incomingAfterStop,afterStop,realTeamsJoined:false,acsRequests:0,museCalls:0,rawAudioSaved:false};
 console.log(JSON.stringify(result,null,2));
 assert.match(devices.selected,/Rally/);assert.ok(mic.rms>.03);assert.ok(Math.abs(mic.peakHz-440)<20);assert.ok(mic.db440-mic.db880>20,'Output does not leak into virtual microphone');assert.ok(incoming.amplitude880>.08);assert.ok(incoming.amplitude880>incoming.amplitude440*20,'Rally speech is isolated from incoming Teams speaker');assert.ok(afterStop.rms<.005,'Stopping output clears virtual microphone');assert.ok(incomingAfterStop.amplitude880>.08,'Incoming speaker still active after output stops');
 await mkdir(path.join(dir,'test-results'),{recursive:true});await writeFile(path.join(dir,'test-results/os-audio-probe.json'),JSON.stringify({passed:true,...result},null,2)+'\n');console.log('PASS: real PulseAudio virtual microphone, independent speaker capture, simultaneous routing and stop isolation. This is a local synthetic test.');
}finally{play?.kill('SIGTERM');record?.kill('SIGTERM');await browser?.close();await new Promise(r=>server.close(r));}
