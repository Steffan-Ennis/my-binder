# Data Model: Revert MTGJSON Infrastructure Replication

**Branch**: `010-revert-mtgjson-infra` | **Date**: 2026-03-30

## Overview

This feature is a **simplification** — it removes entities from the data model rather than adding them. No new tables, schemas, or types are introduced.

---

## Removed Entities

### `card_import_metadata` (migration 003) — REMOVED

Previously: a DuckDB table in `binder.duckdb` tracking the last successful import of MTGJSON parquet files.

| Field | Type | Purpose |
|-------|------|---------|
| `id` | INTEGER PK | Always 1 (singleton row) |
| `last_import_at` | TIMESTAMPTZ | Timestamp of last import run |
| `parquet_mtime` | TIMESTAMPTZ | Mtime of parquet file at import time |
| `parquet_count` | INTEGER | Row count imported |

**Reason removed**: Import pipeline removed; the SDK manages its own cache freshness.

---

### `mtgjson_cards` (migration 004) — REMOVED

Previously: a stub DuckDB table populated by the card importer from `cards.parquet`.

**Reason removed**: Card data lives in the SDK's internal DuckDB instance, not the app's `binder.duckdb`.

---

### `mtgjson_card_identifiers` (migration 004) — REMOVED

Previously: populated from `cardIdentifiers.parquet`.

**Reason removed**: `scryfallId` is available directly on `CardSet.identifiers.scryfallId`.

---

### `mtgjson_card_legalities` (migration 004) — REMOVED

Previously: populated from `cardLegalities.parquet`.

**Reason removed**: Commander legality is available directly on `CardSet.legalities.commander`.

---

## Retained Entities (unchanged)

All user-facing tables in `binder.duckdb` are **unchanged**:

| Table | Migration | Notes |
|-------|-----------|-------|
| `cards` (user collection) | 001 | User collection data — not affected |
| `users` | 002 | Auth data — not affected |

---

## SDK Data Shape (reference only — not stored in app DB)

The SDK's `CardSet` type (from `mtgjson-sdk`) is the runtime representation of a card. Fields used by `MtgjsonProvider`:

| Field path | Type | Used for |
|------------|------|----------|
| `name` | `string` | Card name |
| `setCode` | `string` | Set code |
| `number` | `string` | Collector number |
| `manaCost` | `string \| undefined` | Mana cost string |
| `manaValue` | `number` | CMC (used for range filters) |
| `colorIdentity` | `string[]` | Colour identity array |
| `availability` | `string[]` | Includes `'paper'` for physical cards |
| `legalities.commander` | `string \| undefined` | `'Legal'`, `'Banned'`, or absent |
| `identifiers.scryfallId` | `string \| undefined` | Scryfall image reference |

These fields are mapped to `CardRecord` (defined in `packages/core`) by the existing `mapCardSetToCardRecord` function.

---

## Config Changes

`Config` type in `apps/server/src/config.ts` — field `mtgjsonCacheDir` interpretation changes:

| Context | Previous behaviour | New behaviour |
|---------|-------------------|---------------|
| Lambda (EFS present) | `MTGJSON_CACHE_DIR` env var → SDK cache dir | Derived from `EFS_PATH`: `path.join(EFS_PATH, 'mtgjson-cache')` |
| Local dev | `MTGJSON_CACHE_DIR` env var (default `./data/mtgjson-cache`) | Unchanged |
| Tests | Not initialised (SDK skipped in `test` env) | Unchanged |

No new config fields are added. `EFS_PATH` (already present as a process environment variable) is used to derive the cache path.
