import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createSpeechOutput,pulsePlayback} from './output.mjs';
const utterance={id:'u',epoch:1,text:'Could we return to the release decision?'};
const audio={sampleRate:16000,pcm:Buffer.alloc(3200)};
const tick=()=>new Promise(r=>setImmediate(r));
test('host state changing during synthesis prevents playback',async()=>{
 let finish,allowed=true,played=0;
 const output=createSpeechOutput({engine:{synthesize:()=>new Promise(r=>finish=r),close(){}},play:async()=>played++,canSpeak:async()=>allowed});
 const pending=output.present(utterance);await tick();allowed=false;finish(audio);
 assert.equal(await pending,'canceled');assert.equal(played,0);assert.equal(output.isEchoRisk(),false);
});
test('generation cancellation rejects stale audio while capture remains available during synthesis',async()=>{
 let finish,plays=0;const output=createSpeechOutput({engine:{synthesize:()=>new Promise(r=>finish=r),close(){}},play:async()=>plays++,canSpeak:async()=>true});
 const pending=output.present(utterance);await tick();assert.equal(output.isEchoRisk(),false);output.cancel();finish(audio);assert.equal(await pending,'canceled');assert.equal(plays,0);
});
test('playback and its short tail are marked as echo risk, then capture resumes',async()=>{
 let finish,clock=1000;const events=[];
 const output=createSpeechOutput({engine:{synthesize:async()=>audio,close(){}},play:()=>new Promise(r=>finish=r),canSpeak:async()=>true,onPlayback:e=>events.push(e.state),now:()=>clock});
 const pending=output.present(utterance);await tick();assert.equal(output.isEchoRisk(),true);finish();assert.equal(await pending,'completed');assert.deepEqual(events,['speaking','completed']);assert.equal(output.isEchoRisk(),true);clock+=401;assert.equal(output.isEchoRisk(),false);
});
test('Stop aborts actual playback and its late completion cannot report success',async()=>{
 let finish,aborted=false;const events=[];
 const output=createSpeechOutput({engine:{synthesize:async()=>audio,close(){}},play:(a,{signal})=>new Promise(r=>{finish=r;signal.addEventListener('abort',()=>aborted=true);}),canSpeak:async()=>true,onPlayback:e=>events.push(e.state)});
 const pending=output.present(utterance);await tick();output.cancel();assert.equal(aborted,true);finish();assert.equal(await pending,'canceled');assert.deepEqual(events,['speaking']);
});
test('PulseAudio adapter uses explicit device, validates PCM and kills the child on Stop',async()=>{
 let child,args,options;
 const play=pulsePlayback({sink:'rally_test_out',spawnProcess:(command,argv,opts)=>{assert.equal(command,'paplay');args=argv;options=opts;child=new EventEmitter();child.stdin=new PassThrough();child.kill=()=>{child.killed=true;};return child;}});
 await assert.rejects(play({...audio,sampleRate:48000}),/Invalid/);
 const controller=new AbortController();const pending=play(audio,{signal:controller.signal});const rejected=assert.rejects(pending,/canceled/);controller.abort();await rejected;assert.equal(child.killed,true);assert.ok(args.includes('--device=rally_test_out'));assert.equal(options.shell,undefined);
 assert.throws(()=>pulsePlayback({sink:'bad; command'}),/explicit/);
});
