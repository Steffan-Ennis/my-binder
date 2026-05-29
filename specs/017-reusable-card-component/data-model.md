# Phase 1 Data Model: Reusable Card Component

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This document captures every type / schema added, modified, or removed by
feature 017. The shape conventions follow constitution Principle VII
(Strong Typing & Schema Validation): every wire-shape has a matching
TypeScript type in `@my-binder/core` AND a matching Ajv schema in the
same package's `schemas/` directory.

---

## Entities

### Card image set (`CardImages` — reused, unchanged)

The result of `GET /cards/images/:id`. Already declared in
`packages/core/src/types/card.ts:70`:

```ts
export type CardImages = {
  small: string;   // Scryfall "small" — ~146×204 JPG (not consumed by this feature)
  medium: string;  // Scryfall "normal" — ~488×680 JPG — used for footprint='pocket'
  large: string;   // Scryfall "large" — ~672×936 JPG — used for footprint='detail'
};
```

Matching Ajv schema already declared in `packages/core/src/schemas/card.ts:62`
(`CARD_IMAGES_RESPONSE_SCHEMA`).

**Variant-to-footprint mapping** (pinned by spec clarification Q2 + Q5):

| Footprint | URL field | Purpose |
|---|---|---|
| `pocket` | `medium` | Binder 3×3 grid; sharp on 3× retina at ~120pt width |
| `detail` | `large` | Single-card detail screens (future consumer) |
| _(none)_ | `small` | **Not consumed** by this feature; reserved for none |

### Card slot (UI concept, no wire type)

A rectangular display area in a consuming screen into which `<Card />`
renders. The slot's outer dimensions are governed by the consuming
screen via the surrounding `<View>`; `<Card />` fills 100% of its
parent. No type exists for this — it's the implicit container the
consumer provides.

### Card footprint (`CardFootprint` — new, mobile-only)

```ts
// apps/mobile/src/components/card/types.ts
export type CardFootprint = 'pocket' | 'detail';
```

Mobile-only enum (does not cross the wire) — therefore lives in the
mobile workspace rather than `@my-binder/core`. Spec clarification Q5
pins this set to exactly two members.

### Card view state (`CardViewState` — new, mobile-only)

Discriminated union the `useCard` hook returns to the container; the
view layer renders one branch per `kind`.

```ts
// apps/mobile/src/components/card/types.ts
export type CardViewState =
  | { kind: 'loading' }
  | { kind: 'loaded'; imageUrl: string }
  | { kind: 'notFound' }
  | { kind: 'error'; onRetry: () => void };
```

Total over the four observable component states (FR-002, FR-004, FR-005,
FR-006). Memoised by the hook per constitution v1.16.0 (Hook
return-value memoisation rule).

### Card view props (`CardViewProps` — new, mobile-only)

```ts
// apps/mobile/src/components/card/types.ts
export type CardViewProps = {
  state: CardViewState;
  footprint: CardFootprint;
};
```

The view layer is pure presentational and receives only `state` +
`footprint`. The `id` prop never leaves the container — the view does
not know about card identity (Principle X four-layer rule).

---

## Modifications to existing types / schemas (FR-014, R3)

### `Card` interface — drop `frontFaceImageUrl`

**File**: `packages/core/src/types/crud.ts`

```diff
 export interface Card {
   id: string;
   name: string;
   createdAt: string;
   updatedAt: string;
-  // Mobile binder-home additions (spec 016) — all OPTIONAL. Server may begin
-  // returning these in a follow-up enrichment; mobile consumers MUST tolerate
-  // their absence and degrade gracefully (placeholder image, name-only filter).
-  frontFaceImageUrl?: string;
+  // Mobile binder-home additions (spec 016) — all OPTIONAL. Server may begin
+  // returning these in a follow-up enrichment; mobile consumers MUST tolerate
+  // their absence and degrade gracefully (name-only filter).
   setName?: string;
   setCode?: string;
   typeLine?: string;
 }
```

**Impact**: removes the phantom field. The image URL is now retrieved
exclusively via `GET /cards/images/:id` and surfaced inside the
`<Card />` component.

### `CARD_RESPONSE_SCHEMA` — drop `frontFaceImageUrl`

**File**: `packages/core/src/schemas/card.ts`

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

The Ajv response validator on `GET /cards/:id` will now reject
`frontFaceImageUrl` should the service mistakenly emit it (defence in
depth against future regressions).

### `cardService.enrichCard` — drop image URL computation

**File**: `apps/server/src/services/cardService.ts`

