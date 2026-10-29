// Read-only published UI check. Does not submit a link or opt into processing.
import {chromium} from '../apps/rally/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const env=parseEnv(await readFile(new URL('.env.local',root),'utf8'));
const base='https://rally-meeting-moderator.excavator3496.chatgpt.site';
const browser=await chromium.launch({headless:true,executablePath:'/home/hack/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const request=route.request();
  if(new URL(request.url()).origin!==base)return route.abort();
  // Prevent this QA harness from ever posting a join/transcription action.
  if(!['GET','HEAD'].includes(request.method()))return route.abort();
  return route.continue({headers:{...request.headers(),'OAI-Sites-Authorization':`Bearer ${env.RALLY_SITES_SERVICE_TOKEN}`}});
 });
 await page.goto(base);
 await page.waitForFunction(()=>document.querySelector('#teams-runner')?.textContent==='Server online'&&!document.querySelector('#teams-transcribe').disabled);
 assert.equal(await page.locator('#teams-token-setup').isVisible(),false);
 assert.equal(await page.locator('#teams-link').inputValue(),'');
 assert.equal(await page.locator('#teams-consent').isChecked(),false);
 assert.equal(await page.locator('#teams-transcribe').isChecked(),false);
 const note=await page.locator('#teams-credential-note').textContent();assert.match(note,/paste your link.*lobby/i);
 await page.locator('#teams-connection').scrollIntoViewIfNeeded();
 await mkdir(new URL('apps/rally/test-results/',root),{recursive:true});
 await page.screenshot({path:new URL('apps/rally/test-results/teams-transcription-hosted.png',root).pathname});
 assert.deepEqual(errors,[]);
 const result={checkedAt:new Date().toISOString(),passed:true,readOnly:true,runnerOnline:true,transcriptionEnabled:true,acsSetupHidden:true,meetingLinkBlank:true,consentUnchecked:true,transcriptionUnchecked:true,postedActions:0,paidCalls:0};
 await writeFile(new URL('docs/research/teams-transcription-hosted-ui-check.json',root),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
}finally{await browser.close();}
