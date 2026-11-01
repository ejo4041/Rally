// Offline dictionary coverage and warmed preparation timing; never makes a model call.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
const started=performance.now();
const {createSpeechPreparer}=await import('../packages/rally-speech/text.mjs');
const {referenceForWord,pronunciationReference}=await import('../packages/rally-speech/lexicon.mjs');
const coldLoadMs=performance.now()-started;
const prepare=createSpeechPreparer({adapter:'mms'});
const narration=JSON.parse(await readFile(new URL('./fixtures/feedback-demo-narration.json',import.meta.url),'utf8'));
const words=[...new Set(narration.flatMap(row=>row.text.match(/[\p{L}][\p{L}\p{N}]*(?:['’][\p{L}]+)*/gu)??[]))];
const references=words.map(word=>({word,...referenceForWord(word)}));
const probe='Meta reviews evidence. Read the release record. Priya has not agreed. '.repeat(18).slice(0,1200);
for(let i=0;i<200;i++)prepare(probe);
const durations=[];for(let i=0;i<3000;i++){const t=performance.now();prepare(probe);durations.push(performance.now()-t);}durations.sort((a,b)=>a-b);
const result={at:new Date().toISOString(),reference:pronunciationReference,coldLoadMs,warmedPreparation:{iterations:durations.length,characters:probe.length,medianMs:durations[Math.floor(durations.length*.5)],p95Ms:durations[Math.ceil(durations.length*.95)-1],maxMs:durations.at(-1)},coverage:prepare(probe).coverage,demoWords:references.length,demoUnknownWords:references.filter(row=>!row.known).map(row=>row.word),references,providerCalls:0,networkRequests:0,scope:'Synthetic local CPU preparation benchmark; excludes model generation, network and audio playback. Dictionary references do not guarantee acoustic pronunciation.'};
const output=new URL('../artifacts/feedback/voice-lexicon-v2/',import.meta.url);await mkdir(output,{recursive:true});await writeFile(new URL('preflight.json',output),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,references:undefined}));
