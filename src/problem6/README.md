# Problem 6 — Live Score Board Module

> Module specification for the backend engineering team. Implementation should mirror the conventions established in `src/problem5`.

## 1. Overview

This module is a backend service that maintains a **top-10 live score board**. Users perform some opaque "action" (out of scope of this module). On completion, the client dispatches an authenticated API call to this service, which:

1. Verifies the request is authorised and the action genuinely completed.
2. Atomically increments the user's score (Postgres source of truth + Redis ZSET cache).
3. Publishes the updated top-10 to all subscribed clients over WebSocket.

Anti-cheat is the central design driver: the server never trusts a client-supplied score delta. Every increment must be redeemable from a **server-issued, signed, single-use action token**.

## 2. Requirements

| ID | Requirement |
|----|-------------|
| FR1 | Serve the top 10 user scores (read API). |
| FR2 | Push live leaderboard updates to subscribed clients (sub-second). |
| FR3 | On action completion, increment the user's score. |
| FR4 | Provide an HTTP API endpoint for the client to dispatch the score update. |
| FR5 | Prevent malicious users from increasing scores without authorisation. |

### Non-functional

- Leaderboard read p99 < 100 ms; live push end-to-end < 1 s.
- Every score write authenticated, authorised, idempotent, and audited.
- Horizontally scalable; no sticky sessions.

## 3. Tech Stack

| Concern              | Choice                                      |
|----------------------|---------------------------------------------|
| Runtime              | Node.js LTS                                 |
| Language             | TypeScript                                  |
| HTTP framework       | Express                                     |
| WebSocket            | `ws`                                        |
| Source of truth      | PostgreSQL                                  |
| Cache + leaderboard  | Redis (sorted set + pub/sub + idempotency)  |
| Validation           | Zod                                         |
| Auth                 | JWT bearer (verified, not issued, here)     |
| Logging              | pino (structured JSON)                      |
| Testing              | Vitest (integration + unit)                 |

## 4. C4 Diagrams

### 4.1 System Context (C1)

```
                                 ┌───────────────────────┐
                                 │     End User (Web)    │
                                 │  browser w/ JWT       │
                                 └──────────┬────────────┘
                                            │ HTTPS + WSS
                                            ▼
        ┌───────────────────────────────────────────────────────────┐
        │           Score Board Module (this spec)                  │
        │   - Action token issuance                                 │
        │   - Score increment (authorised, idempotent)              │
        │   - Top-10 leaderboard read                               │
        │   - Live push (WebSocket)                                 │
        └─────┬───────────────────┬──────────────────────┬──────────┘
              │                   │                      │
              ▼                   ▼                      ▼
   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐
   │  Auth Provider   │  │  Postgres        │  │   Redis            │
   │  (JWT issuer —   │  │  users,          │  │   ZSET leaderboard │
   │  out of scope)   │  │  score_events    │  │   pub/sub channel  │
   └──────────────────┘  └──────────────────┘  │   jti idempotency  │
                                               │   rate-limit store │
                                               └────────────────────┘
```

### 4.2 Container (C2)

```
   ┌──────────────────────────────────────────────────────────────────┐
   │                Score Board Module (Node.js process)              │
   │                                                                  │
   │  ┌──────────────────────┐        ┌──────────────────────────┐    │
   │  │   HTTP Server        │        │   WebSocket Server       │    │
   │  │   (Express)          │        │   (ws lib)               │    │
   │  │                      │        │                          │    │
   │  │  /actions/start      │        │  /live (push top10)      │    │
   │  │  /scores/increment   │        │                          │    │
   │  │  /scores/top         │        │                          │    │
   │  │  /scores/me          │        │                          │    │
   │  │  /healthz /readyz    │        │                          │    │
   │  └──────────┬───────────┘        └──────────────┬───────────┘    │
   │             │                                   │                │
   │             ▼                                   ▼                │
   │  ┌─────────────────────────────────────────────────────────┐     │
   │  │            Services / Business Logic                    │     │
   │  │   action-token   |   score   |   leaderboard            │     │
   │  └────────┬──────────────┬─────────────┬───────────────────┘     │
   │           │              │             │                         │
   │   ┌───────▼───┐   ┌──────▼─────┐  ┌────▼──────────┐              │
   │   │ Postgres  │   │   Redis    │  │ Redis pub/sub │              │
   │   │ (truth)   │   │ (ZSET,     │  │ (fanout)      │              │
   │   │           │   │  jti, RL)  │  │               │              │
   │   └───────────┘   └────────────┘  └───────────────┘              │
   └──────────────────────────────────────────────────────────────────┘
```

