import {MMSSpeech} from '../meta-mms/speech.mjs';
import {createSpeechOutput,pulsePlayback} from '../meta-mms/output.mjs';

export const diagnosticText='Rally audio test. This voice is generated locally by Meta MMS. Please confirm that you can hear me.';
// One call owns one engine/output. Caller supplies authoritative host/call state;
// no transcript or arbitrary browser text is promoted to approved speech here.
export function createTeamsSpeech({env,canSpeak,engine,onPlayback=()=>{},play}={}){
 if(!env?.PULSE_SERVER?.startsWith('unix:'))throw Error('Configure the private Teams audio server.');
 const local=engine||new MMSSpeech({
  python:env.RALLY_MMS_PYTHON||'/srv/hackathon/tools/mms-venv/bin/python',
  modelDirectory:env.RALLY_MMS_MODEL_DIR||'/srv/hackathon/models/mms-tts-eng',
 });
 let closed=false;
 const output=createSpeechOutput({engine:local,
  play:play||pulsePlayback({sink:'rally_teams_out',env}),
  canSpeak:async utterance=>!closed&&await canSpeak(utterance),onPlayback,
  echoTailMs:800,
 });
 return{
  async start(){if(closed)throw Error('Teams speech closed.');await local.start();if(closed)throw Error('Teams speech closed.');},
  present:utterance=>closed?Promise.resolve('canceled'):output.present(utterance),
  diagnostic:()=>closed?Promise.resolve('canceled'):output.present({id:'teams-mms-diagnostic',epoch:0,text:diagnosticText}),
  shielded:()=>output.isEchoRisk(),
  cancel:()=>output.cancel(),
  close(){if(closed)return;closed=true;output.close();},
 };
}
