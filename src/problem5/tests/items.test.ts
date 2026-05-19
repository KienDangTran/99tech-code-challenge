import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import type { Express } from "express";

let app: Express;

beforeEach(() => {
  app = createApp({ memory: true });
});

afterEach(() => {
  const db = (app as any)._db;
  if (db) db.close();
});

describe("POST /items", () => {
  it("creates item and returns 201 with created item", async () => {
    const res = await request(app)
      .post("/items")
      .send({ name: "Widget", description: "A small widget" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      name: "Widget",
      description: "A small widget",
      createdAt: expect.any(String),
    });
  });

  it("returns 400 when name missing", async () => {
    const res = await request(app).post("/items").send({ description: "x" });
    expect(res.status).toBe(400);
  });
});

describe("GET /items", () => {
  beforeEach(async () => {
    await request(app).post("/items").send({ name: "Alpha", description: "first" });
    await request(app).post("/items").send({ name: "Beta", description: "second" });
    await request(app).post("/items").send({ name: "Alphabet", description: "third" });
  });

  it("returns all items", async () => {
    const res = await request(app).get("/items");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it("filters by name (partial match)", async () => {
    const res = await request(app).get("/items?name=Alph");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((i: any) => i.name.includes("Alph"))).toBe(true);
  });

  it("limits results", async () => {
    const res = await request(app).get("/items?limit=2");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe("GET /items/:id", () => {
  it("returns item by id", async () => {
    const created = await request(app)
      .post("/items")
      .send({ name: "Thing" });
    const { id } = created.body;

    const res = await request(app).get(`/items/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.name).toBe("Thing");
  });

  it("returns 404 for missing id", async () => {
    const res = await request(app).get("/items/9999");
    expect(res.status).toBe(404);
  });
});

describe("PUT /items/:id", () => {
  it("updates item and returns updated", async () => {
    const created = await request(app)
      .post("/items")
      .send({ name: "Old", description: "before" });
    const { id } = created.body;

    const res = await request(app)
      .put(`/items/${id}`)
      .send({ name: "New", description: "after" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, name: "New", description: "after" });
  });

  it("returns 404 for missing id", async () => {
    const res = await request(app).put("/items/9999").send({ name: "x" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /items/:id", () => {
  it("deletes item and returns 204", async () => {
    const created = await request(app).post("/items").send({ name: "Gone" });
    const { id } = created.body;

    const del = await request(app).delete(`/items/${id}`);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/items/${id}`);
    expect(get.status).toBe(404);
  });

  it("returns 404 for missing id", async () => {
    const res = await request(app).delete("/items/9999");
    expect(res.status).toBe(404);
  });
});
