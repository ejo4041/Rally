import { CallClient, LocalAudioStream } from '@azure/communication-calling';
import { AzureCommunicationTokenCredential } from '@azure/communication-common';

// A virtual microphone: only explicitly queued audio goes into this destination.
// The incoming meeting stream is deliberately never connected to it.
export function virtualMic(context) {
  const destination = context.createMediaStreamDestination();
  const gate = context.createGain();
  gate.gain.value = 1;
  gate.connect(destination);
  const active = new Set();
  return {
    stream: destination.stream,
    play(buffer) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gate);
      active.add(source);
      source.onended = () => { active.delete(source); source.disconnect(); };
      source.start();
    },
    stop() {
      for (const source of active) { source.stop(); source.disconnect(); }
      active.clear();
    },
    dispose() {
      this.stop();
      gate.disconnect();
      destination.stream.getTracks().forEach(track => track.stop());
    }
  };
}

window.sdkProbe = { CallClient, LocalAudioStream, virtualMic };
let session;
window.rallyTeamsStatus = () => ({ state: session?.call?.state || (session ? 'Connecting' : 'Idle'), inputLevel: Number(document.querySelector('#level').value || 0) });
window.rallyTeamsLeave = () => leave();
const log = text => { document.querySelector('#status').textContent = text; };

async function leave() {
  const current = session;
  session = null;
  if (!current) return;
  clearTimeout(current.timeout);
  current.mic.stop();
  try { if (current.call) await current.call.hangUp(); }
  finally {
    for (const audio of current.sinks || []) { audio.srcObject = null; audio.remove(); }
    current.local?.dispose();
    current.mic.dispose();
    await current.agent?.dispose();
    await current.client.dispose();
    current.credential.dispose();
    await current.context.close();
    log('Left; audio resources closed.');
  }
}

document.querySelector('#join').onclick = async () => {
  if (session) return;
  if (!document.querySelector('#consent').checked) return log('Confirm participant consent first.');
  const meetingLink = document.querySelector('#meeting').value.trim();
  let parsed;
  try { parsed = new URL(meetingLink); } catch { return log('Enter a Teams meeting URL.'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'teams.microsoft.com') {
    return log('Use an HTTPS Teams meeting URL.');
  }
  const token = document.querySelector('#token').value.trim();
  if (!token) return log('A short-lived Azure Communication Services voip user token is required.');
  let credential;
  try { credential = new AzureCommunicationTokenCredential(token); }
  catch { return log('Invalid ACS token.'); }
  document.querySelector('#token').value = '';
  const context = new AudioContext();
  const mic = virtualMic(context);
  const client = new CallClient();
  const current = { context, mic, client, credential, sinks: [] };
  session = current;
  // Explicit finite test lifetime, including connection/lobby time. No paid auto-retry.
  current.timeout = setTimeout(() => { leave().catch(() => log('Cleanup failed; check meeting roster.')); }, 180_000);
  try {
    await context.resume();
    current.agent = await client.createCallAgent(credential, { displayName: 'Rally audio test' });
    if (session !== current) { await current.agent.dispose(); return; }
    current.local = new LocalAudioStream(mic.stream);
    current.call = current.agent.join({ meetingLink }, { audioOptions: { muted: false, localAudioStreams: [current.local] } });
    const attached = new Set();
    const attachIncoming = async () => {
      if (session !== current || current.call.state !== 'Connected') return;
      for (const stream of current.call.remoteAudioStreams) {
        if (attached.has(stream)) continue;
        attached.add(stream);
        const media = await stream.getMediaStream();
        if (session !== current) return;
        // Chromium's remote track needs an active playout consumer even when
        // analysis is routed through Web Audio. Keep it silent and separate.
        const audio = document.createElement('audio');
        audio.srcObject = media;
        audio.volume = 0;
        document.body.append(audio);
        current.sinks.push(audio);
        await audio.play();
        const source = context.createMediaStreamSource(media);
        const analyser = context.createAnalyser();
        source.connect(analyser);
        const silentSink = context.createGain();
        silentSink.gain.value = 0;
        analyser.connect(silentSink).connect(context.destination);
        // Only a meter for this spike; no recording, Muse, or speaker loopback.
        // Future Muse PCM adapter consumes this stream, independently of mic output.
        current.incoming = { media, analyser };
        log('Connected; incoming stream accessible. Upload a short consented speech clip to test output.');
      }
    };
    current.call.on('remoteAudioStreamsUpdated', () => { attachIncoming().catch(() => log('Incoming stream failed.')); });
    current.call.on('stateChanged', () => {
      log(`Teams state: ${current.call.state}`);
      attachIncoming().catch(() => log('Incoming stream failed.'));
      if (current.call.state === 'Disconnected') leave().catch(() => log('Cleanup failed.'));
    });
    await attachIncoming();
    log(`Teams state: ${current.call.state}. Admit Rally from the lobby if needed.`);
  } catch {
    await leave();
    log('Join failed. Check token scope/expiry, tenant anonymous-join policy and meeting link.');
  }
};
document.querySelector('#leave').onclick = () => { leave().catch(() => log('Cleanup failed; check meeting roster.')); };
document.querySelector('#stop').onclick = () => { session?.mic.stop(); };
document.querySelector('#play').onclick = async () => {
  const current = session;
  if (!current || current.call?.state !== 'Connected') return log('Connect before sending audio.');
  const file = document.querySelector('#clip').files[0];
  if (!file || file.size > 5_000_000) return log('Select an audio file under 5 MB.');
  try {
    const buffer = await current.context.decodeAudioData(await file.arrayBuffer());
    if (session !== current) return;
    if (buffer.duration > 15) return log('Use a clip of 15 seconds or less.');
    current.mic.stop();
    current.mic.play(buffer);
  } catch { log('Could not decode this audio file.'); }
};
setInterval(() => {
  const incoming = session?.incoming;
  if (!incoming) return;
  const data = new Float32Array(incoming.analyser.fftSize);
  incoming.analyser.getFloatTimeDomainData(data);
  document.querySelector('#level').value = Math.sqrt(data.reduce((s, x) => s + x*x, 0) / data.length);
}, 100);
