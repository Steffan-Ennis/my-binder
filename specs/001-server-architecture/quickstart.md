# Quickstart: Server Architecture

**Feature**: 001-server-architecture
**Date**: 2026-03-21

---

## What This Feature Builds

A containerised Node 22 HTTP server exposing a REST API for card collection CRUD operations.
The server uses DuckDB as its embedded database (no separate DB container) and runs schema
migrations at startup. All configuration is via environment variables.

---

## Prerequisites

- Node 22 (`nvm use` at repo root)
- Docker + Docker Compose

---

## Start the Server Locally (Development)

```bash
cd server
npm install
DB_PATH=:memory: NODE_ENV=development node index.js
```

Server starts on `http://localhost:3000`. The `:memory:` DB path means no file is written to disk
— useful for manual testing.

---

## Run Tests

```bash
cd server
NODE_ENV=test npm test
```

Tests use DuckDB `:memory:` automatically when `NODE_ENV=test`. No test container needed.

---

## Run in Docker

```bash
docker compose up
```

The `docker-compose.yml` mounts a local volume at `./data` and sets `DB_PATH=/data/binder.duckdb`.
Data survives container recreation.

---

## Verify the Server Is Healthy

```bash
curl http://localhost:3000/health
```

Expected response (HTTP 200):

```json
{ "status": "ok", "database": "connected" }
```

---

## Validate the Cards API

```bash
# Create a card
curl -X POST http://localhost:3000/cards \
  -H 'Content-Type: application/json' \
  -d '{"name": "Lightning Bolt"}'

# List all cards
curl http://localhost:3000/cards

# Get a card by ID (replace <id> with the UUID returned above)
curl http://localhost:3000/cards/<id>

# Update a card
curl -X PUT http://localhost:3000/cards/<id> \
  -H 'Content-Type: application/json' \
  -d '{"name": "Sol Ring"}'

# Delete a card
curl -X DELETE http://localhost:3000/cards/<id>
```

---

## Environment Variables

| Variable   | Default                  | Description                              |
|------------|--------------------------|------------------------------------------|
| `PORT`     | `3000`                   | TCP port the server listens on           |
| `DB_PATH`  | `/data/binder.duckdb`    | Path to the DuckDB file; `:memory:` for tests |
| `NODE_ENV` | `development`            | `development` \| `test` \| `production` |

---

## Success Criteria

The implementation is complete when all of the following pass:

1. `GET /health` returns `{"status":"ok","database":"connected"}` within 100ms
2. `POST /cards` with `{"name":"Lightning Bolt"}` returns a 201 with a UUID `id`
3. `GET /cards` returns `{"cards":[...],"total":N}` ordered by `createdAt` ascending
4. `GET /cards/:id` returns the card or a `NOT_FOUND` 404
5. `PUT /cards/:id` updates `name` and advances `updatedAt`; returns `NOT_FOUND` 404 for unknown IDs
6. `DELETE /cards/:id` returns 204; returns `NOT_FOUND` 404 for unknown IDs
7. All unit and integration tests pass with `npm test`
8. `docker compose up` starts the server; data persists after `docker compose restart`
