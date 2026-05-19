import { Router } from "express";
import type { Database } from "better-sqlite3";
import type { Item } from "./db.js";

export function createRouter(db: Database) {
  const router = Router();

  router.post("/items", (req, res) => {
    const { name, description = "" } = req.body as Partial<Item>;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const createdAt = new Date().toISOString();
    const result = db
      .prepare("INSERT INTO items (name, description, createdAt) VALUES (?, ?, ?)")
      .run(name, description, createdAt);
    const item = db
      .prepare("SELECT * FROM items WHERE id = ?")
      .get(result.lastInsertRowid) as Item;
    res.status(201).json(item);
  });

  router.get("/items", (req, res) => {
    const { name, limit } = req.query as { name?: string; limit?: string };
    let sql = "SELECT * FROM items";
    const params: (string | number)[] = [];

    if (name) {
      sql += " WHERE name LIKE ?";
      params.push(`%${name}%`);
    }
    if (limit) {
      sql += " LIMIT ?";
      params.push(Number(limit));
    }

    const items = db.prepare(sql).all(...params) as Item[];
    res.json(items);
  });

  router.get("/items/:id", (req, res) => {
    const item = db
      .prepare("SELECT * FROM items WHERE id = ?")
      .get(Number(req.params.id)) as Item | undefined;
    if (!item) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(item);
  });

  router.put("/items/:id", (req, res) => {
    const existing = db
      .prepare("SELECT * FROM items WHERE id = ?")
      .get(Number(req.params.id)) as Item | undefined;
    if (!existing) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const { name = existing.name, description = existing.description } =
      req.body as Partial<Item>;
    db.prepare("UPDATE items SET name = ?, description = ? WHERE id = ?").run(
      name,
      description,
      Number(req.params.id)
    );
    const updated = db
      .prepare("SELECT * FROM items WHERE id = ?")
      .get(Number(req.params.id)) as Item;
    res.json(updated);
  });

  router.delete("/items/:id", (req, res) => {
    const result = db
      .prepare("DELETE FROM items WHERE id = ?")
      .run(Number(req.params.id));
    if (result.changes === 0) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(204).send();
  });

  return router;
}
