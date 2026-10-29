import {MMSSpeech,MODEL,REVISION} from './speech.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=new URL('./test-results/',import.meta.url);await mkdir(out,{recursive:true});
const phrases=[['opening','Hello, I am Rally. Let us decide the release scope and confirm who owns the next step.'],['redirect','Could we return to the release decision?'],['deadline','Priya, what deadline should we use for the rollback test?'],['wrapup','We have five minutes remaining. Let us confirm our decisions, owners, and deadlines.']];
let startup;const engine=new MMSSpeech({python:process.env.RALLY_MMS_PYTHON||'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:process.env.RALLY_MMS_MODEL_DIR||'/srv/hackathon/models/mms-tts-eng',onReady:value=>startup=value});
const results=[];
try{
 for(const [name,text] of phrases){
  const start=performance.now(),audio=await engine.synthesize(text);
  await writeFile(new URL(name+'.wav',out),audio.wav);
  results.push({name,characters:text.length,synthesisMs:audio.synthesisMs,requestMs:Math.round(performance.now()-start),audioSeconds:audio.seconds,sampleRate:audio.sampleRate,realTimeFactor:audio.synthesisMs/1000/audio.seconds,sha256:createHash('sha256').update(audio.wav).digest('hex')});
 }
 const report={model:MODEL,revision:REVISION,execution:'self-hosted CPU on Rally Ubuntu droplet',license:'CC-BY-NC-4.0',startup,results,limits:{maxCharacters:650,maxAudioSeconds:30,cpuThreads:2},boundaries:['Synthetic, explicitly authored phrases only.','No meeting joined; no meeting audio captured.','No physical listening or Teams output validation.','Generation timing is not first-audible latency.','No Muse/API inference charges; ordinary host infrastructure still exists.']};
 await writeFile(new URL('benchmark.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{engine.close();}
