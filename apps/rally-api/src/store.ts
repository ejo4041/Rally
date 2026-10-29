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
    this.db.exec("UPDATE usage SET status='unknown' WHERE status='running'");
  }
  close() {
    this.db.close();
  }
}
