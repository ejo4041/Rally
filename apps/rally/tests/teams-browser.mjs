import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createMeeting,addFinal} from '../src/core.js';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'/home/hack/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1080},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
let joined,leave=false;let status={enabled:true,online:true,transport:'teams-web',credentialsConfigured:true,transcriptionReady:true,job:null,testMinutes:3};
await page.route('**/api/teams/**',async route=>{const path=new URL(route.request().url()).pathname;let result=status;
 if(path.endsWith('/join')){joined=route.request().postDataJSON();status.job={id:'browser-test',state:'connected',message:'Rally is connected.',transcribe:true,transcriptionState:'listening',transcript:[{id:'one',text:'Andrew will send the proposal Friday.'},{id:'two',text:'<img src=x onerror="window.pwned=true">'}],partial:'Next sentence',inputLevel:.2};result={job:status.job};}
 if(path.endsWith('/save')) result={meetingId:'browser-test'};
 if(path.endsWith('/leave')){leave=true;status.job.state='left';status.job.transcriptionState='stopped';result={ok:true};}
 await route.fulfill({json:result});});
const record=createMeeting({agenda:['Teams discussion'],minutes:3,wrapMinutes:.5},'browser-test');
record.kind='teams';record.phase='ended';record.paused=true;record.source={state:'left',transcriptionState:'stopped'};record.startedAt=record.createdAt;record.endedAt=record.createdAt;
addFinal(record,{sessionId:'one',turnId:1,transcript:'Andrew will send the proposal Friday.'});addFinal(record,{sessionId:'one',turnId:2,transcript:'<img src=x onerror="window.pwned=true">'});
await page.route('**/api/meetings/browser-test',route=>route.fulfill({json:{meeting:record}}));
try{
 await page.goto('http://127.0.0.1:8792');await page.locator('#teams-join').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#teams-join').disabled);
 assert.equal(await page.locator('#teams-token-setup').isVisible(),false);await page.locator('#teams-link').fill('https://teams.microsoft.com/meet/123');await page.locator('#teams-consent').check();await page.locator('#teams-transcribe').check();await page.locator('#teams-join').click();
 await page.waitForFunction(()=>document.querySelector('#teams-transcript').textContent.includes('Andrew'));assert.equal(joined.transcriptionConsented,true);assert.equal(joined.transcribe,true);assert.equal(await page.evaluate(()=>window.pwned),undefined);assert.equal(await page.locator('#teams-transcript img').count(),0);
 assert.equal(await page.locator('#teams-save').isEnabled(),false);
 const download=page.waitForEvent('download');await page.locator('#teams-export').click();assert.equal((await download).suggestedFilename(),'rally-teams-transcript.txt');
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/teams-transcription-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await page.screenshot({path:'test-results/teams-transcription-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#teams-leave').click();await page.waitForFunction(()=>document.querySelector('#teams-state').textContent==='left');assert.ok(leave);assert.equal(await page.locator('#teams-transcript').getByText('Andrew will send the proposal Friday.').count(),1);assert.equal(await page.locator('#teams-save').isEnabled(),true);await page.locator('#teams-save').click();
 await page.waitForFunction(()=>location.hash==='#meeting/browser-test' && document.querySelector('#meeting').hidden===false);
 assert.match(await page.locator('#meeting-meta').textContent(),/Teams transcript/);assert.match(await page.locator('#rally-prompt').textContent(),/Moderation was not run/);assert.match(await page.locator('#transcript').textContent(),/Speech time not recorded/);assert.equal(await page.locator('#start-panel').isVisible(),false);assert.equal(await page.locator('#transcript img').count(),0);assert.equal(await page.evaluate(()=>window.pwned),undefined);assert.deepEqual(errors,[]);
 console.log('Teams UI passed: link, consent, live text, safe rendering, download, mobile layout, leave, retained transcript, saved-history navigation and truthful record rendering. Mocked queue; no meeting or paid calls.');
}finally{await browser.close();}
