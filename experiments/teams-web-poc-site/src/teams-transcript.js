import {AppError} from './core.js';
const MAX_COST = .009;
export const transcriptJob = row => ({
  transcribe: !!row.transcribe, transcriptionState: row.transcription_state || 'off',
  transcript: JSON.parse(row.transcript || '[]'), partial: row.partial || '',
});
export async function transcriptApi(path, data, env, runnerId, now) {
  const db = env.DB;
  const row = await db.prepare('SELECT * FROM teams_jobs WHERE id=? AND runner_id=?').bind(String(data.id||''),runnerId).first();
  if (!row || !row.transcribe) throw new AppError('Transcription session not found.',404);
  if (path.endsWith('/transcription-start')) {
    if (row.state !== 'connected' || row.leave_requested || row.deadline <= now || row.usage_id) throw new AppError('Transcription cannot start in this state.',409);
    if (env.RALLY_PAID_ENABLED !== '1' || !env.MODEL_API_KEY) throw new AppError('Paid transcription is disabled.',503);
    const id = `teams-asr-${row.id}`;
    const event = {id,meetingId:row.id,createdAt:new Date(now).toISOString(),model:'muse-voice-transcribe-1.0',status:'teams_asr_reserved',estimatedCost:null,costBasis:'unreconciled_until_runner_finishes'};
    const result = await db.prepare(`INSERT OR IGNORE INTO usage_events(id,meeting_id,created_at,model,status,estimated_cost,payload)
      SELECT ?,?,?,?,?,NULL,? WHERE NOT EXISTS(SELECT 1 FROM usage_events WHERE estimated_cost IS NULL)
      AND (SELECT COALESCE(SUM(estimated_cost),0) FROM usage_events)+?<=?
      AND ?<=? AND NOT EXISTS(SELECT 1 FROM meetings WHERE json_extract(payload,'$.accountingWarning')=1) RETURNING id`)
      .bind(id,row.id,event.createdAt,event.model,event.status,JSON.stringify(event),MAX_COST,Number(env.RALLY_BUILD_BUDGET||.5),MAX_COST,Number(env.RALLY_MEETING_BUDGET||.25)).first();
    if (!result) throw new AppError('Transcription budget is exhausted or another charge needs reconciliation.',409);
    await db.prepare("UPDATE teams_jobs SET usage_id=?,transcription_state='listening' WHERE id=?").bind(id,row.id).run();
    return {ok:true,maxSeconds:Math.min(180,Math.max(0,Math.floor((row.deadline-now)/1000)))};
  }
  if (!row.usage_id) throw new AppError('Transcription was not started.',409);
  if (path.endsWith('/transcription')) {
    if (row.transcription_state !== 'listening') return {ok:true};
    if (data.final ? now > row.deadline+5000 : (row.state !== 'connected' || row.leave_requested || row.deadline <= now)) throw new AppError('Meeting is no longer accepting audio.',409);
    const turns = JSON.parse(row.transcript || '[]');
    if (data.final) {
      const f = data.final;
      if (typeof f.sessionId !== 'string' || f.sessionId.length>200 || !Number.isSafeInteger(f.turnId) || f.turnId<0 || typeof f.text!=='string' || f.text.length>4000) throw new AppError('Invalid transcript turn.');
      const id = `${f.sessionId}:${f.turnId}`, existing = turns.find(t=>t.id===id);
      const turn = {id,text:f.text.trim(),speaker:typeof f.speaker==='string'?f.speaker.slice(0,40):null};
      if (turn.text) { if (existing) Object.assign(existing,turn); else {if(turns.length>=200)throw new AppError('Transcript limit reached.',409);turns.push(turn);} }
    }
    const partial = typeof data.partial==='string'?data.partial.slice(0,4000):'';
    await db.prepare('UPDATE teams_jobs SET transcript=?,partial=? WHERE id=? AND transcription_state=\'listening\'').bind(JSON.stringify(turns),partial,row.id).run();
    return {ok:true};
  }
  if (path.endsWith('/transcription-finish')) {
    if (row.transcription_state !== 'listening') return {ok:true};
    const sent=Number(data.sentSeconds),processed=Number(data.processedMs);
    if (!Number.isFinite(sent)||sent<0||sent>180||!Number.isFinite(processed)||processed<0||processed>181000) throw new AppError('Invalid audio usage.');
    if(data.notOpened===true&&(sent!==0||processed!==0))throw new AppError('Unopened stream cannot report audio.');
    const known = data.notOpened === true || data.sessionAcknowledged === true;
    const cost = known ? Math.floor(Math.max(sent,processed/1000))*.18/3600 : null;
    const event={id:row.usage_id,meetingId:row.id,createdAt:new Date(now).toISOString(),model:'muse-voice-transcribe-1.0',status:data.failed?'teams_asr_failed':'teams_asr_closed',estimatedCost:cost,usage:{audioSentSeconds:sent,audioProcessedMs:processed},costBasis:known?'conservative_max_sent_and_processed_seconds':'unknown_handshake'};
    await db.batch([
      db.prepare('UPDATE usage_events SET status=?,estimated_cost=?,payload=? WHERE id=? AND estimated_cost IS NULL').bind(event.status,cost,JSON.stringify(event),row.usage_id),
      db.prepare("UPDATE teams_jobs SET transcription_state=?,partial='' WHERE id=? AND transcription_state='listening'").bind(data.failed?'failed':'stopped',row.id)
    ]);
    return {ok:true,estimatedCost:cost};
  }
  throw new AppError('Unknown transcription operation.',404);
}
