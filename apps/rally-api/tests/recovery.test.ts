import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.ts';
import { Meetings } from '../src/meetings.ts';
import { Engine } from '../src/engine.ts';
import { SpeechOutput } from '../src/speech.ts';
import { LiveSpeech } from '../src/live-speech.ts';
import { defaults } from '../src/config.ts';
import { categories, type Providers, type Snapshot, type TranscriptEvent } from '../src/contracts.ts';

async function fixture(t: TestContext) {
  const store = new Store(':memory:');
  store.db.prepare('INSERT INTO users VALUES(?,?,?)').run('host', 'host', 'unused-fixture');
  let drainFails = false, reportCalls = 0, reportInput: Snapshot | undefined;
  let reportGate: Promise<void> | undefined;
  let mediaFails = false;
  const sources: { emit: (event: TranscriptEvent) => void; sent: number; closed: boolean }[] = [];
  const transports: { audio: (bytes: Uint8Array) => void; gap: (reason: string) => void; closed: boolean }[] = [];
  const providers: Providers = {
    async prepare() { return { objective: 'Choose an owner', durationMinutes: 10, wrapMinutes: 2, topics: [{id:'owner',title:'Owner',outcome:'Choose owner',minutes:8,status:'pending'}] }; },
    async openASR(_m, callbacks) {
      const id = `source-${sources.length}`, source = { emit: callbacks.onEvent, sent: 0, closed: false };
      sources.push(source);
      return { sessionId: id, send(bytes) { if (source.closed) throw Error('Closed source received audio'); source.sent += bytes.length; },
        async end() { if (drainFails) throw Error('Synthetic drain failure'); if (!source.closed) { source.emit({type:'final',sessionId:id,turnId:1,text:'Final drained condition: only after verification.',speaker:'A'}); source.closed = true; } },
        close() { source.closed = true; }, sentSeconds: 0, processedMs: 0 };
    },
    async assess() { return {health:null,reason:'Fixture',issues:[],evidence:[],progress:'',intervention:null,plan:null,planReason:''}; },
    async report(snapshot) {
      reportCalls++; reportInput = snapshot;
      await reportGate;
      return {summary:'Synthetic report',decisions:[],actions:[],unresolved:[],speakerTips:[],scores:categories.map(category=>({category,score:null,reason:'Not measured',evidence:[]})),focusTime:{onTopicSeconds:null,offTopicSeconds:null,unknownSeconds:null,note:'Not measured'}};
    },
  };
  const meetings = new Meetings(store, providers);
  const speech = new SpeechOutput(undefined, id => meetings.get(id));
  const engine = new Engine(meetings, {async open(_m, audio, gap) {
    const transport = {audio,gap,closed:false}; transports.push(transport);
    return {connection:async()=>({url:'ws://fixture',room:'fixture',token:'fixture'}),send:async()=>{},close:async()=>{transport.closed=true;if(mediaFails)throw Error('Synthetic media cleanup failure');}};
  }}, {...defaults,assessmentMs:100000}, speech);
  let aborted = false, released = false;
  speech.live = new LiveSpeech({current:id=>meetings.get(id),
    stream:async function*(_text,signal) { yield Buffer.alloc(640); await new Promise<void>(resolve=>{if(signal.aborted)resolve();else signal.addEventListener('abort',()=>{aborted=true;resolve();},{once:true});}); },
    play:async(_id,_job,chunks,_signal,before)=>{try {for await(const _chunk of chunks)before();} finally {released=true;}},
    event:(id,status)=>{const m=meetings.get(id);m.speechStatus=status;meetings.save(m);},shield:()=>{},
  });
  const m = await meetings.create('host',{agenda:'Choose owner',durationMinutes:10});
  await engine.start(m,true,'browser');
  sources[0].emit({type:'final',sessionId:'source-0',turnId:0,text:'Initial source evidence.',speaker:'A'});
  t.after(async()=>{drainFails=false;mediaFails=false; await engine.close();await speech.live?.close();speech.close();store.close();});
  return {engine,meetings,speech,store,id:m.id,sources,transports,
    current:()=>meetings.get(m.id), failDrain:()=>{drainFails=true;}, failMedia:()=>{mediaFails=true;},
    reportCalls:()=>reportCalls, reportInput:()=>reportInput,
    gateReport:()=>{let resolve!:()=>void;reportGate=new Promise<void>(done=>{resolve=done;});return {resolve};},
    async speak() {const m=meetings.get(this.id),offer={id:'spoken',text:'Who owns verification?',at:Date.now(),epoch:m.epoch};m.interventions.push({...offer,kind:'clarify'});meetings.save(m);speech.offer(m.id,offer);await new Promise(resolve=>setImmediate(resolve));assert.equal(speech.live?.status(m.id)?.state,'playing');},
    speechAborted:()=>aborted,speechReleased:()=>released,
  };
}

