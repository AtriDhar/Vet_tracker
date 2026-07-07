// Database adapter — one async code path for every environment:
//   · local dev / self-host:  embedded libSQL file  (file:data/vettracker.db)
//   · production free tier:   Turso hosted libSQL   (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
//
// Schema migration and first-run seeding happen lazily on the first db() call,
// so there is no separate migration step to run anywhere.

import { createClient, type Client, type InValue } from "@libsql/client";
import fs from "fs";
import path from "path";

export type Row = Record<string, unknown>;

export interface Db {
  all<T = Row>(sql: string, args?: InValue[]): Promise<T[]>;
  get<T = Row>(sql: string, args?: InValue[]): Promise<T | undefined>;
  run(sql: string, args?: InValue[]): Promise<{ lastInsertRowid: number }>;
}

function wrap(client: Client): Db {
  return {
    async all<T = Row>(sql: string, args: InValue[] = []): Promise<T[]> {
      const rs = await client.execute({ sql, args });
      return rs.rows.map((r) => {
        const o: Row = {};
        rs.columns.forEach((c, i) => (o[c] = r[i]));
        return o as T;
      });
    },
    async get<T = Row>(sql: string, args: InValue[] = []): Promise<T | undefined> {
      const rows = await this.all<T>(sql, args);
      return rows[0];
    },
    async run(sql: string, args: InValue[] = []) {
      const rs = await client.execute({ sql, args });
      return { lastInsertRowid: Number(rs.lastInsertRowid ?? 0) };
    },
  };
}

let ready: Promise<Db> | null = null;

/** Get the initialized database (migrated + seeded). Memoized per process. */
export function db(): Promise<Db> {
  if (!ready) ready = init();
  return ready;
}

async function init(): Promise<Db> {
  const url = process.env.TURSO_DATABASE_URL;
  let client: Client;
  if (url) {
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  } else {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    client = createClient({ url: "file:" + path.join(dir, "vettracker.db") });
  }
  const d = wrap(client);
  await migrate(client);
  // Deferred import avoids a static cycle: seed → service → db.
  const { ensureSeeded } = await import("./seed");
  await ensureSeeded(d);
  return d;
}

async function migrate(client: Client) {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        role TEXT NOT NULL DEFAULT 'owner',
        vet_id INTEGER REFERENCES vets(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS vets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        clinic TEXT NOT NULL,
        specialty TEXT NOT NULL,
        city TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        hours TEXT NOT NULL,
        emergency INTEGER NOT NULL DEFAULT 0,
        rating REAL NOT NULL DEFAULT 4.5
      )`,
      `CREATE TABLE IF NOT EXISTS pets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        species TEXT NOT NULL,
        breed TEXT,
        sex TEXT,
        birth_date TEXT,
        weight_kg REAL,
        photo TEXT,
        notes TEXT,
        share_token TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        log_date TEXT NOT NULL,
        food_grams REAL,
        water_ml REAL,
        activity_min REAL,
        weight_kg REAL,
        sleep_hours REAL,
        stool TEXT,
        symptoms TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        photo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(pet_id, log_date)
      )`,
      `CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        log_id INTEGER REFERENCES logs(id) ON DELETE SET NULL,
        severity TEXT NOT NULL,
        triage TEXT NOT NULL,
        title TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        reasons TEXT NOT NULL DEFAULT '[]',
        tips TEXT NOT NULL DEFAULT '[]',
        contagion_source_pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
        acknowledged INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        vet_id INTEGER NOT NULL REFERENCES vets(id),
        datetime TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        triage_alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        link TEXT,
        read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        due_date TEXT NOT NULL,
        repeat_days INTEGER,
        last_notified TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        expense_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_logs_pet_date ON logs(pet_id, log_date)`,
      `CREATE INDEX IF NOT EXISTS idx_alerts_pet ON alerts(pet_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read)`,
    ],
    "write"
  );
}

export function newShareToken(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  );
}
