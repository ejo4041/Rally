// Read existing local configuration without printing credentials. This check
// uses a labeled walkthrough and never opens a real model or meeting session.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../apps/rally/package.json',import.meta.url));
const WebSocket=require('ws');
const settings=Object.fromEntries((await readFile(new URL('../.env.local',import.meta.url),'utf8')).split('\n').map(line=>{const i=line.indexOf('=');return i<0?[]:[line.slice(0,i),line.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}).filter(pair=>pair.length));
const origin='https://rally-meeting-moderator.excavator3496.chatgpt.site';
assert.ok(settings.RALLY_SITES_SERVICE_TOKEN,'Existing protected Site credential is required');
const headers={'OAI-Sites-Authorization':'Bearer '+settings.RALLY_SITES_SERVICE_TOKEN,Origin:origin,'Content-Type':'application/json'};
async function call(path,body,method){const response=await fetch(origin+path,{headers,redirect:'error',method:method||(body?'POST':'GET'),body:body?JSON.stringify(body):undefined});assert.ok(response.ok,`Hosted request failed (${response.status}): ${path}`);return response;}
let id,liveId,socket;const checks=[];
try{
 const before=(await(await call('/api/usage')).json()).events.map(e=>e.id).sort();
 const home=await call('/');assert.match(home.headers.get('permissions-policy'),/display-capture=\(self\)/);const html=await home.text();assert.match(html,/Meeting browser tab/);assert.match(html,/Check audio · free/);
 const captureModule=await(await call('/audio-input.js')).text();assert.match(captureModule,/getDisplayMedia/);assert.match(captureModule,/async check/);checks.push('hosted tab-audio UI, module and permission policy');
 const draft=(await(await call('/api/meetings',{title:'Hosted platform metadata check',agenda:['Check setup'],minutes:3,wrapMinutes:.5,captureMode:'meeting-tab',platform:'whatsapp',includeMicrophone:true})).json()).meeting;liveId=draft.id;
 assert.deepEqual(draft.capture,{mode:'meeting-tab',platform:'whatsapp',includeMicrophone:true});checks.push('WhatsApp capture settings persist without starting paid processing');
 const meeting=(await(await call('/api/meetings',{kind:'walkthrough',title:'Hosted sharing walkthrough',minutes:2,wrapMinutes:.5})).json()).meeting;id=meeting.id;
 socket=new WebSocket(origin.replace('https:','wss:')+`/api/meetings/${id}/connect`,{headers:{'OAI-Sites-Authorization':headers['OAI-Sites-Authorization']},origin});
 const messages=[];let wake;socket.on('message',data=>{const value=JSON.parse(data);if(value.type==='speak')socket.send(JSON.stringify({type:'playback',id:value.utterance.id,state:'shown'}));messages.push(value);wake?.();});
 await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
 async function until(predicate){const deadline=Date.now()+20000;for(;;){const index=messages.findIndex(predicate);if(index>=0)return messages.splice(index,1)[0];assert.ok(Date.now()<deadline,'Hosted walkthrough response timed out');await new Promise(resolve=>{const timer=setTimeout(resolve,250);wake=()=>{clearTimeout(timer);resolve();};});}}
 const send=value=>socket.send(JSON.stringify(value));send({type:'start',consented:true});await until(m=>m.type==='ready');let state;
 for(let i=1;i<=6;i++){send({type:'walkthrough_next'});state=await until(m=>m.type==='state'&&m.meeting.turns.length===i);}
 const action=state.meeting.outcomes.find(o=>o.type==='action');send({type:'confirm',id:action.id,owner:'Priya',dueDate:'Thursday at 3 PM'});await until(m=>m.type==='state'&&m.meeting.outcomes.some(o=>o.status==='confirmed'));
 send({type:'end'});await until(m=>m.type==='state'&&m.meeting.phase==='ended');socket.close();
 const followup=await(await call(`/api/meetings/${id}/followup`,{})).json();assert.equal(followup.confirmedCount,1);assert.match(followup.text,/Priya/);assert.ok(!followup.text.includes('Release only after'));assert.ok(!followup.text.includes('mountain bikes'));checks.push('hosted confirmed follow-up excludes proposed outcomes and transcript');
 await call(`/api/meetings/${id}`,undefined,'DELETE');id=null;await call(`/api/meetings/${liveId}`,undefined,'DELETE');liveId=null;
 const after=(await(await call('/api/usage')).json()).events.map(e=>e.id).sort();assert.deepEqual(after,before);checks.push('test records removed and Muse usage unchanged');
 const report={testedAt:new Date().toISOString(),passed:true,version:11,checks,paidModelCalls:0,realPlatformCall:false,externalMessagesSent:0};await writeFile(new URL('../docs/research/platform-hosted-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{socket?.close();for(const key of[id,liveId])if(key)await call(`/api/meetings/${key}`,undefined,'DELETE');}
