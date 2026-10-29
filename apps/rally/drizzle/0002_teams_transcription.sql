ALTER TABLE teams_runner ADD COLUMN transport TEXT NOT NULL DEFAULT 'acs';
--> statement-breakpoint
ALTER TABLE teams_runner ADD COLUMN transcription_ready INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE teams_jobs ADD COLUMN transcribe INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE teams_jobs ADD COLUMN transcript TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE teams_jobs ADD COLUMN partial TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE teams_jobs ADD COLUMN transcription_state TEXT NOT NULL DEFAULT 'off';
--> statement-breakpoint
ALTER TABLE teams_jobs ADD COLUMN usage_id TEXT;
