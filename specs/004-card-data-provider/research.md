# Research: Card Data Provider

**Feature**: 004-card-data-provider
**Date**: 2026-03-21
**Status**: Complete — all unknowns resolved

---

## 1. MTGJSON SDK — Installation and Initialisation

**Decision**: Use `mtgjson-sdk` npm package.
**Rationale**: Official SDK, actively maintained by the MTGJSON project. Single dependency,
no additional tooling required.
**Installation**: `npm install mtgjson-sdk`

**Lifecycle**:
```js
const { MtgjsonSDK } = require('mtgjson-sdk');
const sdk = await MtgjsonSDK.create();
// ... queries ...
await sdk.close(); // must be called to release DuckDB resources
```

The SDK supports `Symbol.asyncDispose` for automatic cleanup in environments that support it.
The server should hold a single long-lived SDK instance for the lifetime of the process and
call `sdk.close()` on graceful shutdown.

**Alternatives considered**: Scryfall REST API (network-dependent, rate-limited at 50–100
ms/request, 10 req/s limit — ruled out); raw MTGJSON JSON files (no query engine, heavy
memory use — ruled out).

---

## 2. Data Architecture — Offline-First Local DuckDB

**Decision**: Accept the SDK's offline-first DuckDB model as-is.
**Rationale**: The SDK downloads Parquet data files from the MTGJSON CDN on first
initialisation and caches them locally. All subsequent queries run against the local DuckDB
file — sub-millisecond latency, no rate limits, no network dependency at query time. This
vastly exceeds the spec's performance requirements (lookup <2s, legality <1s, search <3s).

**Implications for containerisation**:
- The DuckDB cache directory must be mounted as a persistent volume in the container, or
  re-sync will occur on every container restart (acceptable for a personal project but
  increases cold-start time).
- Initial sync requires outbound internet access from the container. Subsequent starts do not
  if the volume is persisted.

**Alternatives considered**: Scryfall API (rate-limited, network-dependent at query time —
ruled out per Principle VI resilience requirement).

---

## 3. SDK Query Methods Relevant to This Feature

### Card Lookup (FR-001 – FR-005)

| Method | Use case |
|--------|----------|
| `sdk.cards.getByName(name)` | Exact name lookup; returns first match |
| `sdk.cards.search({ name: { fuzzy: name } })` | Fuzzy/partial search via Jaro-Winkler |
| `sdk.cards.getPrintings(name)` | All printings of a card across sets |
| `sdk.cards.getAtomic(name)` | Name-level (atomic) card data — shared across all printings |

### Commander Legality (FR-006 – FR-008)

- `sdk.cards.getAtomic(name)` returns a `legalities` map keyed by format (e.g., `"commander"`).
  Values are `"Legal"`, `"Banned"`, or `"Restricted"`.
- Colour identity is returned in the `colorIdentity` field as an array of single-character
  colour codes: `["W","U","B","R","G"]` subsets.
- Legality is name-level (atomic), not printing-specific — consistent with how the Commander
  banned list works.

### Catalogue Search (FR-009 – FR-011)

`sdk.cards.search(filters)` supports ~20 composable filters. Relevant ones:

| Filter key | Type | Purpose |
|------------|------|---------|
| `name.fuzzy` | string | Fuzzy name match |
| `name.exact` | string | Exact name match |
| `setCode` | string | Filter by set code |
| `colorIdentity` | string[] | Filter by colour identity |
| `manaValue.gte` / `.lte` | number | Mana cost range |
| `legalities.commander` | "Legal" \| "Banned" | Legality filter |

**Pagination**: The SDK does not natively paginate `search()` results — it returns all
matches. Pagination MUST be implemented in the server's service layer (slice the result array
by offset + limit). This is appropriate given the local in-process query model.

### Provider Switching (FR-012 – FR-016)

The provider abstraction is implemented in the server layer, not in the SDK. The SDK is one
concrete implementation. The `registry.js` module holds a reference to the active provider
and exposes `setActive(name)` and `getActive()`. The active provider name is read from an
environment variable (`CARD_PROVIDER`, default: `"mtgjson"`) at server startup, satisfying
FR-013 (config-only switching).

---

## 4. Response Mapping — SDK → Normalised CardRecord

The SDK returns its own typed objects. These MUST be mapped to the normalised `CardRecord`
schema before leaving the provider module, so the rest of the system is decoupled from SDK
internals.

**SDK card fields → CardRecord fields**:

| SDK field | CardRecord field | Notes |
|-----------|-----------------|-------|
| `name` | `name` | Direct |
| `setCode` | `set` | The printing's set code |
| `number` | `cardNumber` | Collector number within set |
| `manaCost` | `manaCost` | Mana cost string (e.g., `"{2}{U}"`) |
| `colorIdentity` | `colorIdentity` | Array of colour codes |
| `legalities.commander` | `commanderLegal` | Boolean derived from legality value |
| `identifiers.scryfallId` | `imageRef` | Used by app to fetch card image |

---

## 5. Testing Approach

**Decision**: Use Node 22 built-in `node:test` runner with real SDK for integration tests.
**Rationale**: The SDK's local DuckDB means integration tests run against real data with no
network calls and sub-millisecond latency — making them as fast as unit tests. No mocking
of the SDK is needed for integration tests. Unit tests cover the mapper and service layer
logic independently.

**Test data strategy**: Integration tests use well-known, stable cards (e.g., "Lightning
Bolt", "Sol Ring") whose data is unlikely to change between MTGJSON releases.

---

## 6. DuckDB Export Feature

`sdk.exportDb()` generates a standalone DuckDB file. This is useful for debugging and
offline analysis but is not part of the application's production flow. Out of scope for
this feature.

---

## Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| Pagination in SDK? | Not built-in; implemented as array slice in service layer |
| TypeScript in JS project? | SDK ships compiled JS — no build step needed |
| DuckDB persistence in container? | Mount cache dir as persistent volume (recommended) |
| Provider config mechanism? | `CARD_PROVIDER` env var read at startup |
| Image sourcing? | Scryfall ID from SDK → client fetches image from Scryfall CDN |