### 4.3 Component — Write Path (POST /scores/increment)

```
  Client (with JWT + actionToken)
       │
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  middleware/request-id        → attach req.id                │
  │  middleware/auth              → verify JWT → req.user        │
  │  middleware/rate-limit        → redis token bucket           │
  │  routes/scores.ts             → zod parse {actionToken}      │
  └──────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  services/score.ts           │
              │  increment(user, actionToken)│
              └────┬──────────────────┬──────┘
                   │                  │
                   ▼                  ▼
         ┌──────────────────┐   ┌──────────────────────────┐
         │ action-token.ts  │   │ Redis: SET jti NX EX 60s │
         │ verify sig + exp │   │  (idempotency claim)     │
         │ + userId match   │   │  fail → 409 replayed     │
         └──────────────────┘   └────────────┬─────────────┘
                                             │ success
                                             ▼
                              ┌──────────────────────────────┐
                              │ Postgres TXN:                │
                              │  UPDATE users SET score+=Δ   │
                              │  INSERT score_events(...)    │
                              └─────────────┬────────────────┘
                                            │ commit
                                            ▼
                           ┌────────────────────────────────────┐
                           │ Redis: ZADD leaderboard newScore   │
                           │ Redis: PUBLISH leaderboard:updates │
                           │   {type, top10, changed}           │
                           └────────────┬───────────────────────┘
                                        │
                                        ▼
                          200 OK { score, rank }
```

### 4.4 Component — Read Path (GET /scores/top)

```
  Client
    │
    ▼
  routes/scores.ts ──► services/leaderboard.ts
                         │
                         ▼
                   Redis ZREVRANGE leaderboard 0 9 WITHSCORES
                         │
                         ▼
                   Hydrate display names (Postgres SELECT WHERE id IN (...))
                   or use a cached name map (TTL).
                         │
                         ▼
                   200 OK { leaderboard: [...] }
```

### 4.5 Component — Live Path (WS /live)

```
   Client opens WS /live  (JWT in subprotocol or ?token=)
        │
        ▼
   realtime/ws-server.ts
     - verify JWT
     - enforce per-IP and per-user connection caps
     - register socket
        │
        ▼  (subscribed at process boot)
   realtime/pubsub.ts ── SUBSCRIBE leaderboard:updates (Redis)
        │
        │ on message
        ▼
   Broadcast JSON to all open sockets
        │
        ▼
   Client receives { type: "leaderboard.updated", top10, changed, ts, v }
```

## 5. API Contract

All endpoints are versioned under `/v1`. JSON over HTTPS. Errors are `application/problem+json` (RFC 7807).

### 5.1 `POST /v1/actions/start`

Begins an action; server issues a single-use action token the client will redeem on completion.

- **Auth:** required (JWT).
- **Request body:** `{ "actionType": "string" }` (server determines `delta` from `actionType`).
- **Response 200:** `{ "actionToken": "<JWT>", "exp": "<ISO-8601>" }`
- **Token claims:** `{ userId, actionId, delta, exp, jti }`, signed with `ACTION_TOKEN_SECRET` (HS256) or asymmetric key (RS256). TTL ≤ 60 s.
- **Rate limit:** 60 starts / user / minute.

### 5.2 `POST /v1/scores/increment`

Redeems an action token to apply a score increment.

- **Auth:** required (JWT).
- **Request body:** `{ "actionToken": "<JWT>" }`
- **Server logic:**
  1. Verify JWT (user identity).
  2. Verify `actionToken` signature, `exp` (with ±30 s clock skew), and that its `userId` equals JWT `sub`.
  3. `SET jti:<jti> 1 NX EX <ttl+30>` in Redis → on conflict, return `409 action.replayed`.
  4. Postgres txn: `UPDATE users SET score = score + delta WHERE id = userId` + `INSERT score_events`.
  5. `ZADD leaderboard <newScore> <userId>` + `PUBLISH leaderboard:updates <payload>`.
- **Response 200:** `{ "score": <int>, "rank": <int> }`
- **Errors:** 401 unauthenticated · 403 forbidden (sub ≠ token.userId) · 409 `action.replayed` · 422 `action.token_invalid` / `action.token_expired` · 429 `rate.limited`.
- **Rate limit:** 10 successful increments / user / minute.

### 5.3 `GET /v1/scores/top?limit=10`

