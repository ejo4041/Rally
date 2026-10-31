// Authored synthetic speech only; local pinned Meta MMS, no meeting recording.
import {MMSSpeech} from '../../../experiments/meta-mms/speech.mjs';
import {mkdir,writeFile,access} from 'node:fs/promises';
const directory=new URL('../test-results/endurance-input/',import.meta.url);
await mkdir(directory,{recursive:true});
const phrases=[
 'This rehearsal is about release readiness. We must decide launch scope, rollback verification, and accessibility ownership.',
 'The release is conditional. We can ship only after the rollback check passes. We have not run that check yet.',
 'Priya will verify rollback. The deadline is Thursday at three. The accessibility check still needs an owner.',
 'Rally, what decision still needs attention? Please keep the release condition clear.',
 'I want to compare phone cameras and holiday routes for a while. We are drifting away from the release checklist.',
 'Let us park the phone discussion. We are returning to the release decision and the missing accessibility owner.',
 'Sam will check accessibility. This is a proposal until Sam explicitly agrees. Do not treat a suggested owner as a commitment.',
 'Sam agrees to check accessibility by Wednesday afternoon. Rollback verification remains required before release.',
 'Rally, please recap the unresolved work. We need the source for any claimed commitment.',
 'Correction: rollback is due Thursday at three, not Friday at noon. Keep the corrected deadline in the final report.',
 'The current scope is the browser workflow and Teams voice. Native WhatsApp joining is deferred to later work.',
 'We have agreed the scope. We still need test results before declaring the release ready.',
 'Rally, who owns rollback, and what condition must be satisfied before release?',
 'The checklist is complete as a plan. The actual rollback result is still pending. A plan is not proof that a test passed.',
 'Please preserve the conditional release decision and the corrected deadline. We should follow up on the actual results.',
 'We are wrapping up the rehearsal. Priya owns rollback Thursday at three. Sam owns accessibility Wednesday afternoon. Release waits for rollback verification.'
];
const engine=new MMSSpeech({python:'/srv/hackathon/tools/mms-venv/bin/python',modelDirectory:'/srv/hackathon/models/mms-tts-eng'});
try{
 for(let index=0;index<phrases.length;index++){
  const file=new URL(`phrase-${index}.pcm`,directory);
  try{await access(file);continue;}catch{}
  const audio=await engine.synthesize(phrases[index]);await writeFile(file,audio.pcm,{mode:0o600});
  console.log(JSON.stringify({phrase:index,seconds:audio.seconds}));
 }
 await writeFile(new URL('manifest.json',directory),JSON.stringify({model:'facebook/mms-tts-eng',synthetic:true,phrases,paidModelCalls:0},null,2)+'\n');
}finally{engine.close();}
