CREATE TABLE speech_runner (
  id INTEGER PRIMARY KEY CHECK(id=1),
  runner_id TEXT NOT NULL,
  heartbeat INTEGER NOT NULL,
  revision TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE speech_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  slot INTEGER UNIQUE CHECK(slot=1),
  meeting_id TEXT,
  utterance_id TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  text TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deadline INTEGER NOT NULL,
  runner_id TEXT,
  audio BLOB,
  UNIQUE(meeting_id,utterance_id,epoch)
);
