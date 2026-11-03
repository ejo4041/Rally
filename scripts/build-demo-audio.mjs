// Offline/operator-only asset generation. Never imported by the demo runtime.
import {mkdir,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {dialogue} from '../apps/rally-web/src/demo-simulator.ts';
import {MMSSpeech,wav} from '../experiments/meta-mms/speech.mjs';import {PhonemeSpeech} from '../experiments/phoneme-speech/adapter.mjs';
const backend=process.env.RALLY_DEMO_AUDIO_BACKEND;if(!['mms','fastspeech2','seamless','manifest'].includes(backend))throw Error('Choose explicit demo audio generation backend');
const dir=new URL('../demo/demo-audio/',import.meta.url);await mkdir(dir,{recursive:true});
const asks=[['ask-early','Sample answer: Review the release gates, then confirm owners and deadlines.'],['ask-late','Sample answer: Launch depends on the mobile regression passing. Checklist ownership and the launch date remain unresolved.']];
const receipts=new URL('../artifacts/feedback/demo-audio-generation-20261103/',import.meta.url);await mkdir(receipts,{recursive:true});
const rows=[...dialogue.map(([speaker,text],i)=>({key:'turn-'+i,speaker,text})),...asks.map(([key,text])=>({key,speaker:'Rally',text}))];
const overrides={new:'N UW1',cache:'K AE1 SH',fifth:'F IH1 F TH',response:'R IH0 S P AA1 N S',hundred:'HH AH1 N D R AH0 D',in:'IH0 N',request:'R IH0 K W EH1 S T',against:'AH0 G EH1 N S T',Did:'D IH1 D',anyone:'EH1 N IY0 W AH2 N',conference:'K AA1 N F ER0 AH0 N S',sounds:'S AW1 N D Z',interesting:'IH1 N T R AH0 S T IH0 NG',matches:'M AE1 CH IH0 Z',its:'IH1 T S',due:'D UW1'};
let engine;
try{
 if(backend==='mms')engine=new MMSSpeech({python:'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:'/srv/hackathon/models/mms-tts-eng'});
 if(backend==='fastspeech2')engine=new PhonemeSpeech({python:'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:'/srv/hackathon/models/meta-fastspeech2',phoneOverrides:overrides});
 let token;if(backend==='seamless'){
  if(process.env.RALLY_DEMO_AUDIO_HOSTED!=='1')throw Error('Explicit hosted generation gate required');
  const env=await readFile('/srv/hackathon/rally-deployed/config/api.env','utf8');token=env.split('\n').find(l=>l.startsWith('RALLY_TTS_TOKEN='))?.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g,'');if(!token)throw Error('Speech service token unavailable');
 }
 for(const row of rows){
  const selected=row.speaker==='Rally'?'seamless':row.speaker==='Priya'?'fastspeech2':'mms';if(backend!==selected)continue;
  const spoken=selected==='fastspeech2'?row.text.replaceAll('-',' '):row.text;
  let data,provenance;
  if(engine){const audio=await engine.synthesize(spoken);data=audio.wav;provenance={model:audio.model,revision:audio.revision,providerAPICostUSD:0,infrastructureCost:'unknown',spokenText:spoken,...(selected==='fastspeech2'?{phoneOverrides:overrides}: {})};}
  else{
   const began=Date.now();const response=await fetch('https://2tluh56msb.execute-api.us-west-2.amazonaws.com/prod/v1/audio/speech',{method:'POST',signal:AbortSignal.timeout(45000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({model:'facebook/seamless-m4t-v2-large',input:row.text,voice:'default',response_format:'wav',chunking:'none'})});
   provenance={model:'facebook/seamless-m4t-v2-large',revision:null,provider:'existing AWS speech service',infrastructureCost:'unknown',httpStatus:response.status,elapsedMs:Date.now()-began,cached:response.headers.get('X-First-Phrase-Cached')};
   await writeFile(new URL(row.key+'.generation.json',receipts),JSON.stringify({...row,...provenance},null,2));
   if(!response.ok)throw Error('Hosted speech rejected '+row.key+' HTTP'+response.status);data=Buffer.from(await response.arrayBuffer());
  }
  if(data.toString('ascii',0,4)!=='RIFF')throw Error('Expected WAV for '+row.key);
  await writeFile(new URL(row.key+'.wav',dir),data);await writeFile(new URL(row.key+'.generation.json',receipts),JSON.stringify({...row,backend:selected,...provenance,sha256:createHash('sha256').update(data).digest('hex')},null,2));console.log(JSON.stringify({key:row.key,speaker:row.speaker,backend:selected,bytes:data.length}));
 }
 if(backend==='manifest'){
  // RMS matching with a peak ceiling; timing and pitch remain unchanged.
  const clips={};
  for(const row of rows){const path=new URL(row.key+'.wav',dir);let b=await readFile(path);if(b.toString('ascii',0,4)!=='RIFF')throw Error('Invalid WAV');let offset=12,start=0,size=0,rate=0,channels=0,bits=0;while(offset+8<=b.length){const kind=b.toString('ascii',offset,offset+4),length=b.readUInt32LE(offset+4);if(kind==='fmt '){channels=b.readUInt16LE(offset+10);rate=b.readUInt32LE(offset+12);bits=b.readUInt16LE(offset+22);}if(kind==='data'){start=offset+8;size=length;break;}offset+=8+length+(length%2);}if(rate!==16000||channels!==1||bits!==16||!size)throw Error('Unsupported WAV '+row.key);let squares=0,peak=0;for(let n=start;n<start+size;n+=2){const v=b.readInt16LE(n);squares+=v*v;peak=Math.max(peak,Math.abs(v));}const rms=Math.sqrt(squares/(size/2)),gain=Math.min(32767*10**(-22/20)/rms,32767*10**(-2/20)/peak);for(let n=start;n<start+size;n+=2)b.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(b.readInt16LE(n)*gain))),n);await writeFile(path,b);
   const generated=JSON.parse(await readFile(new URL(row.key+'.generation.json',receipts),'utf8'));
   clips[row.key]={file:row.key+'.wav',text:row.text,speaker:row.speaker,duration:size/(rate*2),model:generated.model,revision:generated.revision,sha256:createHash('sha256').update(b).digest('hex'),gain};
  }
  await writeFile(new URL('silence.wav',dir),wav(Buffer.alloc(3200),16000));
  const manifest={kind:'prerecorded-synthetic-Meta-voices',createdAt:new Date().toISOString(),speakerMap:{Alex:'Meta MMS English',Sam:'Meta MMS English (same underlying voice as Alex)',Priya:'Meta FastSpeech2 + bundled HiFi-GAN',Rally:'Hosted SeamlessM4T-v2 default voice'},runtimeModelCalls:0,liveTranscription:false,alignment:'Simulated partial text follows clip playback progress; not ASR or forced word alignment.',normalization:'Constant RMS gain toward -22dBFS, peak capped at -2dBFS; no pitch/speed modification.',clips};
  await writeFile(new URL('manifest.json',dir),JSON.stringify(manifest,null,2));await writeFile(new URL('../apps/rally-web/src/demo-audio-manifest.ts',import.meta.url), 'export const demoClips = '+JSON.stringify(clips,null,2)+' as const;\n');console.log(JSON.stringify({clips:Object.keys(clips).length,seconds:Object.values(clips).reduce((n,c)=>n+c.duration,0)}));
 }
}finally{engine?.close();}
