import { chromium } from '../teams-audio/node_modules/playwright/index.mjs';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { execFileSync,spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url));
const state=path.join(dir,'state');
const [action,arg,value]=process.argv.slice(2);
const env={...process.env,...JSON.parse(await readFile(path.join(state,'audio-env.json'),'utf8'))};
if(action==='play'){execFileSync('paplay',['--device=rally_teams_out',path.join(state,'test-voice.wav')],{env});console.log('Played diagnostic phrase to the virtual meeting microphone');process.exit();}
if(action==='meter'){
 const p=spawn('parec',['--device=rally_teams_in.monitor','--format=s16le','--rate=16000','--channels=1','--latency-msec=40'],{env,stdio:['ignore','pipe','pipe']});let sum=0,n=0,peak=0;
 p.stdout.on('data',b=>{for(let i=0;i+1<b.length;i+=2){const x=b.readInt16LE(i)/32768;sum+=x*x;peak=Math.max(peak,Math.abs(x));n++;}});await new Promise(r=>setTimeout(r,5000));p.kill('SIGTERM');console.log(JSON.stringify({seconds:n/16000,rms:Math.sqrt(sum/Math.max(1,n)),peak,rawAudioSaved:false}));process.exit();
}
let browser;for(let i=0;i<60;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9226');break;}catch(e){if(i===59)throw e;await new Promise(r=>setTimeout(r,500));}}
const pages=browser.contexts()[0].pages();const page=pages.find(p=>/teams\.(microsoft|cloud\.microsoft)/.test(p.url()))||pages[0];
try{
 if(action==='prepare'){
  await page.getByPlaceholder('Type your name',{exact:true}).waitFor({timeout:45000});
  const warning=page.getByRole('button',{name:'Continue without audio or video',exact:true});if(await warning.isVisible().catch(()=>false))await warning.click();
  await page.getByPlaceholder('Type your name',{exact:true}).fill('Rally audio test');
  await page.locator('[data-tid="toggle-video"]').uncheck({timeout:3000}).catch(()=>{});
  await page.getByRole('radio',{name:'Computer audio',exact:true}).check();
  const mic=page.locator('[data-tid="toggle-mute"]');if(!(await mic.isChecked()))await mic.check();
  console.log('Prepared Rally audio test with virtual microphone, computer speaker, camera off; not joined');
 }else if(action==='direct-meter'){
  const result=await page.evaluate(async duration=>{const element=[...document.querySelectorAll('audio')].find(e=>e.srcObject?.getAudioTracks?.().length);if(!element)throw new Error('No incoming meeting audio stream is present');const ctx=new AudioContext({sampleRate:16000});await ctx.resume();const source=ctx.createMediaStreamSource(element.srcObject);const analyser=ctx.createAnalyser();analyser.fftSize=2048;const zero=ctx.createGain();zero.gain.value=0;source.connect(analyser);analyser.connect(zero).connect(ctx.destination);const b=new Float32Array(analyser.fftSize);let maxRms=0,maxPeak=0,samples=0;const end=Date.now()+duration;while(Date.now()<end){analyser.getFloatTimeDomainData(b);let sq=0;for(const x of b){sq+=x*x;maxPeak=Math.max(maxPeak,Math.abs(x));}maxRms=Math.max(maxRms,Math.sqrt(sq/b.length));samples++;await new Promise(r=>setTimeout(r,50));}source.disconnect();analyser.disconnect();await ctx.close();return {sampleRate:ctx.sampleRate,maxRms,maxPeak,windows:samples,rawAudioSaved:false,streamTrackLive:element.srcObject.getAudioTracks()[0].readyState};},Math.min(30000,Math.max(1000,Number(arg)||20000)));
  const record={testedAt:new Date().toISOString(),...result};await mkdir(path.join(dir,'test-results'),{recursive:true});await writeFile(path.join(dir,'test-results/real-meeting-direct-audio.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record));
 }else if(action==='inspect'){
  const frames=[];for(const f of page.frames()){frames.push({origin:new URL(f.url()).origin,text:await f.locator('body').innerText({timeout:5000}).catch(()=>''),inputs:await f.locator('input').evaluateAll(es=>es.map(e=>({type:e.type,placeholder:e.placeholder,label:e.getAttribute('aria-label'),name:e.name}))).catch(()=>[]),buttons:await f.getByRole('button').allTextContents().catch(()=>[])});}console.log(JSON.stringify({title:await page.title(),frames},null,2));
 }else if(action==='click'){
  let clicked=false;for(const f of page.frames()){for(const role of ['button','link']){const e=f.getByRole(role,{name:arg,exact:true});if(await e.count()&&await e.first().isVisible()){await e.first().click({timeout:10000});clicked=true;break;}}if(clicked)break;}if(!clicked)throw new Error('No visible button/link matched');console.log('Clicked '+arg);
 }else if(action==='fill'){
  let filled=false;for(const f of page.frames()){for(const loc of [f.getByPlaceholder(arg,{exact:true}),f.getByLabel(arg,{exact:true})]){if(await loc.count()&&await loc.first().isVisible()){await loc.first().fill(value);filled=true;break;}}if(filled)break;}if(!filled)throw new Error('No visible input matched');console.log('Updated '+arg);
 }else if(action==='join'){
  await page.getByRole('button',{name:/^Join (now|meeting)$/i}).first().waitFor({state:'visible',timeout:10000});
  await writeFile(path.join(state,'join-deadline.json'),JSON.stringify({deadline:Date.now()+180000}),{mode:0o600});
  await page.getByRole('button',{name:/^Join (now|meeting)$/i}).first().click({timeout:10000});console.log('Requested meeting join as an explicitly named audio test; automatic closure within three minutes.');
 }else if(action==='leave'){
  await page.getByRole('button',{name:/^(Leave|Hang up)(\b|$)/i}).first().click({timeout:10000});console.log('Requested departure');
 }else if(action==='screenshot'){
  await mkdir(path.join(dir,'test-results'),{recursive:true,mode:0o700});await page.screenshot({path:path.join(dir,'test-results',arg||'teams-client.png')});console.log('Screenshot saved in ignored test-results');
 }else if(action==='rtc'){
  const stats=[];for(const f of page.frames()){const s=await f.evaluate(async()=>{const out=[];for(const pc of window.__rallyPeers||[]){const report=await pc.getStats();out.push({connectionState:pc.connectionState,audio:[...report.values()].filter(s=>['inbound-rtp','outbound-rtp','media-source'].includes(s.type)&&(s.kind==='audio'||s.mediaType==='audio')).map(s=>({type:s.type,bytesReceived:s.bytesReceived,bytesSent:s.bytesSent,packetsReceived:s.packetsReceived,packetsSent:s.packetsSent,audioLevel:s.audioLevel,totalAudioEnergy:s.totalAudioEnergy}))});}return out;}).catch(()=>[]);stats.push(...s);}console.log(JSON.stringify(stats,null,2));
 }else throw new Error('Actions: prepare, direct-meter [milliseconds], inspect, click <label>, fill <placeholder> <value>, join, leave, screenshot [filename], rtc, meter, play');
}finally{await browser.close();}
