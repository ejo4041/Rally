import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SeamlessSpeech, interventionSpeech} from '../src/seamless.ts';
const signal = () => new AbortController().signal;
function service(chunks: number[][]) {
  return new SeamlessSpeech('fixture', undefined, async () => new Response(new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(Uint8Array.from(chunk)); c.close();}})));
}
test('aligns fragmented PCM samples without dropping bytes',async()=>{
 const out=[]; for await(const b of service([[1],[2,3],[4]]).stream({input:'Hello.'},signal())){ assert.equal(b.length%2,0);out.push(b); }
 assert.deepEqual([...Buffer.concat(out)],[1,2,3,4]);
});
test('rejects a truncated sample after partial delivery',async()=>{
 await assert.rejects(async()=>{for await(const b of service([[1,2],[3]]).stream({input:'Hello.'},signal())){}},/Incomplete/);
});
test('enforces exact opening once without rewriting generic synthesis',()=>{
 assert.equal(interventionSpeech('Let’s get back on track. Choose an owner.'),'Let’s get back on track. Choose an owner.');
 assert.equal(interventionSpeech('Choose an owner.'),'Let’s get back on track. Choose an owner.');
});
test('passes request contract and surfaces throttling without retry',async()=>{
 let calls=0;
 const tts=new SeamlessSpeech('fixture',undefined,async (_url,init)=>{calls++;const body=JSON.parse(String(init?.body));assert.equal(body.input,'Hello.');assert.equal(body.chunking,'sentence');return new Response('',{status:429,headers:{'Retry-After':'3'}});});
 await assert.rejects(async()=>{for await(const b of tts.stream({input:'Hello.'},signal())){}},(e:any)=>e.status===429&&e.retryAfter==='3');assert.equal(calls,1);
});
test('aborted requests never reach the provider',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 const tts=new SeamlessSpeech('fixture',undefined,async()=>{calls++;return new Response(new Uint8Array([0,0]));});
 await assert.rejects(async()=>{for await(const b of tts.stream({input:'Hello.'},controller.signal)){} });
 assert.equal(calls,0);
});
