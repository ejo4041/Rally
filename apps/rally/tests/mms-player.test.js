import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/mms-speech.js';
function fixture(){
 let played=0,paused=0,canceled=0,audio;const states=[];
 const request=async(path)=>path==='create'?{job:{id:'test'}}:path==='cancel'?(canceled++,{}):{job:{state:'ready'}};
 const engine=RallyMMS.create({request,audioFactory:()=>audio={play(){played++;queueMicrotask(()=>this.onplaying());return Promise.resolve();},pause(){paused++;},removeAttribute(){},load(){}}});
 return{engine,states,get audio(){return audio;},get played(){return played;},get paused(){return paused;},get canceled(){return canceled;}};
}
test('MMS playback reports actual playback and cancel immediately stops audio without late callbacks',async()=>{
 const f=fixture(),pending=f.engine.speak({test:true},s=>f.states.push(s));await new Promise(r=>setImmediate(r));assert.equal(f.played,1);assert.deepEqual(f.states,['speaking']);f.engine.cancel();assert.equal(await pending,'canceled');assert.equal(f.paused,1);f.audio.onended();assert.deepEqual(f.states,['speaking']);assert.ok(f.canceled>=1);
});
test('a late create response cannot play after host cancellation',async()=>{
 let release,plays=0;const response=new Promise(r=>release=r),canceled=[];
 const engine=RallyMMS.create({request:async(path,data)=>path==='create'?response:(canceled.push(data.id),{}),audioFactory:()=>({play(){plays++;}})});
 const pending=engine.speak({test:true});engine.cancel();release({job:{id:'late'}});assert.equal(await pending,'canceled');assert.equal(plays,0);assert.deepEqual(canceled,['late']);
});
test('autoplay refusal falls back to visible text and clears the queue job',async()=>{
 const states=[];let canceled=false;const engine=RallyMMS.create({request:async path=>path==='create'?{job:{id:'blocked'}}:path==='cancel'?(canceled=true,{}):{job:{state:'ready'}},audioFactory:()=>({play:()=>Promise.reject(new Error('autoplay denied'))})});
 assert.equal(await engine.speak({test:true},s=>states.push(s)),'failed');assert.deepEqual(states,['failed']);assert.equal(canceled,true);
});