- **Auth:** optional (public board).
- **Response 200:** `{ "leaderboard": [ { "userId": "...", "name": "...", "score": 123, "rank": 1 }, ... ] }`
- `limit` clamped to `[1, 50]`; defaults to 10.

### 5.4 `GET /v1/scores/me`

- **Auth:** required.
- **Response 200:** `{ "score": <int>, "rank": <int|null> }` (`rank` null if outside top-N tracked).

### 5.5 `GET /v1/live` — WebSocket

- **Auth:** JWT in `Sec-WebSocket-Protocol` subprotocol, or `?token=<jwt>` query (less preferred — token may end up in logs).
- **Server → Client messages:**
  ```json
  {
    "type": "leaderboard.updated",
    "v": 1,
    "ts": "2026-05-19T12:34:56.789Z",
    "top10": [ { "userId": "...", "name": "...", "score": 123, "rank": 1 } ],
    "changed": { "userId": "...", "score": 123, "rank": 7 }
  }
  ```
- **Push policy:** broadcast only when the top-10 composition or any top-10 score changes. Non-top-10 increments do not push.
- **Caps:** 5 concurrent sockets per user, 50 per IP. Excess connections receive WS close code `1008`.

### 5.6 `GET /healthz`, `GET /readyz`

- `/healthz`: 200 if process is alive.
- `/readyz`: 200 only if Postgres and Redis are both reachable.

### 5.7 Error envelope (all error responses)

```json
{
  "type":   "https://errors.example.com/action.replayed",
  "title":  "Action token already used",
  "status": 409,
  "code":   "action.replayed",
  "detail": "The jti has already been redeemed.",
  "instance": "/v1/scores/increment"
}
```

| Code                       | HTTP |
|----------------------------|------|
| `auth.unauthenticated`     | 401  |
| `auth.forbidden`           | 403  |
| `validation.failed`        | 400  |
| `action.token_invalid`     | 422  |
| `action.token_expired`     | 422  |
| `action.replayed`          | 409  |
| `rate.limited`             | 429  |
| `internal`                 | 500  |

## 6. Data Model

### 6.1 Postgres

```sql
CREATE TABLE users (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  score      BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX users_score_desc_idx ON users (score DESC);

-- Append-only audit log. Source of forensic truth for disputes.
CREATE TABLE score_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  action_id   TEXT NOT NULL,
  jti         TEXT NOT NULL UNIQUE,         -- enforces idempotency at the DB layer too
  delta       INT  NOT NULL CHECK (delta > 0),
  prev_score  BIGINT NOT NULL,
  new_score   BIGINT NOT NULL,
  source_ip   INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX score_events_user_idx ON score_events (user_id, created_at DESC);
```

> Note: the `UNIQUE` on `jti` is a defense-in-depth backstop. The primary idempotency check is the Redis `SET NX`; the DB unique constraint catches the rare case where Redis was bypassed or evicted.

### 6.2 Redis

| Key                       | Type   | Purpose                                        |
|---------------------------|--------|------------------------------------------------|
| `leaderboard`             | ZSET   | member = `userId`, score = `score`             |
| `jti:<jti>`               | STRING | Idempotency claim, TTL = token TTL + 30 s skew |
| `rate:incr:<userId>`      | STRING | Token bucket counter                           |
| `rate:start:<userId>`     | STRING | Token bucket counter                           |
| `ws:conn:user:<userId>`   | STRING | Per-user WS conn count                         |
| `ws:conn:ip:<ip>`         | STRING | Per-IP WS conn count                           |
| Channel `leaderboard:updates` | pub/sub | Broadcast payload to all WS server nodes   |

## 7. Anti-Cheat Design (FR5)

The trust chain is the heart of this module.

1. **Identity (who):** JWT bearer issued by an external auth provider. This module verifies signature + expiry only. JWT TTL should be short (≤ 15 min) — token rotation is the auth provider's concern.
2. **Authorisation (action attribution):** the JWT's `sub` MUST equal the action token's `userId`. A user cannot redeem someone else's action token.
3. **Action proof:** action tokens are issued only by `POST /v1/actions/start`. The server determines the `delta` from `actionType`; the client never proposes a delta. Tokens are signed (HS256/RS256), expire in ≤ 60 s, carry a unique `jti`, and are single-use.
4. **Idempotency / replay defence:** redeeming an action token claims `jti:<jti>` in Redis via `SET NX EX`. A reused `jti` returns `409 action.replayed`. The `score_events.jti UNIQUE` constraint is a DB-layer backstop.
5. **Rate limiting:** Redis token bucket on `/actions/start` (60/min/user) and `/scores/increment` (10/min/user). Per-IP caps on WS connections (50) and per-user (5).
6. **Audit:** every increment writes `score_events`, capturing `user_id, action_id, jti, delta, prev_score, new_score, source_ip, user_agent, created_at`. Forensics for disputed scores.

