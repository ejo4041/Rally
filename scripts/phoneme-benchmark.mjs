// Frozen authored-text corpus; real local Meta models, no paid model requests.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {PhonemeSpeech} from '../experiments/phoneme-speech/adapter.mjs';
import {MMSSpeech} from '../experiments/meta-mms/speech.mjs';
import {createPhonemePlanner} from '../packages/rally-speech/phonemes.mjs';
if(process.env.RALLY_LOCAL_PHONEME_BENCHMARK!=='1')throw Error('Explicit local-model experiment gate required');
const run=process.env.RALLY_PHONEME_RUN||'phoneme-pilot-20261102';if(!/^[a-z0-9-]{1,60}$/.test(run))throw Error('Invalid run name');
const directory=resolve('artifacts/feedback/'+run);await mkdir(directory,{recursive:false});
const corpusBytes=await readFile(new URL('./fixtures/phoneme-corpus.json',import.meta.url));
const corpus=JSON.parse(corpusBytes),plan=createPhonemePlanner();
const result={startedAt:new Date().toISOString(),state:'running',sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),corpusSHA256:createHash('sha256').update(corpusBytes).digest('hex'),paidCalls:0,listenerRatings:0,scope:'Direct-phone Meta acoustic/vocoder versus current grapheme Meta MMS. Two different voices/models; quality and cause cannot be inferred from timings.',backendLoads:[],utterances:[]};
const save=()=>writeFile(resolve(directory,'result.json'),JSON.stringify(result,null,2)+'\n');await save();
try{
 for(const [name,engine]of [
  ['mms',new MMSSpeech({python:'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:'/srv/hackathon/models/mms-tts-eng'})],
  ['phoneme',new PhonemeSpeech({python:'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:'/srv/hackathon/models/meta-fastspeech2'})],
 ]){
  try{
   const before=performance.now();await engine.start();result.backendLoads.push({name,coldStartMs:performance.now()-before});
   for(const row of corpus.utterances){
    const phonemes=plan(row.text);const record={...row,backend:name,phonePlanSupported:phonemes.supported,phoneIssues:phonemes.issues};
    if(name==='phoneme'&&!phonemes.supported){record.state='unsupported';}
    else {
     const begin=performance.now();const audio=await engine.synthesize(row.text);record.wholeAudioReadyMs=performance.now()-begin;
     const file=resolve(directory,name+'-'+row.id+'.wav');await writeFile(file,audio.wav);
     Object.assign(record,{state:'generated',audio:file,seconds:audio.seconds,model:audio.model,revision:audio.revision,synthesisMs:audio.synthesisMs,phoneCount:audio.phoneCount??null,audioSHA256:createHash('sha256').update(audio.wav).digest('hex')});
    }
    result.utterances.push(record);await save();console.log(JSON.stringify({backend:name,id:row.id,state:record.state,ms:record.wholeAudioReadyMs,seconds:record.seconds}));
   }
  }finally{engine.close();}
 }
 result.state='completed';
}catch(error){result.state='failed';result.error=error.message;process.exitCode=1;}
finally{result.endedAt=new Date().toISOString();await save();}
console.log(JSON.stringify({state:result.state,output:directory,generated:result.utterances.filter(row=>row.state==='generated').length,unsupported:result.utterances.filter(row=>row.state==='unsupported').length}));
