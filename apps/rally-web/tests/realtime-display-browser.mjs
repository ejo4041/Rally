// Actual DOM and user controls, normalized synthetic events; no provider calls.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{contents:`import {RallyDisplay} from './src/rally-display.ts'; window.fixture=new RallyDisplay(async()=>{window.refreshed=true},e=>{throw e}); document.querySelector('#workspace').hidden=false;document.querySelector('#meeting').hidden=false;document.querySelector('#auth-screen').hidden=true;`,resolveDir:process.cwd(),sourcefile:'fixture.ts'},bundle:true,write:false,format:'iife',platform:'browser'});
const now=Date.now(),check={id:'c1',sequence:1,capturedAt:now,completedAt:now+10,status:'accepted',epoch:1,planRevision:0,latencyMs:10,decision:{health:4,feeling:'curious',observation:'This exploration helps the next agenda item.',progress:'',concern:'',evidence:[],intervention:null,agendaChange:null,extension:null,extensionConsent:null}};
let confirmation;
const server=createServer(async(req,res)=>{
 if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
 if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(readFileSync('src/style.css'));return;}
 if(req.url?.includes('/checks')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({items:[check],nextCursor:null}));return;}
 if(req.url==='/api/meetings/test/extension'){let body='';for await(const chunk of req)body+=chunk;confirmation=JSON.parse(body);res.setHeader('Content-Type','application/json');res.end('{}');return;}
 res.setHeader('Content-Type','text/html');res.end(readFileSync('src/index.html','utf8').replace(/<script[^>]*src="[^\"]*app.js"[^>]*><\/script>/g,'')+'<script src="/fixture.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const meeting={id:'test',phase:'live',epoch:1,paused:false,monitor:check,revisions:[{at:now,reason:'Discuss the customer finding before implementation.',plan:{}}],extension:{id:'extra',minutes:5,deadline:now+300000,state:'pending',reason:'Finish the current decision.'}};
 await page.evaluate(m=>window.fixture.render(m),meeting);
 assert.equal(await page.locator('#rally-display').getAttribute('data-feeling'),'curious');assert.match(await page.locator('#health').textContent(),/4\/5/);
 assert.match(await page.locator('#assessment-note').textContent(),/helps the next agenda/);
 await page.locator('#rally-history summary').click();await page.locator('.rally-check').first().waitFor();assert.match(await page.locator('#rally-history-items').textContent(),/Discuss the customer finding/);
 await page.getByRole('button',{name:'Confirm extra time'}).click();await page.waitForFunction(()=>window.refreshed===true);assert.deepEqual(confirmation,{proposalId:'extra',accept:true});
 await page.evaluate(()=>{window.fixture.event({type:'speech.status',data:{id:'voice',state:'preparing',text:"Let's get back on track.",destination:'browser',epoch:1}});window.fixture.playback('voice',1000,true);});
 assert.equal(await page.locator('#guidance .spoken').count(),2);assert.equal(await page.locator('#readalong-note').isVisible(),true);
 await page.evaluate(()=>{window.fixture.stop();window.fixture.playback('voice',5000,true);});assert.equal(await page.locator('#guidance .spoken').count(),2);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(300);assert.equal(await page.locator('#guidance .read-word').count(),0);assert.equal(await page.locator('#guidance').textContent(),"Let's get back on track.");
 await page.evaluate(m=>{window.fixture.clear();window.fixture.render({...m,speechStatus:{id:'old',text:'Already heard.',state:'playing',destination:'teams',epoch:1}});window.fixture.playback('old',1000,true);},meeting);
 assert.equal(await page.locator('#guidance .read-word').count(),0);
 await page.evaluate(m=>window.fixture.render({...m,monitor:{...m.monitor,capturedAt:Date.now()-30000}}),meeting);assert.equal(await page.locator('#rally-display').getAttribute('data-feeling'),'neutral');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,emotionAndFreshness:true,history:true,extensionConfirmation:true,readAlongStopReducedMotionReconnect:true,providers:'none'}));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