**What this stops:**
- Forged or unsigned score updates (no token, or invalid signature).
- Tampered deltas (delta is part of the signed payload; cannot be changed without breaking the signature).
- Replays of a captured action token (jti single-use).
- Impersonation via stolen action tokens redeemed by a different user (userId-vs-sub check).
- Mass automation by a single account (rate limit).

**What this does NOT stop (acknowledge & accept, or defer):**
- A real user performing the real action many times legitimately, up to the rate limit.
- An attacker who has stolen a valid JWT — they can call `/actions/start` and redeem the resulting token as that user, the same way the user would. Mitigation lies with the auth provider (short JWT TTL, refresh rotation, suspicious-login detection); see §10.
- Server-side or DB-layer bypass — deployment / infrastructure ACLs handle that; out of module scope.

## 8. Project Structure

```
src/problem6/
├── README.md                    # this spec
├── openapi.yaml                 # generated or hand-written API contract
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── src/
│   ├── index.ts                 # bootstrap: load config → start http + ws
│   ├── app.ts                   # express factory (testable)
│   ├── config.ts                # zod-parsed env
│   ├── routes/
│   │   ├── scores.ts            # /scores/increment, /scores/top, /scores/me
│   │   ├── actions.ts           # /actions/start
│   │   └── health.ts            # /healthz, /readyz
│   ├── middleware/
│   │   ├── auth.ts              # JWT verify → req.user
│   │   ├── rate-limit.ts        # redis token bucket
│   │   ├── request-id.ts
│   │   └── error.ts             # central → RFC 7807
│   ├── services/
│   │   ├── action-token.ts      # sign + verify + jti claim
│   │   ├── score.ts             # increment txn + cache write-through + publish
│   │   └── leaderboard.ts       # ZREVRANGE top-N
│   ├── realtime/
│   │   ├── ws-server.ts         # ws upgrade, auth, conn caps
│   │   └── pubsub.ts            # redis sub → ws push
│   ├── db/
│   │   ├── client.ts
│   │   ├── migrations/
│   │   │   ├── 001_users.sql
│   │   │   └── 002_score_events.sql
│   │   └── repositories/
│   │       ├── user.ts
│   │       └── score-event.ts
│   ├── redis/
│   │   └── client.ts
│   └── domain/
│       ├── errors.ts
│       └── schemas.ts           # zod request/response/event schemas
└── tests/
    ├── integration/
    │   ├── scores-increment.test.ts
    │   ├── scores-top.test.ts
    │   ├── actions-start.test.ts
    │   ├── auth.test.ts
    │   ├── replay.test.ts       # jti reuse rejected
    │   └── ws-live.test.ts
    └── unit/
        ├── action-token.test.ts
        └── score-service.test.ts
```

### Boundaries

- **Routes** only parse/validate (zod) and delegate. No SQL in routes.
- **Services** own business rules + transactions. Depend on repositories + clients, not on Express.
- **Repositories** own SQL. Services do not write SQL inline.
- **Realtime** never touches the DB. It reads from the Redis sub channel and pushes JSON.

## 9. Configuration

Environment variables (validated via zod at startup):

| Var                  | Required | Notes                                       |
|----------------------|----------|---------------------------------------------|
| `PORT`               | yes      | HTTP port                                   |
| `DATABASE_URL`       | yes      | `postgres://…`                              |
| `REDIS_URL`          | yes      | `redis://…`                                 |
| `JWT_PUBLIC_KEY`     | yes      | PEM or JWK URL of auth provider             |
| `JWT_ISSUER`         | yes      | Expected `iss` claim                        |
| `JWT_AUDIENCE`       | yes      | Expected `aud` claim                        |
| `ACTION_TOKEN_SECRET`| yes      | HS256 secret (or use asymmetric keys)       |
| `ACTION_TOKEN_TTL_S` | no (60)  | Action token TTL in seconds                 |
| `CLOCK_SKEW_S`       | no (30)  | Tolerance applied to `exp` checks           |
| `RATE_INCR_PER_MIN`  | no (10)  | Per-user score increments per minute        |
| `RATE_START_PER_MIN` | no (60)  | Per-user `/actions/start` calls per minute  |
| `WS_MAX_PER_USER`    | no (5)   | Concurrent sockets per user                 |
| `WS_MAX_PER_IP`      | no (50)  | Concurrent sockets per IP                   |
| `LOG_LEVEL`          | no (info)| pino level                                  |

