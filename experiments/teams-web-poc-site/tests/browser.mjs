import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.RALLY_TEST_URL||'http://127.0.0.1:8787';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1080}});
page.setDefaultTimeout(12000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',dialog=>dialog.accept());
try{
  await mkdir('test-results',{recursive:true});
  await page.goto(base);await page.waitForSelector('.empty-history,.history-row');
  assert.match(await page.title(),/Rally/);
  const pcm=await page.evaluate(async()=>{
    const context=new OfflineAudioContext(1,96000,48000);await context.audioWorklet.addModule('/pcm-worklet.js');
    const processor=new AudioWorkletNode(context,'rally-pcm');const oscillator=context.createOscillator();const gain=context.createGain();gain.gain.value=.2;oscillator.frequency.value=1000;
    let samples=0,power=0;processor.port.onmessage=event=>{if(event.data.type==='pcm'){const data=new Int16Array(event.data.buffer);samples+=data.length;for(const value of data)power+=value*value;}};
    oscillator.connect(gain);gain.connect(processor);processor.connect(context.destination);oscillator.start();await context.startRendering();await new Promise(r=>setTimeout(r,50));return{samples,rms:Math.sqrt(power/samples)};
  });
  assert.equal(pcm.samples,32000,'Two seconds at 48kHz must produce exactly two seconds of 16kHz PCM');assert.ok(pcm.rms>3000&&pcm.rms<6000,'Resampled tone must have a plausible amplitude');
  await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});
  await page.locator('[data-action=new]').first().click();await page.locator('#setup-title').fill('New meeting QA');
  await page.locator('[name=agenda]').fill('Review release\nConfirm next steps');await page.locator('[name=participants]').fill('Alex, Priya');
  await page.locator('#setup-minutes').fill('5');await page.locator('#setup-minutes').dispatchEvent('change');assert.ok(Number(await page.locator('#setup-wrap').inputValue())<5);
  await page.locator('#setup-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#meeting-title').textContent==='New meeting QA');
  await page.locator('#delete-meeting').click();await page.locator('#confirm-delete').click();await page.waitForFunction(()=>!location.hash);
  await page.locator('#try-demo').click();await page.waitForFunction(()=>document.querySelector('#walkthrough-banner').hidden===false);
  await page.locator('#voice-enabled').uncheck();await page.locator('#consent').check();await page.locator('#start-meeting').click();await page.waitForFunction(()=>document.querySelector('#record-label').textContent==='Example transcript'&&!document.querySelector('#next-turn').disabled);
  for(let i=1;i<=6;i++){await page.locator('#next-turn').click();await page.waitForFunction(count=>document.querySelectorAll('.turn').length===count,i);}
  assert.equal(await page.locator('.outcome').count(),2);
  const action=page.locator('.outcome').filter({hasText:'Run the rollback test.'});await action.locator('[data-confirm]').click();await page.locator('#confirm-check').check();await page.locator('#confirm-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#action-score').textContent==='1');
  await page.locator('#pause-moderator').click();await page.waitForFunction(()=>document.querySelector('#phase-badge').textContent==='Rally paused');await page.locator('#pause-moderator').click();
  await page.locator('#demo-clock').click();await page.waitForFunction(()=>!document.querySelector('#demo-clock-banner').hidden);
  await page.screenshot({path:'test-results/meeting-desktop.png',fullPage:true});
  await page.locator('#end-meeting').click();await page.waitForFunction(()=>document.querySelector('#phase-badge').textContent==='Saved');await page.reload();await page.waitForFunction(()=>document.querySelector('#action-score').textContent==='1');
  const exportData=await page.evaluate(async()=>fetch('/api/meetings/'+location.hash.split('/')[1]+'/export').then(r=>r.text()));assert.match(exportData,/SCRIPTED WALKTHROUGH/);assert.match(exportData,/Thursday/);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await page.screenshot({path:'test-results/meeting-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile page must not overflow');
  await page.locator('#menu').click();await page.locator('#nav-scrim').waitFor({state:'visible'});await page.locator('#nav-scrim').click({position:{x:350,y:100}});assert.equal(await page.locator('#nav-scrim').isVisible(),false,'Mobile navigation must be dismissible without leaving a meeting');
  await page.evaluate(()=>{window.__speechTest={cancels:0,last:null};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel(){window.__speechTest.cancels++;},speak(u){window.__speechTest.last=u;setTimeout(()=>u.onstart?.(),10);}}});});await page.locator('#test-voice').click();await page.waitForTimeout(50);assert.equal(await page.locator('#stop-speech').isVisible(),true,'Device voice test must remain usable on a saved record');await page.locator('#stop-speech').click();
  await page.locator('#back-home').click();await page.waitForFunction(()=>!document.querySelector('#home').hidden);await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});
  const usage=await page.evaluate(()=>fetch('/api/usage').then(r=>r.json()));assert.equal(usage.events.length,0,'Walkthrough must not call paid providers');
  await page.locator('.home-heading [data-action=new]').click();await page.locator('#setup-title').fill('Fresh transcript regression');await page.locator('[name=agenda]').fill('A new topic');await page.locator('#setup-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#meeting-title').textContent==='Fresh transcript regression');assert.equal(await page.locator('.turn').count(),0,'Fresh draft must not display the previous conversation');assert.equal(await page.locator('#action-score').textContent(),'0');
  await page.evaluate(()=>{window.__speechTest={cancels:0,last:null};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel(){window.__speechTest.cancels++;},speak(u){window.__speechTest.last=u;setTimeout(()=>u.onstart?.(),10);}}});});
  await page.locator('#test-voice').click();await page.locator('#stop-speech').waitFor({state:'visible'});await page.locator('#stop-speech').click();await page.evaluate(()=>window.__speechTest.last.onend?.());assert.equal(await page.locator('#stop-speech').isVisible(),false,'Late completion must not restart canceled speech');assert.ok(await page.evaluate(()=>window.__speechTest.cancels)>0);
  await page.evaluate(()=>{window.blockPendingSpeech();window.speak({id:'late-server-prompt',text:'A stale prompt that must not restart speech.',epoch:0});});assert.equal(await page.locator('#stop-speech').isVisible(),false,'An old-epoch prompt must be blocked immediately before the server acknowledges override');
  await page.locator('#delete-meeting').click();await page.locator('#confirm-delete').click();
  assert.deepEqual(errors,[]);console.log('Browser flow passed: setup, short-meeting validation, deletion, labeled walkthrough, proposals, confirmation, pause/resume, demo clock, save/reload, export, responsive layout, zero paid usage.');
}finally{await browser.close();}
