import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createMeeting,addFinal,markdown} from '../src/core.js';
import {editTeamsRecord,reviewTeamsRecord} from '../src/teams-review.js';
const base=process.env.RALLY_TEST_URL||'http://127.0.0.1:8792';
let m={...createMeeting({agenda:['Recorded Teams discussion'],minutes:3,wrapMinutes:.5},'teams-review-browser'),version:0};
m.kind='teams';m.phase='ended';m.paused=true;m.source={state:'left',transcriptionState:'stopped'};m.startedAt=m.createdAt;m.endedAt=m.createdAt;
addFinal(m,{sessionId:'fixture',turnId:0,transcript:'Priya will run rollback by Thursday.'});
addFinal(m,{sessionId:'fixture',turnId:1,transcript:'<img src=x onerror="window.pwned=true">'});
let locked=false,paidRequests=0,failNextEdit=false;
const repository={async get(){return structuredClone(m);},async save(value){value.version++;m=structuredClone(value);},async lease(){if(locked)return false;locked=true;return true;},async release(){locked=false;}};
const services={async moderate(){paidRequests++;await new Promise(r=>setTimeout(r,120));return{usage:{id:`fixture-usage-${paidRequests}`},decision:{intervene:false,kind:'none',spoken_text:'',evidence_turn_ids:[],outcomes:[{type:'action',text:'Run rollback.',owner:'Priya',due_date:'Thursday',evidence_turn_ids:['fixture:0']}]}};}};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1080}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
await page.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname;let result={};
 try{
  if(path==='/api/config')result={liveAvailable:true,meetingBudget:.25,buildBudget:.5};
  else if(path==='/api/costs')result={total:0,unknown:0,baseline:0};
  else if(path==='/api/teams/status')result={online:false};
  else if(path==='/api/meetings')result={meetings:[m]};
  else if(path.endsWith('/record')){if(failNextEdit){failNextEdit=false;throw new Error('Record changed. Refresh to continue.');}result=await editTeamsRecord(repository,m.id,route.request().postDataJSON());}
  else if(path.endsWith('/review'))result=await reviewTeamsRecord({RALLY_PAID_ENABLED:'1',MODEL_API_KEY:'fixture-only'},repository,m.id,route.request().postDataJSON(),services);
  else if(path.endsWith('/confirm'))result=await editTeamsRecord(repository,m.id,{...route.request().postDataJSON(),action:'confirm'});
  else if(path.endsWith('/export')){await route.fulfill({body:markdown(m),contentType:'text/markdown'});return;}
  else if(path.endsWith('/'+m.id))result={meeting:m};
  else throw new Error(`Unexpected API operation: ${path}`);
  await route.fulfill({json:result});
 }catch(error){await route.fulfill({status:409,json:{error:error.message}});}
});
try{
 await page.goto(`${base}/#meeting/${m.id}`);await page.locator('#teams-review-panel').waitFor({state:'visible'});
 assert.equal(await page.locator('#review-consent').isChecked(),false);assert.equal(await page.locator('#review-teams').isEnabled(),false);assert.equal(paidRequests,0);
 await page.locator('#review-title').fill('Release planning');await page.locator('#review-agenda').fill('Decide release');await page.locator('#review-participants').fill('Priya, Sam');
 await page.getByRole('button',{name:'Save meeting details',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#meeting-title').textContent==='Release planning');assert.equal(paidRequests,0);
 page.once('dialog',d=>d.accept('Priya'));await page.locator('[data-speaker-turn="fixture:0"]').click();await page.waitForFunction(()=>document.querySelector('#transcript strong').textContent==='Priya');
 await page.locator('#review-consent').check();await page.locator('#review-teams').click();await page.getByRole('button',{name:'Review & confirm',exact:true}).waitFor();assert.equal(paidRequests,1);assert.equal(await page.locator('#action-score').textContent(),'0');assert.equal(await page.locator('#review-consent').isChecked(),false);
 assert.equal(await page.locator('#transcript img').count(),0);assert.equal(await page.evaluate(()=>window.pwned),undefined);
 await page.getByRole('button',{name:'Review & confirm',exact:true}).click();assert.equal(await page.locator('#confirm-check').isChecked(),false);await page.locator('#confirm-check').check();await page.locator('#confirm-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#action-score').textContent==='1');
 page.once('dialog',d=>d.accept('Sam'));await page.locator('[data-speaker-turn="fixture:0"]').click();await page.waitForFunction(()=>document.querySelector('.outcome-status').textContent==='disputed');assert.equal(await page.locator('#action-score').textContent(),'0');assert.match(await page.locator('#teams-review-status').textContent(),/changed/);
 await page.getByRole('button',{name:'Dismiss proposal',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.outcome-status').textContent==='rejected');
 await page.locator('#review-consent').check();await page.locator('#review-teams').click();await page.waitForFunction(()=>!document.querySelector('#teams-review-fields').disabled);assert.equal(paidRequests,2);assert.equal(m.outcomes[0].status,'rejected');
 await page.locator('#review-consent').check();await page.locator('#review-teams').click();await page.waitForFunction(()=>!document.querySelector('#teams-review-fields').disabled);assert.equal(paidRequests,2);assert.match(await page.locator('#toast').textContent(),/No new model request/);
 failNextEdit=true;await page.locator('#review-consent').check();await page.locator('#review-teams').click();await page.waitForFunction(()=>document.querySelector('#teams-review-error').textContent.includes('Record changed'));assert.equal(paidRequests,2);assert.equal(await page.locator('#review-consent').isChecked(),false);
 await page.locator('#review-consent').check();await page.locator('#back-home').click();await page.locator('[data-meeting="teams-review-browser"]').first().click();await page.locator('#teams-review-panel').waitFor({state:'visible'});assert.equal(await page.locator('#review-consent').isChecked(),false);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/teams-review-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('Saved Teams review UI passed: context, explicit consent, proposals, confirmation, speaker correction/dispute, dismissal, cache, failure, navigation reset, safe rendering and mobile layout. Fixture provider only; zero real model calls.');
}finally{await browser.close();}
