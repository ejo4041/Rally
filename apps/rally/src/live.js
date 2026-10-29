import {AppError,addFinal,applyDecision,canSpeak,confirmOutcome,control,elapsedMs,timeCheckpoint,utterance,wrapText} from './core.js';
import {modelConfig,audioCost} from './models.js';
import {modelServices} from './model-services.js';
export function attachSession(socket,m,repository,env,ctx,leaseId,services={}){
  const transcription=modelConfig(env).transcription;
  const {moderate:runModeration,openASR:connectASR}=modelServices(env,services),throttleMs=services.throttleMs??4000;
  let asr=null,queue=Promise.resolve(),closed=false,ending=false,recordedAudio=false,modelBusy=false,modelWanted=false,speaking=false,budgetBlocked=false;
  let lastEvaluationAt=0,playbackUntil=0,modelGeneration=0,asrCloseResolve,evaluationTimer=null,pendingAnalysis=null,lastAnalyzedSource=null;
  const sourceSignature=()=>`${m.currentAgenda}:${JSON.stringify(m.speakerNames)}:${m.turns.map(t=>`${t.id}@${t.revision}`).join('|')}`;
  const asrClosed=new Promise(resolve=>{asrCloseResolve=resolve;});
  const send=(type,data={})=>{if(socket.readyState===1)socket.send(JSON.stringify({type,...data}));};
  const warn=(message,code='notice')=>send('notice',{message,code});
  const enqueue=fn=>{queue=queue.then(fn).catch(e=>{warn(e instanceof AppError?e.message:'An operation failed. Refresh if the connection does not recover.','error');});ctx.waitUntil(queue);return queue;};
  const save=async()=>{await repository.save(m);send('state',{meeting:m});};
  async function costs(){const [all,own]=await Promise.all([repository.costs(),repository.costs(m.id)]);send('cost',{appEstimate:Number(all.total||0),meetingEstimate:Number(own.total||0),unknown:Number(all.unknown||0),baseline:Number(env.RALLY_BASELINE_SPEND||.0517416),conditionalRemainder:150-Number(env.RALLY_BASELINE_SPEND||.0517416)-Number(all.total||0)});return{all,own};}
  async function allowed(projected=0){const {all,own}=await costs();const pending=asr&&!recordedAudio?audioCost(Math.ceil(asr.sentSeconds),transcription):0;return !all.unknown&&Number(all.total)+pending+projected<=Number(env.RALLY_BUILD_BUDGET||.5)&&Number(own.total)+pending+projected<=Number(env.RALLY_MEETING_BUDGET||.25);}
  function speak(value,kind='prompt',priority=false){
    if(!canSpeak(m,Date.now(),priority)||speaking||ending)return null;
    const u=utterance(m,value,kind);
    if(env.RALLY_MMS_ENABLED==='1')enqueue(async()=>{await save();if(u.epoch===m.epoch&&!m.paused&&!ending&&['live','wrapping'].includes(m.phase)&&u.state!=='canceled')send('speak',{utterance:u});});
    else send('speak',{utterance:u});return u;
  }
  async function evaluate(force=false){
    if(m.kind!=='live'||(budgetBlocked&&!force)||m.paused||!['live','wrapping'].includes(m.phase)||speaking||ending)return;
    if(modelBusy){modelWanted=true;return;}
    if(!force&&(m.turns.filter(t=>!t.echoRisk).length<2||sourceSignature()===lastAnalyzedSource))return;
    const wait=throttleMs-(Date.now()-lastEvaluationAt);
    if(!force&&wait>0){clearTimeout(evaluationTimer);evaluationTimer=setTimeout(()=>ctx.waitUntil(evaluate()),wait+5);return;}
    // Reserve before the first await: rapid finals/host requests cannot race the
    // asynchronous budget read and create concurrent paid requests.
    modelBusy=true;lastEvaluationAt=Date.now();const epoch=m.epoch,generation=++modelGeneration;
    const snapshot=structuredClone(m),signature=sourceSignature();
    try{
      if(!(await allowed(.015))){budgetBlocked=true;warn('Automatic reasoning stopped at the session budget or unknown-cost boundary.','budget');return;}
      if(ending||epoch!==m.epoch||m.paused)return;
      send('thinking',{active:true});
      const promise=runModeration(env,snapshot,repository,{pendingAudioEstimate:asr&&!recordedAudio?audioCost(Math.ceil(asr.sentSeconds),transcription):0});
      pendingAnalysis={promise,snapshot,signature};
      const result=await promise;
      if(ending)return; // End drains this same result without queue deadlock.
      await enqueue(async()=>{
        if(epoch!==m.epoch||generation!==modelGeneration||ending||m.paused)return;
        const validated=applyDecision(m,result.decision);
        budgetBlocked=false;
        lastAnalyzedSource=signature;
        const stillCurrent=m.turns.at(-1)?.id===snapshot.turns.at(-1)?.id;
        if(validated.intervene&&stillCurrent)speak(validated.spokenText,validated.kind,force);
        await save();send('reasoning',{durationMs:result.usage.durationMs});
      });
    }catch(e){budgetBlocked=true;if(e.accountingFailure){m.accountingWarning=true;if(!ending)await enqueue(save);}warn(e instanceof AppError?e.message:'Automatic reasoning is unavailable.','error');}
    finally{modelBusy=false;send('thinking',{active:false});try{await costs();}catch{budgetBlocked=true;}if(modelWanted&&!ending){modelWanted=false;ctx.waitUntil(evaluate());}}
  }
  async function recordAudio(){
    if(recordedAudio||!asr)return;
    const duration=Math.max(asr.sentSeconds,asr.processedMs/1000);
    await repository.usage({id:crypto.randomUUID(),meetingId:m.id,createdAt:new Date().toISOString(),model:transcription.model,adapter:transcription.adapter,pricing:{usdPerAudioHour:transcription.usdPerAudioHour},status:'closed',estimatedCost:audioCost(duration,transcription),usage:{audioSentSeconds:asr.sentSeconds,audioProcessedMs:asr.processedMs},costBasis:asr.processedMs/1000>=asr.sentSeconds?'reported_processed_seconds':'sent_audio_estimate',sessionId:asr.sessionId});recordedAudio=true;await costs();
  }
  async function begin(command){
    if(m.phase!=='draft')throw new AppError('This meeting has already started. Create a new session.',409);
    if(command.consented!==true)throw new AppError('Confirm consent before starting.');
    if(m.kind==='live'){
      if(!env.MODEL_API_KEY||env.RALLY_PAID_ENABLED!=='1')throw new AppError('Live Muse calls are disabled for this environment. The walkthrough is available.',503);
      if(!(await allowed(m.minutes*60*transcription.usdPerAudioHour/3600+.015)))throw new AppError('Meeting forecast exceeds the configured budget. Choose a shorter meeting.');
      asr=await connectASR(env,{
        onEvent(event){
          if(event.type==='partial')send('partial',{text:event.text});
          if(event.type==='final'){
            const value={sessionId:event.sessionId,turnId:event.turnId,transcript:event.text,speaker:event.speaker||null,echoRisk:false};
            if(ending){addFinal(m,value);return;}
            enqueue(async()=>{const t=addFinal(m,value);if(t){await save();send('partial',{text:''});ctx.waitUntil(evaluate());}});
          }
        },
        onClose(){asrCloseResolve();if(!ending){warn('Transcription disconnected. End this meeting and start a new one; no hidden backlog is replayed.','error');enqueue(async()=>{m.paused=true;m.epoch++;await save();await recordAudio();});}},
        onError(message){if(!ending)warn(message,'error');}
      });
    }
    control(m,{type:'start',consented:true});await save();send('ready',{sampleRate:16000});speak(m.opening,'opening',true);await save();
  }
  async function end(){
    if(ending)return;ending=true;m.epoch++;clearTimeout(evaluationTimer);send('cancel');speaking=false;
    try{
      if(asr){asr.end();await Promise.race([asrClosed,new Promise(r=>setTimeout(r,2500))]);asr.close();}
      try{await recordAudio();}catch{budgetBlocked=true;m.accountingWarning=true;warn('Audio accounting could not be saved. Pause further paid use until usage is reconciled.','budget');}
      // Finish evidence/proposals without speaking. Flushed finals are collected
      // directly above while this serialized end command awaits the provider.
      if(pendingAnalysis){
        try{const previous=await pendingAnalysis.promise;if(pendingAnalysis.snapshot.epoch+1===m.epoch){applyDecision(m,previous.decision);lastAnalyzedSource=pendingAnalysis.signature;}}catch(e){if(e.accountingFailure){m.accountingWarning=true;budgetBlocked=true;}}
      }
      if(m.kind==='live'&&m.turns.length&&sourceSignature()!==lastAnalyzedSource&&!budgetBlocked){
        try{
          if(await allowed(.015)){
            const final=await runModeration(env,structuredClone(m),repository,{pendingAudioEstimate:0});applyDecision(m,final.decision);lastAnalyzedSource=sourceSignature();
          }else warn('Transcript saved. The final proposal pass was skipped at the budget boundary.','budget');
        }catch(e){if(e.accountingFailure){m.accountingWarning=true;budgetBlocked=true;}warn('Transcript saved; review final commitments manually because the final proposal pass was unavailable.','error');}
      }
    }finally{
      control(m,{type:'end'});
      try{await save();}finally{
        clearInterval(clock);clearInterval(heartbeat);
        try{await repository.release(m.id,leaseId);}catch{}
        try{socket.close(1000,'Meeting saved');}catch{}
      }
    }
  }
  function walkthrough(){
    if(m.kind!=='walkthrough'||!['live','wrapping'].includes(m.phase))throw new AppError('Start the walkthrough first.');
    const index=m.turns.length;
    const lines=[['Alex','We need to decide whether to release on Friday. The rollback test is the only blocker.'],['Priya','Before we decide, I spent the weekend comparing mountain bikes.'],['Sam','Let’s compare bike frames and holiday routes instead of the release.'],['Alex','Back to the release: we will wait until the rollback test passes.'],['Priya','I can run the rollback test, but we have not agreed a deadline.'],['Priya','I will run the rollback test by Thursday at 3 PM.']];
    if(index>=lines.length){warn('All walkthrough turns are complete. Confirm the proposals and try the demo clock.');return;}
    const [speaker,value]=lines[index];m.speakerNames[speaker]=speaker;
    addFinal(m,{sessionId:'walkthrough',turnId:index,transcript:value,speaker,source:'scripted_walkthrough'});
    if(index===2)speak('Could we return to the Friday release decision?','redirect',true);
    if(index===3)applyDecision(m,{intervene:false,kind:'none',spoken_text:'',evidence_turn_ids:[],outcomes:[{type:'decision',text:'Release only after the rollback test passes.',owner:null,due_date:null,evidence_turn_ids:['walkthrough:3']}]});
    if(index===4)speak('Priya, what deadline should we use for the rollback test?','clarify',true);
    if(index===5)applyDecision(m,{intervene:false,kind:'none',spoken_text:'',evidence_turn_ids:[],outcomes:[{type:'action',text:'Run the rollback test.',owner:'Priya',due_date:'Thursday at 3 PM',evidence_turn_ids:['walkthrough:4','walkthrough:5']}]});
  }
  socket.addEventListener('message',event=>{
    if(event.data instanceof ArrayBuffer||ArrayBuffer.isView(event.data)){
      if(asr&&!ending&&m.phase!=='draft'&&m.phase!=='ended'){
        if(event.data.byteLength>16000||event.data.byteLength%2){warn('Invalid audio frame.','error');return;}
        const realSeconds=m.startedAt?(Date.now()-Date.parse(m.startedAt))/1000:0;
        if(asr.sentSeconds+event.data.byteLength/32000>realSeconds+.75){warn('Audio ran ahead of real time; stopping the session instead of spending on an invalid stream.','error');enqueue(end);return;}
        asr.send(event.data);
      }return;
    }
    enqueue(async()=>{
      let c;try{c=JSON.parse(event.data);}catch{throw new AppError('Invalid control message.');}
      if(c.type==='start')return begin(c);
      if(c.type==='end')return end();
      if(c.type==='playback'){
        const u=m.interventions.find(u=>u.id===c.id);if(!u||u.epoch!==m.epoch)return;
        if(c.state==='speaking'){u.state='speaking';u.startedAt=new Date().toISOString();if(u.kind!=='opening')m.lastPresentedAt=Date.now();speaking=true;playbackUntil=Date.now()+25000;}
        else if(c.state==='shown'){u.state='completed';u.presentation='visible_only';if(u.kind!=='opening')m.lastPresentedAt=Date.now();speaking=false;}
        else if(['completed','canceled','failed'].includes(c.state)){u.state=c.state;u.endedAt=new Date().toISOString();speaking=false;}
        await save();if(['shown','completed','canceled','failed'].includes(c.state))ctx.waitUntil(evaluate());return;
      }
      if(c.type==='confirm'){confirmOutcome(m,c.id,{owner:c.owner,dueDate:c.dueDate,actor:'Meeting host',note:'Host explicitly confirmed after reviewing the source transcript.'});await save();return;}
      if(c.type==='reject'){const o=m.outcomes.find(o=>o.id===c.id);if(!o)throw new AppError('Proposal not found.');o.status='rejected';await save();return;}
      if(c.type==='review'){if(m.kind==='live')ctx.waitUntil(evaluate(true));else walkthrough();await save();return;}
      if(c.type==='walkthrough_next'){walkthrough();await save();return;}
      if(['pause','resume','dismiss','agenda','speaker','demo_clock'].includes(c.type)){
        control(m,c);if(['pause','dismiss','agenda','speaker'].includes(c.type)){speaking=false;modelGeneration++;send('cancel');}
        await save();if(c.type==='resume'||c.type==='agenda')ctx.waitUntil(evaluate());return;
      }
      throw new AppError('Unknown control.');
    });
  });
  const clock=setInterval(()=>enqueue(async()=>{
    if(ending||!['live','wrapping'].includes(m.phase))return;
    if(!(await repository.renew(m.id,leaseId))){warn('Session ownership expired; stopping safely.','error');await end();return;}
    if(speaking&&Date.now()>playbackUntil){speaking=false;send('cancel');warn('Speech timed out and was canceled.');}
    const elapsed=elapsedMs(m);
    if(elapsed>=m.minutes*60000){warn('Planned meeting time is complete. Saving the record.');await end();return;}
    if(!m.wrapTriggered&&elapsed>=(m.minutes-m.wrapMinutes)*60000&&!m.paused&&!speaking){m.wrapTriggered=true;m.phase='wrapping';speak(wrapText(m),'wrapup',true);await save();}
    const checkpoint=timeCheckpoint(m);if(checkpoint&&!speaking){const u=speak(checkpoint.text,'checkpoint');if(u){m.checkpointItems.push(checkpoint.index);await save();}}
    if(asr&&!(await allowed(.001))){warn('Audio stopped at the budget boundary.','budget');await end();}
  }),1000);
  const heartbeat=setInterval(()=>{if(!closed)send('heartbeat',{at:Date.now()});},15000);
  async function cleanup(){if(closed)return;closed=true;clearInterval(clock);clearInterval(heartbeat);await enqueue(end);await repository.release(m.id,leaseId);}
  socket.addEventListener('close',()=>ctx.waitUntil(cleanup()));socket.addEventListener('error',()=>ctx.waitUntil(cleanup()));
  send('state',{meeting:m});ctx.waitUntil(costs());
  return {cleanup};
}
