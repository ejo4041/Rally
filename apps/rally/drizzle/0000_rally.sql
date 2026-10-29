CREATE TABLE meetings (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  phase TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  lease_id TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE usage_events (
  id TEXT PRIMARY KEY NOT NULL,
  meeting_id TEXT,
  created_at TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  estimated_cost REAL,
  payload TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX usage_created ON usage_events(created_at);
