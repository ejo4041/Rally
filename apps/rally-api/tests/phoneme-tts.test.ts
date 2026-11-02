import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalPhonemeTTS} from '../src/phoneme-tts.ts';
import {SpeechService} from '../src/speech-service.ts';
import {Store} from '../src/store.ts';
const identity={model:'facebook/fastspeech2-en-ljspeech',revision:'a3e3e5e2e62bb7ca7514b11aa469e9c5b01a20bf',sampleRate:16000 as const};

test('local phoneme waveform uses the common transport and keeps its own provenance/accounting',async()=>{
 let input='',closed=false;const pcm=Buffer.alloc(1280,1),wav=Buffer.alloc(1324,2);
 const tts=new LocalPhonemeTTS({identity,start:async()=>{},close:()=>{closed=true;},synthesize:async text=>{input=text;return {pcm,wav,sampleRate:16000,seconds:.04,model:identity.model,revision:identity.revision,synthesisMs:1};}});
 const store=new Store(':memory:'),service=new SpeechService(store,tts,true);
 try{
  assert.equal(service.status().ready,false);await service.start();assert.equal(service.status().ready,true);
  const chunks:Buffer[]=[];for await(const part of service.stream('host',{input:'Meta evidence agenda.'},new AbortController().signal,'meeting'))chunks.push(part);
  assert.equal(input,'Meta evidence agenda.');assert.deepEqual(Buffer.concat(chunks),pcm);assert.deepEqual(chunks.map(part=>part.length),[640,640]);
  const usage=service.usage('host')[0];assert.equal(usage.adapter,'fastspeech2-local');assert.equal(usage.revision,identity.revision);assert.equal(usage.apiCostUSD,0);assert.equal(usage.cost,null);assert.match(usage.billing,/infrastructure cost unknown/);assert.doesNotMatch(usage.billing,/AWS/);
  assert.deepEqual(await service.synthesize('host',{input:'Meta.'},new AbortController().signal),wav);
 }finally{service.close();store.close();}assert.equal(closed,true);
});
test('local speech cancellation prevents later transport chunks and invalid voice/text fail before generation',async()=>{
 let calls=0;const tts=new LocalPhonemeTTS({identity,start:async()=>{},close(){},synthesize:async()=>{calls++;return {pcm:Buffer.alloc(1280),wav:Buffer.alloc(1324),sampleRate:16000,seconds:.04,model:identity.model,revision:identity.revision,synthesisMs:1};}});
 const controller=new AbortController(),iterator=tts.stream({input:'Meta.'},controller.signal);
 assert.equal((await iterator.next()).value?.length,640);controller.abort();await assert.rejects(iterator.next());
 await assert.rejects(tts.synthesize({input:''},new AbortController().signal),/Invalid/);
 await assert.rejects(tts.synthesize({input:'x'.repeat(651)},new AbortController().signal),/Invalid/);
 assert.equal(calls,1);tts.close();
});
test('local readiness follows worker death and close during warmup',async()=>{
 let alive=true,release:()=>void=()=>{};
 const tts=new LocalPhonemeTTS({identity,isReady:()=>alive,start:()=>new Promise<void>(resolve=>{release=resolve;}),close(){alive=false;},synthesize:async()=>{throw Error('offline');}});
 const warming=tts.start();tts.close();release();await warming;assert.equal(tts.ready(),false);
 alive=true;const warmingAgain=tts.start();release();await warmingAgain;assert.equal(tts.ready(),true);
 alive=false;assert.equal(tts.ready(),false);tts.close();
});
test('local expected pronunciation and concurrency refusals have explicit HTTP statuses',async()=>{
 let code='PHONEME_INPUT';
 const tts=new LocalPhonemeTTS({identity,start:async()=>{},close(){},synthesize:async()=>{throw Object.assign(Error('local details'),{code});}});
 for(const [next,status]of [['PHONEME_INPUT',422],['PHONEME_BUSY',429],['PHONEME_TIMEOUT',504],['OTHER',502]] as const){
  code=next;await assert.rejects(tts.synthesize({input:'Meta.'},new AbortController().signal),(error:unknown)=>(error as {status:number}).status===status);
 }tts.close();
});
