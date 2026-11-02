import {PhonemeSpeech} from '../../../experiments/phoneme-speech/adapter.mjs';
import type {SpeechRequest} from './seamless.ts';
import {SpeechError} from './seamless.ts';
import type {TextToSpeech} from './speech-service.ts';

type LocalEngine=Pick<PhonemeSpeech,'identity'|'start'|'synthesize'|'close'> & {isReady?:()=>boolean};
export class LocalPhonemeTTS implements TextToSpeech {
 readonly identity;
 readonly billing='Self-hosted CPU; provider API fee zero, infrastructure cost unknown';
 readonly apiCostUSD=0;
 private engine:LocalEngine;
 private warmed=false;
 private lifecycle=0;
 constructor(engine?:LocalEngine){
  if(!engine&&process.env.RALLY_EXPERIMENTAL_PHONEMES!=='1')throw Error('FastSpeech2 phoneme speech requires explicit experimental opt-in');
  this.engine=engine??new PhonemeSpeech({python:process.env.RALLY_PHONEME_PYTHON||'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:process.env.RALLY_PHONEME_MODEL_DIR||'/srv/hackathon/models/meta-fastspeech2',phoneOverrides:JSON.parse(process.env.RALLY_PHONE_OVERRIDES||'{}')});
  this.identity={...this.engine.identity,adapter:'fastspeech2-local',channels:1,format:'pcm_s16le'};
 }
 async start(){const generation=this.lifecycle;await this.engine.start();if(generation===this.lifecycle)this.warmed=true;}
 ready(){return this.warmed&&(this.engine.isReady?.()??true);}
 private async audio(input:SpeechRequest,signal:AbortSignal){
  signal.throwIfAborted();
  if(!input||typeof input.input!=='string'||!input.input.trim()||input.input.length>650||(input.voice!==undefined&&input.voice!=='default'))throw new SpeechError('Invalid local phoneme speech input',422);
  const generation=this.lifecycle;
  try{
   const audio=await this.engine.synthesize(input.input,{signal});if(generation===this.lifecycle)this.warmed=true;signal.throwIfAborted();return audio;
  }catch(error){
   if(signal.aborted){this.warmed=false;throw error;}
   const code=(error as {code?:string})?.code;
   if(code==='PHONEME_INPUT')throw new SpeechError('Speech needs an explicit pronunciation or supported text normalization',422);
   if(code==='PHONEME_BUSY')throw new SpeechError('Speech service busy',429,'1');
   this.warmed=false;
   if(code==='PHONEME_TIMEOUT')throw new SpeechError('Local speech timed out',504);
   throw new SpeechError('Local speech unavailable',502);
  }
 }
 async *stream(input:SpeechRequest,signal:AbortSignal,format:'pcm'|'wav'='pcm',onCache?:(cached:boolean|null)=>void){
  if(format!=='pcm'&&format!=='wav')throw new SpeechError('Unsupported speech format',422);
  // Native model emits a complete waveform; this is transport chunking, not
  // model-level streaming. First-audio latency includes full local generation.
  const audio=await this.audio(input,signal);onCache?.(false);
  const bytes=format==='wav'?audio.wav:audio.pcm;
  for(let offset=0;offset<bytes.length;offset+=640){signal.throwIfAborted();yield bytes.subarray(offset,offset+640);}
 }
 async synthesize(input:SpeechRequest,signal:AbortSignal,onCache?:(cached:boolean|null)=>void){const audio=await this.audio(input,signal);onCache?.(false);return audio.wav;}
 close(){this.lifecycle++;this.engine.close();this.warmed=false;}
}
