# Phase 1 Contracts: HTTP API deltas

**Spec**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

This document captures every wire-shape change introduced by feature
017. The mobile client and the server agree on these shapes via
`@my-binder/core` (shared types + Ajv schemas). Existing OpenAPI
documentation served at `apps/server/src/routes/docs.ts` consumes the
same Ajv schemas, so updating the schema simultaneously updates the
docs.

The card component itself does NOT add any new endpoint — the
`/cards/images/:id` route already exists. The only *server-side*
change is a tightening of the existing `/cards` and `/cards/:id`
response shapes (drop `frontFaceImageUrl`).

---

## 1. `GET /cards` — list owned cards (TIGHTENED)

**Path**: `/cards`
**Auth**: Bearer JWT (existing `fastify.authenticate` preHandler)
**Change**: response items no longer include `frontFaceImageUrl`.

### Request

Unchanged — no body, no query params (cursor pagination already
declared on the response shape but not yet emitted).

### Response 200

```jsonc
// AFTER feature 017 (no frontFaceImageUrl):
{
  "cards": [
    {
      "id": "6ca7af0b-4b6a-59ba-90be-6da4f62bcff1",
      "name": "Lightning Bolt",
      "createdAt": "2026-05-16T12:00:00.000Z",
      "updatedAt": "2026-05-16T12:00:00.000Z",
      "setName": "Magic 2011",
      "setCode": "m11",
      "typeLine": "Instant"
    }
    // ...
  ],
  "total": 11,
  "nextCursor": null
}
```

Compared to the spec 016 baseline, the only field removed from each item
is `frontFaceImageUrl`. The `setName`, `setCode`, `typeLine` fields
remain (used by mobile for name/set/type search and the future card
detail header).

### Migration

- **Server**: `cardService.enrichCard` already does not populate
  `frontFaceImageUrl` for the list path (only the single-card
  `getCard` does). No server code change required for this endpoint —
  only the schema tightening (see §3) prevents future regressions.
- **Mobile**: `apps/mobile/src/services/api/schemas.ts` re-exports
  `Card` from `@my-binder/core`. The TypeScript type loses the
  `frontFaceImageUrl?` field automatically after the core type
  change. Consumer call sites: `BinderHomeView.tsx` (passes
  `card.frontFaceImageUrl` to inline `<Image>`) — replaced by
  `<Card id={card.id} footprint="pocket" />` per FR-001.

---

## 2. `GET /cards/:id` — fetch a single owned card (TIGHTENED)

**Path**: `/cards/:id`
**Auth**: Bearer JWT
**Change**: response no longer includes `frontFaceImageUrl`.

### Request

```http
GET /cards/6ca7af0b-4b6a-59ba-90be-6da4f62bcff1
Authorization: Bearer <jwt>
```

### Response 200

```jsonc
// AFTER feature 017:
{
  "id": "6ca7af0b-4b6a-59ba-90be-6da4f62bcff1",
  "name": "Lightning Bolt",
  "createdAt": "2026-05-16T12:00:00.000Z",
  "updatedAt": "2026-05-16T12:00:00.000Z",
  "setName": "Magic 2011",
  "setCode": "m11",
  "typeLine": "Instant"
}
```

### Response 404

Unchanged — `{ "error": "NOT_FOUND", "message": "..." }`.

### Migration

- **Server**: `cardService.enrichCard` (called from `getCard`) drops
  the `frontFaceImageUrl` computation; the orphaned
  `scryfallNormalImageUrl` helper is deleted. See `data-model.md` §
  "Modifications to existing types / schemas" for the precise diff.
- **Tests**: `apps/server/src/routes/cards.test.ts` line 137-153 is
  renamed and inverted — the assertion `expect(body.frontFaceImageUrl).toBe(M11_BOLT_IMAGE_NORMAL)`
  becomes `expect(body.frontFaceImageUrl).toBeUndefined()`. `apps/server/src/services/cardService.test.ts`
  lines 142-189 drop the four `frontFaceImageUrl` assertion blocks; the
  surviving `getCardImagesById` describe at line 299 is unchanged.

---

## 3. `CARD_RESPONSE_SCHEMA` — schema tightening (defence in depth)

