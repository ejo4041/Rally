// Explicitly gated, bounded real-provider + real local LiveKit experiment.
// Authored synthetic speech; never a Teams join, human meeting or diarization benchmark.
import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Room,RoomEvent,AudioStream,AudioSource,AudioFrame,LocalAudioTrack,TrackPublishOptions,TrackSource,dispose} from '@livekit/rtc-node';
import {Store} from '../src/store.ts';
import {Meetings} from '../src/meetings.ts';
import {Engine} from '../src/engine.ts';
import {LiveKitMedia} from '../src/media.ts';
import {SpeechOutput} from '../src/speech.ts';
import {SpeechService} from '../src/speech-service.ts';
import {SeamlessSpeech} from '../src/seamless.ts';
import {LiveSpeech} from '../src/live-speech.ts';
import {recordSpeechDelivery} from '../src/speech-delivery.ts';
import {createMuse,modelSettings} from '../src/muse.ts';
import {defaults} from '../src/config.ts';
if(process.env.RALLY_PROVIDER_ENDURANCE_APPROVED!=='1')throw Error('Explicit real-provider authorization required');
const minutes=Number(process.env.RALLY_ENDURANCE_MINUTES||65),name=process.env.RALLY_ENDURANCE_NAME||'provider-65-minute';
const rotationMs=Number(process.env.RALLY_ENDURANCE_ROTATION_MS||55*60000),budget=Number(process.env.RALLY_ENDURANCE_BUDGET||6),speechLimit=Number(process.env.RALLY_ENDURANCE_SPEECH_LIMIT||12);
if(!Number.isFinite(minutes)||minutes<1||minutes>70||!Number.isFinite(rotationMs)||rotationMs<60000||rotationMs>55*60000||!Number.isFinite(budget)||budget<=0||budget>6||!Number.isInteger(speechLimit)||speechLimit<0||speechLimit>12||!/^[a-z0-9-]{1,60}$/.test(name))throw Error('Invalid bounded settings');
const directory=new URL(`../test-results/${name}/`,import.meta.url);
if(existsSync(directory))throw Error('Existing run retained; use an explicit distinct run name, never auto-repeat');
mkdirSync(directory,{recursive:true,mode:0o700});
const env=parseEnv(readFileSync('/srv/hackathon/rally-deployed/config/api.env','utf8'));
if(!env.MODEL_API_KEY||!env.RALLY_TTS_TOKEN)throw Error('Configured providers required');
const inputDirectory=new URL('../test-results/endurance-input/',import.meta.url);
const inputManifest=JSON.parse(readFileSync(new URL('manifest.json',inputDirectory),'utf8'));
const clips:Buffer[]=inputManifest.phrases.map((_:string,index:number)=>readFileSync(new URL(`phrase-${index}.pcm`,inputDirectory)));
const result:any={startedAt:new Date().toISOString(),state:'starting',minutes,rotationMs,museBudget:budget,speechRequestLimit:speechLimit,realMuse:true,realSeamless:true,realLocalLiveKit:true,syntheticInput:true,teamsJoined:false,humanMeeting:false,rawMeetingAudioSaved:false,samples:[],events:[],inputManifestSha256:createHash('sha256').update(JSON.stringify(inputManifest)).digest('hex')};
try{result.sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();result.sourceDirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();}catch{}
const save=()=>{writeFileSync(new URL('result.json.tmp',directory),JSON.stringify(result,null,2)+'\n',{mode:0o600});renameSync(new URL('result.json.tmp',directory),new URL('result.json',directory));};
const stopping=new AbortController();let stoppedByOperator=false;
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{stoppedByOperator=true;stopping.abort();});
const port=19038;
const mediaProcess=spawn('/srv/hackathon/rally-deployed/bin/livekit-server',['--dev','--bind','127.0.0.1','--node-ip','127.0.0.1','--config-body',`port: ${port}\nrtc:\n  tcp_port: 19039\n  port_range_start: 19040\n  port_range_end: 19050\n`],{stdio:'ignore'});
let engine:Engine|undefined,store:Store|undefined,speech:SpeechOutput|undefined,source:AudioSource|undefined,meetingId:string|undefined;
const publisher=new Room(),readers=new Set<ReadableStreamDefaultReader<any>>();
let outputBytes=0,outputEnergy=0,inputBytes=0,asrSessions=0,receivedInputBytes=0,latestAudioAt=performance.now(),timer:ReturnType<typeof setInterval>|undefined;
let receiverError:string|undefined,reportInputTurns=0,reportInputCharacters=0;
const wait=(ms:number)=>new Promise<void>(resolve=>{const done=()=>{clearTimeout(handle);stopping.signal.removeEventListener('abort',done);resolve();};const handle=setTimeout(done,ms);if(stopping.signal.aborted)done();else stopping.signal.addEventListener('abort',done,{once:true});});
const config={...defaults,dbPath:new URL('usage.sqlite',directory).pathname,paidEnabled:true,realtimeEnabled:true,meetingBudget:budget,buildBudget:budget,reportReserve:.25,assessmentMs:10000,asrRotationMs:rotationMs,livekitUrl:`ws://127.0.0.1:${port}`,livekitPublicUrl:''};
try{
 for(let n=0;;n++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{}if(n>80||mediaProcess.exitCode!==null)throw Error('Isolated media server failed');await wait(100);}
 store=new Store(config.dbPath);const db=store.db;
 const userId=randomUUID();db.prepare('INSERT INTO users VALUES(?,?,?)').run(userId,'endurance-'+randomUUID(),'unusable-offline-test-account');
 const settings=modelSettings(env.RALLY_MODEL_CONFIG||'{}');
 const real=createMuse(store,config,{key:env.MODEL_API_KEY,settings});
 const providers={...real,async report(snapshot:any){reportInputTurns=snapshot.turns.length;reportInputCharacters=snapshot.turns.reduce((n:number,turn:any)=>n+turn.text.length,0);return real.report(snapshot);},async openASR(m:any,callbacks:any){const session=await real.openASR(m,callbacks);asrSessions++;return session;}};
 const meetings=new Meetings(store,providers);
 const transport=new LiveKitMedia(config);
 const media={async open(m:any,onAudio:any,onGap:any){return transport.open(m,(bytes)=>{receivedInputBytes+=bytes.byteLength;latestAudioAt=performance.now();onAudio(bytes);},onGap);}};
 speech=new SpeechOutput(undefined,id=>meetings.get(id),(id,shield)=>meetings.recordAudioExclusion(id,shield));
 engine=new Engine(meetings,media,config,speech);
 const tts=new SpeechService(store,new SeamlessSpeech(env.RALLY_TTS_TOKEN),true);
 speech.live=new LiveSpeech({current:id=>meetings.get(id),stream:(text,signal,id)=>{const count=(db.prepare('SELECT count(*) n FROM speech_usage').get() as {n:number}).n;if(count>=speechLimit)throw Error('Bounded speech allowance reached');return tts.stream(userId,{input:text},signal,id);},
  play:async(id,job,chunks,signal,before,onProgress)=>{const session=engine!.active.get(id)?.media;if(!session?.play)throw Error('No live playback');await session.play(job,chunks,signal,before,onProgress);},
  event:(id,status)=>{recordSpeechDelivery(store!,id,status);const m=meetings.get(id);m.speechStatus=status;meetings.save(m);engine!.emit(id,'speech.status',status);},
  shield:(id,window)=>meetings.recordAudioExclusion(id,window),
 });
 const meeting=await meetings.create(userId,{title:'Controlled real-provider endurance',agenda:'Synthetic release rehearsal. Preserve conditional release on rollback verification; identify rollback and accessibility owners and corrected deadlines; defer native WhatsApp joining. Do not treat repeated rehearsal statements as evidence that a real check passed.',durationMinutes:Math.max(5,Math.ceil(minutes)),moderationMode:'balanced'});
 meetingId=meeting.id;if(meeting.phase!=='ready')throw Error('Real agenda preparation failed');
 if(speechLimit===0){meeting.speechEnabled=false;meetings.save(meeting);}
 publisher.on(RoomEvent.TrackSubscribed,(track,_publication,participant)=>{
  if(participant.identity!==`backend-${meeting.id}`)return;
  const reader=new AudioStream(track,{sampleRate:16000,numChannels:1,frameSizeMs:20}).getReader();readers.add(reader);
  void(async()=>{try{while(!stopping.signal.aborted){const {value,done}=await reader.read();if(done)break;outputBytes+=value.data.byteLength;for(const sample of value.data)outputEnergy+=sample*sample;}}catch{if(!stopping.signal.aborted)receiverError='Output receiver failed';}finally{readers.delete(reader);await reader.cancel().catch(()=>{});}})();
 });
 const {connection}=await engine.start(meeting,true,'browser');
 await publisher.connect(connection.url,connection.token,{autoSubscribe:true,dynacast:false});
 source=new AudioSource(16000,1,200);const track=LocalAudioTrack.createAudioTrack('authored-synthetic-meeting',source);
 await publisher.localParticipant!.publishTrack(track,new TrackPublishOptions({source:TrackSource.SOURCE_MICROPHONE}));
 const start=performance.now(),deadline=start+minutes*60000;
 result.captureStartedAt=new Date().toISOString();result.state='running';save();
 let previousInput=0,previousAt=start;
 timer=setInterval(()=>{
  try{
   const m=meetings.get(meeting.id),rows=db.prepare('SELECT status,cost,estimate FROM usage').all() as any[];
   const unknown=rows.filter(row=>row.status==='unknown').length;
   const spent=rows.reduce((sum,row)=>sum+(row.cost??row.estimate),0);
   const speechRows=db.prepare('SELECT body FROM speech_usage').all() as {body:string}[];
   if(speechRows.length>=speechLimit&&m.speechEnabled!==false&&speechLimit>0)void engine!.command(m,{type:'voice_off'});
   const now=performance.now(),turns=meetings.turns(meeting.id);
   result.samples.push({at:new Date().toISOString(),elapsedMinutes:+((now-start)/60000).toFixed(2),inputBytes,receivedInputBytes,inputBytesPerSecond:Math.round((inputBytes-previousInput)/((now-previousAt)/1000)),outputBytes,outputEnergy,asrSessions,turns:turns.length,maxFinalCharacters:Math.max(0,...turns.map(turn=>turn.text.length)),monitorStatus:m.monitor?.status??null,monitorSequence:m.monitor?.sequence??0,museCommittedOrReserved:spent,unknownCosts:unknown,speechRequests:speechRows.length,rssMB:Math.round(process.memoryUsage().rss/1048576),phase:m.phase});
   previousAt=now;previousInput=inputBytes;save();console.log(JSON.stringify(result.samples.at(-1)));
   assert.equal(m.phase,'live','Capture stopped');assert.ok(m.gaps.every(gap=>gap.reason.includes('Muse transcription restarted')),'Unexpected capture gap');assert.equal(unknown,0,'Unknown costs; stop and reconcile');assert.ok(spent<=budget+.001,'Budget exceeded');assert.ok(now-latestAudioAt<10000,'Incoming media stopped');assert.ok(!receiverError,receiverError);
   engine!.heartbeat(m,connection.captureToken);
  }catch(error){result.failure=error instanceof Error?error.message:'Endurance guard failed';stopping.abort();}
 },10000);
 let clipIndex=0,offset=0;
 // Real-time AudioSource queue pacing; source text intentionally changes by stage.
 while(performance.now()<deadline&&!stopping.signal.aborted){
  const elapsed=performance.now()-start,stage=Math.min(5,Math.floor(elapsed/(minutes*60000/6)));
  const groups=[[0,1,2,3],[4,5,1,3],[6,7,8,2],[9,7,10,8],[11,12,13,9],[14,15,8,1]];
  const clip=clips[groups[stage][clipIndex%4]];
  const pcm=Buffer.alloc(640);clip.copy(pcm,0,offset,Math.min(clip.length,offset+640));offset+=640;
  if(offset>=clip.length){offset=0;clipIndex++;}
  const samples=new Int16Array(320);for(let n=0;n<320;n++)samples[n]=pcm.readInt16LE(n*2);
  await source.captureFrame(new AudioFrame(samples,16000,1,320));inputBytes+=640;
 }
 clearInterval(timer);timer=undefined;
 if(result.failure)throw Error(result.failure);
 if(stoppedByOperator)throw Error('Operator requested stop');
 await source.waitForPlayout();
 await engine.end(meetings.get(meeting.id));
 const reportDeadline=performance.now()+210000;
 while(engine.reports.has(meeting.id)&&performance.now()<reportDeadline)await wait(250);
 const ended=meetings.get(meeting.id),turns=meetings.turns(meeting.id);
 const checks=db.prepare('SELECT body FROM live_checks WHERE meeting_id=?').all(meeting.id) as {body:string}[];
 const parsed=checks.map(row=>JSON.parse(row.body));
 assert.equal(ended.phase,'ended');assert.equal(ended.reportStatus,'ready','Complete report did not finish');assert.ok(turns.length>0,'No real ASR finals');
 assert.ok(parsed.some(check=>check.status==='accepted'),'No eligible real reasoning result');
 assert.ok(inputBytes/32000>=minutes*60*.95,'Insufficient real-time input');assert.ok(receivedInputBytes>=inputBytes*.95,'Media delivery fell below 95 percent');assert.equal(reportInputTurns,turns.length,'Report omitted finalized turns');assert.equal(reportInputCharacters,turns.reduce((n,turn)=>n+turn.text.length,0),'Report omitted canonical text');
 if(minutes*60000>rotationMs+15000)assert.ok(asrSessions>=2,'Actual ASR handoff not observed');
 if(speechLimit>0)assert.ok(outputBytes>0&&outputEnergy>0,'No real streamed speech received');
 result.final={reportInputTurns,reportInputCharacters,turns:turns.length,asrSessions,reportStatus:ended.reportStatus,reportEvidenceIds:[...ended.report!.decisions,...ended.report!.actions].flatMap(row=>row.evidence),canonicalCharacters:turns.reduce((sum,turn)=>sum+turn.text.length,0),acceptedChecks:parsed.filter(check=>check.status==='accepted').length,checkStates:Object.fromEntries([...new Set(parsed.map(check=>check.status))].map(status=>[status,parsed.filter(check=>check.status===status).length])),outputBytes,outputEnergy,gaps:ended.gaps.length};
 result.state='passed';
}catch(error){result.state=stoppedByOperator?'stopped':'failed';result.error=error instanceof Error?error.message:'Provider endurance failed';if(!stoppedByOperator)process.exitCode=1;}
finally{
 clearInterval(timer);stopping.abort();await source?.close().catch(()=>{});for(const reader of readers)await reader.cancel().catch(()=>{});
 await engine?.close().catch(()=>{});await speech?.live?.close().catch(()=>{});speech?.close();await publisher.disconnect().catch(()=>{});
 if(store){const rows=store.db.prepare('SELECT body,status,cost,estimate FROM usage').all() as any[];result.usage={calls:rows.length,knownCost:rows.reduce((n,row)=>n+(row.cost??0),0),unknown:rows.filter(row=>row.status==='unknown').length,running:rows.filter(row=>row.status==='running').length,rows:rows.map(row=>JSON.parse(row.body))};result.speechUsage=(store.db.prepare('SELECT body FROM speech_usage').all() as any[]).map(row=>JSON.parse(row.body));store.close();}
 mediaProcess.kill('SIGTERM');await dispose();result.endedAt=new Date().toISOString();save();console.log(JSON.stringify({state:result.state,museUsage:result.usage?.knownCost,unknown:result.usage?.unknown,speechRequests:result.speechUsage?.length,error:result.error}));
}
