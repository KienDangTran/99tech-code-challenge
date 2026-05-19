import express from "express";
import type { Database } from "better-sqlite3";
import { createDb } from "./db.js";
import { createRouter } from "./router.js";

export function createApp({ memory = false } = {}) {
  const db: Database = createDb(memory);
  const app = express();

  app.use(express.json());
  app.use(createRouter(db));

  (app as any)._db = db;
  return app;
}
