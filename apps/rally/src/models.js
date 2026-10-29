import {AppError} from './core.js';
export const DEFAULT_MODELS=Object.freeze({
 reasoning:{adapter:'meta-chat-json',model:'muse-spark-1.3',reasoningEffort:'minimal',maxOutputTokens:1024,rates:{input:1.25,cachedInput:.15,output:4.25}},
 transcription:{adapter:'meta-realtime-asr',model:'muse-voice-transcribe-1.0',usdPerAudioHour:.18},
 speech:{adapter:'mms-local',model:'facebook/mms-tts-eng',revision:'c71de0fe7204c83f1c10820a7d696d0b450048ba',sampleRate:16000}
});
function invalid(){throw new AppError('Invalid server model configuration. Check adapters, model IDs and explicit pricing.',503);}
function keys(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))invalid();}
function rate(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0)invalid();}
export function modelConfig(env={}){
 let overrides={};if(env.RALLY_MODEL_CONFIG){try{overrides=JSON.parse(env.RALLY_MODEL_CONFIG);}catch{invalid();}}
 keys(overrides,['reasoning','transcription','speech']);const config=structuredClone(DEFAULT_MODELS);
 for(const capability of Object.keys(overrides)){
  keys(overrides[capability],Object.keys(config[capability]));Object.assign(config[capability],overrides[capability]);
 }
 const r=config.reasoning,a=config.transcription,s=config.speech;
 if(r.adapter!=='meta-chat-json'||!/^muse-[a-z0-9.-]{1,100}$/.test(r.model)||!['minimal','low','medium','high'].includes(r.reasoningEffort)||!Number.isSafeInteger(r.maxOutputTokens)||r.maxOutputTokens<128||r.maxOutputTokens>4096)invalid();
 if(r.model!==DEFAULT_MODELS.reasoning.model&&!Object.hasOwn(overrides.reasoning||{},'rates'))invalid();
 keys(r.rates,['input','cachedInput','output']);for(const key of ['input','cachedInput','output'])rate(r.rates[key]);if(r.rates.cachedInput>r.rates.input)invalid();
 if(a.adapter!=='meta-realtime-asr'||!/^muse-[a-z0-9.-]{1,100}$/.test(a.model))invalid();rate(a.usdPerAudioHour);
 if(a.model!==DEFAULT_MODELS.transcription.model&&!Object.hasOwn(overrides.transcription||{},'usdPerAudioHour'))invalid();
 if(s.adapter!=='mms-local'||!/^facebook\/mms-tts-[a-z]{3}$/.test(s.model)||!/^[a-f0-9]{40}$/.test(s.revision)||s.sampleRate!==16000)invalid();
 if(s.model!==DEFAULT_MODELS.speech.model&&!Object.hasOwn(overrides.speech||{},'revision'))invalid();
 return config;
}
export const audioCost=(seconds,config)=>Math.floor(Math.max(0,seconds))*config.usdPerAudioHour/3600;
export const reasoningCost=(usage,config)=>((usage.inputTokens-usage.cachedTokens)*config.rates.input+usage.cachedTokens*config.rates.cachedInput+usage.outputTokens*config.rates.output)/1e6;
export function publicModels(config){return Object.fromEntries(Object.entries(config).map(([key,value])=>[key,{adapter:value.adapter,model:value.model,...(value.revision?{revision:value.revision}:{})}]));}
