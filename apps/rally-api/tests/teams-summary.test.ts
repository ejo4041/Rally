import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {postTeamsSummary,summaryURL,leaveTeamsMeeting} from '../src/teams-summary.ts';
test('summary links use configured origin and no access token',()=>{
 assert.equal(summaryURL('https://rally.example/ignored?private=value','meeting-id'),'https://rally.example/#report/meeting-id');
 assert.throws(()=>summaryURL('javascript:alert(1)','m'),/Invalid summary origin/);
});
test('chat sends one access-controlled link and never retries an uncertain click',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage(),url='https://rally.example/#report/test';
 await page.setContent(`<button aria-label="Chat" onclick="document.querySelector('[contenteditable]').hidden=true">Chat</button><div contenteditable="true" role="textbox"></div><button aria-label="Send">Send</button><section id="messages"></section><script>window.sends=0;document.querySelector('[aria-label=Send]').onclick=()=>{window.sends++;const a=document.createElement('a');a.href='${url}';a.textContent=document.querySelector('[contenteditable]').textContent;document.querySelector('#messages').append(a);document.querySelector('[contenteditable]').textContent='';};</script>`);
 assert.equal(await postTeamsSummary(page,url),'sent');assert.equal(await page.evaluate(()=>(window as any).sends),1);assert.match(await page.locator('#messages').textContent()??'',/host can grant report access/);
 await page.evaluate(()=>(window as any).sends=0);await page.setContent('<button aria-label="Chat">Chat</button><div contenteditable="true" role="textbox"></div><button aria-label="Send" onclick="window.sends=(window.sends||0)+1">Send</button>');
 assert.equal(await postTeamsSummary(page,url),'unknown');assert.equal(await page.evaluate(()=>(window as any).sends),1);
 await page.setContent('<p>Meeting chat is disabled.</p>');assert.equal(await postTeamsSummary(page,url),'unavailable');
 }finally{await browser.close();}
});

test('normal leave waits for post-call confirmation rather than browser shutdown',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{const page=await browser.newPage();
 await page.setContent(`<button aria-label="Leave" onclick="setTimeout(()=>{document.body.innerHTML='<p>You left the meeting</p>';},250)">Leave</button>`);
 const started=Date.now();assert.equal(await leaveTeamsMeeting(page),true);assert.ok(Date.now()-started>=900);assert.equal(await page.isClosed(),false);
 }finally{await browser.close();}
});
