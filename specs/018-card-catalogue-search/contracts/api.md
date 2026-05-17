# Phase 1 Contracts: HTTP API deltas

**Spec**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

This document captures every wire-shape change introduced by spec 018.
Mobile and server agree on these shapes via `@my-binder/core` (shared
types + Ajv schemas); the Fastify docs page (`/docs`) consumes the same
Ajv schemas so updating a schema simultaneously updates the OpenAPI
documentation.

The feature touches five endpoints — three modified, two new. Numbering
matches the section order below.

| # | Endpoint | Status |
|---|---|---|
| 1 | `GET  /cards/search` | MODIFIED — adds catalogue filter dimensions, joins `numberOwned`, mandates paper-only |
| 2 | `GET  /cards`        | MODIFIED — joins `numberOwned` per row |
| 3 | `POST /cards`        | MODIFIED — duplicate `(id, user_id)` increments instead of 409; response carries `numberOwned` |
| 4 | `PATCH /cards/:id`   | NEW — `{ delta: 1 \| -1 }` body; deletes row at 0 |
| 5 | `GET  /cards/:id/prices`         | NEW — latest observation per source |
| 5 | `GET  /cards/:id/prices/history` | NEW — 30-day series per source |

The masthead, filter sheet, detail sheet, owned-count glyph, pager, and
catalogue UI surfaces are mobile-only and have no wire shape; their
contracts live in `./ui.md`.

---

## 1. `GET /cards/search` — catalogue search (MODIFIED)

**Path**: `/cards/search`
**Auth**: Bearer JWT REQUIRED when `missing_only=true`; OPTIONAL otherwise
(see Migration notes below).
**Change**: Adds five filter dimensions; mandates paper-only filtering at
the provider layer; joins `numberOwned` per row when the request is
authenticated.

### Request

```http
GET /cards/search?name=bolt
                 &set=M21
                 &colors=R
                 &cmc_min=1&cmc_max=3
                 &formats=Modern,Legacy,Commander
                 &super_types=Legendary
                 &sub_types=Equipment
                 &creature_types=Goblin
                 &missing_only=true
                 &page=1&limit=9
Authorization: Bearer <jwt>
```

