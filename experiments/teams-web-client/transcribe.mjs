import { spawn } from 'node:child_process';
import {modelConfig,audioCost} from '../../apps/rally/src/models.js';
import {metaTranscriptEvent} from '../../apps/rally/src/muse.js';
import {framesDue} from './audio-pacing.mjs';

// One session, no retries. Caller must record a reservation before opening.
export async function transcribe({ key, source, signal, config=modelConfig().transcription, seconds = 180, onEvent = () => {}, onLevel = () => {}, shielded = () => false }) {
  config=modelConfig({RALLY_MODEL_CONFIG:JSON.stringify({transcription:config})}).transcription;
  if (!key || !Number.isFinite(seconds) || seconds <= 0 || seconds > 180) throw new Error('Invalid transcription configuration');
  let sentBytes = 0, shieldedBytes = 0, processedMs = 0, sessionId, producer, finish, stopping;
  let failed = false, ended = false, stopReason=null, socketCloseCode=null, providerErrorCode=null, maxPendingBytes=0;
  const startedAt = Date.now();
  const socket = new WebSocket('wss://api.meta.ai/v1/asr/realtime');
  const done = new Promise(resolve => { finish = resolve; });
  const stats = () => ({sessionId, sentSeconds: sentBytes / 32000, shieldedSeconds: shieldedBytes / 32000, processedMs, failed, stopReason, socketCloseCode, providerErrorCode, maxPendingBytes,
    estimatedCost: sessionId ? audioCost(Math.max(sentBytes / 32000, processedMs / 1000),config) : null,
    costBasis: processedMs ? 'conservative_max_sent_and_processed_seconds' : 'sent_seconds_estimate'});
  async function stop(reason='host_stop') {
    stopReason ||= reason;
    if (stopping) return stopping;
    stopping = (async () => {
      ended = true; producer?.kill('SIGTERM');
      if (socket.readyState === WebSocket.OPEN && sessionId) socket.send(JSON.stringify({type:'endStream'}));
      await Promise.race([done, new Promise(r => setTimeout(r, 2500))]);
      socket.close(); finish(); return stats();
    })();
    return stopping;
  }
  const hardStop = setTimeout(() => void stop('wall_limit'), seconds * 1000 + 12000);
  socket.addEventListener('close', event => { socketCloseCode=Number.isInteger(event.code)?event.code:null;if(!ended){failed=true;stopReason||='upstream_closed';} producer?.kill('SIGTERM'); finish(); });
  socket.addEventListener('error', () => { failed = true;stopReason||='upstream_socket_error';finish(); });
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const ackTimer = setTimeout(() => rejectReady(new Error('Transcription handshake timed out')), 12000);
  socket.addEventListener('open', () => socket.send(JSON.stringify({authorization:{accessToken:`Bearer ${key}`},
    model:config.model, audioEncoding:'PCM_16KHZ', mode:'ENDPOINTING', partialMode:'CUMULATIVE', emitAudioProgress:true})));
  socket.addEventListener('message', event => {
    try {
      const value = JSON.parse(event.data);
      if (Number.isFinite(value.audioProcessedMs)) processedMs = Math.max(processedMs, value.audioProcessedMs);
      if (value.type === 'error') { failed = true;stopReason||='upstream_protocol_error';const code=value.code||value.error?.code;providerErrorCode=typeof code==='string'&&/^[a-zA-Z0-9_.-]{1,80}$/.test(code)?code:null; rejectReady(new Error('Transcription rejected the stream')); void stop(); return; }
      if (!sessionId && value.sessionId) { sessionId = value.sessionId; resolveReady(); }
      if(sessionId){const event=metaTranscriptEvent(value,sessionId);if(event)onEvent(event);}
    } catch { failed = true; void stop('event_processing_error'); }
  });
  const onAbort=()=>void stop();
  signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted)onAbort();
  try { await Promise.race([ready, done.then(() => { throw new Error('Transcription closed before ready'); })]); }
  catch (error) { failed = true;stopReason||='handshake_failed';socket.close(); clearTimeout(hardStop); signal?.removeEventListener('abort',onAbort); error.usage = stats(); throw error; }
  finally { clearTimeout(ackTimer); }
  if(ended || signal?.aborted){await stop();return {stop,done,stats,startedAt};}
  producer = source();
  let pending = Buffer.alloc(0), sending = false;
  const captureStarted=performance.now();
  const maxBytes = Math.floor(seconds * 32000 / 640) * 640;
  // Exactly 20ms frames: cap both queue size and total duration. A blocked socket
  // aborts instead of accumulating or replaying a backlog of meeting audio.
  producer.stdout.on('data', data => { pending = Buffer.concat([pending, data]);maxPendingBytes=Math.max(maxPendingBytes,pending.length);if (pending.length > 64000) { failed = true; void stop('audio_source_backlog'); } });
  producer.on('error', () => { failed = true; void stop('audio_source_error'); });
  producer.on('close', () => { if (!ended) void stop('audio_source_closed'); });
  const tick = setInterval(() => {
    if (ended || sending || pending.length < 640) return;
    if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 64000) { failed = true; void stop('socket_backpressure'); return; }
    sending = true;
    const count=Math.min(framesDue(performance.now()-captureStarted,sentBytes,maxBytes),Math.floor(pending.length/640));
    try{for(let n=0;n<count;n++){
      const captured = pending.subarray(0,640);pending=pending.subarray(640);
      // Preserve cadence while excluding possible moderator echo. Discard, never replay.
      const suppress=shielded();if(suppress)shieldedBytes+=640;
      const frame=suppress?Buffer.alloc(640):captured;
      let sum=0;for(let i=0;i<frame.length;i+=2)sum+=(frame.readInt16LE(i)/32768)**2;
      onLevel(Math.min(1,Math.sqrt(sum/320)*4));
      socket.send(frame);sentBytes+=frame.length;
      if(sentBytes>=maxBytes){void stop('audio_limit');break;}
    }}catch{failed=true;void stop('audio_send_error');}finally{sending=false;}
  },20);
  done.finally(() => { signal?.removeEventListener('abort',onAbort); clearInterval(tick); clearTimeout(hardStop); producer?.kill('SIGTERM'); });
  return { stop, done, stats, startedAt };
}

export function pulseSource(env = process.env) {
  return spawn('parec', ['--device=rally_teams_in.monitor', '--format=s16le', '--rate=16000', '--channels=1', '--latency-msec=40'],
    {env, stdio:['ignore','pipe','ignore']});
}
