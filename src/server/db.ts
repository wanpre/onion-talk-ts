import Database from 'better-sqlite3';
import crypto from 'crypto';

const db = new Database('chat.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    name TEXT PRIMARY KEY,
    passwordHash TEXT NOT NULL,
    createdAt INTEGER DEFAULT (strftime('%s', 'now'))
  );
`);

export function initDb() {
  return db;
}

export async function createOrJoinRoom(name: string, password: string): Promise<boolean> {
  const hash = crypto.pbkdf2Sync(password, name, 10000, 64, 'sha512').toString('hex');

  const stmtSelect = db.prepare('SELECT passwordHash FROM rooms WHERE name = ?');
  const existing = stmtSelect.get(name) as { passwordHash: string } | undefined;

  if (existing) {
    return existing.passwordHash === hash;
  }

  const stmtInsert = db.prepare('INSERT INTO rooms (name, passwordHash) VALUES (?, ?)');
  stmtInsert.run(name, hash);
  return true;
}

export function getRoomPasswordHash(name: string): string | null {
  const stmt = db.prepare('SELECT passwordHash FROM rooms WHERE name = ?');
  const row = stmt.get(name) as { passwordHash: string } | undefined;
  return row ? row.passwordHash : null;
}