import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../../../demo/',import.meta.url);
const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://local').pathname.slice(1)||'index.html';if(!/^(?:demo-audio\/)?[a-zA-Z0-9.\-]+$/.test(name))throw Error();const data=await readFile(new URL(name,root));res.setHeader('Content-Type',name.endsWith('.wav')?'audio/wav':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'text/html');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.DEMO_PUBLIC_URL||`http://127.0.0.1:${server.address().port}/`;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage',...(process.env.DEMO_PUBLIC_URL?['--host-resolver-rules=MAP rally.tail703f9e.ts.net 209.177.145.192']:[])]});
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',acceptDownloads:true});
 const page=await context.newPage(),requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));

 await page.addInitScript(()=>{window.__mediaCalls=[];for(const name of ['getUserMedia','getDisplayMedia']){if(navigator.mediaDevices)navigator.mediaDevices[name]=()=>{window.__mediaCalls.push(name);throw Error('Demo requested media');};}window.WebSocket=class {constructor(){window.__mediaCalls.push('WebSocket');throw Error('Demo opened a socket');}};});
 await page.goto(base,{waitUntil:'networkidle'});
 await page.getByText('Demo mode · simulated meeting',{exact:true}).waitFor();
 await page.locator('#new-meeting').click();await page.locator('#create-dialog').waitFor();
 await page.locator('[name=title]').fill('Judge sample <img src=x onerror=alert(1)>');
 await page.locator('#create-submit').click();await page.locator('#meeting-title').filter({hasText:'Judge sample'}).waitFor();
 assert.equal(await page.locator('#meeting-title img').count(),0);
 await page.locator('#audio-mode').selectOption('teams');await page.locator('#consent').check();
 assert.equal(await page.locator('#start').isEnabled(),true);await page.locator('#start').click();
 await page.locator('#partial').filter({hasText:'Let’s'}).waitFor();
 await page.locator('#transcript .turn').first().waitFor();
 await page.locator('#mute').click();const paused=await page.locator('#transcript .turn').count();await page.waitForTimeout(500);assert.equal(await page.locator('#transcript .turn').count(),paused);await page.locator('#mute').click();
 await page.locator('#transcript [data-speaker]').first().click();await page.locator('#speaker-name').fill('<b>Sample host</b>');await page.locator('#speaker-form button[type=submit]').click();await page.locator('#speaker-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('#transcript strong b').count(),0);
 await page.locator('#request-guidance').click();await page.locator('#rally-replies-section').waitFor();
 await page.locator('#rally-history summary').click();await page.locator('#rally-history-status').filter({hasText:'No checks recorded yet.'}).waitFor();
 await page.locator('#end').click();await page.locator('#report-status').filter({hasText:'Ready'}).waitFor();
 const downloaded=page.waitForEvent('download');await page.locator('#export').click();const download=await downloaded;const file=JSON.parse(await readFile(await download.path(),'utf8'));assert.match(file.provenance,/Synthetic/);assert.ok(file.turns.length);
 await page.evaluate(()=>{window.__printed=false;window.print=()=>{window.__printed=true;};});await page.locator('#export-pdf').click();assert.equal(await page.evaluate(()=>window.__printed),true);
 await page.locator('#share-report').click();await page.locator('#report-recipient').fill('sample_judge');await page.locator('#report-share-form button').click();await page.locator('[data-revoke-report]').waitFor();await page.locator('[data-revoke-report]').click();assert.equal(await page.locator('[data-revoke-report]').count(),0);await page.getByRole('button',{name:'Close sharing',exact:true}).click();
 await page.locator('#home-nav').click();await page.locator('#history [data-meeting="demo-1"]').click();await page.locator('#report-body [data-evidence]').first().click();assert.equal(await page.locator('.turn.highlight').count(),1);
 await page.locator('#home-nav').click();await page.locator('.topbar [data-theme-selector]').selectOption('dark');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/rally-demo-desktop.png'});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/rally-demo-mobile.png'});
 assert.deepEqual(await page.evaluate(()=>window.__mediaCalls),[]);
 assert.equal(requests.some(u=>u.includes('/api/')||u.startsWith('wss:')||u.includes('model')),false,JSON.stringify(requests));assert.deepEqual(errors,[]);
 await page.locator('#reset-demo').click();await page.locator('#history [data-meeting="demo-1"]').waitFor();assert.equal(await page.locator('#history .history-row').count(),1);
 console.log(JSON.stringify({result:'passed',source:base,requests,consoleErrors:errors,checks:['same workspace/create modal/meeting/report UI','create and prepare','safe text rendering','simulated partial/final transcript','pause/resume replay','speaker correction','Ask Rally reply','end/report','JSON export','mock sharing/revoke','evidence navigation','desktop/mobile','reset','no API/model/WebSocket/media calls']}));
 await context.close();
 if(process.env.DEMO_PUBLIC_URL){const protectedPage=await browser.newPage();await protectedPage.goto(new URL('/?demo=1',base).href,{waitUntil:'networkidle'});await protectedPage.locator('#auth-form').waitFor();assert.equal(await protectedPage.locator('#workspace').isHidden(),true);assert.equal(await protectedPage.locator('.demo-banner').count(),0);assert.equal(await protectedPage.evaluate(async()=>{const r=await fetch('/api/auth/me');return r.status;}),401);await protectedPage.close();console.log('Regular app remains authenticated even with a demo query parameter.');}

}finally{await browser?.close();await new Promise(r=>server.close(r));}
