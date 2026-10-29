import test from 'node:test';
import assert from 'node:assert/strict';
import {modelConfig,audioCost,reasoningCost,publicModels} from '../src/models.js';
import {modelServices} from '../src/model-services.js';
import {moderate,metaTranscriptEvent} from '../src/muse.js';
import {createMeeting,addFinal} from '../src/core.js';
test('capability defaults stay on Meta and compatible model changes require explicit pricing',()=>{
 const c=modelConfig();assert.equal(c.transcription.model,'muse-voice-transcribe-1.0');assert.equal(c.reasoning.adapter,'meta-chat-json');assert.equal(c.speech.model,'facebook/mms-tts-eng');
 c.reasoning.rates.input=99;assert.equal(modelConfig().reasoning.rates.input,1.25);
 for(const override of [{reasoning:{model:'muse-future'}},{transcription:{model:'muse-asr-future'}},{speech:{model:'facebook/mms-tts-spa'}},{transcription:{adapter:'teams-built-in'}},{reasoning:{rates:{input:-1,cachedInput:0,output:1}}},{unknown:{}}])assert.throws(()=>modelConfig({RALLY_MODEL_CONFIG:JSON.stringify(override)}),/Invalid server model/);
 const config=modelConfig({RALLY_MODEL_CONFIG:JSON.stringify({transcription:{model:'muse-asr-compatible',usdPerAudioHour:.36},reasoning:{model:'muse-reasoning-compatible',rates:{input:2,cachedInput:1,output:6}}})});
 assert.ok(Math.abs(audioCost(10.9,config.transcription)-.001)<1e-12);assert.equal(reasoningCost({inputTokens:100,cachedTokens:10,outputTokens:20},config.reasoning),.00031);assert.ok(!JSON.stringify(publicModels(config)).includes('API_KEY'));
 const fake=()=>{};assert.equal(modelServices({}, {openASR:fake}).openASR,fake);
});
test('Meta event names are normalized at the adapter boundary',()=>{
 assert.deepEqual(metaTranscriptEvent({type:'transcript',transcript:'Words'},'s'),{type:'partial',text:'Words'});
 assert.deepEqual(metaTranscriptEvent({type:'speechComplete',turnId:1,transcript:'Final',speakerId:0},'s'),{type:'final',sessionId:'s',turnId:1,text:'Final',speaker:'0'});
 assert.equal(metaTranscriptEvent({type:'speechComplete',turnId:'bad',transcript:'Invalid'},'s'),null);assert.equal(metaTranscriptEvent({type:'unrelated'},'s'),null);
});
test('configured reasoning model, controls and prices reach the provider and usage record',async t=>{
 const env={MODEL_API_KEY:'fixture-only',RALLY_MODEL_CONFIG:JSON.stringify({reasoning:{model:'muse-compatible-model',reasoningEffort:'low',maxOutputTokens:512,rates:{input:2,cachedInput:1,output:6}}})};
 let request,usage;t.mock.method(globalThis,'fetch',async(url,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify({usage:{prompt_tokens:100,prompt_tokens_details:{cached_tokens:10},completion_tokens:20},choices:[{finish_reason:'stop',message:{content:JSON.stringify({intervene:false,kind:'none',spoken_text:'',evidence_turn_ids:[],outcomes:[]})}}]}));});
 const m=createMeeting({agenda:['Release'],minutes:3,wrapMinutes:.5});addFinal(m,{sessionId:'s',turnId:1,transcript:'Release discussion.'});
 await moderate(env,m,{costs:async()=>({total:0,unknown:0}),usage:async value=>usage=value});assert.equal(request.model,'muse-compatible-model');assert.equal(request.reasoning_effort,'low');assert.equal(request.max_tokens,512);assert.equal(usage.model,request.model);assert.equal(usage.estimatedCost,.00031);assert.deepEqual(usage.pricing,{input:2,cachedInput:1,output:6});
});
