# Contract: API Client (binder-home additions)

**Feature**: 016-binder-home-view
**Date**: 2026-05-10
**Owner**: `apps/mobile/src/services/api/` (existing) + `apps/mobile/src/hooks/useCardsInfiniteQuery.ts` (new)

This document captures the **delta** to spec 002's API-client contract
(`specs/002-mobile-binder-app/contracts/api-client.md`) introduced by this feature. Spec
002 is the authoritative source for the rest of the surface (auth endpoints, retry
defaults, error mapping). This file only documents what is new or changed by 016.

---

## 1. Endpoint consumed: `GET /cards`

The endpoint already exists on the server (spec 001) and is already wrapped on the
client by `apiClient.getCards(cursor?: string)` (spec 002). This spec adds the
TanStack hook that drives the binder-home query.

**Request**:

```http
GET /cards
Authorization: Bearer <jwt>
```

**Response (current — single page, today)**:

```json
{
  "cards": [
    { "id": "uuid", "name": "Lightning Bolt", "createdAt": "2026-05-01T00:00:00Z", "updatedAt": "2026-05-01T00:00:00Z" }
  ],
  "total": 1
}
```

**Response (forward-compatible — once the server enriches the row + adopts cursor pagination)**:

```json
{
  "cards": [
    {
      "id": "uuid",
      "name": "Lightning Bolt",
      "createdAt": "2026-05-01T00:00:00Z",
      "updatedAt": "2026-05-01T00:00:00Z",
      "frontFaceImageUrl": "https://...",
      "setName": "Magic 2010",
      "setCode": "M10",
      "typeLine": "Instant"
    }
  ],
  "total": 1,
  "nextCursor": null
}
```

**Schema**: `CARD_LIST_RESPONSE_SCHEMA` from **`@my-binder/core`**
(`packages/core/src/schemas/card.ts`) — extended in this spec to declare
`frontFaceImageUrl`, `setName`, `setCode`, `typeLine` as optional strings on the
referenced `CARD_RESPONSE_SCHEMA`, and `nextCursor` as an optional nullable string at
the list level. `additionalProperties: false` is preserved on the core schema so the
declared fields exhaustively describe the wire shape. Both `apps/server` and
`apps/mobile` import this schema from core; no parallel `Card` / `CARD_RESPONSE_SCHEMA`
declaration is permitted in either app.

---

## 2. New cross-feature hook: `useCardsInfiniteQuery`

```ts
// apps/mobile/src/hooks/useCardsInfiniteQuery.ts
import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query';
import type { Card, CardList } from '@my-binder/core';

import { apiClient } from '@src/services/api/apiClient';
import type { ApiError } from '@src/services/api/ApiError';
import { useSession } from '@src/hooks/useSession';

const QUERY_KEY = ['cards', 'list'] as const;
const STALE_TIME_MS = 60_000;
const GC_TIME_MS = 5 * 60_000;

export type UseCardsInfiniteQueryResult = UseInfiniteQueryResult<
  { pages: ReadonlyArray<CardList>; pageParams: ReadonlyArray<string | undefined> },
  ApiError
>;

/**
 * Page the authenticated user's collection from `GET /cards`. Wraps `apiClient.getCards`
 * with TanStack `useInfiniteQuery` so the UI can flatten `data.pages` into a single
 * array for the 3×3 grid. The hook is gated on an active session.
 *
 * @returns the TanStack `useInfiniteQuery` result; `data.pages` is a list of
 *   `CardListResponse`; the first page is fetched on mount.
 *
 * @example
 *   const cardsQuery = useCardsInfiniteQuery();
 *   const cards = useMemo(
 *     () => cardsQuery.data?.pages.flatMap((p) => p.cards) ?? [],
 *     [cardsQuery.data],
 *   );
 */
export const useCardsInfiniteQuery = (): UseCardsInfiniteQueryResult => {
  const { status } = useSession();
  return useInfiniteQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ pageParam }) => apiClient.getCards(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: status === 'active',
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};
```

**Why `useInfiniteQuery` instead of `useQuery`**:

- The shared core `CardList` declares an optional `nextCursor` string (added in spec 016
  alongside the binder-home filter fields), and the server is expected to add cursor
  pagination as the collection grows beyond a single response. `useInfiniteQuery` lets
  the binder-home flatten `data.pages` once and remain forward-compatible without
  changing call sites when pagination lands.
- For today's single-page response (no `nextCursor` returned), `getNextPageParam`
  returns `undefined` and the hook reduces to a single fetch — observationally
  equivalent to `useQuery` from the view's standpoint.

**Retry / cache behaviour**: inherits the global `QueryClient` defaults from spec 002
(retry 3 with 1s/2s/4s back-off, skip 4xx, `refetchOnWindowFocus: false`). No per-hook
override.

**Error mapping**: the global `queryCache.onError` in `queryClient.ts` already routes
401 → session-clear + `Login` and 403 → `AccessDenied`. The hook surfaces 5xx / network
failures as `isError === true` for the inline retry affordance defined by spec 016 Edge
Cases (Network error).

---

## 3. Canonical `Card` schema delta (in `@my-binder/core`)

The `Card` type and `CARD_RESPONSE_SCHEMA` live in `packages/core` and are extended in
this spec; both `apps/server` and `apps/mobile` import from core. The migration also
deletes the divergent local `Card` / `CARD_SCHEMA` / `CardListResponse` /
`CARD_LIST_RESPONSE_SCHEMA` declarations that lived in
`apps/mobile/src/services/api/schemas.ts` (a spec-002 carry-forward), replacing them
with re-exports from core.

| Field | Before (core, today) | After (this spec) | Notes |
|---|---|---|---|
| `id` | required `string` (uuid) | required | unchanged |
| `name` | required `string` | required | unchanged |
| `createdAt` | required `string` (date-time) | required | unchanged |
| `updatedAt` | required `string` (date-time) | required | unchanged |
| `frontFaceImageUrl` | absent in core (was forward-looking in mobile only) | optional `string` | new — migrated into core; mobile renders an empty-pocket placeholder when absent |
| `setName` | absent | optional `string` | new — filterable |
| `setCode` | absent | optional `string` | new — filterable |
| `typeLine` | absent | optional `string` | new — filterable |
| `additionalProperties` (core) | `false` | `false` | unchanged — declared fields are exhaustive |

`CardList` (in `packages/core/src/types/crud.ts`) is extended with an optional
`nextCursor?: string | null` for forward-compatible cursor pagination; the matching
optional property is added to `CARD_LIST_RESPONSE_SCHEMA`. `total` remains required
because the server returns it today.

---

## 4. No new endpoints

This spec adds **no new server endpoints**. The binder-search filter is implemented
client-side (`apps/mobile/src/utils/binderSearch.ts`) over the cards already loaded into
the TanStack cache (research §1). A future spec MAY introduce
`GET /cards/search?q=...` to support collections beyond the 1 000-card scope of SC-003;
when it does, the binder-search affordance will swap its filter source from the local
utility to a debounced server query without the view contract changing.
