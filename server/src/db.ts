import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = path.join(__dirname, "..", "data");

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(path.join(dataDir, "screenwriter.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    scene_count INTEGER NOT NULL DEFAULT 0,
    last_edited TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL REFERENCES scripts(id),
    heading TEXT NOT NULL,
    action_context TEXT NOT NULL,
    subtext TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

const sceneColumns = db.prepare("PRAGMA table_info(scenes)").all() as { name: string }[];
if (!sceneColumns.some((col) => col.name === "title")) {
  db.exec("ALTER TABLE scenes ADD COLUMN title TEXT NOT NULL DEFAULT ''");
  db.exec("UPDATE scenes SET title = heading WHERE title = ''");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL REFERENCES scripts(id),
    name TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS character_entries (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL REFERENCES characters(id),
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL
  )
`);
