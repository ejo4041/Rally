import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {MMSSpeech,MODEL,REVISION,wav} from './speech.mjs';

async function fixture(t,{startupDelay=0,invalid=false,...options}={}){
 const dir=await mkdtemp(path.join(tmpdir(),'rally-mms-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));const worker=path.join(dir,'worker.mjs');
 await writeFile(worker,`import {createInterface} from 'node:readline';
 setTimeout(()=>console.log(JSON.stringify({type:'ready',model:${JSON.stringify(MODEL)},revision:${JSON.stringify(REVISION)},loadMs:1})),${startupDelay});
 createInterface({input:process.stdin}).on('line',line=>{const r=JSON.parse(line);setTimeout(()=>console.log(JSON.stringify({type:'audio',id:r.id,model:${JSON.stringify(invalid?'wrong-model':MODEL)},revision:${JSON.stringify(REVISION)},sampleRate:16000,seconds:.01,synthesisMs:1,pcmBase64:Buffer.alloc(320,1).toString('base64')})),r.text==='slow'?120:1);});`);
 const engine=new MMSSpeech({python:process.execPath,worker,modelDirectory:dir,startTimeoutMs:1000,synthesisTimeoutMs:500,...options});t.after(()=>engine.close());return engine;
}
test('MMS adapter validates inputs before starting a process and produces mono 16k WAV',async t=>{
 const engine=await fixture(t);await assert.rejects(engine.synthesize('x'.repeat(651)),/1–650/);await assert.rejects(engine.synthesize('secret\x00'),/1–650/);assert.equal(engine.child,undefined);
 const result=await engine.synthesize('Test phrase.');assert.equal(result.wav.toString('ascii',0,4),'RIFF');assert.equal(result.wav.readUInt32LE(24),16000);assert.equal(result.wav.readUInt32LE(40),320);assert.equal(result.wav.length,364);assert.equal(result.model,MODEL);
 assert.throws(()=>wav(Buffer.alloc(3),16000),/Invalid/);
});
test('one request at a time; cancellation kills generation and a later request starts a fresh process',async t=>{
 const engine=await fixture(t);await engine.start();const controller=new AbortController();const pending=engine.synthesize('slow',{signal:controller.signal});const rejection=assert.rejects(pending,/canceled|stopped/);await assert.rejects(engine.synthesize('duplicate'),/already generating/);const old=engine.child;controller.abort();await rejection;assert.equal(engine.child,null);assert.ok(old.killed);const result=await engine.synthesize('Fresh speech.');assert.equal(result.seconds,.01);assert.notEqual(engine.child,old);
});
test('cancellation during model startup rejects without leaving a process',async t=>{
 const engine=await fixture(t,{startupDelay:300});const controller=new AbortController();const pending=engine.synthesize('Test',{signal:controller.signal});const rejection=assert.rejects(pending,/canceled|stopped/);controller.abort();await rejection;assert.equal(engine.child,null);
});
test('wrong model output is refused and timed out synthesis is terminated',async t=>{
 const invalid=await fixture(t,{invalid:true});await assert.rejects(invalid.synthesize('Test'),/Invalid MMS/);assert.equal(invalid.child,null);
 const slow=await fixture(t);await slow.start();slow.synthesisTimeoutMs=20;await assert.rejects(slow.synthesize('slow'),/timed out/);assert.equal(slow.child,null);
});

test('late output from a canceled worker cannot reject or terminate its replacement',async t=>{
 const engine=await fixture(t);
 await engine.start();
 const old=engine.child,controller=new AbortController();
 const first=engine.synthesize('slow',{signal:controller.signal});
 const canceled=assert.rejects(first,/canceled|stopped/);
 controller.abort();await canceled;
 const replacement=engine.synthesize('Fresh speech.');
 const current=engine.child;
 assert.notEqual(current,old);
 // A killed process can still have stdout buffered for delivery. Exercise the
 // existing reader on that old stream after a replacement has taken ownership.
 old.stdout.emit('data',Buffer.from('not-valid-json\n'));
 const result=await replacement;
 assert.equal(result.seconds,.01);
 assert.equal(engine.child,current);
 assert.equal(current.killed,false);
});
test('MMS passes speech-only pronunciation and bounded pacing to the worker',async t=>{
 const engine=await fixture(t,{pronunciations:{Priya:'Pree yah'},speakingRate:.98,sentencePauseMs:320});
 await engine.start();let wire='';const original=engine.child.stdin.write.bind(engine.child.stdin);
 engine.child.stdin.write=(data,...args)=>{wire+=data;return original(data,...args);};
 await engine.synthesize('Priya uses AI. MMS speaks.');
 const request=JSON.parse(wire);assert.equal(request.text,'Pree yah uses ay eye. em em ess speaks.');assert.deepEqual(request.prosody,{speakingRate:.98,sentencePauseMs:320});
 assert.throws(()=>new MMSSpeech({python:'python',modelDirectory:'model',sentencePauseMs:0}),/prosody/);
});
test('local meeting speech uses the same reference-aware Meta and evidence corrections',async t=>{
 const engine=await fixture(t);await engine.start();let wire='';const original=engine.child.stdin.write.bind(engine.child.stdin);
 engine.child.stdin.write=(data,...args)=>{wire+=data;return original(data,...args);};
 const approved='Meta reviews the evidence. Do not release yet.';await engine.synthesize(approved);
 assert.equal(JSON.parse(wire).text,'Metta reviews the evidense. Do not release yet.');
 assert.equal(approved,'Meta reviews the evidence. Do not release yet.');
});

test('the local voice renders agenda in-context using the same correction as narration',async t=>{
 const engine=await fixture(t);await engine.start();let wire='';const original=engine.child.stdin.write.bind(engine.child.stdin);
 engine.child.stdin.write=(data,...args)=>{wire+=data;return original(data,...args);};
 await engine.synthesize('Follow the agenda. Do not extend the deadline.');
 assert.equal(JSON.parse(wire).text,'Follow the ajenda. Do not extend the deadline.');
});