## 10. Improvements & Open Questions

The following are improvements I recommend the team consider; none are blockers for the MVP.

1. **Stolen-JWT mitigation.** This module cannot detect a stolen JWT — it sees only the signed bearer. Pair with: short JWT TTL, refresh-token rotation, IP/device binding, and an auth-provider revocation list this service can consult (cached, with bounded staleness). Spec the integration once the auth provider's revocation surface is known.
2. **Anomaly detection.** Capture score-delta velocity per user, per IP, and per device. A separate worker can flag suspicious patterns (e.g., score deltas faster than the action is physically performable) and either auto-throttle or auto-suspend. Feed signals from the `score_events` table; do not block the hot path.
3. **Periodic ZSET reconciliation.** A 5-minute cron rebuilds the ZSET from `SELECT id, score FROM users ORDER BY score DESC LIMIT N`. Heals any drift caused by Redis evictions, transient publish failures, or partial writes.
4. **Outbox pattern for publish.** Today the publish (Redis `PUBLISH`) happens after the Postgres commit. If the process crashes between commit and publish, the leaderboard update is lost (the cache write is also lost, healed by reconciliation, but live subscribers miss the event). For stricter delivery, write an `outbox_events` row in the same txn and have a relay worker drain it to Redis. Skip if at-most-once is acceptable.
5. **Transport fallback.** Some corporate networks block WSS. Offer an SSE fallback path (`GET /v1/live/sse`) emitting the same `leaderboard.updated` events. Cheap to add; broadens reach.
6. **Public board cacheability.** `GET /v1/scores/top` can serve `Cache-Control: public, max-age=2, stale-while-revalidate=10` to absorb traffic spikes at the CDN edge. Live clients still get push; polling/anonymous clients hit the edge.
7. **Action proof strengthening.** If the "action" runs entirely client-side, the token round-trip is the only proof the server has. Where feasible, move at least part of the action's execution server-side (e.g., the action's own backend issues the token only after it has verified completion against its own state). This collapses two trust boundaries into one and is the single largest realistic uplift to anti-cheat.
8. **Display-name hydration.** Top-10 is small, but per-request `SELECT … WHERE id IN (...)` is still a DB hit. Consider a tiny in-process LRU keyed by `userId` with a 60 s TTL; bust on rename events.
9. **Observability.** Emit Prometheus metrics: `http_requests_total`, `score_increments_total`, `jti_reuse_total`, `ws_connections`, `ws_broadcasts_total`, `leaderboard_publish_failures_total`. Add a dashboard tracking p50/p95/p99 of `/scores/increment` end-to-end latency.
10. **Schema for `actionType` → `delta` mapping.** Where does this live? Two options: (a) a small in-code lookup table (fastest, requires deploy to change); (b) an `action_types` Postgres table (configurable at runtime, must be cached). Decide before the action engine team consumes this API.
11. **Graceful degradation.** If Redis is down, the system is currently fail-closed for writes (cannot claim `jti`). That is correct — better to refuse than double-spend. Reads can fall back to a Postgres-backed top-10 query so the board still renders. Document the degradation path explicitly in the runbook.

## 11. Acceptance Criteria

The implementation is done when:

- [ ] All five FRs are demonstrably met via integration tests.
- [ ] Replay of an action token is rejected with `409 action.replayed`.
- [ ] A client-supplied `delta` cannot influence the stored score (no `delta` field is read from the increment request body).
- [ ] A user cannot redeem an action token whose `userId` ≠ the JWT `sub`.
- [ ] Top-10 read is served from Redis ZSET (verified by metrics or by a load test where Postgres is intentionally slowed).
- [ ] A score change inside the top-10 reaches all subscribed WS clients in under 1 s p95.
- [ ] Score changes outside the top-10 do not generate a WS broadcast.
- [ ] `/readyz` returns 503 when either Postgres or Redis is unreachable.
- [ ] Every `score_events` row reconciles with one Postgres `users.score` delta and one Redis `ZADD`.
- [ ] All endpoints emit `application/problem+json` on error, with the documented `code` values.
