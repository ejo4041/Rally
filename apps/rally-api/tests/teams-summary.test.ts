import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {postTeamsSummary,summaryURL,leaveTeamsMeeting} from '../src/teams-summary.ts';
function fixture(ack=true,delay=false){return `<button aria-label="Chat" ${delay?'hidden':''}>Chat</button><div contenteditable="true" role="textbox" ${delay?'hidden':''}></div><button aria-label="Send">Send</button><section data-tid="chat-pane-message"></section><div role="dialog" hidden><label>Text to display<input id="display"></label><label>Address<input id="address"></label><button id="insert">Insert</button></div><script>(()=>{
 window.sends=0;const editor=document.querySelector('[contenteditable]'),dialog=document.querySelector('[role=dialog]');
 if(${delay})setTimeout(()=>document.querySelector('[aria-label=Chat]').hidden=false,250);
 document.querySelector('[aria-label=Chat]').onclick=()=>editor.hidden=!editor.hidden;
 editor.onkeydown=e=>{if(e.ctrlKey&&e.key==='k'){e.preventDefault();dialog.hidden=false;}};
 document.querySelector('#insert').onclick=()=>{const a=document.createElement('a');a.href=document.querySelector('#address').value;a.textContent=document.querySelector('#display').value;editor.append(a);dialog.hidden=true;editor.focus();const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(range);};
 document.querySelector('[aria-label=Send]').onclick=()=>{window.sends++;if(${ack}){const message=document.createElement('article');message.innerHTML=editor.innerHTML;document.querySelector('[data-tid=chat-pane-message]').append(message);editor.textContent='';}};
 })();</script>`;}
test('summary links use configured origin and no access token',()=>{assert.equal(summaryURL('https://rally.example/ignored?private=value','meeting-id'),'https://rally.example/#report/meeting-id');assert.throws(()=>summaryURL('javascript:alert(1)','m'),/Invalid summary origin/);});
test('chat waits for controls, inserts a real hyperlink, sends once and never retries uncertainty',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let html='';const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;try{const page=await browser.newPage(),url='https://rally.example/#report/test';const show=async(content:string)=>{html=content;await page.goto(base);};
 await show(fixture());assert.equal(await postTeamsSummary(page,url),'sent');assert.equal(await page.evaluate(()=>(window as any).sends),1);assert.equal(await page.locator('[data-tid=chat-pane-message] a').getAttribute('href'),url);assert.match(await page.locator('[data-tid=chat-pane-message]').textContent()??'',/host can grant report access/);
 await show(fixture(false));assert.equal(await postTeamsSummary(page,url),'unknown');assert.equal(await page.evaluate(()=>(window as any).sends),1);
 await show(fixture(true,true));assert.equal(await postTeamsSummary(page,url),'sent');
 await show('<p>Meeting chat is disabled.</p>');assert.equal(await postTeamsSummary(page,url),'unavailable');
 }finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
});
test('normal leave waits for post-call confirmation rather than browser shutdown',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{const page=await browser.newPage();await page.setContent(`<button aria-label="Leave" onclick="setTimeout(()=>{document.body.innerHTML='<p>You left the meeting</p>';},250)">Leave</button>`);const started=Date.now();assert.equal(await leaveTeamsMeeting(page),true);assert.ok(Date.now()-started>=900);assert.equal(page.isClosed(),false);}finally{await browser.close();}
});
