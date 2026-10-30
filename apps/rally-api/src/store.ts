import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS meetings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS turns(meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,id TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(meeting_id,id));
      CREATE TABLE IF NOT EXISTS usage(id TEXT PRIMARY KEY,meeting_id TEXT NOT NULL,user_id TEXT NOT NULL,estimate REAL NOT NULL,status TEXT NOT NULL,cost REAL,body TEXT NOT NULL);
    `);
    // One-time auth migration: old password-only sessions must not survive MFA rollout.
    const cols = this.db.prepare("PRAGMA table_info(sessions)").all();
    if (!cols.some((c) => c.name === "mfa_verified")) {
      this.db.exec(
        "BEGIN IMMEDIATE; DELETE FROM sessions; ALTER TABLE sessions ADD COLUMN mfa_verified INTEGER NOT NULL DEFAULT 0; ALTER TABLE sessions ADD COLUMN verified_at INTEGER NOT NULL DEFAULT 0; COMMIT;",
      );
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_security(user_id TEXT PRIMARY KEY REFERENCES users(id),role TEXT NOT NULL DEFAULT 'user',disabled INTEGER NOT NULL DEFAULT 0,secret TEXT,last_step INTEGER NOT NULL DEFAULT -1,reset_required INTEGER NOT NULL DEFAULT 0);
      INSERT OR IGNORE INTO user_security(user_id) SELECT id FROM users;
      CREATE TABLE IF NOT EXISTS auth_challenges(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,secret TEXT,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS recovery_codes(user_id TEXT NOT NULL REFERENCES users(id),hash TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS account_tokens(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_limits(id TEXT PRIMARY KEY,until INTEGER NOT NULL,attempts INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,at INTEGER NOT NULL,actor TEXT,event TEXT NOT NULL,target TEXT,detail TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS audit_time ON audit(at);
      CREATE TABLE IF NOT EXISTS transcript_shares(meeting_id TEXT PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,enabled INTEGER NOT NULL DEFAULT 0,at INTEGER NOT NULL);
    `);
    this.db.exec("UPDATE usage SET status='unknown' WHERE status='running'");
  }
  close() {
    this.db.close();
  }
}
