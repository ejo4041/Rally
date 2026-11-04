// Real shared UI against the isolated simulator. No live records, models or capture.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../../../demo/',import.meta.url),out=process.env.RALLY_VISUAL_OUT||'/tmp/rally-theme-review';await mkdir(out,{recursive:true});
const widths=(process.env.RALLY_VISUAL_WIDTHS||'390,1280').split(',').map(Number),themes=['dark','light'];
const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://local').pathname.slice(1)||'index.html';if(!/^(?:demo-audio\/)?[a-zA-Z0-9.\-]+$/.test(name))throw Error();res.setHeader('Content-Type',name.endsWith('.wav')?'audio/wav':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(new URL(name,root)));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.DEMO_PUBLIC_URL||`http://127.0.0.1:${server.address().port}/`;
let browser;const results=[],errors=[],network=[];
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage',...(process.env.DEMO_PUBLIC_URL?['--host-resolver-rules=MAP rally.tail703f9e.ts.net 209.177.145.192']:[])]});
 for(const width of widths)for(const theme of themes){
  const height=Number(process.env.RALLY_VISUAL_HEIGHT)||(width<=430?844:width<=850?1024:900);
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/')||/^wss?:/.test(r.url()))network.push(r.url());});
  await page.addInitScript(t=>localStorage.setItem('rally:appearance',t),theme);
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('#workspace').waitFor();
  async function shot(name){await page.waitForTimeout(70);const metrics=await page.evaluate(()=>{
   const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&r.bottom>0&&r.top<innerHeight;};
   const key=e=>e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+[...e.classList].join('.');
   const bright=[],overflow=[],contrast=[];
   const rgb=s=>{const c=s.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];return s.startsWith('color(srgb ')?c.map((v,i)=>i<3?v*255:v):c;};
   const blend=(c,b)=>c.slice(0,3).map((v,i)=>v*(c[3]??1)+b[i]*(1-(c[3]??1)));
   const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
   const modalOpen=document.querySelector('dialog[open]');

   for(const e of document.querySelectorAll('body *')){if(!visible(e)||['SCRIPT','STYLE','SVG','PATH'].includes(e.tagName)||e.closest('svg'))continue;const r=e.getBoundingClientRect(),s=getComputedStyle(e),c=s.backgroundColor.match(/[\d.]+/g)?.map(Number)||[];
    if(c.length>=3&&(c[3]??1)>.95&&Math.min(...c.slice(0,3))>210&&r.width>60&&r.height>18)bright.push({element:key(e),background:s.backgroundColor,width:Math.round(r.width),height:Math.round(r.height)});
    if((!modalOpen||modalOpen.contains(e))&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!e.closest('.model-art,.hero-art,.brand,[aria-hidden=true],button:disabled,[aria-disabled=true]')&&Number(s.opacity)>.99){
     let bg=[255,255,255];const chain=[];for(let a=e;a;a=a.parentElement)chain.unshift(a);for(const a of chain)bg=blend(rgb(getComputedStyle(a).backgroundColor),bg);
     const fg=blend(rgb(s.color),bg),ratio=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);
     if(ratio<(large?3:4.5)-.05)contrast.push({element:key(e),ratio:Math.round(ratio*100)/100,text:e.textContent.trim().slice(0,65),foreground:s.color,background:bg});
    }
    if((r.right>innerWidth+2||r.left< -2)&&!e.closest('.hero-art,.model-art,.rally-silk')&&getComputedStyle(e.parentElement).overflowX==='visible')overflow.push({element:key(e),left:Math.round(r.left),right:Math.round(r.right)});
   }
   const modal=document.querySelector('dialog[open]'),rect=modal?.getBoundingClientRect();
   return {rootBackground:getComputedStyle(document.documentElement).backgroundColor,bodyBackground:getComputedStyle(document.body).backgroundColor,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,metaBottom:document.querySelector('#home .meta-products')?.getBoundingClientRect().bottom,bright,overflow,contrast,modal:rect?{top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right}:null};
  });results.push({width,height,theme,stage:name,...metrics});await page.screenshot({path:`${out}/${width}-${theme}-${name}.png`});}
  await shot('home');await page.locator('#new-meeting').click();await shot('create');await page.locator('#create-submit').click();await page.locator('#meeting-title').filter({hasText:'release readiness'}).waitFor();await shot('setup');
  await page.locator('#edit-plan').click();await shot('plan-editor');await page.locator('#plan-dialog [data-close]').click();
  await page.locator('#consent').check();await page.locator('#start').click();await page.locator('#request-guidance').click();await page.locator('#rally-replies-section').waitFor({state:'attached'});await page.evaluate(()=>scrollTo(0,0));await shot('live');
  for(const [control,dialog] of [['open-plan','plan-sheet'],['open-conversation','conversation-sheet'],['open-settings','meeting-settings']]){await page.locator('#'+control).click();await shot(dialog);await page.locator('#'+dialog+' [data-close]').first().click();}
  await page.locator('#end').click();await page.locator('#report-status').filter({hasText:'Ready'}).waitFor();
  await page.locator(width<=650?'#mobile-home':'#home-nav').click();await page.locator('#history [data-meeting="demo-1"]').click();await page.locator('#report-body .score-list').waitFor();await page.evaluate(()=>scrollTo(0,0));await shot('report');
  await page.locator('#share-report').click();await shot('sharing');await page.locator('#report-sharing-dialog [data-close]').click();
  await page.locator('#draft-follow-up').click();await page.locator('#follow-up-choices input').first().check();await shot('follow-up');await page.locator('#follow-up-dialog [data-close]').click();
  await page.locator('.account-menu summary').click();await page.locator('#usage-button').click();await shot('usage');await page.locator('#usage-dialog [data-close]').click();
  await context.close();
 }
 await writeFile(out+'/audit.json',JSON.stringify({results,errors,network},null,2));
 const problems=results.flatMap(r=>{const p=[];if(r.scrollWidth>r.viewport+1)p.push(`${r.width}/${r.theme}/${r.stage}: page overflow`);if(r.theme==='dark'&&r.bright.length)p.push(`${r.width}/${r.theme}/${r.stage}: bright surfaces ${r.bright.map(v=>v.element).join(',')}`);if(r.theme==='dark'&&r.rootBackground!==r.bodyBackground)p.push(`${r.width}/${r.theme}/${r.stage}: document canvas mismatches body`);if(r.contrast.length)p.push(`${r.width}/${r.theme}/${r.stage}: text contrast ${r.contrast.map(c=>c.element).join(',')}`);if(r.modal&&(r.modal.left< -1||r.modal.right>r.viewport+1||r.modal.top< -1))p.push(`${r.width}/${r.theme}/${r.stage}: modal out of bounds`);return p;});
 console.log(JSON.stringify({screens:results.length,errors,network,problems,contrastWarnings:results.flatMap(r=>r.contrast.map(c=>({width:r.width,theme:r.theme,stage:r.stage,...c}))),artifacts:out}));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);if(process.env.RALLY_VISUAL_STRICT==='1')assert.deepEqual(problems,[]);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