**File**: `packages/core/src/schemas/card.ts`
**Change**: drop `frontFaceImageUrl` from the schema's `properties`.

```diff
 export const CARD_RESPONSE_SCHEMA = {
   type: 'object',
   additionalProperties: true,
   required: ['id', 'name'],
   properties: {
     id: { type: 'string', format: 'uuid' },
     name: { type: 'string', minLength: 1, maxLength: 255 },
     createdAt: { type: 'string', format: 'date-time' },
     updatedAt: { type: 'string', format: 'date-time' },
-    // Optional binder-home fields (spec 016) — not yet returned by the server.
-    frontFaceImageUrl: { type: 'string', minLength: 1 },
     setName: { type: 'string' },
     setCode: { type: 'string' },
     typeLine: { type: 'string' },
   },
 } as const;
```

Note: `additionalProperties: true` is preserved, so the schema does not
hard-reject an `frontFaceImageUrl` field if a future server bug
re-emits it — but the TypeScript `Card` type no longer permits it,
which catches the bug at compile time.

---

## 4. `GET /cards/images/:id` — fetch image URLs for a card (UNCHANGED)

**Path**: `/cards/images/:id`
**Auth**: Bearer JWT (existing)
**Change**: **none**. Documented here as the contract the new mobile
component depends on.

### Request

```http
GET /cards/images/6ca7af0b-4b6a-59ba-90be-6da4f62bcff1
Authorization: Bearer <jwt>
```

### Response 200

```jsonc
{
  "small":  "https://cards.scryfall.io/small/front/6/c/6ca7af0b-….jpg",
  "medium": "https://cards.scryfall.io/normal/front/6/c/6ca7af0b-….jpg",
  "large":  "https://cards.scryfall.io/large/front/6/c/6ca7af0b-….jpg"
}
```

Shape: matches `CARD_IMAGES_RESPONSE_SCHEMA` (Ajv) and `CardImages`
(TypeScript) — both already declared in `@my-binder/core`.

### Response 400

`{ "error": "VALIDATION_ERROR", "message": "params/id must match format \"uuid\"" }` — when `:id` is not a UUID. **Per FR-006: skipped from
retry budget** (4xx).

### Response 404

`{ "error": "CARD_NOT_FOUND", "message": "..." }` — when the UUID is
unknown to the MTGJSON SDK. **Per FR-005: surfaces as the not-found
view state with no retry** (4xx).

### Response 503

`{ "error": "PROVIDER_UNAVAILABLE", "message": "..." }` — when the
active provider is offline. **Per FR-006: triggers the 5-attempt retry
with exponential back-off.**

### Mobile client contract (`apiClient.getCardImages`)

```ts
// apps/mobile/src/services/api/apiClient.ts
async getCardImages(id: string): Promise<CardImages> {
  const response = await this.fetch(`/cards/images/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }
  const json = await response.json();
  if (!validateCardImages(json)) {
    throw new ApiError('SCHEMA_MISMATCH', 'CardImages payload failed validation', 502);
  }
  return json;
}
```

The Ajv validator `validateCardImages` is compiled from
`CARD_IMAGES_RESPONSE_SCHEMA` per the project's Strong Typing & Schema
Validation rule (Principle VII). The `ApiError.kind` discriminants
(`'CARD_NOT_FOUND'`, `'PROVIDER_UNAVAILABLE'`, `'SCHEMA_MISMATCH'`) map
to the existing `apiClient.ts` taxonomy.

---

## Summary of wire-shape changes

| Endpoint | Field | Direction | Before 017 | After 017 |
|---|---|---|---|---|
| `GET /cards` | `cards[].frontFaceImageUrl` | response | absent (de facto) | absent (now schema-enforced via `Card` type) |
| `GET /cards/:id` | `frontFaceImageUrl` | response | populated when scryfallId present | **removed** |
| `GET /cards/images/:id` | (full response) | response | `{small,medium,large}` URLs | unchanged |
| `CARD_RESPONSE_SCHEMA` | `properties.frontFaceImageUrl` | schema | declared | **removed** |
| `Card` type (TS) | `frontFaceImageUrl?: string` | type | declared optional | **removed** |