Querystring (extends the existing `SEARCH_QUERYSTRING_SCHEMA`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | conditional* | substring match, case-insensitive |
| `set` | string | conditional* | single set code (e.g. `M21`) |
| `colors` | string | conditional* | comma-separated subset of `WUBRG,C` |
| `cmc_min` | integer ≥ 0 | conditional* | inclusive |
| `cmc_max` | integer ≥ 0 | conditional* | inclusive |
| `page` | integer ≥ 1 | optional (default 1) | offset paging |
| `limit` | integer 1–100 | optional (default 20) | mobile uses 9 |
| `formats` | string | conditional* | comma-separated format names |
| `super_types` | string | conditional* | comma-separated super-type names |
| `sub_types` | string | conditional* | comma-separated sub-type names |
| `creature_types` | string | conditional* | comma-separated creature-type names |
| `missing_only` | boolean | conditional* | requires Bearer JWT when true |

*At least ONE of `name`, `set`, `colors`, `cmc_min`, `cmc_max`, `formats`,
`super_types`, `sub_types`, `creature_types`, `missing_only` MUST be
provided. The existing `MISSING_FILTER` 400 response is updated to count
the new dimensions as valid filters (a request with only `missing_only=true`
is no longer a 400).

### Response 200

```jsonc
{
  "cards": [
    {
      "id":            "6ca7af0b-4b6a-59ba-90be-6da4f62bcff1",
      "name":          "Lightning Bolt",
      "set":           "Magic 2011",
      "cardNumber":    "146",
      "manaCost":      "{R}",
      "colorIdentity": ["R"],
      "commanderLegal": true,
      "imageRef":      "https://cards.scryfall.io/normal/...",
      "numberOwned":   3
    }
    // …up to `limit` entries
  ],
  "total":      18,
  "page":       1,
  "limit":      9,
  "totalPages": 2
}
```

New field: `numberOwned` (integer >= 0). Present whenever the request
carries a valid Bearer JWT; absent for unauthenticated calls. Zero means
"the signed-in user does not own this printing"; positive means "the user
owns this many copies of this exact printing".

### Response 400

`MISSING_FILTER` — every filter dimension is empty. The error message
enumerates the dimensions the caller may set:

```json
{
  "error": "MISSING_FILTER",
  "message": "At least one filter must be provided. Allowed: name, set, colors, cmc_min, cmc_max, formats, super_types, sub_types, creature_types, missing_only."
}
```

### Response 401

`AUTH_INVALID_TOKEN` — Bearer JWT is missing or expired AND
`missing_only=true` was set. (Without `missing_only`, the endpoint
remains accessible to unauthenticated callers as it is today, omitting
`numberOwned` from the response.)

### Response 503

`PROVIDER_UNAVAILABLE` — the active card provider raised an error.
Unchanged from current behaviour.

### Server-side filter semantics

| Dimension | Combinator within dimension | Combinator across dimensions |
|---|---|---|
| `name` | n/a (single value) | AND |
| `set` | OR (single value today; future multi-set is OR) | AND |
| `colors` | OR (e.g. `R,G` matches red OR green identities; `C` matches colourless) | AND |
| `cmc_min`/`cmc_max` | AND (inclusive range) | AND |
| `formats` | OR | AND |
| `super_types` | OR | AND |
| `sub_types` | OR | AND |
| `creature_types` | OR | AND |
| `missing_only` | n/a (boolean) | AND |

Provider-layer mandate (FR-021): every catalogue response MUST exclude
digital-only printings. The `MtgjsonProvider.search` adapter filters
`card.availability.includes('paper')` before returning to the service
layer. There is no opt-in for digital printings on this endpoint.

### Migration

- **Server**: `SEARCH_QUERYSTRING_SCHEMA` in
  `packages/core/src/schemas/card.ts` gains the five new fields. The
  `cards.ts` route handler parses each comma-separated list into
  `string[]`, populates `query.userId` from `request.identity` when the
  request is authenticated, and forwards the full `SearchQuery` to
  `cardService.searchCards`. The service performs the per-user LEFT JOIN
  for `numberOwned` and applies `missing_only` after the provider returns.
  Provider-layer filtering (paper-only) lives in `MtgjsonProvider.search`.
- **Mobile**: `apiClient` gains `searchCards(query: SearchQuery): Promise<SearchResult>`.
  The infinite-query hook (`useCatalogueInfiniteQuery`) consumes it.

---

## 2. `GET /cards` — list owned cards (MODIFIED)

**Path**: `/cards`
**Auth**: Bearer JWT
**Change**: response items now include `numberOwned` (always present, ≥ 1
because the binder never holds 0-count rows).

### Request

Unchanged.

### Response 200

```jsonc
{
  "cards": [
    {
      "id":          "6ca7af0b-4b6a-59ba-90be-6da4f62bcff1",
      "name":        "Lightning Bolt",
      "createdAt":   "2026-05-17T12:00:00.000Z",
      "updatedAt":   "2026-05-17T12:00:00.000Z",
      "setName":     "Magic 2011",
      "setCode":     "m11",
      "typeLine":    "Instant",
      "numberOwned": 3
    }
    // …
  ],
  "total":      1,
  "nextCursor": null
}
```

### Migration

- **Server**: `cardRepository.findAll` selects the new
  `cards.number_owned` column and `cardService.getCards` populates the
  field on every row before responding. `CARD_RESPONSE_SCHEMA` accepts
  the new optional property (added in data-model §1.2).
- **Mobile**: `Card` type in `@my-binder/core` carries the new optional
  field. `useBinderHome` reads `card.numberOwned` to drive the
  on-pocket owned-count glyph when `>= 2` (FR-024).

---

## 3. `POST /cards` — add a card to the binder (MODIFIED)

**Path**: `/cards`
**Auth**: Bearer JWT
**Change**: duplicate `(id, user_id)` no longer responds 409 — it
increments `numberOwned` and returns the updated row.

### Request

```http
POST /cards
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "id":   "6ca7af0b-4b6a-59ba-90be-6da4f62bcff1",
  "name": "Lightning Bolt"
}
```

Body: unchanged (`CREATE_CARD_BODY_SCHEMA`).

### Response 201 (first insert)

```jsonc
{
  "id":          "6ca7af0b-4b6a-59ba-90be-6da4f62bcff1",
  "name":        "Lightning Bolt",
  "createdAt":   "2026-05-17T12:00:00.000Z",
  "updatedAt":   "2026-05-17T12:00:00.000Z",
  "numberOwned": 1
}
```

### Response 200 (duplicate increment)

```jsonc
{
  "id":          "6ca7af0b-4b6a-59ba-90be-6da4f62bcff1",
  "name":        "Lightning Bolt",
  "createdAt":   "2026-05-17T12:00:00.000Z",
  "updatedAt":   "2026-05-17T12:00:01.000Z",
  "numberOwned": 2
}
```

`createdAt` is preserved across increments; `updatedAt` advances.

### Migration

- **Server**: `cardRepository.create` is replaced by `cardRepository.upsertIncrement`
  that runs a single `INSERT … ON CONFLICT (id, user_id) DO UPDATE SET
  number_owned = cards.number_owned + 1, updated_at = NOW() RETURNING *`.
  The route handler responds 201 when the row is fresh (no `updated_at`
  advance) and 200 otherwise.
- **Mobile**: `useUpdateBinderEntryMutation` with `delta: +1` against a
  not-yet-owned printing calls `POST /cards`; with `delta: +1` against an
  already-owned printing also calls `POST /cards` (the server idempotency
  collapses both cases).

---

## 4. `PATCH /cards/:id` — adjust owned count by delta (NEW)

**Path**: `/cards/:id`
**Auth**: Bearer JWT
**Purpose**: increment or decrement `numberOwned` by 1.

### Request

```http
PATCH /cards/6ca7af0b-4b6a-59ba-90be-6da4f62bcff1
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "delta": -1
}
```

Params: `id` MUST be a UUID (existing `CARD_ID_PARAMS_SCHEMA`).
Body: matches `PATCH_CARD_BODY_SCHEMA` — `delta` MUST be `1` or `-1`.

### Response 200 (count updated; row remains)

```jsonc
{
  "id":          "6ca7af0b-4b6a-59ba-90be-6da4f62bcff1",
  "name":        "Lightning Bolt",
  "createdAt":   "2026-05-17T12:00:00.000Z",
  "updatedAt":   "2026-05-17T12:00:02.000Z",
  "numberOwned": 2
}
```

### Response 204 (count reached 0; row deleted)

Empty body. Returned when `delta: -1` brings `numberOwned` from 1 to 0
(triggering row deletion per FR-026).

### Response 400 (would underflow)

```json
{
  "error":   "VALIDATION_ERROR",
  "message": "delta -1 would underflow numberOwned (current=0)"
}
```

Surfaces when the row does not exist OR exists at `numberOwned = 0`
(should never persist; defensive). The mobile stepper disables the `−`
button in this case so users do not see this response, but the route
returns it for direct API consumers.

### Response 404 (no such printing in user's binder, delta: -1)

```json
{
  "error":   "NOT_FOUND",
  "message": "Card with id \"<uuid>\" not found"
}
```

Returned when the user has never added the printing AND `delta: -1` is
sent (decrementing a non-row is a 404). When `delta: +1` is sent against
a non-row, the call is routed to the `POST /cards` upsert path instead —
the mobile mutation hook does this transparently.

### Response 401 / 503

Standard auth and provider failures unchanged.

### Migration

- **Server**: new route handler in `apps/server/src/routes/cards.ts`. New
  `cardRepository.adjustNumberOwned(id, userId, delta)` repository method
  runs a single `UPDATE cards SET number_owned = number_owned + :delta,
  updated_at = NOW() WHERE id = :id AND user_id = :userId RETURNING *`
  inside a transaction. When the returned `number_owned` is 0, the same
  transaction issues a `DELETE FROM cards WHERE id = :id AND user_id =
  :userId` and the handler responds 204.
- **Mobile**: `apiClient.patchCard(id, body)` returns
  `{ status: 200; card: Card } | { status: 204 }`. The mutation hook
  `useUpdateBinderEntryMutation` consumes it.

---

## 5. `GET /cards/:id/prices` & `GET /cards/:id/prices/history` (NEW)

### 5a. `GET /cards/:id/prices`

**Path**: `/cards/:id/prices`
**Auth**: Bearer JWT
**Purpose**: latest observation per source for one printing.

#### Request

```http
GET /cards/6ca7af0b-4b6a-59ba-90be-6da4f62bcff1/prices
Authorization: Bearer <jwt>
```

#### Response 200

```jsonc
{
  "printingId":  "6ca7af0b-4b6a-59ba-90be-6da4f62bcff1",
  "cardKingdom": { "source": "CARD_KINGDOM", "amountCents": 1378, "currency": "USD", "observedOn": "2026-05-16" },
  "tcgPlayer":   { "source": "TCG_PLAYER",   "amountCents": 1311, "currency": "USD", "observedOn": "2026-05-16" }
}
```

Per-source values are either a `PriceQuote` object or `null` (FR-019 —
missing observation rendered as `—` mobile-side). The endpoint NEVER
returns 404 for "no prices"; it returns 200 with both slots `null`.
MTG Goldfish is deferred to a follow-up specification per the spec's
2026-05-18 Clarifications entry; the response shape extends additively
when that spec lands.

#### Response 404

`CARD_NOT_FOUND` — the `:id` is not a valid MTGJSON printing UUID per
the active provider. Returned only when the provider explicitly rejects
the id; for "valid printing but no price data", the response is 200 with
all-null slots.

### 5b. `GET /cards/:id/prices/history`

**Path**: `/cards/:id/prices/history?days=30`
**Auth**: Bearer JWT
**Purpose**: per-source series over the last N days.

#### Request

```http
GET /cards/6ca7af0b-4b6a-59ba-90be-6da4f62bcff1/prices/history?days=30
Authorization: Bearer <jwt>
```

Querystring:

| Field | Type | Required | Notes |
|---|---|---|---|
| `days` | integer 1–365 | optional (default 30) | window length ending today |

#### Response 200

```jsonc
{
  "printingId": "6ca7af0b-4b6a-59ba-90be-6da4f62bcff1",
  "days":       30,
  "cardKingdom": [
    { "observedOn": "2026-04-17", "amountCents": 1410 },
    { "observedOn": "2026-04-18", "amountCents": 1392 },
    // …up to 30 entries, ascending date order
    { "observedOn": "2026-05-16", "amountCents": 1378 }
  ],
  "tcgPlayer":   [ /* … */ ]
}
```

Per-source arrays MAY be shorter than `days` when observations are
missing. Each source's array is independently sorted ascending by
`observedOn`. Mobile renders gaps in the line where dates are missing
(FR-019); the series MUST NOT pad missing days with `0` or interpolated
values.

#### Response 404

Same as `/cards/:id/prices` — the provider doesn't recognise the UUID.

### Migration

- **Server**: new route file
  `apps/server/src/routes/prices.ts` registered alongside `cards.ts`.
  Schemas + types live in `@my-binder/core` per data-model §2.4. Price
  data is sourced from the **MTGJSON SDK** via two new methods on the
  `CardProvider` interface (data-model §2.1):

  ```ts
  // apps/server/src/providers/interface.ts (extended)
  getPrices(uuid: string): Promise<CardPricesResponse>;
  getPriceHistory(uuid: string, days: number): Promise<CardPriceHistoryResponse>;
  ```

  `MtgjsonProvider` implements both by fanning out two
  `sdk.prices.today` (or `.history`) calls — one per in-scope source
  provider key — and assembling the wire response. A new thin
  `priceService` (`apps/server/src/services/priceService.ts`) wraps
  the provider calls with the same `ProviderUnavailableError`
  rewriting `cardService` uses, so route handlers can map errors
  consistently to 503. **No TypeORM entity, no repository, no Postgres
  table, no migration.**

  The two MTGJSON provider keys consumed are `cardkingdom` and
  `tcgplayer`, both queried as `{ finish: 'normal', priceType:
  'retail' }` for paper-only retail observations (FR-021). MTG
  Goldfish is deferred to a follow-up specification per the spec's
  2026-05-18 Clarifications entry.

- **Mobile**: `apiClient` gains `getCardPrices(id)` and
  `getCardPriceHistory(id, days)`. Two cross-feature TanStack hooks:
  `useCardPricesQuery(id)` and `useCardPriceHistoryQuery(id, days)`,
  both consumed by `useCardDetailSheet`.

---

## Summary of wire-shape changes

| Endpoint | Field | Before 018 | After 018 |
|---|---|---|---|
| `GET /cards/search` | `cards[].numberOwned` | absent | optional integer ≥ 0 (present when auth'd) |
| `GET /cards/search` querystring | `formats` `super_types` `sub_types` `creature_types` `missing_only` | n/a | NEW optional fields |
| `GET /cards` | `cards[].numberOwned` | absent | required integer ≥ 1 |
| `POST /cards` (duplicate) | response | 409 | 200 with incremented `numberOwned` |
| `POST /cards` response | `numberOwned` | absent | required integer ≥ 1 |
| `PATCH /cards/:id` | — | n/a | NEW endpoint |
| `GET /cards/:id/prices` | — | n/a | NEW endpoint |
| `GET /cards/:id/prices/history` | — | n/a | NEW endpoint |
| `Card` type (TS) | `numberOwned?: number` | absent | optional |
| `CardRecord` type (TS) | `numberOwned?: number` | absent | optional |
| `CARD_RESPONSE_SCHEMA` | `properties.numberOwned` | absent | added (`integer, minimum: 0`) |
| `CARD_RECORD_SCHEMA` | `properties.numberOwned` | absent | added (`integer, minimum: 0`) |
| `SEARCH_QUERYSTRING_SCHEMA` | five new properties | absent | added (all optional) |
