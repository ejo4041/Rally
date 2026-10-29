(() => {
  const el = id => document.getElementById(id);
  let snapshot, busy = false;
  const activeStates = ['queued','joining','lobby','connected','leaving'];
  async function request(path,body) {
    const response = await fetch(`/api/teams/${path}`,{ ...(body ? {method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}} : {}) });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Teams connection could not be updated.');
    return value;
  }
  function render(value) {
    snapshot = value;
    const active = value.job && activeStates.includes(value.job.state);
    el('teams-runner').textContent = value.online ? 'Server online' : 'Server offline';
    el('teams-runner').className = `badge ${value.online ? 'live' : ''}`;
    el('teams-status').textContent = value.job ? value.job.message : value.online ? 'Paste a Teams meeting link to start a connection test.' : 'The Teams server is unavailable. No join can start.';
    el('teams-state').textContent = value.job ? value.job.state : 'Ready';
    el('teams-level').value = value.job?.inputLevel || 0;
    el('teams-join').disabled = busy || !value.online || !!active;
    el('teams-leave').hidden = !active;
    el('teams-leave').disabled = busy || !!value.job?.leaveRequested;
    el('teams-credential-note').textContent = value.credentialsConfigured ? 'Azure calling is configured on the server. Only the meeting link is needed.' : 'One-time Azure calling setup is needed. You can use a short-lived ACS VoIP token below for this test.';
    el('teams-token-setup').hidden = value.transport === 'teams-web' || !!value.credentialsConfigured;
    if (value.transport === 'teams-web') el('teams-credential-note').textContent='Paste your link and admit Rally from the lobby. The test ends automatically after three minutes.';
    el('teams-transcribe').disabled = !value.transcriptionReady || !!active;
    el('teams-transcript-panel').hidden = !value.job?.transcribe;
    el('teams-transcription-state').textContent = ({waiting:'Waiting for admission. No audio has been sent for transcription.',listening:'Listening · meeting audio is sent to Meta',stopped:'Transcription stopped · transcript saved',failed:'Transcription failed · check server status'})[value.job?.transcriptionState] || '';
    el('teams-transcript').replaceChildren(...(value.job?.transcript || []).map(turn=>{const p=document.createElement('p');p.textContent=(turn.speaker?turn.speaker+': ':'')+turn.text;return p;}));
    el('teams-partial').textContent=value.job?.partial || '';
    el('teams-save').disabled=busy || active || !['stopped','failed'].includes(value.job?.transcriptionState) || !value.job?.transcript?.length;
    el('teams-export').disabled=!value.job?.transcript?.length;
  }
  async function refresh() {
    try { render(await request('status')); }
    catch { el('teams-runner').textContent='Status unavailable';el('teams-join').disabled=true; }
  }
  el('teams-form').addEventListener('submit',async event => {
    event.preventDefault();
    if (busy) return;
    busy = true; el('teams-error').textContent=''; if(snapshot) render(snapshot);
    try {
      await request('join',{meetingUrl:el('teams-link').value,consented:el('teams-consent').checked,token:el('teams-token').value,transcribe:el('teams-transcribe').checked,transcriptionConsented:el('teams-transcribe').checked});
      el('teams-token').value='';
    } catch(error) { el('teams-error').textContent=error.message; }
    finally { busy=false;await refresh(); }
  });
  el('teams-leave').addEventListener('click',async()=>{
    if (!snapshot?.job || busy) return;
    busy=true;render(snapshot);el('teams-error').textContent='';
    try { await request('leave',{id:snapshot.job.id}); }
    catch(error) { el('teams-error').textContent=error.message; }
    finally { busy=false;await refresh(); }
  });
  el('teams-save').addEventListener('click',async()=>{
    if (!snapshot?.job || busy) return;
    busy=true;render(snapshot);el('teams-error').textContent='';
    try { const saved=await request('save',{id:snapshot.job.id}); location.hash=`meeting/${saved.meetingId}`; }
    catch(error) { el('teams-error').textContent=error.message; }
    finally { busy=false;await refresh(); }
  });
  el('teams-export').addEventListener('click',()=>{const turns=snapshot?.job?.transcript||[];const blob=new Blob(['Rally Teams transcript\n\n'+turns.map(t=>(t.speaker?t.speaker+': ':'')+t.text).join('\n\n')],{type:'text/plain'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='rally-teams-transcript.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  el('teams-refresh').addEventListener('click',refresh);
  setInterval(()=>{if(!document.hidden)refresh();},3000);
  refresh();
})();