test('End cancels active speech, drains final evidence and runs exactly one complete report', async t => {
  const f=await fixture(t), gate=f.gateReport();await f.speak();
  await f.engine.end(f.current());await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.speechAborted(),true);assert.equal(f.speechReleased(),true);
  assert.equal(f.current().reportStatus,'processing');assert.equal(f.reportInput()?.turns.length,2);
  assert.match(f.reportInput()!.turns[1].text,/only after verification/);
  await f.engine.end(f.current());assert.equal(f.reportCalls(),1);
  await assert.rejects(f.engine.start(f.current(),true),/Prepare|report/);
  gate.resolve();await Promise.all(f.engine.reports.values());
  assert.equal(f.current().reportStatus,'ready');assert.equal(f.engine.active.size,0);assert.equal(f.transports[0].closed,true);
});

test('explicit reconnect preserves evidence and ignores stale source and media callbacks', async t => {
  const f=await fixture(t);await f.engine.interrupt(f.current());
  await f.engine.start(f.current(),true,'browser');
  const before=f.meetings.turns(f.id).length, gaps=f.current().gaps.length;
  f.sources[0].emit({type:'final',sessionId:'source-0',turnId:9,text:'Stale final',speaker:'A'});
  f.transports[0].audio(new Uint8Array([1,2]));f.transports[0].gap('Late disconnected old room');
  assert.equal(f.current().gaps.length,gaps);assert.equal(f.meetings.turns(f.id).length,before);
  f.transports[1].audio(new Uint8Array([3,4]));assert.equal(f.sources[1].sent,2);
  f.sources[1].emit({type:'final',sessionId:'source-1',turnId:0,text:'Fresh source evidence.',speaker:'A'});
  assert.equal(f.meetings.turns(f.id).length,before+1);
  assert.notEqual(f.meetings.turns(f.id)[0].speaker,f.meetings.turns(f.id).at(-1)!.speaker);
});

test('interrupt releases capture and permits explicit recovery when final ASR drain fails', async t => {
  const f=await fixture(t);f.failDrain();
  await f.engine.interrupt(f.current());
  assert.equal(f.current().phase,'interrupted');assert.match(f.current().error!,/drain/i);
  assert.equal(f.transports[0].closed,true);assert.equal(f.sources[0].closed,true);assert.equal(f.engine.active.size,0);
  assert.equal(f.reportCalls(),0);assert.equal(f.meetings.turns(f.id).length,1);
  await f.engine.start(f.current(),true,'browser');assert.equal(f.current().phase,'live');
});

test('shutdown releases speech and media even when ASR drain fails', async t => {
  const f=await fixture(t);await f.speak();f.failDrain();
  await f.engine.close();await f.speech.live?.close();
  assert.equal(f.speechAborted(),true);assert.equal(f.speechReleased(),true);
  assert.equal(f.transports[0].closed,true);assert.equal(f.sources[0].closed,true);
  assert.equal(f.engine.active.size,0);assert.equal(f.current().phase,'interrupted');assert.equal(f.reportCalls(),0);
});

test('shutdown waits for an in-flight report and leaves the completed report readable', async t => {
  const f=await fixture(t),gate=f.gateReport();await f.engine.end(f.current());
  let closed=false;const closing=f.engine.close().then(()=>{closed=true;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(closed,false);
  gate.resolve();await closing;assert.equal(f.current().reportStatus,'ready');assert.equal(f.reportCalls(),1);
  assert.equal(f.engine.reports.size,0);assert.equal(f.transports[0].closed,true);
});

test('shutdown still releases a failed media transport and preserves canonical evidence', async t => {
  const f=await fixture(t);f.failMedia();
  await f.engine.close();
  assert.equal(f.transports[0].closed,true);assert.equal(f.sources[0].closed,true);
  assert.equal(f.current().phase,'interrupted');assert.match(f.current().error!,/Media cleanup failed/);
  assert.equal(f.meetings.turns(f.id).length,2);assert.equal(f.engine.active.size,0);
});
