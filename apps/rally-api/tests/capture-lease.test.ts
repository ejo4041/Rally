import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplication} from './support/application.ts';
test('browser lease authenticates renewals and expires paused capture without another model call',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:1000000});let drains=0,assessments=0;
 const api=createApplication({dbPath:':memory:',assessmentMs:100000,captureLeaseMs:90000,
  media:{open:async()=>({connection:async()=>({url:'ws://fixture',room:'fixture',token:'fixture'}),send:async()=>{},close:async()=>{}})},
  providers:{prepare:async()=>({objective:'Test',durationMinutes:10,wrapMinutes:2,topics:[{id:'one',title:'Test',outcome:'Test',minutes:8,status:'active'}]}),openASR:async()=>({sessionId:'fixture',send(){},end:async()=>{drains++;},close(){},sentSeconds:0,processedMs:0}),assess:async()=>{assessments++;throw Error('Should not assess');}}});
 const server=api.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 t.after(async()=>{await api.close();await new Promise<void>(r=>server.close(()=>r()));});
 const base=`http://127.0.0.1:${(server.address() as any).port}/api`;let cookie='';
 const req=(path:string,body?:unknown)=>fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const signup=await req('/fixture/signup',{username:'lease-test',password:'test-password'});cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const m=await(await req('/meetings',{agenda:'Test',durationMinutes:10})).json();const path=`/meetings/${m.id}`;
 const start=await(await req(path+'/start',{consented:true})).json();assert.ok(start.connection.captureToken);
 assert.equal((await req(path+'/heartbeat',{captureToken:'wrong'})).status,409);
 t.mock.timers.tick(60000);assert.equal((await req(path+'/heartbeat',{captureToken:start.connection.captureToken})).status,200);
 await req(path+'/commands',{type:'pause'});t.mock.timers.tick(90001);
 await req(path+'/commands',{type:'request_guidance'});
 const ended=await(await req(path)).json();assert.equal(ended.phase,'interrupted');assert.equal(drains,1);assert.equal(assessments,0);
 assert.equal((await req(path+'/heartbeat',{captureToken:start.connection.captureToken})).status,409);
});
