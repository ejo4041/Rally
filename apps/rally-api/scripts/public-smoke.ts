// Operator check: real public HTTPS/auth/media, synthetic audio, no model calls.
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {dispose} from '@livekit/rtc-node';
import {LiveKitMedia} from '../src/media.ts';
import {defaults} from '../src/config.ts';
import type {Meeting} from '../src/contracts.ts';
if(process.env.RALLY_PUBLIC_SMOKE!=='1')throw Error('Requires RALLY_PUBLIC_SMOKE=1 on deployment host');
const env=parseEnv(readFileSync('/srv/hackathon/rally-deployed/config/api.env','utf8'));
function required(name:string):string { const value=env[name]; if(!value)throw Error('Missing deployment setting '+name); return value; }
const username='audit_'+randomBytes(6).toString('hex'),password=randomBytes(18).toString('hex');
const base='https://rally.tail703f9e.ts.net';
const report:any={at:new Date().toISOString(),passed:false,scope:'Server browser through public Funnel relay; synthetic bidirectional media; not an independent external device or Teams rehearsal',paidCalls:0,platformJoins:0};
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,session:Awaited<ReturnType<LiveKitMedia["open"]>>|undefined;const db=new DatabaseSync('/srv/hackathon/rally-deployed/state/rally.sqlite');
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--host-resolver-rules=MAP rally.tail703f9e.ts.net '+(process.env.RALLY_PUBLIC_RELAY_IP||'209.177.145.192')]});
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto(base);
 await page.locator('#auth-toggle').click();await page.locator('#username').fill(username);await page.locator('#password').fill(password);await page.locator('#auth-submit').click();
 await page.locator('#workspace').waitFor({state:'visible'});
 const cookies=await context.cookies();assert.ok(cookies.some(c=>c.secure&&c.httpOnly));report.secureHttpOnlyCookie=true;
 await page.locator('#logout').click();await page.locator('#auth-screen').waitFor({state:'visible'});
 await page.locator('#username').fill(username);await page.locator('#password').fill(password);await page.locator('#auth-submit').click();await page.locator('#workspace').waitFor({state:'visible'});report.signupAndLogin=true;
 const other=db.prepare('SELECT id FROM meetings LIMIT 1').get() as {id:string}|undefined;
 if(other){assert.equal(await page.evaluate(async id=>(await fetch('/api/meetings/'+id)).status,other.id),404);report.ownerIsolation=true;}
 report.speechStatus=await page.evaluate(async()=>(await fetch('/api/speech/status')).json());
 await page.addScriptTag({content:readFileSync(new URL('../node_modules/livekit-client/dist/livekit-client.umd.js',import.meta.url),'utf8')});
 let bytes=0,energy=0;
 session=await new LiveKitMedia({...defaults,livekitUrl:required('LIVEKIT_URL'),livekitPublicUrl:required('LIVEKIT_PUBLIC_URL'),livekitKey:required('LIVEKIT_API_KEY'),livekitSecret:required('LIVEKIT_API_SECRET')}).open({id:username,captureSource:'browser'} as Meeting,data=>{bytes+=data.length;const pcm=new DataView(data.buffer,data.byteOffset,data.byteLength);for(let i=0;i+1<data.length;i+=2)energy+=pcm.getInt16(i,true)**2;},()=>{});
 const connection=await session.connection();
 await page.evaluate(async connection=>{
  const w=window as any,lk=w.LivekitClient;w.probeRoom=new lk.Room();w.received=0;
  w.probeRoom.on(lk.RoomEvent.TrackSubscribed,(track:any)=>{if(track.kind!=='audio')return;const el=track.attach();document.body.append(el);void el.play();const ctx=new AudioContext(),src=ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack])),a=ctx.createAnalyser();src.connect(a);setInterval(()=>{const b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);w.received=Math.max(w.received,Math.sqrt(b.reduce((s,v)=>s+v*v,0)/b.length));},20);});
  await w.probeRoom.connect(connection.url,connection.token);const ctx=new AudioContext();await ctx.resume();const osc=ctx.createOscillator(),dest=ctx.createMediaStreamDestination();osc.connect(dest);osc.start();await w.probeRoom.localParticipant.publishTrack(dest.stream.getAudioTracks()[0],{source:lk.Track.Source.Microphone});
 },connection);
 await new Promise(r=>setTimeout(r,1800));assert.ok(bytes>16000&&energy>0,'Public browser input reaches backend');
 async function* chunks(){for(let n=0;n<100;n++){const pcm=new Int16Array(320);for(let i=0;i<320;i++)pcm[i]=Math.sin((n*320+i)*2*Math.PI*440/16000)*8000;yield Buffer.from(pcm.buffer);}}
 await session.play!({id:'probe',interventionId:'probe',epoch:1,at:Date.now(),state:'preparing',destination:'browser'},chunks(),AbortSignal.timeout(15000),async()=>{});
 const rms=await page.evaluate(()=>(window as any).received);assert.ok(rms>0.01,'Backend audio reaches public browser');
 Object.assign(report,{passed:true,publicWebSocket:connection.url,incomingBytes:bytes,outgoingRms:rms});
}finally{
 const teardown = await Promise.allSettled([
  Promise.resolve().then(()=>session?.close()),
  Promise.resolve().then(()=>browser?.close()),
 ]);
 const native = await Promise.allSettled([Promise.resolve().then(()=>dispose())]);
 report.teardownFailures=[...teardown,...native].filter(result=>result.status==='rejected').length;
 if(report.teardownFailures)report.passed=false;
 try {
  const user=db.prepare('SELECT id FROM users WHERE username=?').get(username) as {id:string}|undefined;
  if(user){db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.prepare('DELETE FROM users WHERE id=?').run(user.id);}
  report.temporaryAccountRemoved=true;
 } catch(error) { report.passed=false;report.temporaryAccountRemoved=false;throw error; }
 finally {
  db.close();
  writeFileSync(new URL('../../../docs/research/public-deployment-smoke-2026-10-30.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }
 if(report.teardownFailures)throw Error('Public smoke transport teardown failed; temporary account removed');
}
