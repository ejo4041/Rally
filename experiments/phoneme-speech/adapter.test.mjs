import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {PhonemeSpeech,MODEL,REVISION} from './adapter.mjs';
async function fixture(t,{invalid=false,invalidReady=false,readyDelay=0,delay=1,...options}={}){
 const directory=await mkdtemp(join(tmpdir(),'rally-phone-worker-'));t.after(()=>rm(directory,{recursive:true,force:true}));const worker=join(directory,'worker.mjs');
 await writeFile(worker,String.raw`import {createInterface} from 'node:readline';
 setTimeout(()=>console.log(JSON.stringify({type:'ready',model:${JSON.stringify(invalidReady?'wrong':MODEL)},revision:${JSON.stringify(REVISION)},sampleRate:16000,inputKind:'arpabet'})),${readyDelay});
 createInterface({input:process.stdin}).on('line',line=>{const r=JSON.parse(line);if(r.phones.includes('Metta')||!r.phones.includes('EH1'))throw Error('wrong input');if(r.sentences.flatMap(s=>s.phones).join(' ')!==r.phones.join(' ')||r.sentences.length>32||/[\u0000-\u001f\u007f]/.test(r.text))throw Error('invalid sentence contract');setTimeout(()=>console.log(JSON.stringify({type:'audio',id:r.id,model:${JSON.stringify(invalid?'wrong':MODEL)},revision:${JSON.stringify(REVISION)},sampleRate:16000,seconds:.01,synthesisMs:1,pcmBase64:Buffer.alloc(320).toString('base64')})),${delay});});`);
 const engine=new PhonemeSpeech({python:process.execPath,modelDirectory:directory,worker,startTimeoutMs:1000,synthesisTimeoutMs:500,...options});t.after(()=>engine.close());return engine;
}
test('phones reach a phone-capable worker, canonical words and provenance remain exact',async t=>{
 const engine=await fixture(t);await engine.start();let wire='';const write=engine.child.stdin.write.bind(engine.child.stdin);engine.child.stdin.write=(data,...args)=>{wire+=data;return write(data,...args);};
 const result=await engine.synthesize('Meta evidence agenda.');const request=JSON.parse(wire);
 assert.equal(request.text,'Meta evidence agenda.');assert.equal(request.inputKind,'arpabet');assert.ok(request.phones.join(' ').includes('AH0 JH EH1 N D AH0'));assert.equal(result.model,MODEL);assert.equal(result.wav.readUInt32LE(24),16000);
});
test('unknowns, numeric values and ambiguous homographs fail before worker startup',async t=>{
 const engine=await fixture(t);for(const text of ['Xqzena agrees.','Read the record.','Pay 20.'])await assert.rejects(engine.synthesize(text),/explicit normalization or pronunciation/);assert.equal(engine.child,undefined);
});
test('cancel kills model work, concurrent utterances cannot overlap and replacement is usable',async t=>{
 const engine=await fixture(t,{delay:100});await engine.start();const controller=new AbortController();const pending=engine.synthesize('Meta.',{signal:controller.signal});const rejected=assert.rejects(pending,/canceled|stopped/);await assert.rejects(engine.synthesize('Meta.'),/already/);const old=engine.child;controller.abort();await rejected;assert.equal(old.killed,true);const replacement=await engine.synthesize('Meta.');assert.equal(replacement.model,MODEL);assert.notEqual(engine.child,old);
});
test('wrong model identity and generation timeout fail closed',async t=>{
 const wrong=await fixture(t,{invalid:true});await assert.rejects(wrong.synthesize('Meta.'),/Invalid/);assert.equal(wrong.child,null);
 const slow=await fixture(t,{delay:100,synthesisTimeoutMs:20});await assert.rejects(slow.synthesize('Meta.'),/timed out/);assert.equal(slow.child,null);
});
test('a broken worker pipe rejects synthesis without an unhandled stream error',async t=>{
 const engine=await fixture(t);await engine.start();
 const pending=engine.synthesize('Meta.');const rejected=assert.rejects(pending,/canceled|stopped/);
 engine.child.stdin.emit('error',Object.assign(Error('broken pipe'),{code:'EPIPE'}));
 await rejected;assert.equal(engine.child,null);assert.equal(engine.busy,false);
 const next=await engine.synthesize('Meta.');assert.equal(next.model,MODEL);
});
test('input refusals carry a stable code and do not start the worker',async t=>{
 const engine=await fixture(t);
 for(const text of ['',null,'x'.repeat(651),'Read the record.','Pay 20.','Meta\nagenda.','Meta\tagenda.','Monday–Friday.','Hi. '.repeat(33).trim()]){
  await assert.rejects(engine.synthesize(text),{code:'PHONEME_INPUT'});
 }
 assert.equal(engine.child,undefined);assert.equal(engine.isReady(),false);
});
test('busy and startup/generation timeouts have distinct stable refusal codes',async t=>{
 const engine=await fixture(t,{delay:100});await engine.start();
 const request=engine.synthesize('Meta.');
 await assert.rejects(engine.synthesize('Meta.'),{code:'PHONEME_BUSY'});await request;
 const cold=await fixture(t,{readyDelay:1000,startTimeoutMs:50});
 await assert.rejects(cold.start(),{code:'PHONEME_TIMEOUT'});assert.equal(cold.isReady(),false);assert.equal(cold.child,null);
 const slow=await fixture(t,{delay:100,synthesisTimeoutMs:20});
 await assert.rejects(slow.synthesize('Meta.'),{code:'PHONEME_TIMEOUT'});assert.equal(slow.isReady(),false);assert.equal(slow.child,null);
});
test('readiness requires verified identity and follows startup, idle exit, replacement and close',async t=>{
 const wrong=await fixture(t,{invalidReady:true});
 await assert.rejects(wrong.start(),/identity or capability/);assert.equal(wrong.isReady(),false);
 const engine=await fixture(t,{readyDelay:20});assert.equal(engine.isReady(),false);
 const starting=engine.start();assert.equal(engine.isReady(),false);await starting;assert.equal(engine.isReady(),true);
 const old=engine.child,exited=once(old,'exit');old.kill('SIGKILL');assert.equal(engine.isReady(),false);await exited;
 assert.equal(engine.isReady(),false);await engine.start();assert.equal(engine.isReady(),true);assert.notEqual(engine.child,old);
 old.stdout.emit('error',Error('late old-worker error'));assert.equal(engine.isReady(),true);
 engine.close();assert.equal(engine.isReady(),false);
});
test('stdout/readline errors retire the current worker without escaping and permit replacement',async t=>{
 const engine=await fixture(t,{delay:100});await engine.start();
 const request=engine.synthesize('Meta.');const rejected=assert.rejects(request,/canceled|stopped/);
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(engine.pending);assert.equal(engine.isReady(),true);
 assert.doesNotThrow(()=>engine.child.stdout.emit('error',Error('broken stdout')));
 await rejected;assert.equal(engine.isReady(),false);assert.equal(engine.busy,false);
 await engine.synthesize('Meta,, agenda.');assert.equal(engine.isReady(),true);
});
test('cancellation during startup settles and cannot mark the canceled child ready',async t=>{
 const engine=await fixture(t,{readyDelay:100});const controller=new AbortController();
 const request=engine.synthesize('Meta.',{signal:controller.signal});const rejected=assert.rejects(request,/canceled|stopped/);
 assert.equal(engine.isReady(),false);controller.abort();await rejected;
 assert.equal(engine.busy,false);assert.equal(engine.isReady(),false);
 await engine.synthesize('Meta.');assert.equal(engine.isReady(),true);
});
