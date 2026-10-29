import {modelConfig} from './models.js';
import {moderate,openASR} from './muse.js';

// Register protocol implementations here. Meeting policy consumes these ports;
// it does not construct provider requests, parse their events or select URLs.
const reasoningAdapters={'meta-chat-json':moderate};
const transcriptionAdapters={'meta-realtime-asr':openASR};
export function modelServices(env,overrides={}){
 const config=modelConfig(env);
 return{
  moderate:overrides.moderate||reasoningAdapters[config.reasoning.adapter],
  openASR:overrides.openASR||transcriptionAdapters[config.transcription.adapter]
 };
}
/**
 * Transcription port: openASR(env,{onEvent,onClose,onError}) -> session.
 * session: send(PCM16 mono/16kHz), end(), close(), sessionId, sentSeconds,
 * processedMs. Events: partial{text}, final{sessionId,turnId,text,speaker},
 * progress{processedMs}. Provider failures reach onError/onClose.
 *
 * Reasoning port: moderate(env,meetingSnapshot,repository,options) ->
 * {decision,usage}. decision uses the validated application schema; outcomes
 * remain proposals. usage identifies actual model, adapter and pricing.
 *
 * Speech port (local runner): start(), synthesize(text,{signal}) ->
 * {model,revision,sampleRate,pcmBase64,seconds}; close() cancels work.
 * The bridge carries mono PCM16 at 16kHz; another engine must adapt its output.
 */
