# Problem 5 — A Crude Server

ExpressJS CRUD API backed by SQLite (better-sqlite3). TypeScript throughout.

## Stack

- **Express 5** — HTTP server
- **better-sqlite3** — SQLite, file-based in prod, in-memory for tests
- **Vitest + Supertest** — integration tests

## Code Structure

```
src/problem5/
  app.ts          # Express app factory (exported for testing)
  db.ts           # SQLite setup, createDb()
  router.ts       # CRUD routes for /items
  index.ts        # server entry point
  vitest.config.ts
  tests/
    items.test.ts
```

## Configuration

| Env var | Default | Description        |
| ------- | ------- | ------------------ |
| `PORT`  | `3000`  | HTTP port to bind  |

SQLite database file: `items.db` (created in the working directory on first run).

## Running

```bash
# Install dependencies (from repo root)
npm install

# Start server
npm run problem5

# Run with custom port
PORT=8080 npm run problem5
```

## Running Tests

```bash
npm run problem5:test
```

## API

All requests/responses use JSON (`Content-Type: application/json`).

### Create item

```
POST /items
{ "name": "Widget", "description": "optional" }
→ 201 { id, name, description, createdAt }
```

### List items

```
GET /items[?name=<partial>&limit=<n>]
→ 200 [{ id, name, description, createdAt }, ...]
```

### Get item

```
GET /items/:id
→ 200 { id, name, description, createdAt }
→ 404 if not found
```

### Update item

```
PUT /items/:id
{ "name": "...", "description": "..." }   (both optional, partial update)
→ 200 { id, name, description, createdAt }
→ 404 if not found
```

### Delete item

```
DELETE /items/:id
→ 204 No Content
→ 404 if not found
```
