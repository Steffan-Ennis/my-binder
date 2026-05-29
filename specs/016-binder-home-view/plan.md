# Implementation Plan: Binder Home View

**Branch**: `016-binder-home-view` | **Date**: 2026-05-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-binder-home-view/spec.md`

## Summary

Migrate the unimplemented binder-home tasks (T075–T082) out of `specs/002-mobile-binder-app/`
into a dedicated, scope-focused feature and ship them. Three user stories deliver:

1. **US1 — Branded binder home with header bar** (P1): the Binder tab renders a deep-crimson
   header (binder mark + "MY-BINDER" overline + italic-serif "My Binder") with a binder-search
   button and a Profile shortcut on the right, above a paper-cream canvas that hosts the
   summary caption and the rounded binder page surface with three ring perforations.
2. **US2 — Page through the collection** (P1): a 3×3 binder page renders the user's cards
   nine-per-page with prev/next pill buttons, a two-line "Page N / OF M" indicator, and a
   horizontal swipe gesture; partial last pages and empty pockets behave per spec 002's
   carried-forward acceptance criteria.
3. **US3 — Filter the binder with search** (P2): tapping the header binder-search button
   collapses the masthead and expands an inline text input that live-filters the cards by
   name + set name/code + card type (case-insensitive, all-tokens AND); the binder pages
   re-flow on each keystroke; clearing the input restores the full binder and the prior
   page position.

The work is implemented entirely in `apps/mobile`. Every supporting service already exists
from spec 002 (`apiClient`, `queryClient`, `sessionStore`, `binderStore`, `pageMath`,
the `useGoogleSignInMutation` / `useMeQuery` / `useSession` / `useSignOutMutation` cross-
feature hooks, the `Colors` / `Type` / `Spacing` / `Radius` / `Touch` / `Motion` design
tokens). This spec adds **one feature directory** (`src/components/binder-home/{BinderHomeContainer.tsx,
useBinderHome.ts,BinderHomeView.tsx}`), **one cross-feature TanStack hook**
(`src/hooks/useCardsInfiniteQuery.ts`), and **one pure-utility filter helper**
(`src/utils/binderSearch.ts`). The binder route file
`apps/mobile/src/app/(authenticated)/(tabs)/binder.tsx` is rewritten from its current
"Hello World" stub into the canonical one-line container shell, and the tabs layout opts
the Binder tab out of Expo Router's default header so the in-feature header bar renders
edge-to-edge.

No new third-party dependencies are introduced — `react-native-pager-view`,
`react-native-gesture-handler`, `expo-image`, `@expo/vector-icons`, `@tanstack/react-query`,
`zustand`, and `ajv` are all installed at SDK 54-compatible versions from spec 002.

**Schema-of-record rule (corrected 2026-05-10)**: every type and JSON schema for a
request/response that crosses the mobile↔server boundary lives in `@my-binder/core`
(`packages/core/src/types/` and `packages/core/src/schemas/`) and is imported by both
`apps/server` and `apps/mobile`. Spec 002 left a divergent local copy in
`apps/mobile/src/services/api/schemas.ts` (a `Card` shape with `frontFaceImageUrl` plus
a cursor-paginated `CardListResponse` that the server doesn't return today); spec 016
**migrates that duplication into `packages/core`** rather than extending it. The new
filter fields (`setName?`, `setCode?`, `typeLine?`) are added in core, and the mobile
file is reduced to typed re-exports (or deleted if no mobile-only schemas remain).

## Technical Context

**Language/Version**: TypeScript ~5.9 (`strict: true`), Node 22 (build/test toolchain only).
**Primary Dependencies**: React Native 0.81.5 + Expo SDK ~54.0 on React 19.1, Expo Router
~6.0, TanStack Query 5 (`useInfiniteQuery` for `/cards` pagination), Zustand 5
(`binderStore` for `currentPage`), `react-native-pager-view` ~7.0 (paged horizontal swipe),
`react-native-gesture-handler` ~2.28 (paging gesture), `expo-image` ~3.0 (front-face image
caching), `@expo/vector-icons` (Ionicons for the header magnifying-glass and person glyphs),
`ajv` 8 (response schema validation inside the `queryFn`), `@my-binder/core` (shared types).
All present at the SDK 54-pinned versions from spec 002.

**Storage**:

- **Persistent**: none new. Spec 002's `expo-secure-store` session JWT is the only persisted
  datum.
- **Ephemeral cache**:
  - `/cards` response — TanStack Query 5 in-memory cache (`queryKey: ["cards", "list"]`).
    `staleTime: 60_000`, `gcTime: 5 * 60_000`. Not persisted to disk.
  - Card front-face images — `expo-image` disk cache (managed by Expo; LRU bounded).
  - UI state — `binderStore.currentPage` (Zustand) and a local hook-scoped
    `BinderSearchState` (`useState` inside `useBinderHome` per Principle X — search mode is
    UI-local, not cross-feature, so it does not warrant a Zustand store).

**Testing**: Jest 30 + `jest-expo` SDK 54 preset + `@testing-library/react-native` 13.
Co-located `<filename>.test.ts(x)` per Principle III. The full Unit Testing Phase below
enumerates every test file.

**Target Platform**: iOS 15.1+ and Android API 24+ (inherited from spec 002 / SDK 54).
**Project Type**: Mobile-only feature inside the existing `apps/mobile` workspace.

**Performance Goals** (mapped to spec 016 Success Criteria):

- Binder home renders and is interactive within 2 s of successful sign-in (SC-001).
- Page navigation completes within one display frame on a 100-card collection (SC-002).
- 3×3 grid renders cleanly for 0–1000 cards (SC-003) — `react-native-pager-view`'s
  `offscreenPageLimit: 1` keeps decoded image memory bounded.
- Search filter recomputes within a single render at 1000 cards (≈ ms) — the filter is a
  single pass over the flat card list, no pagination IO involved.

**Constraints**:

- Filter MUST be **client-side** over the cards already loaded into the TanStack cache.
  No new server endpoint is added by this spec. The shared `Card` type in
  `@my-binder/core` (`packages/core/src/types/crud.ts`) is extended with three
  **optional** filter fields (`setName?`, `setCode?`, `typeLine?`); the matching
  optional properties are added to `CARD_RESPONSE_SCHEMA` in
  `packages/core/src/schemas/card.ts`. The filter degrades to "name only" when the
  server has not yet populated them. The same migration also moves the spec-002
  mobile-only `frontFaceImageUrl` and `nextCursor` declarations into core so there is
  exactly one definition shared by `apps/server` and `apps/mobile`.
- Per Principle X, **no `useState`/`useEffect` in views, screens, or containers**. The
  binder-home feature hook owns all state: the search-mode flag, the search query string,
  and the pre-search page-restore memory.
- The header bar MUST be rendered **inside the BinderHomeView** (not via Expo Router's
  per-screen header). The default header is opted out by setting `headerShown: false` on
  the Binder `Tabs.Screen` only, so other tabs keep their default header behaviour.
- TanStack Query 5 `useInfiniteQuery` pages the `/cards` endpoint when (eventually) the
  server emits a `nextCursor`. Today the server returns a single-page `{ cards, total }`
  shape; the hook's `getNextPageParam` returns `undefined` in that case, so the hook
  reduces to a single fetch. The hook is forward-compatible with cursor pagination
  without any view-side change.
- Search MUST NOT navigate to the bottom-tab Search route (FR-005). Per spec
  Clarifications §2026-05-10 the two are intentionally distinct; the bottom-tab Search is
  a different feature owned by a future spec.
- Page-position memory MUST persist across **app backgrounding within an active session
  window** (FR-023). Zustand's in-memory `binderStore.currentPage` survives
  backgrounding (the JS runtime is not torn down by iOS/Android backgrounding within the
  active-session lifetime); the store does NOT need persistence middleware. Cross-sign-in
  reset is delivered by sign-out's `binderStore.getState().reset()` call (added in this
  spec) and verified by SC-007.

**Scale/Scope**: 0–1000 cards per binder. ≈ 112 pages at the 9-per-page packing.
Single user per device. Single tab (Binder); the other three tabs remain spec 002's
`<ComingSoonContainer />` placeholders.

### Outstanding NEEDS CLARIFICATION

None. All five clarifications resolved in spec.md §Clarifications 2026-05-10:

1. Header search vs bottom-tab Search are distinct (binder search vs catalogue search).
2. Multi-match behaviour: filter the binder pages.
3. Match fields: name + set name/code + card type, case-insensitive substring.
4. Search input surface: inline header replacement.
5. Multi-word query: all-tokens AND.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|---|---|---|
| I | Simplicity First | ✅ PASS | One feature dir, one cross-feature hook, one pure utility. No SQLite, no offline mode, no new abstractions. The search filter lives in a 30-line pure function (`utils/binderSearch.ts`). |
| II | Data Integrity | ✅ PASS | Card data is read-only from `/cards`. No local writes. No new persisted data. Sign-out resets `binderStore.currentPage` to 1 so a fresh sign-in does not inherit a stale page index. |
| III | Test-First Development | ✅ PASS | Unit Testing Phase below enumerates every Jest file; tests are written before implementation per the constitution. `jest-expo` SDK 54 preset and `@testing-library/react-native` 13 are already pinned (constitution v1.15.0). Co-location rule enforced. Mobile mocking conventions: no new native or Expo modules are introduced, so `apps/mobile/jest.setup.ts` needs no new entries. |
| IV | Single Responsibility | ✅ PASS | `BinderHomeView` is pure presentation; `useBinderHome` is the only place state and side effects live; `useCardsInfiniteQuery` is a single-purpose TanStack wrapper; `binderSearch` is a pure function. The header bar is a sub-component file inside the feature dir if it grows, but starts inline in the view. |
| V | Transparency & Legibility | ✅ PASS | All literals (slot count, page-size, retry delays) are imported from named constants (`SLOTS_PER_BINDER_PAGE`, `Colors`, `Spacing`, `Touch`, `Motion`). Identifier names describe intent (`isSearchActive`, `preSearchPage`, `matchedCards`). |
| VI | Layered Architecture | ✅ PASS | Mobile → API server only. Mobile MUST NOT call MTGJSON, the database, or AWS Secrets Manager. The `/cards` query goes through the same `apiClient` boundary spec 002 established. |
| VII | Strong Typing & Schema Validation | ✅ PASS | TS strict + Ajv validation runs inside the `useCardsInfiniteQuery` `queryFn` via the existing `apiClient.getCards`. **The `Card` type and `CARD_RESPONSE_SCHEMA` in `@my-binder/core` are the single source of truth** for the `/cards` wire shape — both `apps/server` and `apps/mobile` import from core, never re-declare. Spec 016 extends the core schema with optional `setName`, `setCode`, `typeLine`, and the previously mobile-only `frontFaceImageUrl` and `nextCursor` declarations are migrated into core in the same change. Path aliases `@root/*` and `@src/*` declared. `type` over `interface` for all new declarations. |
| VIII | Error Transparency | ✅ PASS | Existing `apiClient.getCards` logs original errors before throwing the typed `ApiError`; `queryClient`'s global `onError` routes 401/403 to the auth-cleanup chain. No new catch sites are introduced. The hook's network-error UI (Edge Cases) renders an inline retry affordance — never a silent swallow. |
| IX | Public API Discipline | ✅ PASS | The new cross-feature hook (`useCardsInfiniteQuery`) and the new utility (`binderSearch`) carry full JSDoc with `@example` blocks per the rule. The feature hook (`useBinderHome`) carries JSDoc per the spec-002 convention. No `index.ts` aggregation files are introduced; the feature directory uses sibling `*.ts(x)` files. |
| X | Component Architecture (Mobile) | ✅ PASS | Screen → Container → Hook → View enforced. The route file `app/(authenticated)/(tabs)/binder.tsx` is rewritten into the canonical one-line `<BinderHomeContainer />` shell (per the v1.13.2 layout rule, the v1.14.0 component-declaration rule using `const Foo: FC = ...`, and the v1.16.0 hook-return-value memoisation rule — every non-primitive returned by `useBinderHome` is wrapped in `useMemo` or `useCallback` with exhaustive deps). The view never imports from stores, services, navigation, or Zustand selectors. The container destructures every named prop (no spread). `useEffect` is used **only** for the page-restore-on-close effect, which is a cross-component synchronisation event (search-mode flag → `binderStore.setPage`); cleanup is unnecessary because the effect is idempotent and has no subscriptions. |
| XI | Dependency Currency | ✅ PASS | No new packages introduced. The Dependency Currency table below records "no off-stable selections". |

**Pre-implementation gates**: All cleared. `/speckit.tasks` is unblocked.

### Dependency Currency Check (Principle XI)

This feature introduces **no new entries** in `dependencies`, `devDependencies`, or
`peerDependencies` in any `package.json`. All required packages
(`react-native-pager-view`, `react-native-gesture-handler`, `expo-image`,
`@expo/vector-icons`, `@tanstack/react-query`, `zustand`, `ajv`) were installed by spec
002 at the SDK 54-mandated versions and remain pinned there.

| Package | Workspace | Chosen version | Current stable | Justification (only if off-stable) |
|---|---|---|---|---|
| _no new packages — table intentionally empty_ | _n/a_ | _n/a_ | _n/a_ | _n/a_ |

## Project Structure

### Documentation (this feature)

```text
specs/016-binder-home-view/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — search semantics, header strategy, paging
├── data-model.md        # Phase 1 output — Card (mobile), CollectionSummary, BinderPage, BinderSearchState
├── quickstart.md        # Phase 1 output — local run, simulator, manual test scenarios
├── contracts/
│   ├── binder-home-ui.md     # Phase 1 output — useBinderHome return shape, view props, route shell
│   └── api-client.md         # Phase 1 output — Card type extension + GET /cards consumption
├── checklists/
│   └── requirements.md  # Pre-existing checklist
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
my-binder/
├── packages/
│   └── core/
│       └── src/
│           ├── types/
│           │   └── crud.ts                                  # MODIFIED — extend Card with optional frontFaceImageUrl, setName, setCode, typeLine; extend CardList with optional nextCursor
│           └── schemas/
│               └── card.ts                                  # MODIFIED — extend CARD_RESPONSE_SCHEMA with the four optional fields; extend CARD_LIST_RESPONSE_SCHEMA with optional nextCursor
├── apps/
│   └── mobile/
│       ├── src/
│       │   ├── app/
│       │   │   └── (authenticated)/
│       │   │       └── (tabs)/
│       │   │           ├── _layout.tsx                  # MODIFIED — set headerShown:false on the Binder tab only
│       │   │           └── binder.tsx                   # MODIFIED — replace stub with <BinderHomeContainer />
│       │   ├── components/
│       │   │   └── binder-home/                          # NEW — feature directory
│       │   │       ├── BinderHomeContainer.tsx          # NEW — destructures useBinderHome, passes named props to view
│       │   │       ├── useBinderHome.ts                 # NEW — feature hook: cards query + search state + pager state
│       │   │       ├── useBinderHome.test.ts            # NEW — Jest tests for the feature hook
│       │   │       ├── BinderHomeView.tsx               # NEW — pure view: header bar + canvas + 3×3 grid + page indicator
│       │   │       └── BinderHomeView.test.tsx          # NEW — view tests (render snapshot + interaction)
│       │   ├── hooks/
│       │   │   ├── useCardsInfiniteQuery.ts             # NEW — TanStack useInfiniteQuery wrapping apiClient.getCards
│       │   │   └── useCardsInfiniteQuery.test.ts        # NEW — hook tests (success, error, paging)
│       │   ├── services/
│       │   │   └── api/
│       │   │       └── schemas.ts                        # MODIFIED — delete the duplicated Card / CardListResponse / CARD_SCHEMA / CARD_LIST_RESPONSE_SCHEMA declarations; replace with re-exports of the canonical definitions from @my-binder/core (auth schemas may stay until a follow-up migration)
│       │   ├── stores/
│       │   │   └── binderStore.ts                       # MODIFIED — sign-out cleanup hook calls reset() (added by useSignOutMutation, not in this file)
│       │   └── utils/
│       │       ├── binderSearch.ts                      # NEW — pure filter helper (token-AND across name+set+type)
│       │       └── binderSearch.test.ts                 # NEW — Jest tests for the filter
│       └── package.json                                  # UNCHANGED — no new deps
```

**Structure Decision**: Mobile-only feature using the spec 002 four-layer split exactly as
constitution Principle X prescribes. The route file at
`apps/mobile/src/app/(authenticated)/(tabs)/binder.tsx` is the Screen layer (one-line
container shell); `apps/mobile/src/components/binder-home/` is the feature directory;
shared cross-feature hooks live in `apps/mobile/src/hooks/`; pure utilities live in
`apps/mobile/src/utils/`. No package-level paths change; all aliases (`@src/*`, `@root/*`)
are already declared in `apps/mobile/tsconfig.json`.

## Unit Testing Phase

*GATE: This section is REQUIRED in every plan per Constitution Principle III. A plan
without a completed Unit Testing Phase MUST NOT proceed to task generation
(`/speckit.tasks`).*

**Test framework**: Jest 30 with the `jest-expo` SDK 54 preset and
`@testing-library/react-native` 13 (`renderHook` for hook tests, `render` for view
tests). Co-located `<filename>.test.ts(x)` per Principle III.

### Mobile mocking conventions (Principle III sub-rule)

This feature introduces **no new native or Expo modules**, so `apps/mobile/jest.setup.ts`
needs **no new entries**. Existing default mocks for `react-native-reanimated`,
`expo-secure-store`, `@react-native-google-signin/google-signin`, `expo-constants`, and
`expo-router` cover everything the new tests touch.

`react-native-pager-view` is consumed only by `BinderHomeView`. Its existing default
behaviour under the `jest-expo` preset (a `View` shim) is sufficient for unit tests; the
view test exercises the rendered grid, not the gesture-driven page change. If a future
test asserts `onPageSelected` callbacks the spy is added at that test's `beforeEach`
against an in-`jest.setup.ts` default — never via in-file `jest.mock`.

### Test files to create or update

| Test file | Status | Behaviours covered (mapped to FR-### where applicable) |
|---|---|---|
| `apps/mobile/src/utils/binderSearch.test.ts` | new | • empty/whitespace query → `null` (no filter) [FR-005a, FR-005b]<br>• single-token name match (case-insensitive) [FR-005a]<br>• single-token set-name match [FR-005a]<br>• single-token set-code match [FR-005a]<br>• single-token type-line match [FR-005a]<br>• multi-token AND across mixed fields [FR-005a]<br>• zero-match input → empty array, summary recomputes to "0 CARDS · 1 PAGE" via call site [FR-005d]<br>• cards with missing optional `setName`/`setCode`/`typeLine` → degrade to name-only match (no false positives) |
| `apps/mobile/src/hooks/useCardsInfiniteQuery.test.ts` | new | • returns the validated `cards` flat list when single-page response [FR-001 enabling]<br>• exposes `isLoading`/`isError` flags so the view can render its placeholder/retry states [Edge Cases: loading, network error]<br>• 401/403 surface through global cache `onError` (covered by `queryClient` test, not duplicated) — only the happy path and the retryable error path are asserted here<br>• `enabled` gate keyed off `useSession().status === 'active'` |
| `apps/mobile/src/components/binder-home/useBinderHome.test.ts` | new | • returns `{ cards, currentPage, totalPages, summaryCaption, isSearchActive, searchQuery, matchedCards, onSearchOpen, onSearchChange, onSearchClear, onNextPage, onPrevPage, onProfilePress, onPageChange }` with stable references [Principle X v1.16.0]<br>• summary caption pluralisation: 0/1/many cards, 1/many pages [FR-009, Edge Cases: singular vs plural]<br>• loading state: caption renders dashes [FR-010]<br>• error state: caption renders dashes; `error` flag truthy [Edge Cases: network error]<br>• `onSearchOpen` captures `binderStore.currentPage` into `preSearchPage` and sets `isSearchActive=true` [FR-005, FR-005c]<br>• `onSearchChange` updates `searchQuery`; `matchedCards` recomputes via `binderSearch`; `totalPages` recomputes against the filtered set [FR-005a, FR-005e]<br>• zero-match query: `matchedCards = []`, `totalPages = 1`, caption = "0 CARDS · 1 PAGE", `noMatches=true` [FR-005d]<br>• `onSearchClear` resets `searchQuery=''`, `isSearchActive=false`, restores `binderStore.currentPage = preSearchPage` [FR-005f, FR-005c]<br>• `onProfilePress` calls `router.navigate('/profile')` (Profile tab) [FR-006]<br>• `onNextPage`/`onPrevPage` clamp via `binderStore.{nextPage,prevPage}` against `totalPages` [FR-017, FR-018, FR-020]<br>• `onPageChange` (from PagerView) calls `binderStore.setPage` |
| `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx` | new | • renders header bar with masthead text "MY-BINDER" + "My Binder" + binder-search and Profile buttons (accessibility labels assert FR-003, FR-004)<br>• tapping the Profile button fires `onProfilePress` [FR-006]<br>• tapping the binder-search button fires `onSearchOpen` [FR-005]<br>• when `isSearchActive=true`: masthead replaced by `TextInput` with cancel control; `onSearchChange`/`onSearchClear` fire on input/clear [FR-005, FR-005f]<br>• summary caption renders the `summaryCaption` prop verbatim [FR-008, FR-009]<br>• 3×3 grid: occupied pockets render `<Image>` with `frontFaceImageUrl`; empty pockets render the dashed placeholder; partial last page packs remaining cards left-to-right with empty placeholders [FR-014, FR-015, FR-016, FR-022]<br>• page indicator renders "Page N" / "OF M" [FR-019]<br>• prev/next buttons fire callbacks; disabled state on first/last page [FR-017, FR-018, FR-020]<br>• zero-match search: renders the inline "no matches in your binder" message [FR-005d, US3 acceptance #5]<br>• loading state: caption renders "— CARDS · — PAGE", grid renders empty pockets [FR-010, Edge Cases: loading]<br>• network error: inline retry affordance replaces the grid [Edge Cases: network error] |
| `apps/mobile/src/app/(authenticated)/(tabs)/_layout.test.tsx` | update | • binder Tabs.Screen options include `headerShown: false` (assert via the `Tabs.Screen` mock spy in `jest.setup.ts`) — other tabs unaffected |

E2E coverage for the swipe gesture and the multi-page navigation is **deferred** to a
future Detox/Maestro spec (out of scope). The unit tests above cover the gesture's
*callback path* (`onPageChange` → `binderStore.setPage`) but not the gesture itself, in
line with spec 002's testing scope.

### Coverage target

The constitution's project-wide floor of **80% lines / 80% functions / 80% branches /
80% statements** applies (declared in `apps/mobile/jest.config.ts`). The new files
introduced by this feature MUST clear that floor; the load-bearing files are expected to
clear it comfortably:

- `useBinderHome.ts` — target ≥ 90% lines (state transitions and pagination math are the
  spec's main risk surface).
- `binderSearch.ts` — target 100% lines/branches (pure function with explicit token AND
  semantics; small enough to fully cover).

```jsonc
// jest.config.ts — coverageThreshold remains the 80% global default;
// no per-file overrides are added by this spec.
{
  "coverageThreshold": {
    "global": { "branches": 80, "functions": 80, "lines": 80, "statements": 80 }
  }
}
```

### Test execution

Local development:

```bash
# Mobile-only run (fast feedback while building the feature)
pnpm --filter @my-binder/mobile test

# Watch mode for the binder-home directory
pnpm --filter @my-binder/mobile test -- --watch src/components/binder-home

# Full repo gate (matches the CI invocation)
turbo test
turbo typecheck
```

Both `turbo test` and `turbo typecheck` MUST exit `0` before each phase exit per
Principle III's Phase completion validation gate. No `it.skip` / `xit` /
`describe.skip` are permitted to bypass a failing test in any phase.

## Complexity Tracking

> No constitution violations to justify. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_ | _n/a_ | _n/a_ |
