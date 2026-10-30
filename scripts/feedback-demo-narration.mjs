import {MMSSpeech,MODEL,REVISION} from '../experiments/meta-mms/speech.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const dir=new URL('../artifacts/feedback/',import.meta.url);await mkdir(dir,{recursive:true});
const segments=JSON.parse(await readFile(new URL('./fixtures/feedback-demo-narration.json',import.meta.url),'utf8'));
const engine=new MMSSpeech({python:'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:'/srv/hackathon/models/mms-tts-eng'});
const timings=[];
try{for(let i=0;i<segments.length;i++){const segment=segments[i],audio=await engine.synthesize(segment.text);await writeFile(new URL(`narration-${i}.wav`,dir),audio.wav);timings.push({...segment,seconds:audio.seconds,model:MODEL,revision:REVISION});console.log(`Narration ${i+1}/${segments.length}: ${audio.seconds.toFixed(2)} seconds for ${segment.end-segment.start}-second chapter`);}await writeFile(new URL('demo-narration-evidence.json',dir),JSON.stringify({model:MODEL,revision:REVISION,license:'CC-BY-NC-4.0',purpose:'Noncommercial hackathon review-draft narration',apiCalls:0,segments:timings},null,2));}finally{engine.close();}
