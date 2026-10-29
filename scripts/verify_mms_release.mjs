import {chromium} from '../apps/rally/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
const settings=parseEnv(await readFile(new URL('../.env.local',import.meta.url),'utf8'));
const origin='https://rally-meeting-moderator.excavator3496.chatgpt.site';
const headers={'OAI-Sites-Authorization':`Bearer ${settings.RALLY_SITES_SERVICE_TOKEN}`,'Content-Type':'application/json',Origin:origin};
async function get(path){const response=await fetch(origin+path,{headers,redirect:'error'});assert.equal(response.status,200);return response.json();}
const before=await get('/api/usage'),config=await get('/api/config'),speech=await get('/api/speech/status');
assert.equal(speech.online,true);assert.equal(config.mmsAvailable,true);assert.equal(config.deviceVoiceAvailable,false);assert.equal(config.models.transcription.model,'muse-voice-transcribe-1.0');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({extraHTTPHeaders:headers});page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',error=>errors.push(error.message));let meetingId,audioStatus;
await page.route('**/*',route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin!==origin)return route.abort();
 if(request.method()==='POST'&&!['/api/meetings','/api/speech/create','/api/speech/cancel'].includes(url.pathname))return route.abort();
 return route.continue();
});
page.on('response',response=>{if(new URL(response.url()).pathname.startsWith('/api/speech/audio/'))audioStatus=response.status();});
try{
 await page.goto(origin);await page.locator('#teams-join').waitFor({state:'visible'});
 assert.equal(await page.locator('#teams-link').inputValue(),'');assert.equal(await page.locator('#teams-consent').isChecked(),false);assert.equal(await page.locator('#teams-transcribe').isChecked(),false);
 await page.locator('#try-demo').click();await page.locator('#test-voice').waitFor({state:'visible'});meetingId=new URL(page.url()).hash.split('/')[1];
 const start=performance.now();await page.locator('#test-voice').click();await page.waitForFunction(()=>document.querySelector('#rally-state').textContent==='Speaking');const decodedPlaybackStartMs=Math.round(performance.now()-start);assert.equal(audioStatus,200);
 await page.locator('#stop-speech').click();assert.equal(await page.locator('#stop-speech').isVisible(),false);await page.waitForTimeout(500);assert.equal(await page.locator('#stop-speech').isVisible(),false);assert.deepEqual(errors,[]);
 const after=await get('/api/usage');assert.deepEqual(after.events.map(e=>[e.id,e.estimatedCost]),before.events.map(e=>[e.id,e.estimatedCost]));
 const report={testedAt:new Date().toISOString(),passed:true,model:speech.model,revision:speech.revision,models:config.models,decodedPlaybackStartMs,audioHttpStatus:audioStatus,hostStopPassed:true,teamsInviteBlank:true,consentInitiallyUnchecked:true,usageCountBefore:before.events.length,usageCountAfter:after.events.length,paidMuseCalls:0,realMeetingJoined:false,physicalAudibilityVerified:false,notes:'Protected hosted UI to real self-hosted MMS queue and muted Chromium playback; no Teams join or participant audio. Native browser voice fallback disabled.'};
 await writeFile(new URL('../docs/research/mms-hosted-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{
 if(meetingId){const response=await fetch(origin+'/api/meetings/'+meetingId,{method:'DELETE',headers,redirect:'error'});assert.equal(response.status,200);}
 await browser.close();
}
