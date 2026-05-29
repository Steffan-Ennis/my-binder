# Implementation Plan: Reusable Card Component

**Branch**: `017-reusable-card-component` | **Date**: 2026-05-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-reusable-card-component/spec.md`

## Summary

A single `<Card />` component renders any owned card by **id alone**, fetches
its image set on demand via the existing `GET /cards/images/:id` endpoint,
and shows a dashed-border-skeleton interstitial until the image arrives.
The component supports exactly two footprints — `pocket` (medium variant,
9-up binder grid) and `detail` (large variant, single-card screens) — and
exposes a 404/error fallback inside the same frame. The binder home view
swaps its inline `CardPocket` markup for `<Card id={card.id} footprint="pocket" />`,
and the server-side `/cards` list + `/cards/:id` responses drop
`frontFaceImageUrl` so image-URL construction is paid only when a slot is
actually viewed (FR-014).

Technical approach (validated against the existing repo):
- **Mobile**: new `apps/mobile/src/components/card/` four-layer slice
  (Container → Hook → View + co-located theme) per constitution Principle X.
  A new `apps/mobile/src/hooks/useCardImagesQuery.ts` wraps
  `useQuery` against `apiClient.getCardImages(id)`, with a **per-query
  retry override of 5 attempts** (overriding the queryClient default of 3
  per FR-006 / clarification Q4) reusing the existing `computeRetryDelay`
  and `isFourXX` helpers from `apps/mobile/src/services/api/queryClient.ts`.
  `BinderHomeView` keeps its dashed-border test-IDs (`pocket-occupied`,
  `pocket-empty`) for SC-006 backward compatibility; `<Card />` emits
  `pocket-occupied` when an image is loaded.
- **Server**: `cardService.enrichCard` drops `frontFaceImageUrl`
  computation; the `scryfallNormalImageUrl` helper in `cardService.ts` is
  deleted (only consumer); `CARD_RESPONSE_SCHEMA` in
  `packages/core/src/schemas/card.ts` drops the `frontFaceImageUrl`
  property; the `Card` interface in `packages/core/src/types/crud.ts`
  drops `frontFaceImageUrl?`. The `/cards/images/:id` route is unchanged.
- **Core**: `CardImages` type already exists at
  `packages/core/src/types/card.ts:70` and `CARD_IMAGES_RESPONSE_SCHEMA`
  at `packages/core/src/schemas/card.ts:62` — both are reused unchanged.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) on Node 22; React 19.1; React Native 0.81.5.
**Primary Dependencies** (all already installed — no version bumps): `@tanstack/react-query@^5.100.8`, `expo-image@~3.0.11`, `@expo/vector-icons` (for the not-found / retry glyph), `react-native-pager-view` (unchanged in the binder context), `zustand@^5` (only via `useSession` indirection). Server: `fastify@4`, `mtgjson-sdk@0.1.1` (untouched — route already exists).
**Storage**: in-memory TanStack Query cache only (FR-015). No `expo-secure-store`, no AsyncStorage, no disk persistence introduced by this feature. The `expo-image` library independently caches *image bytes* to disk by default — that is orthogonal to the URL-response cache scoped by FR-015 and is not modified by this plan.
**Testing**: Jest 30 + `jest-expo` SDK 54 preset + `@testing-library/react-native` 13 for `apps/mobile`; `ts-jest` (Node env) for `apps/server` and `packages/core`. All per-Principle-III defaults; new mobile view tests follow the v1.24.0 `ComponentWithDefaults` rule.
**Target Platform**: iOS 17+ and Android 8+ (Expo SDK 54 baselines, unchanged from spec 002). The component is RN-only; no web target.
**Project Type**: Mobile feature with a small server-side schema tightening. Touches `apps/mobile`, `apps/server`, and `packages/core` workspaces.
**Performance Goals**: SC-002 (95% within-session warm-cache renders hit first paint without a skeleton interstitial); SC-003 (cold-cache 9-slot page exits skeleton state within the spec 016 envelope); SC-004 (zero measurable layout shift).
**Constraints**: per-query retry budget of 5 attempts overrides the queryClient default of 3 (FR-006). The override is local to `useCardImagesQuery` and does not affect any other query in the app. Cache is in-memory only (FR-015) — a deliberate trade-off deferred to a future holistic local-storage spec.
**Scale/Scope**: target wireframe shows "426 CARDS · 48 PAGES" — i.e., a few hundred cards per user with ~9 visible at a time. Per-page image-fetch fan-out is 9 concurrent `/cards/images/:id` requests on cold cache (deduped per FR-007). At realistic binder scale (<5k cards/user), in-memory cache size is bounded and well within React Native default heap budgets.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Simplicity First | ✅ Pass | One new component slice + one new hook + a schema/type tightening. No new abstractions, no speculative footprints (Q5 narrowed FR-009 to exactly 2). |
| II. Data Integrity | ✅ Pass | No write paths touched. The dropped `frontFaceImageUrl` field is response-side only; no schema migration. |
| III. Test-First Development | ✅ Pass | Co-located Jest tests for every new file; phase gates run `turbo test` per workspace; new mobile view test follows the v1.24.0 `ComponentWithDefaults` rule (canonical reference: `BinderHomeView.test.tsx`); server route tests for the updated `/cards/:id` + `/cards` responses use the v1.23.0 factory rule (existing `userFactory`/`allowedUserFactory` are sufficient — no new factory needed). |
| IV. Single Responsibility | ✅ Pass | `useCardImagesQuery` does one thing (fetch the image set for one id). `<Card />` does one thing (render that one card's image with loading/error states). |
| V. Transparency & Legibility | ✅ Pass | Every state is observable via testID (`card-loading`, `card-loaded`, `card-not-found`, `card-error`) and accessibility label. |
| VI. Layered Architecture | ✅ Pass | Mobile follows Screen → Container → Hook → View. Server follows route → service → provider. Cross-layer coupling is unchanged. |
| VII. Strong Typing & Schema Validation | ✅ Pass | New `CardFootprint = 'pocket' \| 'detail'` type lives in `apps/mobile/src/components/card/types.ts` (mobile-only concern — never needed on the wire). `CardImages` and `CARD_IMAGES_RESPONSE_SCHEMA` already exist in `@my-binder/core`; reused unchanged. |
| VIII. Error Transparency | ✅ Pass | 404 → distinct not-found view (FR-005); network/5xx after 5 retries → error view with user-tap retry (FR-006); 401 routes through the existing `registerAuthErrorHandler` cleanup (already wired). |
| IX. Public API Discipline | ✅ Pass | `apps/mobile/src/components/card/index.ts` is a pure barrel re-export of `CardContainer` as `Card`; `packages/core/src/{types,schemas}/index.ts` re-export edits stay barrel-only. |
| X. Component Architecture (Mobile) | ✅ Pass | Four-layer slice (`CardContainer.tsx`, `useCard.ts`, `CardView.tsx`, `CardView.theme.ts`); FC declaration rule; Hook return-value memoisation rule (`useCard` returns memoised `loading`/`loaded`/`notFound`/`error` discriminated state); State locality rule (no Zustand store — all state lives in the hook); Style co-location rule (theme.ts sibling). |
| XI. Dependency Currency | ✅ Pass | **No new packages added.** All dependencies (`@tanstack/react-query`, `expo-image`, `@expo/vector-icons`) are already in `apps/mobile/package.json` at versions current as of the feature start date. Dependency Currency table omitted per Principle XI's "skip the table entirely if the feature adds no new packages" rule. |

**Pre-Phase-0 gate: PASS.** No violations; no Complexity Tracking row needed.

**Post-Phase-1 re-check (2026-05-16, after research.md + data-model.md + contracts/api.md + quickstart.md)**: re-evaluated all eleven principles against the design artifacts. No new violations surfaced. The four-layer slice, the per-query retry override, the schema tightening, and the test-ID backward-compat all land inside existing principle envelopes. Phase 2 (`/speckit.tasks`) is unblocked.

### Dependency Currency Check (Principle XI)

**No new packages introduced** — skip table per Principle XI's carve-out.

## Project Structure

### Documentation (this feature)

```text
specs/017-reusable-card-component/
├── plan.md              # This file
├── research.md          # Phase 0 — TanStack retry override, expo-image cache scope, server schema-tightening risk
├── data-model.md        # Phase 1 — CardImages + CardFootprint + the dropped frontFaceImageUrl field
├── quickstart.md        # Phase 1 — <Card id={...} footprint={...} /> usage
├── contracts/
│   └── api.md           # Phase 1 — GET /cards (FR-014 drop) + GET /cards/:id (drop) + GET /cards/images/:id (unchanged) deltas
├── checklists/
│   └── requirements.md  # Created by /speckit.specify
└── tasks.md             # Phase 2 — created by /speckit.tasks (NOT by /speckit.plan)
```

### Source Code (repository root)

This feature touches three workspaces. Only paths added or modified by this
feature are shown; unrelated paths under each workspace are unchanged.

```text
packages/core/src/
├── types/
│   ├── card.ts          # (UNCHANGED) — CardImages type at line 70 is reused
│   └── crud.ts          # MODIFY — drop `frontFaceImageUrl?: string` from Card interface
└── schemas/
    └── card.ts          # MODIFY — drop `frontFaceImageUrl` from CARD_RESPONSE_SCHEMA properties

