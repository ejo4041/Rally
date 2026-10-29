import { chromium } from 'playwright';
import { callingAuth, identityClient } from './auth.mjs';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { serve } from './serve.mjs';

const envPath = new URL('../../.env.local', import.meta.url);
const runnerId = randomUUID();
let browser, page, active, server, shuttingDown = false;
let identity, closing, lastUnavailableLog=0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function settings() { return { ...parseEnv(await readFile(envPath,'utf8')), ...process.env }; }
function log(message) { console.log(new Date().toISOString(), message); }
async function api(config, action, data) {
  const url = new URL(`/api/teams/runner/${action}`,config.RALLY_TEAMS_SITE_URL);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('Invalid Site origin.');
  const response = await fetch(url, { method:'POST', redirect:'error', signal:AbortSignal.timeout(8000), headers:{
    'Content-Type':'application/json','X-Rally-Bridge':config.RALLY_TEAMS_BRIDGE_SECRET,
    ...(config.RALLY_SITES_SERVICE_TOKEN ? {'OAI-Sites-Authorization':`Bearer ${config.RALLY_SITES_SERVICE_TOKEN}`} : {}),
  }, body:JSON.stringify({runnerId,...data}) });
  if (!response.ok) throw new Error(`Site runner operation returned HTTP ${response.status}.`);
  return response.json();
}
async function closeSession() {
  if (closing) return closing;
  const previous={page,browser,identity};
  clearTimeout(active?.timer); active=null;page=null;browser=null;identity=null;
  closing=(async()=>{
    if(previous.page){
      try { await Promise.race([previous.page.evaluate(()=>window.rallyTeamsLeave?.()),sleep(1500)]); } catch {}
      await previous.page.close().catch(()=>{});
    }
    await previous.browser?.close().catch(()=>{});
    if(previous.identity){
      try { await previous.identity.client.deleteUser(previous.identity.user,{abortSignal:AbortSignal.timeout(5000)}); }
      catch { log('ACS temporary identity cleanup failed; inspect Azure resource.'); }
    }
  })();
  try { await closing; } finally { closing=null; }
}
async function startSession(job, config) {
  const current = { id:job.id, deadline:job.deadline, started:Date.now() };active=current;
  // Independent server deadline, even if the Site connection fails.
  active.timer = setTimeout(() => {
    closeSession().then(()=>api(config,'update',{id:job.id,state:'left'})).catch(()=>{});
  },Math.max(1,job.deadline-Date.now()));
  const auth=callingAuth(config);
  let token = job.token || (auth.mode==='temporary-token' ? config.AZURE_COMMUNICATION_TOKEN : null);
  if (!token && auth.configured) {
    const client = identityClient(config);
    const issued = await client.createUserAndToken(['voip'],{abortSignal:AbortSignal.timeout(10000)});
    if(active!==current){await client.deleteUser(issued.user,{abortSignal:AbortSignal.timeout(5000)});throw new Error('Test canceled.');}
    identity = { client, user:issued.user }; token = issued.token;
  }
  if (!token) throw new Error('ACS calling credentials are not configured.');
  const launched = await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
  if(active!==current){await launched.close();throw new Error('Test canceled.');}browser=launched;
  page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}`);
  await page.waitForFunction(()=>!!window.sdkProbe,{},{timeout:15000});
  await page.locator('#meeting').fill(job.meetingUrl);
  await page.locator('#token').fill(token);
  await page.locator('#consent').check();
  if(active!==current)throw new Error('Test canceled.');
  await page.locator('#join').click();
  log('Teams connection test launched.');
}

server = await serve();
log('Teams runner started; no meeting joined.');
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{ shuttingDown=true; });
while (!shuttingDown) {
  let config;
  try {
    config = await settings();
    if (!config.RALLY_TEAMS_SITE_URL || !config.RALLY_TEAMS_BRIDGE_SECRET) throw new Error('Runner configuration missing.');
    const {job} = await api(config,'poll',{credentialsConfigured:callingAuth(config).configured});
    if (active && (!job || job.id !== active.id || job.leaveRequested || Date.now() >= active.deadline)) {
      const id = active.id;
      await closeSession();
      await api(config,'update',{id,state:'left'});
      log('Teams connection test closed.');
    }
    if (job?.claimed && !shuttingDown) {
      try { await startSession(job,config); }
      catch {
        await closeSession();
        await api(config,'update',{id:job.id,state:'failed'});
        log('Teams connection test failed; details intentionally exclude credentials and meeting links.');
      }
    }
    if (active && page) {
      let status;
      try { status = await page.evaluate(()=>window.rallyTeamsStatus()); }
      catch { status={state:'Failed'}; }
      const mapping = {Connected:'connected',InLobby:'lobby',Connecting:'joining',Ringing:'joining',EarlyMedia:'joining',None:'joining'};
      const state = mapping[status.state] || 'failed';
      await api(config,'update',{id:active.id,state,inputLevel:status.inputLevel});
      if (state === 'failed') { await closeSession(); log('Teams client ended or failed.'); }
    }
  } catch {
    // Never keep a meeting orphaned when host controls cannot reach the runner.
    if (active) { await closeSession(); log('Site controls unavailable; Teams client closed.'); }
    if(Date.now()-lastUnavailableLog>30_000){log('Waiting for Site connectivity/configuration.');lastUnavailableLog=Date.now();}
  }
  await sleep(2000);
}
await closeSession();
await new Promise(resolve=>server.close(resolve));
log('Teams runner stopped.');
