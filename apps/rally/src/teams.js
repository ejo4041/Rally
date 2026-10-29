import {saveTeamsRecord} from './teams-history.js';
import { AppError } from './core.js';
import {transcriptJob,transcriptApi} from './teams-transcript.js';

const ACTIVE = ['queued', 'joining', 'lobby', 'connected', 'leaving'];
const STATES = new Set([...ACTIVE, 'left', 'failed']);
const FRESH_MS = 30_000;
const publicJob = row => row && ({
  ...transcriptJob(row), id: row.id, createdAt: row.created_at, updatedAt: row.updated_at,
  deadline: row.deadline, state: row.state, message: row.message,
  leaveRequested: !!row.leave_requested, inputLevel: row.input_level,
});

async function key(secret) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(token, secret, id) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) }, await key(secret), new TextEncoder().encode(token));
  return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(data)) });
}
async function open(cipher, secret, id) {
  const { iv, data } = JSON.parse(cipher);
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv), additionalData: new TextEncoder().encode(id) }, await key(secret), new Uint8Array(data));
  return new TextDecoder().decode(bytes);
}
async function authorize(request, env) {
  const expected = env.RALLY_TEAMS_BRIDGE_SECRET;
  if (!expected) throw new AppError('Teams runner is not configured.', 503);
  const actual = request.headers.get('X-Rally-Bridge') || '';
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a,b] = await Promise.all([digest(expected), digest(actual)]);
  let different = 0; for (let i=0;i<a.length;i++) different |= a[i]^b[i];
  if (different) throw new AppError('Runner authentication required.', 403);
}
export function teamsMeetingUrl(value) {
  let url; try { url = new URL(String(value || '').trim()); } catch { throw new AppError('Paste a valid Teams meeting link.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'teams.microsoft.com' || url.port || url.username || url.password || !/^\/(l\/meetup-join\/|meet\/)/.test(url.pathname) || url.href.length > 4000) {
    throw new AppError('Use a work/school Teams HTTPS meeting link from teams.microsoft.com.');
  }
  url.hash = '';
  return url.href;
}
export async function teamsApi(request, env, data, now = Date.now()) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/teams/')) return null;
  const db = env.DB;
  // Clear expired payloads and release the singleton slot. An unresponsive
  // runner is not evidence of a clean departure; say so explicitly.
  await db.prepare("UPDATE teams_jobs SET state='failed',slot=NULL,token_cipher=NULL,message='Runner stopped responding or test expired. Verify Rally has left in the Teams roster.',updated_at=? WHERE slot=1 AND (deadline<? OR (state!='queued' AND updated_at<?) OR (state='queued' AND created_at<?))")
    .bind(now, now, now-45_000, now-60_000).run();
  const runner = await db.prepare('SELECT * FROM teams_runner WHERE id=1').first();
  if (path === '/api/teams/status' && request.method === 'GET') {
    const job = await db.prepare('SELECT * FROM teams_jobs ORDER BY created_at DESC,rowid DESC LIMIT 1').first();
    return { enabled: !!env.RALLY_TEAMS_BRIDGE_SECRET, online: !!runner && runner.heartbeat >= now-FRESH_MS,
      transport: runner?.transport || 'acs', transcriptionReady: !!runner?.transcription_ready && env.RALLY_PAID_ENABLED === '1' && !!env.MODEL_API_KEY, credentialsConfigured: !!runner?.credentials_configured, job: publicJob(job), testMinutes: 3 };
  }
  if (path === '/api/teams/join' && request.method === 'POST') {
    if (!env.RALLY_TEAMS_BRIDGE_SECRET || !runner || runner.heartbeat < now-FRESH_MS) throw new AppError('The Teams runner is offline. No join was attempted.', 503);
    if (data.consented !== true) throw new AppError('Confirm participant consent before inviting Rally.');
    const meetingUrl = teamsMeetingUrl(data.meetingUrl);
    const token = String(data.token || '').trim();
    if (token.length > 12000) throw new AppError('Access token is too long.');
    if (data.transcribe === true && (runner.transport !== 'teams-web' || !runner.transcription_ready || env.RALLY_PAID_ENABLED !== '1' || !env.MODEL_API_KEY)) throw new AppError('The transcription runner is not ready.',503);
    if (data.transcribe === true && data.transcriptionConsented !== true) throw new AppError('Consent to sending meeting audio to Meta and saving its transcript is required.');
    if (runner.transport !== 'teams-web' && !runner.credentials_configured && !token) throw new AppError('Azure calling is not configured. Add a short-lived ACS VoIP token in connection setup.');
    const id = crypto.randomUUID();
    const cipher = token ? await seal(token, env.RALLY_TEAMS_BRIDGE_SECRET, id) : null;
    const row = await db.prepare("INSERT OR IGNORE INTO teams_jobs(id,slot,created_at,updated_at,deadline,meeting_url,token_cipher,state,message) VALUES(?,1,?,?,?,?,?,'queued','Waiting for the server to start the Teams client.') RETURNING *")
      .bind(id,now,now,now+180_000,meetingUrl,cipher).first();
    if (!row) throw new AppError('Rally already has an active Teams connection test. Leave it before joining another.', 409);
    if(data.transcribe === true) await db.prepare("UPDATE teams_jobs SET transcribe=1,transcription_state='waiting' WHERE id=?").bind(id).run();
    return { job: publicJob({...row,transcribe:data.transcribe===true?1:0}) };
  }
  if (path === '/api/teams/leave' && request.method === 'POST') {
    const row = await db.prepare('SELECT * FROM teams_jobs WHERE id=?').bind(String(data.id || '')).first();
    if (!row) throw new AppError('Teams connection not found.',404);
    if (row.slot) await db.prepare("UPDATE teams_jobs SET leave_requested=1,token_cipher=NULL,state=CASE WHEN state='queued' THEN 'left' ELSE 'leaving' END,slot=CASE WHEN state='queued' THEN NULL ELSE slot END,message='Departure requested by host.' WHERE id=? AND slot=1").bind(row.id).run();
    return { ok: true };
  }
  if (path === '/api/teams/save' && request.method === 'POST') return saveTeamsRecord(db, data.id, now);
  if (!path.startsWith('/api/teams/runner/')) throw new AppError('Unknown Teams operation.',404);
  await authorize(request, env);
  if (request.method !== 'POST') throw new AppError('POST required.',405);
  const runnerId = String(data.runnerId || '');
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(runnerId)) throw new AppError('Invalid runner identity.');
  if (/\/transcription(?:-start|-finish)?$/.test(path)) return transcriptApi(path,data,env,runnerId,now);
  if (path === '/api/teams/runner/poll') {
    if (runner && runner.runner_id !== runnerId && runner.heartbeat >= now-FRESH_MS) throw new AppError('Another Teams runner is already online.',409);
    const heartbeat = await db.prepare('INSERT INTO teams_runner(id,runner_id,heartbeat,credentials_configured) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET runner_id=excluded.runner_id,heartbeat=excluded.heartbeat,credentials_configured=excluded.credentials_configured WHERE teams_runner.runner_id=excluded.runner_id OR teams_runner.heartbeat<? RETURNING id')
      .bind(runnerId, now, data.credentialsConfigured === true ? 1 : 0, now-FRESH_MS).first();
    if (!heartbeat) throw new AppError('Another Teams runner is already online.',409);
    await db.prepare('UPDATE teams_runner SET transport=?,transcription_ready=? WHERE id=1 AND runner_id=?').bind(data.transport==='teams-web'?'teams-web':'acs',data.transcriptionReady===true?1:0,runnerId).run();
    const existing = await db.prepare('SELECT * FROM teams_jobs WHERE slot=1').first();
    if (!existing) return { job: null };
    if (existing.state !== 'queued') return { job: existing.runner_id === runnerId ? publicJob(existing) : null };
    const claimed = await db.prepare("UPDATE teams_jobs SET state='joining',runner_id=?,updated_at=?,message='Starting Rally on the server.' WHERE id=? AND state='queued' AND slot=1 RETURNING *")
      .bind(runnerId,now,existing.id).first();
    if (!claimed) return { job: null };
    // Never return credentials on workspace/status endpoints. Consume encrypted
    // payload once; a failed delivery fails the test instead of auto-rejoining.
    await db.prepare('UPDATE teams_jobs SET token_cipher=NULL WHERE id=?').bind(claimed.id).run();
    let token;
    try { token = claimed.token_cipher ? await open(claimed.token_cipher,env.RALLY_TEAMS_BRIDGE_SECRET,claimed.id) : null; }
    catch {
      await db.prepare("UPDATE teams_jobs SET slot=NULL,state='failed',message='Connection credential could not be opened. Start a new test.' WHERE id=?").bind(claimed.id).run();
      throw new AppError('Connection credential failed.',409);
    }
    return { job: { ...publicJob(claimed), meetingUrl: claimed.meeting_url, token, claimed: true } };
  }
  if (path === '/api/teams/runner/update') {
    if (!STATES.has(data.state) || data.state === 'queued') throw new AppError('Invalid connection state.');
    const terminal = ['failed','left'].includes(data.state);
    const messages = { joining:'Rally is connecting to Teams.', lobby:'Rally is waiting in the Teams lobby. Admit it from the meeting.', connected:'Rally is connected. Incoming audio level is shown below.', leaving:'Rally is leaving the meeting.', left:'Rally has left the meeting.', failed:'Teams test failed. Check the meeting policy, lobby and server. Verify Rally has left in the meeting roster.' };
    const level = Math.max(0,Math.min(1,Number(data.inputLevel)||0));
    await db.prepare('UPDATE teams_jobs SET state=?,message=?,updated_at=?,input_level=?,slot=CASE WHEN ?=1 THEN NULL ELSE slot END,token_cipher=NULL WHERE id=? AND runner_id=? AND slot=1')
      .bind(data.state,messages[data.state],now,level,terminal?1:0,String(data.id||''),runnerId).run();
    return { ok:true };
  }
  throw new AppError('Unknown runner operation.',404);
}
