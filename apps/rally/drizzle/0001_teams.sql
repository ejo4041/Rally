CREATE TABLE teams_runner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  runner_id TEXT NOT NULL,
  heartbeat INTEGER NOT NULL,
  credentials_configured INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE teams_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  slot INTEGER UNIQUE CHECK (slot = 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deadline INTEGER NOT NULL,
  meeting_url TEXT NOT NULL,
  token_cipher TEXT,
  state TEXT NOT NULL,
  message TEXT NOT NULL,
  runner_id TEXT,
  leave_requested INTEGER NOT NULL DEFAULT 0,
  input_level REAL NOT NULL DEFAULT 0
);
