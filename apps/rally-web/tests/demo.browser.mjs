import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../../../demo/',import.meta.url);
const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://local').pathname.slice(1)||'index.html';if(!/^[a-zA-Z0-9.\-]+$/.test(name))throw Error();const data=await readFile(new URL(name,root));res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'text/html');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.DEMO_PUBLIC_URL||`http://127.0.0.1:${server.address().port}/`;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage',...(process.env.DEMO_PUBLIC_URL?['--host-resolver-rules=MAP rally.tail703f9e.ts.net 209.177.145.192']:[])]});
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',acceptDownloads:true});
 const page=await context.newPage(),requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.getByText('Interactive sample · scripted, synthetic content',{exact:true}).waitFor();
 await page.locator('#agenda').fill('<img src=x onerror=alert(1)> sample');await page.locator('#prepare').click();assert.equal(await page.locator('#agenda-preview img').count(),0);
 await page.locator('[data-stage=conversation]').click();await page.locator('#play').click();await page.locator('.partial').waitFor();await page.locator('#play').click();const paused=await page.locator('#progress').textContent();await page.waitForTimeout(200);assert.equal(await page.locator('#progress').textContent(),paused);
 await page.locator('#next').click();await page.getByRole('button',{name:'Identify speaker',exact:true}).first().click();await page.getByRole('textbox',{name:'Speaker label'}).fill('<b>Host</b>');await page.getByRole('button',{name:'Save label'}).click();assert.equal(await page.locator('#transcript strong b').count(),0);
 await page.locator('#finish').click();await page.locator('#host-note').fill('Sample host review');const downloaded=page.waitForEvent('download');await page.locator('#export').click();const download=await downloaded;const file=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(file.kind,'rally-synthetic-sample');assert.equal(file.hostNote,'Sample host review');
 await page.getByRole('button',{name:'View source · turn 5',exact:true}).click();assert.equal(await page.locator('#turn-4').textContent().then(t=>t.includes('only after')),true);
 await page.locator('#approach').selectOption('passive');assert.equal(await page.locator('.rally-turn').count(),0);await page.locator('#approach').selectOption('proactive');assert.equal(await page.locator('.rally-turn').count(),2);
 await page.locator('#reset').click();assert.match(await page.locator('#progress').textContent(),/^0 of/);
 await page.locator('[data-stage=plan]').click();await page.locator('[data-theme-selector]').selectOption('dark');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/rally-demo-desktop.png'});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/rally-demo-mobile.png'});
 assert.equal(requests.some(u=>u.includes('/api/')||u.startsWith('wss:')||u.includes('model')),false,JSON.stringify(requests));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'passed',source:base,requests,consoleErrors:errors,checks:['authored provenance','safe text rendering','play/pause','speaker edit','evidence navigation','passive/proactive','reset','JSON export','desktop/mobile','no API/model/websocket requests']}));
 await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}
