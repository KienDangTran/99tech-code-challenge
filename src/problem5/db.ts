import Database from "better-sqlite3";

export type Item = {
  id: number;
  name: string;
  description: string;
  createdAt: string;
};

export function createDb(memory = false) {
  const db = new Database(memory ? ":memory:" : "items.db");

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      createdAt   TEXT NOT NULL
    )
  `);

  return db;
}