apps/server/src/
├── routes/
│   ├── cards.ts         # (UNCHANGED) — GET /cards/images/:id already returns CardImages
│   └── cards.test.ts    # MODIFY — invert assertions at line 137-153 ("returns 200 with enriched setCode and frontFaceImageUrl") — frontFaceImageUrl MUST be absent
└── services/
    ├── cardService.ts   # MODIFY — remove `scryfallNormalImageUrl` helper + drop `frontFaceImageUrl` line from enrichCard
    └── cardService.test.ts  # MODIFY — drop or invert the 4 frontFaceImageUrl assertions (lines 142-189)

apps/mobile/
├── jest.setup.ts        # (UNCHANGED) — expo-image already mocked at line 45
├── src/
│   ├── components/
│   │   ├── card/                       # NEW — four-layer Principle X slice
│   │   │   ├── index.ts                # NEW — barrel re-export of CardContainer as Card (Principle IX)
│   │   │   ├── CardContainer.tsx       # NEW — calls useCard(id, footprint), renders <CardView />
│   │   │   ├── CardContainer.test.tsx  # NEW — wiring test (id → useCard → view props)
│   │   │   ├── CardView.tsx            # NEW — pure presentational; renders dashed border + skeleton/image/fallback
│   │   │   ├── CardView.test.tsx       # NEW — view tests via CardViewWithDefaults FC (v1.24.0 rule)
│   │   │   ├── CardView.theme.ts       # NEW — useStyles for dashed border, skeleton, image, fallback (Style co-location rule)
│   │   │   ├── useCard.ts              # NEW — composes useCardImagesQuery + footprint variant selection → memoised view props
│   │   │   ├── useCard.test.ts         # NEW — state machine tests (loading → loaded / notFound / error)
│   │   │   └── types.ts                # NEW — CardFootprint = 'pocket' | 'detail'; CardViewProps discriminated union
│   │   └── binder-home/
│   │       ├── BinderHomeView.tsx      # MODIFY — replace inline CardPocket with <Card id={card.id} footprint="pocket" />; keep `pocket-empty` for page-level loading
│   │       └── BinderHomeView.test.tsx # MODIFY — adapt setup so makeCard no longer needs frontFaceImageUrl; SC-006 assertions unchanged
│   └── hooks/
│       ├── useCardImagesQuery.ts       # NEW — useQuery wrapper with retry: 5, computeRetryDelay reused, queryKey ['cards', 'images', id]
│       └── useCardImagesQuery.test.ts  # NEW — covers happy path, 404 skip-retry, 5-attempt back-off exhaustion, dedup, unmount cancellation
└── src/services/api/
    ├── apiClient.ts                    # MODIFY — add `getCardImages(id: string): Promise<CardImages>` typed against CARD_IMAGES_RESPONSE_SCHEMA
    ├── apiClient.test.ts               # MODIFY — add coverage for getCardImages happy/404/5xx
    ├── queryClient.ts                  # MODIFY — export `isFourXX` and `computeRetryDelay` (currently file-private) so useCardImagesQuery can reuse them without re-implementing
    └── schemas.ts                      # (UNCHANGED) — re-exports from @my-binder/core via barrel
