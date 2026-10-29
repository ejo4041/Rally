import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.RALLY_TEST_URL||'http://127.0.0.1:8792';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:1440,height:1080}});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));let id;
await page.route('**/api/config',async route=>{const response=await route.fetch();await route.fulfill({json:{...await response.json(),liveAvailable:true}});});
await page.addInitScript(()=>{
 const f=window.captureFixture={mode:'no-audio',streams:[],contexts:[],frames:[],socketCount:0};
 function audio(hz){const c=new AudioContext({sampleRate:48000});f.contexts.push(c);const d=c.createMediaStreamDestination(),o=c.createOscillator(),g=c.createGain();g.gain.value=.2;o.frequency.value=hz;o.connect(g).connect(d);o.start();void c.resume();return d.stream;}
 Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async options=>{f.options=options;const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;canvas.getContext('2d').fillRect(0,0,16,16);const s=canvas.captureStream(2),v=s.getVideoTracks()[0];Object.defineProperty(v,'getSettings',{value:()=>({displaySurface:f.mode==='screen'?'monitor':'browser'})});if(f.mode!=='no-audio')for(const t of audio(440).getAudioTracks())s.addTrack(t);f.streams.push(s);return s;}});
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const s=audio(880);f.streams.push(s);return s;}});
 class Socket{
  constructor(){f.socketCount++;this.readyState=0;this.bufferedAmount=0;setTimeout(()=>{this.readyState=1;this.onopen?.();},0);}
  send(value){if(typeof value!=='string'){f.frames.push(new Int16Array(value).slice());return;}const c=JSON.parse(value);if(c.type==='start'){this.onmessage?.({data:JSON.stringify({type:'state',meeting:{...f.meeting,phase:'live',startedAt:new Date().toISOString()}})});this.onmessage?.({data:JSON.stringify({type:'ready'})});}if(c.type==='end'){this.onmessage?.({data:JSON.stringify({type:'state',meeting:{...f.meeting,phase:'ended',endedAt:new Date().toISOString()}})});this.close();}}
  close(){if(this.readyState===3)return;this.readyState=3;this.onclose?.();}
 }Object.defineProperty(window,'WebSocket',{configurable:true,value:Socket});
});
try{
 await page.goto(base);await page.locator('[data-action=new]').first().click();await page.locator('#setup-title').fill('WhatsApp call capture test');await page.locator('[name=agenda]').fill('Release decision');await page.locator('#setup-capture').selectOption('meeting-tab');assert.equal(await page.locator('#tab-audio-setup').isVisible(),true);
 for(const platform of['zoom','meet','jitsi','whatsapp'])await page.locator('#setup-platform').selectOption(platform);
 await page.locator('#setup-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#meeting-title').textContent==='WhatsApp call capture test');id=new URL(page.url()).hash.split('/')[1];
 await page.evaluate(async id=>{captureFixture.meeting=(await(await fetch('/api/meetings/'+id)).json()).meeting;},id);
 assert.equal(await page.locator('#voice-enabled').isChecked(),false);assert.match(await page.locator('#capture-source-note').textContent(),/WhatsApp Web/);
 await page.locator('#consent').check();await page.locator('#start-meeting').click();await page.waitForFunction(()=>document.querySelector('#connection-banner').textContent.includes('No tab audio'));assert.equal(await page.evaluate(()=>captureFixture.socketCount),0);assert.equal(await page.evaluate(()=>captureFixture.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true);
 await page.evaluate(()=>captureFixture.mode='screen');await page.locator('#start-meeting').click();await page.waitForFunction(()=>document.querySelector('#connection-banner').textContent.includes('browser tab'));assert.equal(await page.evaluate(()=>captureFixture.socketCount),0);
 await page.evaluate(()=>{captureFixture.mode='tab';captureFixture.streams=[];});await page.locator('#start-meeting').click();await page.waitForFunction(()=>captureFixture.frames.length>=8);
 const result=await page.evaluate(()=>{const chunks=captureFixture.frames,data=new Int16Array(chunks.reduce((n,c)=>n+c.length,0));let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}const amplitude=hz=>{let x=0,y=0;for(let i=0;i<data.length;i++){x+=data[i]/32768*Math.cos(2*Math.PI*hz*i/16000);y+=data[i]/32768*Math.sin(2*Math.PI*hz*i/16000);}return 2*Math.hypot(x,y)/data.length;};return{frames:chunks.length,frameBytes:chunks[0].byteLength,remoteAmplitude:amplitude(440),microphoneAmplitude:amplitude(880),options:captureFixture.options};});
 assert.equal(result.frameBytes,2560);assert.ok(result.remoteAmplitude>.03);assert.ok(result.microphoneAmplitude>.03);assert.equal(result.options.systemAudio,'exclude');
 await page.evaluate(()=>captureFixture.streams[0].getVideoTracks()[0].dispatchEvent(new Event('ended')));await page.waitForFunction(()=>document.querySelector('#phase-badge').textContent==='Saved');assert.equal(await page.evaluate(()=>captureFixture.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 const report={testedAt:new Date().toISOString(),passed:true,source:'synthetic tab and microphone tracks through real AudioContext/PCM worklet',...result,paidModelCalls:0,realPlatformCall:false};await mkdir('test-results',{recursive:true});await writeFile('test-results/platform-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await page.evaluate(()=>Promise.all(captureFixture.contexts.map(c=>c.close()))).catch(()=>{});if(id)await fetch(base+'/api/meetings/'+id,{method:'DELETE'});await browser.close();}
