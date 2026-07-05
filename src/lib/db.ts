import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { ensureSeeded } from "./seed";

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  _db = new Database(path.join(dir, "vettracker.db"));
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  // _db is assigned before seeding, so re-entrant db() calls from the seeder are safe
  ensureSeeded(_db);
  return _db;
}

function migrate(d: Database.Database) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    role TEXT NOT NULL DEFAULT 'owner',        -- 'owner' | 'vet'
    vet_id INTEGER REFERENCES vets(id),        -- set when role='vet'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    clinic TEXT NOT NULL,
    specialty TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    hours TEXT NOT NULL,
    emergency INTEGER NOT NULL DEFAULT 0,      -- 1 = 24hr emergency hospital
    rating REAL NOT NULL DEFAULT 4.5
  );

  CREATE TABLE IF NOT EXISTS pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT NOT NULL,                     -- 'dog' | 'cat' | 'other'
    breed TEXT,
    sex TEXT,
    birth_date TEXT,
    weight_kg REAL,
    photo TEXT,                                -- emoji or data-URL
    notes TEXT,                                -- medical history notes
    share_token TEXT NOT NULL UNIQUE,          -- public QR emergency card token
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    log_date TEXT NOT NULL,                    -- YYYY-MM-DD
    food_grams REAL,
    water_ml REAL,
    activity_min REAL,
    weight_kg REAL,
    sleep_hours REAL,
    stool TEXT,                                -- normal|soft|diarrhea|constipated|bloody
    symptoms TEXT NOT NULL DEFAULT '[]',       -- JSON array of symptom keys
    notes TEXT,
    photo TEXT,                                -- data-URL attachment
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(pet_id, log_date)
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    log_id INTEGER REFERENCES logs(id) ON DELETE SET NULL,
    severity TEXT NOT NULL,                    -- 'info' | 'watch' | 'urgent'
    triage TEXT NOT NULL,                      -- 'home' | 'vet48' | 'emergency'
    title TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    reasons TEXT NOT NULL DEFAULT '[]',        -- JSON array of explanation strings
    tips TEXT NOT NULL DEFAULT '[]',           -- JSON array of self-care tips
    contagion_source_pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    vet_id INTEGER NOT NULL REFERENCES vets(id),
    datetime TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',    -- pending|confirmed|completed|cancelled
    triage_alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,                        -- alert|reminder|appointment|contagion|system
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,                        -- vaccination|medication|checkup|grooming
    title TEXT NOT NULL,
    due_date TEXT NOT NULL,                    -- YYYY-MM-DD
    repeat_days INTEGER,                       -- null = one-off
    last_notified TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    category TEXT NOT NULL,                    -- vet|medication|food|grooming|insurance|other
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    expense_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_logs_pet_date ON logs(pet_id, log_date);
  CREATE INDEX IF NOT EXISTS idx_alerts_pet ON alerts(pet_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
  `);
}

export function newShareToken(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  );
}
