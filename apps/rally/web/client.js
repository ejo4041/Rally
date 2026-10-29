const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=id=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const state={m:null,ws:null,ready:false,config:null,history:[],voices:[],stream:null,captureInput:null,captureGeneration:0,context:null,worklet:null,muted:false,speech:null,speechGeneration:0,blockedEpoch:0,speechTimer:null,toastTimer:null,confirmId:null,turnCount:-1,connecting:false,reviewBusy:false};
const emptyTranscript=$('transcript').innerHTML;
let presenterId=null;
try{const saved=sessionStorage.getItem('rallyPresenterMeeting');if(saved&&/^[a-zA-Z0-9-]+$/.test(saved))presenterId=saved;}catch{}
document.body.classList.toggle('presenting',!!presenterId);
function presenterView(enabled){
  presenterId=enabled?state.m?.id:null;if(enabled&&!presenterId)return;
  try{if(presenterId)sessionStorage.setItem('rallyPresenterMeeting',presenterId);else sessionStorage.removeItem('rallyPresenterMeeting');}catch{}
  document.body.classList.toggle('presenting',!!presenterId);closeNav();if(state.m)render();else if(!presenterId)showHome();
}
$('present-meeting').onclick=()=>presenterView(true);$('exit-presenter').onclick=()=>presenterView(false);
let audioCheck;
function stopAudioCheck(closeDialog=true){audioCheck?.abort();audioCheck=null;if(closeDialog)$('audio-check-dialog').close();}
async function checkAudio(){
  if(!$('consent').checked){notice('Confirm participant consent before checking meeting audio.',true);$('consent').focus();return;}
  if(active()||state.connecting||state.m?.kind!=='live'||state.m.phase!=='draft')return;
  stopAudioCheck();statusBanner('');const controller=new AbortController();audioCheck=controller;
  const tab=state.m.capture?.mode==='meeting-tab';$('check-tab-row').hidden=!tab;$('check-mic-row').hidden=tab&&!state.m.capture.includeMicrophone;
  for(const name of['tab','mic']){$(`check-${name}-level`).value=0;$(`check-${name}-result`).textContent='No signal detected yet.';}
  $('audio-check-status').textContent='Choose the audio source when prompted.';$('stop-audio-check').disabled=false;$('audio-check-dialog').showModal();
  try{
    await RallyAudioInput.check({mode:state.m.capture?.mode||'microphone',includeMicrophone:!!state.m.capture?.includeMicrophone,signal:controller.signal,onLevel:({source,rms,peak})=>{if(audioCheck!==controller)return;const name=source==='tab'?'tab':'mic';$(`check-${name}-level`).value=Math.min(1,rms*5);$(`check-${name}-result`).textContent=peak>=.005?'Audio signal detected.':'No signal detected yet. Ask the relevant speaker to speak.';$('audio-check-status').textContent='Checking locally for up to 15 seconds. Nothing is being sent.';},onFinished:reason=>{if(audioCheck!==controller)return;$('stop-audio-check').disabled=true;$('audio-check-status').textContent=reason==='complete'?'Check complete. Audio capture is off.':reason==='sharing-ended'?'Sharing ended. Audio capture is off.':'Audio check stopped. Capture is off.';}});
  }catch(error){if(audioCheck===controller){$('audio-check-status').textContent=error.name==='NotAllowedError'?'Audio sharing was not granted.':error.message;$('stop-audio-check').disabled=true;}}
}
$('audio-check-dialog').addEventListener('close',()=>stopAudioCheck(false));
$('check-audio').onclick=checkAudio;$('stop-audio-check').onclick=()=>audioCheck?.abort();
const mms=RallyMMS.create({request:async(path,body)=>{const response=await fetch(`/api/speech/${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const value=await response.json();if(!response.ok)throw new Error(value.error||'Voice unavailable.');return value;}});
const active=()=>state.m&&['live','wrapping'].includes(state.m.phase)&&state.ws?.readyState===1;
function notice(message,error=false){$('toast').textContent=message;$('toast').className=`toast${error?' error':''}`;$('toast').hidden=false;clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
async function api(path,options={}){const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json();if(!response.ok)throw new Error(data.error||'The workspace is unavailable.');return data;}
function send(command){if(state.ws?.readyState!==1){notice('The meeting connection is not active.',true);return false;}state.ws.send(JSON.stringify(command));return true;}
function statusBanner(message){$('connection-banner').textContent=message;$('connection-banner').hidden=!message;}
function money(v,d=5){return `$${Number(v||0).toFixed(d)}`;}
function dateLabel(v){return new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric'})+' · '+new Date(v).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});}
function elapsed(){const m=state.m;if(!m?.startedAt)return 0;return Math.max(0,(m.endedAt?Date.parse(m.endedAt):Date.now())-Date.parse(m.startedAt)+(m.demoOffsetMs||0));}
function speakerName(t){return state.m.speakerNames[`turn:${t.id}`]||state.m.speakerNames[t.speaker]||t.speaker||'Unknown speaker';}
function closeNav(){$('sidebar').classList.remove('open');$('nav-scrim').hidden=true;}
function navigateHome(){if(state.connecting){notice('Finish selecting audio before leaving.');return;}if(active()){notice('End the current meeting before leaving. Your microphone is still active.');return;}location.hash='';showHome();}
async function refreshHistory(){
  const data=await api('/api/meetings');state.history=data.meetings;$('nav-count').textContent=state.history.length;$('history-total').textContent=`${state.history.length} SAVED ${state.history.length===1?'MEETING':'MEETINGS'}`;
  $('history').innerHTML=state.history.length?state.history.map(m=>`<button class="history-row" data-meeting="${esc(m.id)}"><span class="history-icon">${icon(m.kind==='walkthrough'?'play':'file')}</span><span class="history-info"><strong>${esc(m.title)}</strong><small>${esc(dateLabel(m.createdAt))}${m.kind==='walkthrough'?' · Scripted walkthrough':m.kind==='teams'?' · Teams transcript':''}</small></span><span class="badge ${esc(m.phase)}">${esc(m.phase==='draft'?'Ready':m.phase)}</span>${icon('arrow')}</button>`).join(''):`<div class="empty-history"><span class="history-icon">${icon('file')}</span><div><h3>A fresh start for better meetings.</h3><p>Create your first meeting, or explore the clearly labeled walkthrough.<br>No microphone or API calls start until you choose to begin.</p></div></div>`;
  $('recent-nav').innerHTML=state.history.length?state.history.slice(0,7).map(m=>`<button class="${m.id===state.m?.id?'current':''}" data-meeting="${esc(m.id)}">${esc(m.title)}</button>`).join(''):'<p class="muted small">Your next good meeting starts here.</p>';
}
function showHome(){if(presenterId){location.hash=`meeting/${presenterId}`;return;}stopAudioCheck();$('home').hidden=false;$('meeting').hidden=true;$('breadcrumb').textContent='Meetings';closeNav();refreshHistory().catch(e=>notice(e.message,true));}
async function openMeeting(id){
  if(presenterId&&id!==presenterId){location.hash=`meeting/${presenterId}`;return;}
  if(state.connecting){notice('Finish selecting audio before opening another meeting.');location.hash=`meeting/${state.m.id}`;return;}
  if(active()&&id!==state.m.id){notice('End the current meeting before opening another.');location.hash=`meeting/${state.m.id}`;return;}
  if(active()&&id===state.m.id)return;
  stopAudioCheck();stopAudio();cancelSpeech(false);state.ready=false;state.ending=false;state.blockedEpoch=0;state.turnCount=-1;$('partial').textContent='';state.m=(await api(`/api/meetings/${id}`)).meeting;
  $('home').hidden=true;$('meeting').hidden=false;$('breadcrumb').textContent='Meeting room';closeNav();$('consent').checked=false;$('review-consent').checked=false;$('voice-enabled').checked=state.m.capture?.mode!=='meeting-tab';statusBanner('');render();
  if(['live','wrapping'].includes(state.m.phase))statusBanner('This saved session is no longer connected here. Capture is off. Use End meeting to finalize it after its session lease expires.');
  refreshHistory().catch(()=>{});
}
function render(){
  const m=state.m;if(!m)return;
  $('meeting-title').textContent=m.title;$('phase-badge').textContent=m.paused&&m.phase!=='ended'?'Rally paused':({draft:'Ready',live:'In progress',wrapping:'Wrapping up',ended:'Saved'})[m.phase];$('phase-badge').className=`badge ${m.phase}`;
  $('share-followup').disabled=m.phase!=='ended'||!m.outcomes.some(o=>o.status==='confirmed');
  $('present-meeting').disabled=m.phase==='draft';
  const confirmed=m.outcomes.filter(o=>o.status==='confirmed'&&o.confirmation?.source==='host_explicit');
  $('presenter-outcome-list').innerHTML=confirmed.length?confirmed.slice(-3).map(o=>`<p><strong>${esc(o.type==='action'?'Action':'Decision')}: ${esc(o.text)}</strong>${o.type==='action'?`${esc(o.owner)} · ${esc(o.dueDate)}`:''}</p>`).join('')+(confirmed.length>3?`<p class="small muted">Showing the latest 3 of ${confirmed.length} host-confirmed outcomes.</p>`:''):'<p class="muted">No outcomes confirmed yet. The host reviews each proposal before it appears here.</p>';
  $('check-audio').hidden=m.kind!=='live';$('check-audio').disabled=state.connecting;
  const tabCapture=m.capture?.mode==='meeting-tab';$('capture-source-note').hidden=!tabCapture;$('capture-source-note').textContent=tabCapture?`Capture ${({'whatsapp':'WhatsApp Web','zoom':'Zoom Web','meet':'Google Meet','jitsi':'Jitsi Meet','other':'meeting tab'})[m.capture.platform]||'meeting tab'} audio${m.capture.includeMicrophone?' and your microphone':''}. Choose the meeting tab and enable Share tab audio when prompted. Rally prompts are host-side. Stop sharing or End to finish.`:'';
  $('meeting-meta').textContent=m.kind==='teams'?`Teams transcript · ${m.review?'reviewed after the meeting':'no moderation performed'} · timing includes lobby`:`${m.participants.length} participants · ${m.minutes} minutes · wrap-up ${m.wrapMinutes} minutes before the end`;
  $('walkthrough-banner').hidden=m.kind!=='walkthrough';$('demo-clock-banner').hidden=!m.demoClockUsed;$('start-panel').hidden=m.phase!=='draft';$('start-meeting').textContent=state.connecting?'Connecting…':m.kind==='walkthrough'?'Start walkthrough':'Start meeting';$('start-meeting').disabled=state.connecting;
  const running=['live','wrapping'].includes(m.phase);$('control-bar').hidden=!running;$('walkthrough-controls').hidden=m.kind!=='walkthrough'||!running;$('next-turn').disabled=!state.ready||m.turns.length>=6;
  $('end-meeting').disabled=!!state.ending;$('end-meeting').textContent=state.ending?'Saving record…':'End meeting';
  $('pause-moderator').innerHTML=icon(m.paused?'play':'pause')+`<span>${m.paused?'Resume Rally':'Pause Rally'}</span>`;
  $('record-indicator').className=`record-indicator${running&&state.ready?' active':''}`;$('record-label').textContent=m.kind==='walkthrough'?'Example transcript':state.ready&&running?'Transcribing live':m.phase==='ended'?'Transcript saved':'Not recording';
  $('rally-state').textContent=m.paused?'Moderator paused':m.phase==='ended'?'Meeting complete':state.speech?'Speaking':running?'Listening for the next useful step':'Ready to help';
  $('capture-label').textContent=m.kind==='walkthrough'?'Scripted example':state.speech?.preparing?'Preparing speech':state.speech?'Rally is speaking':state.muted?'Audio capture muted':state.ready?'Listening':'Capture off';
  $('capture-detail').textContent=m.kind==='teams'?'Saved transcript; no audio capture or moderation is running.':state.speech?.preparing?'Listening while speech is prepared':state.speech?'Audio shielded · Stop speaking to return the floor':m.paused?'Transcription continues; automatic prompts are paused.':'Your microphone stays in your control.';
  $('mute-mic').disabled=m.kind==='walkthrough'||!state.ready;$('mute-mic').textContent=tabCapture?(state.muted?'Unmute audio':'Mute audio'):(state.muted?'Unmute mic':'Mute mic');$('ask-rally').disabled=!state.ready||m.paused;$('pause-moderator').disabled=!state.ready;
  $('agenda-list').innerHTML=m.agenda.map((v,i)=>`<button class="agenda-item${i===m.currentAgenda?' active':''}" data-agenda="${i}" ${!state.ready?'disabled':''}><span>${String(i+1).padStart(2,'0')}</span><span>${esc(v)}</span></button>`).join('');
  $('desired-outcome').textContent=m.desiredOutcome||'Clear decisions and an owner for every next step.';$('participant-count').textContent=m.participants.length;
  $('participants').innerHTML=m.participants.length?m.participants.map(v=>`<div class="participant"><span>${esc(v.slice(0,2).toUpperCase())}</span><span>${esc(v)}</span></div>`).join(''):'<p class="small muted">No participant names entered.</p>';
  renderTurns();renderOutcomes();renderTeamsReview();tick();
  if(m.phase==='ended'){$('control-bar').hidden=true;stopAudio();if(!state.speech?.isTest){$('rally-state').textContent='Meeting complete';$('rally-prompt').textContent=m.kind==='teams'?(m.review?'Transcript reviewed. Confirm any proposed decisions and next steps.':'Saved Teams transcript. Moderation was not run for this test.'):'The conversation ends. The next steps stay clear.';$('rally-hint').textContent=m.kind==='teams'?`Connection: ${m.source.state}. Transcription: ${m.source.transcriptionState}. Review or export the captured words.`:'Review the evidence, confirm remaining proposals, and export your record.';cancelSpeech(false);}}
}
function renderTurns(){
  const m=state.m;if(!m.turns.length){$('transcript').innerHTML=emptyTranscript;state.turnCount=0;return;}
  const box=$('transcript'),nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<80;
  box.innerHTML=m.turns.map(t=>`<article class="turn" id="turn-${encodeURIComponent(t.id)}"><div class="turn-meta"><span class="speaker-avatar">${esc(t.speaker?speakerName(t).slice(0,2).toUpperCase():'?')}</span><strong>${esc(speakerName(t))}</strong>${m.participants.length?`<button class="speaker-correct" data-speaker-turn="${esc(t.id)}">correct</button>`:''}<time>${m.kind==='teams'?'Speech time not recorded':esc(new Date(t.receivedAt).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'}))}</time></div><p>${esc(t.text)}</p></article>`).join('');
  if(nearBottom||state.turnCount!==m.turns.length)box.scrollTop=box.scrollHeight;state.turnCount=m.turns.length;
}
function renderOutcomes(){
  const outcomes=state.m.outcomes;$('outcome-count').textContent=outcomes.length;
  $('decision-score').textContent=outcomes.filter(o=>o.type==='decision'&&o.status==='confirmed').length;$('action-score').textContent=outcomes.filter(o=>o.type==='action'&&o.status==='confirmed'&&o.owner&&o.dueDate).length;$('unresolved-score').textContent=outcomes.filter(o=>!['confirmed','rejected'].includes(o.status)).length;
  if(!outcomes.length){$('outcomes').innerHTML='<div class="outcome-empty">No commitments invented here.<br>Decisions and follow-ups will appear as proposals, with their source transcript.</div>';return;}
  $('outcomes').innerHTML=outcomes.map(o=>`<article class="outcome"><div class="outcome-header"><span class="outcome-type">${esc(o.type)}</span><span class="outcome-status ${esc(o.status)}">${esc(o.status==='confirmed'?'Confirmed by host':o.status)}</span></div><h3>${esc(o.text)}</h3>${o.type==='action'?`<div class="outcome-details"><span>Owner: ${esc(o.owner||'not yet agreed')}</span><span>Due: ${esc(o.dueDate||'not yet agreed')}</span></div>`:''}<div class="outcome-evidence">${o.evidence.map((e,i)=>`<button data-evidence="${esc(e.turnId)}">Source ${i+1} ↗</button>`).join('')}</div><div class="outcome-actions">${['proposed','disputed'].includes(o.status)?`<button class="button secondary small-button" data-confirm="${esc(o.id)}">${icon('check')}Review & confirm</button>${state.ready||state.m.kind==='teams'?`<button class="text-button" data-reject="${esc(o.id)}">Dismiss proposal</button>`:''}`:o.status==='confirmed'?'<span class="small muted">Explicit confirmation recorded.</span>':o.status==='disputed'?'<span class="small muted">Source changed. Review before relying on this outcome.</span>':''}</div></article>`).join('');
  $('decision-score').textContent=outcomes.filter(o=>o.type==='decision'&&o.status==='confirmed').length;$('action-score').textContent=outcomes.filter(o=>o.type==='action'&&o.status==='confirmed'&&o.owner&&o.dueDate).length;$('unresolved-score').textContent=outcomes.filter(o=>!['confirmed','rejected'].includes(o.status)).length;
}
function tick(){if(!state.m)return;const seconds=Math.floor(elapsed()/1000),remain=Math.max(0,state.m.minutes*60-seconds);$('meeting-timer').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;$('remaining').textContent=state.m.phase==='draft'?`${state.m.minutes} minutes reserved`:state.m.phase==='ended'?'Meeting record saved':`${Math.floor(remain/60)}m ${remain%60}s remaining${state.m.demoClockUsed?' · demo clock':''}`;$('time-progress').style.width=`${Math.min(100,seconds/(state.m.minutes*60)*100)}%`;}
function gate(){state.worklet?.port.postMessage({type:'gate',value:state.muted||!!(state.speech&&!state.speech.preparing)});}
async function startAudio(){
  const generation=++state.captureGeneration;
  try{
    const capture=await RallyAudioInput.acquire({mode:state.m.capture?.mode||'microphone',includeMicrophone:!!state.m.capture?.includeMicrophone,onEnded:()=>{if(generation!==state.captureGeneration)return;statusBanner('Audio sharing ended. Capture has stopped.');if(state.ws?.readyState===1)send({type:'end'});stopAudio();}});
    if(generation!==state.captureGeneration){capture.close();throw new Error('Audio selection canceled.');}
    state.captureInput=capture;state.stream=capture.streams[0];
    state.context=new AudioContext();await state.context.resume();await state.context.audioWorklet.addModule('/pcm-worklet.js');
    if(generation!==state.captureGeneration)throw new Error('Audio selection canceled.');
    state.worklet=new AudioWorkletNode(state.context,'rally-pcm',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
    for(const stream of capture.streams){const source=state.context.createMediaStreamSource(new MediaStream(stream.getAudioTracks())),gain=state.context.createGain();gain.gain.value=1/capture.streams.length;source.connect(gain).connect(state.worklet);}
    const zero=state.context.createGain();zero.gain.value=0;state.worklet.connect(zero).connect(state.context.destination);
    state.worklet.port.onmessage=e=>{
      if(e.data.type==='pcm'&&state.ready&&state.ws?.readyState===1){if(state.ws.bufferedAmount>16000){statusBanner('Audio connection fell behind. Capture stopped instead of replaying an old backlog.');send({type:'end'});stopAudio();return;}state.ws.send(e.data.buffer);}
      if(e.data.type==='level')$('input-level').style.height=`${Math.min(100,e.data.value*500)}%`;
    };gate();
  }catch(e){if(generation===state.captureGeneration)stopAudio();throw new Error(e.name==='NotAllowedError'?'Audio sharing was not granted. No meeting audio was sent.':e.message||'Audio could not start.');}
}
function stopAudio(){state.captureGeneration++;state.ready=false;state.captureInput?.close();state.captureInput=null;state.stream=null;state.worklet?.disconnect();state.worklet=null;const context=state.context;state.context=null;if(context&&context.state!=='closed')context.close().catch(()=>{});$('input-level').style.height='0%';}

function voices(){
  $('test-voice').disabled=!state.config?.deviceVoiceAvailable&&!state.config?.mmsAvailable;
  $('voice-select').hidden=!state.config?.deviceVoiceAvailable;
  state.voices=(window.speechSynthesis?.getVoices()||[]).filter(v=>v.localService===true&&v.lang.toLowerCase().startsWith('en'));
  const selected=$('voice-select').value;$('voice-select').innerHTML='<option value="">First local English voice</option>'+state.voices.map(v=>`<option value="${esc(v.voiceURI)}">${esc(v.name)} · local device</option>`).join('');$('voice-select').value=selected;
}
function cancelSpeech(notify=true){
  const previous=state.speech;mms.cancel();state.speechGeneration++;clearTimeout(state.speechTimer);state.speech=null;window.speechSynthesis?.cancel();gate();$('stop-speech').hidden=true;
  if(previous&&notify&&state.ws?.readyState===1)send({type:'playback',id:previous.id,state:'canceled'});
}
function blockPendingSpeech(){state.blockedEpoch=Math.max(state.blockedEpoch+1,(state.m?.epoch||0)+1);cancelSpeech();}
function speak(u,test=false){
  if(!test&&(u.epoch<state.blockedEpoch||u.epoch!==state.m?.epoch||state.m?.paused||state.m?.phase==='ended'))return;
  cancelSpeech();$('rally-prompt').textContent=u.text;$('rally-hint').textContent=test?'Local device voice test · no model API calls.':'Suggested by Rally. You can stop or pause the moderator at any time.';
  if(state.config?.mmsAvailable){
    if(!$('voice-enabled').checked&&!test){send({type:'playback',id:u.id,state:'shown'});return;}
    const generation=++state.speechGeneration;u.isTest=test;u.preparing=true;state.speech=u;gate();$('stop-speech').hidden=false;
    const current=()=>generation===state.speechGeneration&&state.speech===u;
    state.speechTimer=setTimeout(()=>{if(current()){cancelSpeech();if(!test)send({type:'playback',id:u.id,state:'failed'});notice('Voice timed out. The prompt remains visible.',true);}},55000);
    void mms.speak(test?{test:true}:{meetingId:state.m.id,utteranceId:u.id,epoch:u.epoch},status=>{
      if(!current())return;
      if(status==='speaking'){u.preparing=false;gate();if(!test)send({type:'playback',id:u.id,state:'speaking'});$('rally-state').textContent='Speaking';return;}
      clearTimeout(state.speechTimer);state.speech=null;gate();$('stop-speech').hidden=true;
      if(!test)send({type:'playback',id:u.id,state:status});if(status==='failed')notice('Meta MMS voice is unavailable. The prompt remains visible.',true);render();
    });return;
  }
  if(!state.config?.deviceVoiceAvailable){$('rally-hint').textContent='Voice output is unavailable here. Rally’s prompt stays visible.';if(!test)send({type:'playback',id:u.id,state:'shown'});return;}
  if(!$('voice-enabled').checked&&!test){send({type:'playback',id:u.id,state:'shown'});return;}
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){notice('Speech synthesis is unavailable. The prompt is shown as text.',true);if(!test)send({type:'playback',id:u.id,state:'shown'});return;}
  // Never leave voice unset: a browser default can be a remote speech service.
  const available=window.speechSynthesis.getVoices().filter(v=>v.localService===true&&v.lang.toLowerCase().startsWith('en'));
  const voice=available.find(v=>v.voiceURI===$('voice-select').value)||available.find(v=>v.default)||available[0];
  if(!voice){notice('No local English voice is available. Rally’s prompt stays visible.',true);if(!test)send({type:'playback',id:u.id,state:'shown'});return;}
  const generation=++state.speechGeneration;u.isTest=test;state.speech=u;gate();$('stop-speech').hidden=false;
  const utterance=new SpeechSynthesisUtterance(u.text);utterance.lang='en-US';utterance.rate=.98;
  utterance.voice=voice;
  const finish=status=>{if(generation!==state.speechGeneration)return;clearTimeout(state.speechTimer);state.speech=null;gate();$('stop-speech').hidden=true;if(!test)send({type:'playback',id:u.id,state:status});if(status==='failed')notice('Voice playback failed. Read the visible prompt or try another device voice.',true);render();};
  utterance.onstart=()=>{if(generation!==state.speechGeneration)return;if(!test)send({type:'playback',id:u.id,state:'speaking'});$('rally-state').textContent='Speaking';render();};
  utterance.onend=()=>finish('completed');utterance.onerror=()=>finish('failed');u.nativeUtterance=utterance;
  state.speechTimer=setTimeout(()=>{if(generation===state.speechGeneration){cancelSpeech();notice('Speech playback timed out; the floor is yours.',true);render();}},23000);
  window.speechSynthesis.speak(utterance);
}
async function startMeeting(){
  if(!$('consent').checked){notice('Confirm that everyone consents before starting.',true);$('consent').focus();return;}
  if(state.connecting||active())return;
  stopAudioCheck();
  const isLive=state.m.kind==='live';if(isLive&&!state.config.liveAvailable){statusBanner('Live calls are disabled for this environment. Use the walkthrough, or enable the server’s configured Muse integration.');return;}
  state.connecting=true;render();statusBanner('');
  try{
    if(isLive)await startAudio();
    const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/meetings/${state.m.id}/connect`);state.ws=ws;
    const timeout=setTimeout(()=>{if(!state.ready){statusBanner('The meeting did not become ready. Capture has stopped.');stopAudio();ws.close();}},18000);
    ws.onopen=()=>send({type:'start',consented:true});
    ws.onmessage=event=>{
      let data;try{data=JSON.parse(event.data);}catch{return;}
      if(data.type==='state'){state.m=data.meeting;render();}
      if(data.type==='ready'){clearTimeout(timeout);state.ready=true;state.connecting=false;statusBanner('');render();}
      if(data.type==='partial')$('partial').textContent=data.text;
      if(data.type==='speak')speak(data.utterance);
      if(data.type==='cancel'){cancelSpeech(false);render();}
      if(data.type==='notice'){notice(data.message,data.code==='error');if(['error','budget'].includes(data.code))statusBanner(data.message);}
      if(data.type==='thinking'){document.querySelector('.rally-card').classList.toggle('thinking',data.active);$('rally-state').textContent=data.active?'Considering the conversation…':state.m.paused?'Moderator paused':'Listening';}
      if(data.type==='reasoning')$('rally-hint').textContent=`Reasoning completed in ${(data.durationMs/1000).toFixed(2)}s. Audible response time is device-dependent.`;
      if(data.type==='cost')updateCost(data);
    };
    ws.onclose=()=>{clearTimeout(timeout);state.connecting=false;stopAudio();cancelSpeech(false);if(state.m?.phase!=='ended')statusBanner('Connection closed. Capture is off. Your saved transcript remains available.');render();refreshHistory().catch(()=>{});};
    ws.onerror=()=>{statusBanner('Could not establish the meeting connection. Capture will stop.');ws.close();};
  }catch(e){state.connecting=false;stopAudio();statusBanner(e.message);render();}
}
function updateCost(value){
  const app=value.appEstimate??value.total??0,baseline=value.baseline??state.config?.baselineSpend??.0517416;
  $('budget-label').textContent=`${money(Number(app)+Number(baseline),3)} estimated`;
  const unknown=Number(value.unknown||0);
  $('cost-details').innerHTML=`<div class="cost-hero">${money(150-Number(app)-Number(baseline),5)}</div><p class="small muted">Conditional grant remainder · not verified Billing balance</p><div class="cost-row"><span>Earlier tracked experiments</span><strong>${money(baseline,6)}</strong></div><div class="cost-row"><span>This app’s tracked usage</span><strong>${money(app,6)}</strong></div><div class="cost-row"><span>Current meeting estimate</span><strong>${money(value.meetingEstimate??0,6)}</strong></div><div class="cost-row"><span>Unknown-cost requests</span><strong>${unknown}</strong></div><div class="cost-row"><span>Per-meeting configured ceiling</span><strong>${money(state.config?.meetingBudget??.25,2)}</strong></div>${unknown?'<p class="form-error">Some charges are unknown. Additional paid reasoning is blocked until reconciled.</p>':''}`;
}
async function createWalkthrough(){
  if(active()){notice('End the current meeting before starting a walkthrough.');return;}
  try{const r=await api('/api/meetings',{method:'POST',body:JSON.stringify({kind:'walkthrough',minutes:30,wrapMinutes:5,desiredOutcome:'A clear release decision and an owner and deadline for rollback validation.'})});location.hash=`meeting/${r.meeting.id}`;}catch(e){notice(e.message,true);}
}
function newDialog(){if(presenterId){notice('Return to the workspace before creating another meeting.');return;}if(state.connecting){notice('Finish selecting audio before creating another meeting.');return;}if(active()){notice('End the current meeting before creating another.');return;}$('setup-error').textContent='';$('setup-dialog').showModal();$('setup-title').focus();}
async function confirmOpen(id){
  const o=state.m.outcomes.find(x=>x.id===id);if(!o)return;state.confirmId=id;$('confirm-text').textContent=o.text;$('action-fields').hidden=o.type!=='action';$('confirm-owner').innerHTML='<option value="">Choose a participant</option>'+state.m.participants.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');$('confirm-owner').value=o.owner||'';$('confirm-date').value=o.dueDate||'';$('confirm-check').checked=false;$('confirm-error').textContent='';$('confirm-evidence').innerHTML=o.evidence.map(e=>`<p>${esc(e.quote)}</p>`).join('');$('confirm-dialog').showModal();
}
document.addEventListener('click',async event=>{
  const target=event.target.closest('button,a');if(!target)return;
  try{
    if(target.dataset.action==='new')newDialog();
    if(target.dataset.close)$(target.dataset.close).close();
    if(target.dataset.meeting)location.hash=`meeting/${target.dataset.meeting}`;
    if(target.dataset.agenda!==undefined){blockPendingSpeech();send({type:'agenda',index:Number(target.dataset.agenda)});}
    if(target.dataset.evidence){const node=$(`turn-${encodeURIComponent(target.dataset.evidence)}`);if(node){node.scrollIntoView({behavior:'smooth',block:'center'});node.classList.add('highlight');setTimeout(()=>node.classList.remove('highlight'),1800);}}
    if(target.dataset.confirm)confirmOpen(target.dataset.confirm);
    if(target.dataset.reject){if(state.m.kind==='teams'&&!state.ready)await savedTeamsEdit({action:'reject',id:target.dataset.reject});else send({type:'reject',id:target.dataset.reject});}
    if(target.dataset.speakerTurn){
      const t=state.m.turns.find(t=>t.id===target.dataset.speakerTurn);
      if(!state.ready&&state.m.kind!=='teams'){notice('Speaker correction is available in the active host session.');return;}
      const name=window.prompt(`Choose the verified speaker name (${state.m.participants.join(', ')}). This is a host correction, not automatic identity recognition.`,speakerName(t)==='Unknown speaker'?'':speakerName(t));
      if(name){if(!state.m.participants.includes(name.trim())){notice('Choose an exact participant name from the roster.',true);return;}if(state.m.kind==='teams'&&!state.ready)await savedTeamsEdit({action:'speaker',turnId:t.id,name:name.trim()});else{blockPendingSpeech();send({type:'speaker',label:`turn:${t.id}`,name:name.trim()});}}
    }
  }catch(e){notice(e.message,true);}
});
function renderTeamsReview(){
  const m=state.m,teams=m?.kind==='teams';$('teams-review-panel').hidden=!teams;
  if(!teams)return;
  const key=`${m.id}:${m.version}`;
  if($('teams-review-form').dataset.loaded!==key){
    $('review-title').value=m.title;$('review-agenda').value=m.agenda.join('\n');$('review-participants').value=m.participants.join(', ');$('review-desired').value=m.desiredOutcome;
    $('review-consent').checked=false;$('teams-review-error').textContent='';$('teams-review-form').dataset.loaded=key;
  }
  $('teams-review-fields').disabled=state.reviewBusy;
  $('review-teams').disabled=state.reviewBusy||!state.config?.liveAvailable||!$('review-consent').checked;
  $('review-teams').textContent=state.reviewBusy?'Reviewing…':'Review transcript with Muse';
  $('teams-review-status').textContent=!state.config?.liveAvailable?'Paid reviews are disabled in this environment. You can save details and correct speakers.':m.review?`${m.review.turnCount} turns reviewed. ${m.review.stale?'Meeting details changed; review again to update proposals.':'Proposals still require host confirmation.'}`:'Save your agenda and names, then choose whether to request a paid review.';
}
async function savedTeamsEdit(data){
  const id=state.m.id,result=await api(`/api/meetings/${id}/record`,{method:'POST',body:JSON.stringify({...data,version:state.m.version})});
  if(state.m?.id===id){state.m=result.meeting;render();}
  refreshHistory().catch(()=>{});return result.meeting;
}
function savedSetup(){return{action:'setup',title:$('review-title').value,agenda:$('review-agenda').value,participants:$('review-participants').value,desiredOutcome:$('review-desired').value};}
$('review-consent').onchange=renderTeamsReview;
$('teams-review-form').addEventListener('submit',async event=>{event.preventDefault();if(state.reviewBusy)return;try{await savedTeamsEdit(savedSetup());notice('Meeting details saved. No model request was made.');}catch(error){$('teams-review-error').textContent=error.message;}});
$('review-teams').onclick=async()=>{
  if(state.reviewBusy||!$('review-consent').checked||!$('teams-review-form').reportValidity())return;
  const id=state.m.id,details=savedSetup();state.reviewBusy=true;renderTeamsReview();$('teams-review-error').textContent='';
  try{
    const m=await savedTeamsEdit(details);
    const result=await api(`/api/meetings/${id}/review`,{method:'POST',body:JSON.stringify({version:m.version,consented:true})});
    if(state.m?.id===id){state.m=result.meeting;render();}
    updateCost(await api('/api/costs'));notice(result.cached?'Existing review reused. No new model request.':'Review saved. Check the sources before confirming proposals.');
  }catch(error){if(state.m?.id===id)$('teams-review-error').textContent=error.message;}
  finally{state.reviewBusy=false;if(state.m?.id===id){$('review-consent').checked=false;renderTeamsReview();}}
};
$('setup-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.target;const button=form.querySelector('[type=submit]');button.disabled=true;try{const data=Object.fromEntries(new FormData(form));data.minutes=Number(data.minutes);data.wrapMinutes=Number(data.wrapMinutes);const r=await api('/api/meetings',{method:'POST',body:JSON.stringify(data)});$('setup-dialog').close();location.hash=`meeting/${r.meeting.id}`;}catch(err){$('setup-error').textContent=err.message;}finally{button.disabled=false;}});

$('setup-capture').onchange=()=>{$('tab-audio-setup').hidden=$('setup-capture').value!=='meeting-tab';};
$('share-followup').onclick=async()=>{try{const result=await api(`/api/meetings/${state.m.id}/followup`,{method:'POST',body:'{}'});$('followup-text').value=result.text;$('followup-count').textContent=`${result.confirmedCount} confirmed outcomes. ${result.excludedCount} unconfirmed or unavailable outcomes excluded.`;$('followup-dialog').showModal();}catch(error){notice(error.message,true);}};
$('copy-followup').onclick=async()=>{try{await navigator.clipboard.writeText($('followup-text').value);notice('Follow-up copied.');}catch{notice('Select the draft and copy it manually.',true);}};
$('whatsapp-followup').onclick=()=>{if(!$('followup-text').value)return;window.open('https://wa.me/?text='+encodeURIComponent($('followup-text').value),'_blank','noopener,noreferrer');};
$('setup-minutes').addEventListener('change',()=>{if(Number($('setup-wrap').value)>=Number($('setup-minutes').value))$('setup-wrap').value=Math.max(.5,Math.min(5,Number($('setup-minutes').value)/2));});
$('confirm-form').addEventListener('submit',async e=>{e.preventDefault();if(!$('confirm-check').checked)return;const o=state.m.outcomes.find(o=>o.id===state.confirmId),owner=$('confirm-owner').value,dueDate=$('confirm-date').value.trim();if(o.type==='action'&&(!owner||!dueDate)){$('confirm-error').textContent='An action needs an owner and an agreed deadline.';return;}try{const command={id:o.id,...(state.m.kind==='teams'?{version:state.m.version}:{}),...(o.type==='action'?{owner,dueDate}:{})};if(state.ready)send({type:'confirm',...command});else{state.m=(await api(`/api/meetings/${state.m.id}/confirm`,{method:'POST',body:JSON.stringify(command)})).meeting;render();}$('confirm-dialog').close();}catch(err){$('confirm-error').textContent=err.message;}});
$('start-meeting').onclick=startMeeting;$('try-demo').onclick=createWalkthrough;$('back-home').onclick=navigateHome;$('home-nav').onclick=navigateHome;
document.querySelector('.brand').onclick=e=>{e.preventDefault();navigateHome();};$('menu').onclick=()=>{$('sidebar').classList.toggle('open');$('nav-scrim').hidden=!$('sidebar').classList.contains('open');};$('nav-scrim').onclick=closeNav;
$('pause-moderator').onclick=()=>{blockPendingSpeech();send({type:state.m.paused?'resume':'pause'});};$('stop-speech').onclick=()=>{if(active()){blockPendingSpeech();send({type:'dismiss'});}else cancelSpeech();render();};
$('mute-mic').onclick=()=>{state.muted=!state.muted;gate();render();};$('ask-rally').onclick=()=>send({type:'review'});$('next-turn').onclick=()=>send({type:'walkthrough_next'});
$('end-meeting').onclick=()=>{blockPendingSpeech();if(state.ws?.readyState===1){state.ending=true;send({type:'end'});stopAudio();render();}else notice('The disconnected session must be finalized or deleted after its lease expires.',true);};
$('demo-clock').onclick=()=>{if(!state.ready){notice('Start a meeting or walkthrough first.');return;}send({type:'demo_clock'});};
$('voice-enabled').onchange=()=>{if(!$('voice-enabled').checked)cancelSpeech();};$('test-voice').onclick=()=>speak({id:'device-voice-test',text:'Hi, I’m Rally. Let’s make this meeting count.'},true);
$('budget-button').onclick=async()=>{try{updateCost(await api('/api/costs'));$('budget-dialog').showModal();}catch(e){notice(e.message,true);}};
$('download-usage').onclick=async()=>{try{const value=await api('/api/usage');const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='rally-usage.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){notice(e.message,true);}};
$('export').onclick=()=>{if(state.m)window.location.href=`/api/meetings/${state.m.id}/export`;};
$('delete-meeting').onclick=()=>{if(active()){notice('End this meeting before deleting it.');return;}$('delete-dialog').showModal();};
$('confirm-delete').onclick=async()=>{try{await api(`/api/meetings/${state.m.id}`,{method:'DELETE'});$('delete-dialog').close();state.m=null;location.hash='';showHome();notice('Meeting transcript and outcomes deleted.');}catch(e){notice(e.message,true);}};
window.addEventListener('hashchange',()=>route().catch(e=>notice(e.message,true)));
window.addEventListener('beforeunload',e=>{if(active()){e.preventDefault();e.returnValue='';}});
window.speechSynthesis?.addEventListener('voiceschanged',voices);
async function route(){const match=location.hash.match(/^#meeting\/([a-zA-Z0-9-]+)$/);if(match)return openMeeting(match[1]);if(state.connecting){location.hash=`meeting/${state.m.id}`;return;}if(active()){location.hash=`meeting/${state.m.id}`;notice('End the current meeting before leaving.');return;}showHome();}
async function boot(){try{state.config=await api('/api/config');await refreshHistory();updateCost(await api('/api/costs'));voices();if(presenterId)location.hash=`meeting/${presenterId}`;await route();}catch(e){$('history').textContent='The workspace could not load. Refresh to retry.';notice(e.message,true);}}
setInterval(tick,1000);boot();
