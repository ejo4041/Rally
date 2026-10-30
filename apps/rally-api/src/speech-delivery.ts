import type {Store} from './store.ts';
import type {SpeechState} from './live-speech.ts';
const initialized=new WeakSet<Store>();
function ensure(store:Store){if(initialized.has(store))return;store.db.exec('CREATE TABLE IF NOT EXISTS speech_delivery(id TEXT PRIMARY KEY,meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,at INTEGER NOT NULL,body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS speech_delivery_meeting ON speech_delivery(meeting_id,at)');store.db.prepare("UPDATE speech_delivery SET body=json_set(body,'$.state','canceled','$.error','Server restarted before delivery completed','$.completedAt',?) WHERE json_extract(body,'$.state') IN ('preparing','playing')").run(Date.now());initialized.add(store);}
export function recordSpeechDelivery(store:Store,meetingId:string,state:SpeechState){
 ensure(store);
 store.db.prepare('INSERT INTO speech_delivery VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(state.id,meetingId,state.startedAt??state.at,JSON.stringify(state));
 store.db.prepare('DELETE FROM speech_delivery WHERE meeting_id=? AND id NOT IN (SELECT id FROM speech_delivery WHERE meeting_id=? ORDER BY at DESC LIMIT 1000)').run(meetingId,meetingId);
}
export function listSpeechDeliveries(store:Store,meetingId:string):SpeechState[]{ensure(store);return (store.db.prepare('SELECT body FROM speech_delivery WHERE meeting_id=? ORDER BY at DESC LIMIT 20').all(meetingId) as {body:string}[]).map(row=>JSON.parse(row.body));}
