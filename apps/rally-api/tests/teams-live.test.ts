import test from 'node:test';
import assert from 'node:assert/strict';
import {TeamsLive} from '../src/teams-live.ts';
import type {Meeting} from '../src/contracts.ts';
test('live Teams owns capture until explicit leave, without a browser lease',async()=>{
 const m={id:'m',userId:'u',phase:'ready',plan:{},epoch:0} as Meeting;
 let started=0,ended=0,closed=0;
 const teams=new TeamsLive({current:()=>m,save:()=>{},start:async()=>{started++;m.phase='live';},end:async()=>{ended++;m.phase='ended';},interrupt:async()=>{},
  connect:async()=>({alive:()=>true,receive:()=>()=>{},play:async()=>{},close:async()=>{closed++;}})});
 teams.join(m,'https://teams.microsoft.com/l/meetup-join/test',true);
 await new Promise(r=>setImmediate(r));
 assert.equal(started,1);assert.equal(m.captureSource,'teams');assert.equal(teams.status('m').state,'connected');
 await teams.leave('m');assert.equal(ended,1);assert.equal(closed,1);assert.equal(teams.status('m').state,'left');
});
test('cancel during connector startup holds the runner until the late connector closes',async()=>{
 const m={id:'m',userId:'u',phase:'ready',plan:{},epoch:0} as Meeting;
 let resolve!: (value:any)=>void,closed=0;
 const teams=new TeamsLive({current:()=>m,save:()=>{},start:async()=>{},end:async()=>{},interrupt:async()=>{},connect:()=>new Promise(r=>resolve=r)});
 teams.join(m,'https://teams.microsoft.com/meet/test',true);
 const leaving=teams.leave('m');
 await new Promise(r=>setImmediate(r));
 assert.throws(()=>teams.join(m,'https://teams.microsoft.com/meet/test',true),/busy/);
 resolve({alive:()=>true,receive:()=>()=>{},play:async()=>{},close:async()=>{closed++;}});
 await leaving;assert.ok(closed>=1);assert.equal(teams.status('m').state,'left');
});
