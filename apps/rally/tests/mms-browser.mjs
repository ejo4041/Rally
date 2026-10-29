import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.RALLY_TEST_URL||'http://127.0.0.1:8792';
const status=await(await fetch(base+'/api/speech/status')).json();assert.equal(status.online,true,'Start a warm local MMS queue runner against this preview first');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage();page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',e=>errors.push(e.message));let meetingId,audioStatus;
page.on('response',response=>{if(new URL(response.url()).pathname.startsWith('/api/speech/audio/'))audioStatus=response.status();});
try{
 await page.goto(base);await page.locator('#try-demo').click();await page.locator('#test-voice').waitFor({state:'visible'});meetingId=new URL(page.url()).hash.split('/')[1];
 const start=performance.now();await page.locator('#test-voice').click();await page.waitForFunction(()=>document.querySelector('#rally-state').textContent==='Speaking');const decodedPlaybackStartMs=Math.round(performance.now()-start);
 assert.equal(audioStatus,200);await page.locator('#stop-speech').click();assert.equal(await page.locator('#stop-speech').isVisible(),false);await page.waitForTimeout(500);assert.equal(await page.locator('#stop-speech').isVisible(),false);assert.deepEqual(errors,[]);
 // Exercise the actual saved-utterance path too, using the explicitly labeled
 // walkthrough. This starts no microphone or paid reasoning/transcription.
 await page.locator('#consent').check();const openingStart=performance.now();await page.locator('#start-meeting').click();await page.waitForFunction(()=>document.querySelector('#rally-state').textContent==='Speaking');const approvedOpeningPlaybackMs=Math.round(performance.now()-openingStart);
 await page.locator('#stop-speech').click();await page.locator('#end-meeting').click();await page.waitForFunction(()=>document.querySelector('#phase-badge').textContent==='Saved');await page.waitForTimeout(100);
 assert.equal((await(await fetch(base+'/api/usage')).json()).events.length,0);
 const report={testedAt:new Date().toISOString(),browser:await browser.version(),model:status.model,revision:status.revision,decodedPlaybackStartMs,approvedOpeningPlaybackMs,audioHttpStatus:audioStatus,cancelButtonHiddenAfterStop:true,paidMuseCalls:0,realMeetingJoined:false,physicalAudibilityVerified:false,notes:'Real local MMS generation through Worker/D1 queue into Chromium Audio playback. Headless browser audio was muted; onplaying establishes decoded playback, not physical sound or Teams transmission.'};
 await mkdir('test-results',{recursive:true});await writeFile('test-results/mms-queue-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{if(meetingId)await fetch(base+'/api/meetings/'+meetingId,{method:'DELETE'});await browser.close();}