```diff
 async function enrichCard(card: Card, provider: CardProvider | null): Promise<Card> {
   if (provider === null) return card;
   try {
     const details = await provider.getByUuid(card.id);
     if (details === null) return card;
-    const frontFaceImageUrl = details.scryfallId
-      ? scryfallNormalImageUrl(details.scryfallId)
-      : undefined;
     return {
       ...card,
       setCode: details.setCode,
       ...(details.setName !== null && { setName: details.setName }),
       typeLine: details.typeLine,
-      ...(frontFaceImageUrl !== undefined && { frontFaceImageUrl }),
     };
   } catch (err) {
     console.error(`[cardService] enrichment failed for card id=${card.id}`, err);
     return card;
   }
 }
```

### `scryfallNormalImageUrl` helper — delete

**File**: `apps/server/src/services/cardService.ts`

The helper at the top of the file becomes orphaned once `enrichCard`
stops calling it. Delete it entirely. Image URL construction now lives
exclusively in `apps/server/src/providers/mtgjson/scryfallImages.ts:buildScryfallImageUrls`,
which is called from the provider's `getCardImages(uuid)` method
(unchanged) and surfaced via `GET /cards/images/:id`.

---

## Relationships

```
┌─────────────────────────────────────┐
│ Consuming screen                     │
│   (binder-home, future search, etc.) │
└────────────┬────────────────────────┘
             │ <Card id="…" footprint="pocket" />
             ▼
┌─────────────────────────────────────┐
│ apps/mobile/src/components/card/     │
│   CardContainer.tsx                  │
│     ├─ useCard(id, footprint)       │
│     │     ├─ useCardImagesQuery(id) │ → @tanstack/react-query
│     │     │     queryKey:           │
│     │     │       ['cards','images',id] │
│     │     │     retry: 5 (FR-006)   │
│     │     └─ pickVariant(footprint) │
│     └─ <CardView state footprint /> │
└─────────────────────────────────────┘
             │ apiClient.getCardImages(id)
             ▼
┌─────────────────────────────────────┐
│ apps/server  GET /cards/images/:id   │ → CardImages JSON
│   handler → cardService.getCardImagesById()
│           → providerRegistry.getActive().getCardImages(id)
│           → MtgjsonProvider.getCardImages(uuid)
│           → buildScryfallImageUrls(scryfallId)
└─────────────────────────────────────┘
```

## State transitions (CardViewState)

```
                   ┌──────────┐
   useCardImagesQuery.isLoading
                   ▼
              ┌─────────┐
              │ loading │ ─── data resolves ─────► loaded
              └─────────┘
                   │
                   ├─── 404 (CARD_NOT_FOUND) ────► notFound (no retry per FR-005)
                   │
                   └─── 5xx / network after 5    ► error (with onRetry callback)
                          attempts exhausted
                          (FR-006)
```

- `loading → loaded`: 200 response received.
- `loading → notFound`: 404 surfaced from `apiClient.getCardImages`;
  retry is skipped per `isFourXX(error)` in the per-query retry
  predicate.
- `loading → error`: any retryable failure (5xx, network) after the
  full 5-attempt budget is exhausted with exponential back-off (1s →
  2s → 4s → 8s → 16s capped at 30s).
- `error → loading`: user taps the retry affordance; `onRetry` calls
  `query.refetch()` which resets the failure count and starts the
  5-attempt cycle afresh (edge case "Repeated retries" in spec).
- `loaded` is terminal within a session unless the `id` prop changes
  on the container — at which point the hook discards the in-flight
  response and re-enters `loading` for the new id (FR-012).

## Validation rules

| Rule | Source | Enforcement |
|---|---|---|
| `id` is a UUID | FR-003 + server route schema | Ajv `format: 'uuid'` on `CARD_ID_PARAMS_SCHEMA` (server-side); TypeScript `string` at the prop boundary (mobile) — server is the authoritative validator |
| `footprint ∈ {'pocket','detail'}` | FR-009, Q5 | TypeScript literal-union `CardFootprint`; exhaustive `switch` inside `pickVariant` (TS reports unhandled members) |
| Image URLs are non-empty strings | Existing schema | Ajv `minLength: 1` on each variant in `CARD_IMAGES_RESPONSE_SCHEMA` (already enforced) |
| `useCard`'s return value is identity-stable | Constitution v1.16.0 | `useMemo` on the discriminated `CardViewState` object; `useCallback` on the `onRetry` function (test: re-render with same inputs → reference-equal output) |
| Empty pockets MUST NOT render `<Card />` | Spec edge case ("Empty slot vs. loading slot") | `BinderHomeView.tsx` rendering guard: occupied slots render `<Card id={card.id} footprint="pocket" />`; empty slots render the local `<View testID="pocket-empty" />` |
