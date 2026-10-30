// Local process integration: real private PulseAudio/Xvfb, no platform page,
// account, model call or real browser. Delay the browser-launch promise to make
// termination during startup deterministic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createGuest} from './guest.mjs';
const require=createRequire(new URL('../../apps/rally-web/package.json',import.meta.url));
const {chromium}=require('playwright');

test('termination during browser startup closes a late browser instead of returning a guest',async t=>{
 let releaseLaunch,enteredLaunch,closes=0,guest;
 const entered=new Promise(resolve=>enteredLaunch=resolve);
 const launched=new Promise(resolve=>releaseLaunch=resolve);
 const fakeBrowser={
  async close(){closes++;},
  async newContext(){return{async newPage(){return{setDefaultTimeout(){}};}};},
 };
 t.mock.method(chromium,'launch',async()=>{enteredLaunch();return launched;});
 const starting=createGuest({seconds:10});
 try{
  await Promise.race([entered,starting]);
  process.emit('SIGTERM');
  // Let normal close finish before the outstanding launch becomes ready.
  await new Promise(resolve=>setTimeout(resolve,350));
  releaseLaunch(fakeBrowser);
  await assert.rejects(async()=>{guest=await starting;},/cancel|closed/i);
  assert.equal(closes,1,'the late browser must be closed exactly once');
 }finally{
  releaseLaunch(fakeBrowser);
  await guest?.close();
  await starting.catch(()=>{});
 }
});

test('the guest deadline includes a pending browser launch and cleans its temporary directory',async t=>{
 const {access}=await import('node:fs/promises');
 const {dirname}=await import('node:path');
 let releaseLaunch,enteredLaunch,closes=0,contexts=0,directory;
 const entered=new Promise(resolve=>enteredLaunch=resolve);
 const launched=new Promise(resolve=>releaseLaunch=resolve);
 const previousTerms=process.listenerCount('SIGTERM');
 const previousInterrupts=process.listenerCount('SIGINT');
 const fakeBrowser={
  async close(){closes++;},
  async newContext(){contexts++;return{async newPage(){return{setDefaultTimeout(){}};}};},
 };
 t.mock.method(chromium,'launch',async options=>{
  directory=dirname(options.env.PULSE_SERVER.slice('unix:'.length));
  enteredLaunch();return launched;
 });
 const starting=createGuest({seconds:1});
 try{
  await Promise.race([entered,starting]);
  await new Promise(resolve=>setTimeout(resolve,1300));
  releaseLaunch(fakeBrowser);
  await assert.rejects(starting,/cancel|closed/i);
  assert.equal(closes,1);
  assert.equal(contexts,0,'a canceled launch must not create a browser context');
  await assert.rejects(access(directory));
  assert.equal(process.listenerCount('SIGTERM'),previousTerms);
  assert.equal(process.listenerCount('SIGINT'),previousInterrupts);
 }finally{
  releaseLaunch(fakeBrowser);
  const guest=await starting.catch(()=>null);
  await guest?.close();
 }
});

test('a real local guest reaches its deadline and repeated close releases browser and temporary files',{timeout:10000},async()=>{
 const {access}=await import('node:fs/promises');
 const previousTerms=process.listenerCount('SIGTERM');
 const guest=await createGuest({seconds:3});
 try{
  assert.equal(guest.browser.isConnected(),true);
  await new Promise(resolve=>guest.browser.once('disconnected',resolve));
  await guest.close();
  await guest.close();
  assert.equal(guest.closed(),true);
  assert.equal(guest.browser.isConnected(),false);
  await assert.rejects(access(guest.dir));
  assert.equal(process.listenerCount('SIGTERM'),previousTerms);
 }finally{await guest.close();}
});
