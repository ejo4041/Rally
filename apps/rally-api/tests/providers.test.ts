import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.ts';
import { defaults } from '../src/config.ts';
import { createMuse, TranscriptDecoder } from '../src/muse.ts';
import type { Meeting,TranscriptEvent } from '../src/contracts.ts';

test('the Muse adapter normalizes speaker spans, timing, partials and out-of-order final turns',()=>{
  const events:TranscriptEvent[]=[];const decoder=new TranscriptDecoder('s',e=>events.push(e));
  decoder.accept({type:'speechStart',turnId:1,audioProcessedMs:100});
  decoder.accept({type:'transcript',transcript:'hello'});
  decoder.accept({type:'speaker',label:'A',audioProcessedMs:400});
  decoder.accept({type:'speechEnd',turnId:1,audioProcessedMs:500});
  decoder.accept({type:'speechStart',turnId:2,audioProcessedMs:600});
  decoder.accept({type:'speaker',label:'B',audioProcessedMs:800});
  decoder.accept({type:'speechEnd',turnId:2,audioProcessedMs:900});
  decoder.accept({type:'speechComplete',turnId:2,transcript:'Second.',audioProcessedMs:900});
  decoder.accept({type:'speechComplete',turnId:1,transcript:'First.',audioProcessedMs:500});
  const finals=events.filter(e=>e.type==='final');assert.equal(finals.length,2);
  assert.deepEqual(finals[1],{type:'final',sessionId:'s',turnId:1,text:'First.',speaker:'A',startMs:100,endMs:500});
});

test('unknown text charges block later calls and a failed request is never retried automatically',async t=>{
  const store=new Store(':memory:');t.after(()=>store.close());let calls=0;
  const muse=createMuse(store,{...defaults,paidEnabled:true},{key:'fixture',fetch:async()=>{calls++;throw new Error('network');}});
  const meeting={id:'meeting',userId:'host',agenda:'Choose launch',durationMinutes:10,participants:[]} as unknown as Meeting;
  await assert.rejects(muse.prepare(meeting));await assert.rejects(muse.prepare(meeting),/unknown/i);assert.equal(calls,1);
});

test('the streaming adapter drains final speech and records known audio usage through a real local WebSocket',async t=>{
  const {WebSocketServer}=await import('ws');const wss=new WebSocketServer({host:'127.0.0.1',port:0});
  await new Promise<void>(r=>wss.once('listening',r));
  const store=new Store(':memory:');t.after(async()=>{for(const client of wss.clients)client.terminate();await new Promise<void>(r=>wss.close(()=>r()));store.close();});
  let frames=0;wss.on('connection',socket=>socket.on('message',(data,binary)=>{
    if(binary){frames++;return;}
    const value=JSON.parse(data.toString());
    if(value.authorization){assert.equal(value.mode,'DIARIZATION');socket.send(JSON.stringify({sessionId:'local-asr'}));}
    if(value.type==='endStream'){
      for(const event of [{type:'speechStart',turnId:1,audioProcessedMs:0},{type:'speaker',label:'A',audioProcessedMs:50},{type:'speechEnd',turnId:1,audioProcessedMs:100},{type:'speechComplete',turnId:1,transcript:'Finished.',audioProcessedMs:100}])socket.send(JSON.stringify(event));
      socket.close(1000);
    }
  }));
  const events:TranscriptEvent[]=[];
  const muse=createMuse(store,{...defaults,paidEnabled:true},{key:'fixture',asrUrl:`ws://127.0.0.1:${(wss.address() as {port:number}).port}`});
  const session=await muse.openASR({id:'meeting',userId:'host'} as Meeting,{onEvent:e=>events.push(e),onError:e=>{throw e;},onClose(){}});
  session.send(new Uint8Array(3200));await session.end();
  assert.ok(frames>=5);assert.equal(events.filter(e=>e.type==='final').length,1);
  // The external accounting contract is checked through the ledger's next-call gate.
  const {UsageLedger}=await import('../src/muse.ts');new UsageLedger(store,defaults).check('meeting',.01);
});