```

**Structure Decision**: Three-workspace touch (`packages/core` + `apps/server`
+ `apps/mobile`) with the bulk of new code in
`apps/mobile/src/components/card/` as a single four-layer Principle X slice.
The server and core changes are tightenings (dropping a field, removing a
helper) — no new module, no new endpoint. The new
`useCardImagesQuery.ts` lives in `apps/mobile/src/hooks/` alongside the
existing per-endpoint hooks (`useCardsInfiniteQuery.ts`, `useMeQuery.ts`,
etc.) following the established pattern.

## Unit Testing Phase

*GATE: REQUIRED per Constitution Principle III. A plan without a completed
Unit Testing Phase MUST NOT proceed to task generation.*

**Test framework**: Jest 30 + `jest-expo` SDK 54 preset (mobile) + `ts-jest`
(server + core). Per Principle III, no alternative runners.

### Test files to create or update

> **Mobile mocks (`apps/mobile` only):** No new third-party native/Expo dependencies are introduced. The existing `expo-image` mock at `apps/mobile/jest.setup.ts:45` already covers the render-side need; the new TanStack hook tests use the project's standard `QueryClientProvider` + a per-test fresh `QueryClient` (no global override). No `jest.setup.ts` edit required.
>
> **Mobile view tests (`apps/mobile/src/components/card/CardView.test.tsx`):** `render(...)` is called only inside `it(...)` blocks; a `CardViewWithDefaults: FC<Partial<CardViewProps>>` declared at module scope spreads a `defaults` object over `<CardView />`. Canonical pattern matches `BinderHomeView.test.tsx`. Constitution v1.24.0 rule applies.
>
> **Server route tests (`apps/server` only):** The route file is unchanged. The existing `cards.test.ts` test at line 137-153 is updated to assert `frontFaceImageUrl` is absent. The test still uses the real DataSource + offline-mode SDK + the existing `createTestUser` factory; no new factory is needed.

| Test file | Status | Behaviours covered (mapped to FR-### where applicable) |
|---|---|---|
| `apps/mobile/src/hooks/useCardImagesQuery.test.ts` | new | happy path returns `CardImages` (FR-003); 404 surfaces immediately without retry (FR-005, Q4); 5xx/network retries exactly 5 times with exponential back-off then surfaces error (FR-006, Q4); same key deduplicates concurrent requests (FR-007); within-session warm cache returns instantly (FR-008, Q3); unmount mid-fetch is cancellation-safe (FR-013); id change discards in-flight (FR-012). |
| `apps/mobile/src/components/card/useCard.test.ts` | new | derives discriminated `loading` / `loaded` / `notFound` / `error` view-state from `useCardImagesQuery` output; selects medium URL for `footprint=pocket` and large for `footprint=detail` (FR-009, Q2); memoises returned object identity (constitution v1.16.0 hook return-value rule). |
| `apps/mobile/src/components/card/CardView.test.tsx` | new | renders dashed-border skeleton with `testID="card-loading"` when in loading state (FR-002, US1-AS1); renders `expo-image` with the supplied URL and `testID="card-loaded"` when loaded (FR-004, US1-AS2); renders not-found fallback with `testID="card-not-found"` (FR-005, US3-AS1); renders error fallback with retry button `testID="card-retry"` (FR-006, US3-AS2); emits `pocket-occupied` testID when loaded at `footprint=pocket` for SC-006 backward compatibility; same outer dimensions across all four states (FR-011, SC-004). |
| `apps/mobile/src/components/card/CardContainer.test.tsx` | new | wires `id` + `footprint` props to `useCard` and passes the resulting view-props to `<CardView />`; verifies `useCard` is the only state-owning collaborator (Principle X four-layer). |
| `apps/mobile/src/services/api/apiClient.test.ts` | update | adds 3 test cases for new `apiClient.getCardImages(id)` — 200 returns parsed `CardImages`, 404 throws `ApiError('CARD_NOT_FOUND')`, 5xx throws `ApiError('PROVIDER_UNAVAILABLE')`. |
| `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx` | update | adapts `makeCard()` factory to drop the `frontFaceImageUrl` field (no longer on `Card`); wraps render in a `QueryClientProvider` so embedded `<Card />` instances can issue their queries; SC-006 assertions on `pocket-occupied` / `pocket-empty` / `binder-page-ring` remain unchanged. |
| `apps/server/src/routes/cards.test.ts` | update | line 137-153 test renamed from "returns enriched setCode and frontFaceImageUrl" to "returns enriched setCode without frontFaceImageUrl"; asserts `body.frontFaceImageUrl` is `undefined`. The `GET /cards/images/:id` block (lines 205-239) stays unchanged. |
| `apps/server/src/services/cardService.test.ts` | update | drops the 4 frontFaceImageUrl assertion blocks at lines 142-189 (they now belong to the deleted `enrichCard` image path); the existing `describe('getCardImagesById')` at line 299 stays unchanged. |
| `packages/core/src/schemas/card.test.ts` (if present) | check | If the file exists and tests `CARD_RESPONSE_SCHEMA` properties, update to reflect the dropped `frontFaceImageUrl`. If the file does not exist, no action — Ajv compile-time validation already enforces the schema shape via the route's response declaration. |

### Coverage target

```jsonc
// apps/mobile/jest.config.ts — coverageThreshold for new files
{
  "coverageThreshold": {
    "global":  { "branches": 80, "functions": 80, "lines": 80, "statements": 80 },
    "apps/mobile/src/components/card/**/*.{ts,tsx}":  { "branches": 90, "functions": 90, "lines": 90, "statements": 90 },
    "apps/mobile/src/hooks/useCardImagesQuery.ts":    { "branches": 90, "functions": 90, "lines": 90, "statements": 90 }
  }
}
```

New files lift the floor to 90% (vs. the 80% project default) because the
component is reused across screens and a regression in its state machine
silently breaks every consumer. The server-side changes (`cardService.ts`,
`crud.ts`, schema) are pure deletions; coverage on the surviving code is
maintained by the existing tests after the update.

### Test execution

```bash
# Run during development
pnpm --filter @my-binder/mobile test
pnpm --filter @my-binder/server test
pnpm --filter @my-binder/core test

# Phase gate (must exit 0 for every phase exit per Principle III)
turbo test       # all three workspaces
turbo typecheck  # all three workspaces
```

The new test files land in the standard `turbo test` pipeline; no
out-of-band test runners.

## Complexity Tracking

No Constitution Check violations. Table omitted.

The one deliberate deviation worth flagging in the file-level JSDoc (not
in this table because the constitution does not prohibit it) is the
**per-query retry override of 5 attempts** on `useCardImagesQuery`,
versus the project-wide queryClient default of 3. This is recorded:

- In `useCardImagesQuery.ts` JSDoc — "Overrides the default 3-attempt budget
  per FR-006 / spec 017 clarification Q4; reuses `computeRetryDelay` and
  `isFourXX` exported from `queryClient.ts`."
- In `spec.md` Clarifications Q4 (already integrated).
- In `tasks.md` (Phase 2 output, not generated here) as part of the hook
  task description.

No other deviation from project defaults.
