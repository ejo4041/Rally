import {AppError, createMeeting, addFinal} from './core.js';

// Preserve the job ID so existing usage remains attributable without copying it.
export async function saveTeamsRecord(db, id, now = Date.now()) {
  const row = await db.prepare('SELECT * FROM teams_jobs WHERE id=?').bind(String(id || '')).first();
  if (!row || !row.transcribe) throw new AppError('Teams transcript not found.', 404);
  if (!['left', 'failed'].includes(row.state) || !['stopped', 'failed'].includes(row.transcription_state)) {
    throw new AppError('Wait for Rally to leave and finish transcription before saving.', 409);
  }
  const turns = JSON.parse(row.transcript || '[]');
  if (!turns.length) throw new AppError('There are no finalized transcript turns to save.', 409);
  const m = createMeeting({title: 'Teams transcript', agenda: ['Recorded Teams discussion'], minutes: 3, wrapMinutes: .5}, row.id, row.created_at);
  m.kind = 'teams'; m.phase = 'ended'; m.paused = true; m.consented = true;
  // Job times include preparation/lobby; individual speech timestamps were not retained.
  m.startedAt = new Date(row.created_at).toISOString();
  m.endedAt = new Date(row.updated_at).toISOString();
  m.updatedAt = new Date(now).toISOString();
  m.source = {transport: 'teams-web', jobId: row.id, state: row.state,
    transcriptionState: row.transcription_state, timing: 'job-window', turnTiming: 'not-recorded'};
  for (const turn of turns) {
    const separator = turn.id.lastIndexOf(':');
    addFinal(m, {sessionId: turn.id.slice(0, separator), turnId: Number(turn.id.slice(separator + 1)),
      transcript: turn.text, speaker: turn.speaker, source: 'teams-asr', receivedAt: row.created_at});
  }
  // Duplicate clicks/retries preserve the original record, including future host edits.
  await db.prepare(`INSERT OR IGNORE INTO meetings(id,title,created_at,updated_at,phase,payload,version)
    VALUES(?,?,?,?,?,?,0)`).bind(m.id,m.title,m.createdAt,m.updatedAt,m.phase,JSON.stringify(m)).run();
  return {meetingId: m.id};
}
