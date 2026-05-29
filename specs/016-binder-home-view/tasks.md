---
description: "Task list for feature 016-binder-home-view"
---

# Tasks: Binder Home View

**Input**: Design documents from `/specs/016-binder-home-view/`
**Prerequisites**: plan.md (loaded), spec.md (loaded), research.md, data-model.md,
contracts/binder-home-ui.md, contracts/api-client.md, quickstart.md

**Tests**: Per Constitution Principle III, **unit tests are REQUIRED** for every feature
and MUST be written with **Jest** (`<filename>.test.ts(x)` co-located beside the file
under test). Contract and integration tests are not required for this feature; the
manual scenarios in `quickstart.md` cover end-to-end validation.

**Organization**: Tasks are grouped by user story (US1, US2, US3) so each story can be
implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User-story label (US1 / US2 / US3) for traceability — applied only to
  tasks inside a user-story phase
- Every task description includes the exact file path

## Path Conventions

This is a **mobile-only** feature inside the `apps/mobile` workspace of the
pnpm + Turborepo monorepo. Paths are absolute from the repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify the workspace is in the expected starting state. No new
dependencies are installed by this feature (research §9, plan Dependency Currency
table).

- [X] T001 Verify branch + workspace state from repo root: confirm `git branch --show-current` is `016-binder-home-view`, `apps/mobile/src/components/binder-home/` is empty, `apps/mobile/src/hooks/useCardsInfiniteQuery.ts` does not yet exist, and `apps/mobile/src/utils/binderSearch.ts` does not yet exist.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure all three user stories depend on:
the canonical `Card` schema lifted into `@my-binder/core` (data-model §1,
contracts/api-client.md §3, schema-of-record rule), the migration of the existing
spec-002 mobile-only duplicate into a re-export of core, the `useCardsInfiniteQuery`
TanStack hook (contracts/api-client.md §2), and the tabs-layout opt-out of the
default Expo Router header on the Binder tab (research §6).

**⚠️ CRITICAL**: No user-story work may begin until Phase 2 is complete.

- [X] T002 [P] Extend the canonical `Card` interface in `packages/core/src/types/crud.ts` with optional `frontFaceImageUrl?: string`, `setName?: string`, `setCode?: string`, `typeLine?: string`, and extend `CardList` with optional `nextCursor?: string | null` (data-model §1; contracts/api-client.md §3). Existing required fields (`id`, `name`, `createdAt`, `updatedAt` on `Card`; `cards`, `total` on `CardList`) stay unchanged. The barrel export in `packages/core/src/types/index.ts` already re-exports these so no edit is needed there.
- [X] T003 [P] Extend `packages/core/src/schemas/card.ts` to add the four new optional properties (`frontFaceImageUrl`, `setName`, `setCode`, `typeLine`) to `CARD_RESPONSE_SCHEMA` and the optional `nextCursor` property (`type: ['string', 'null']`) to `CARD_LIST_RESPONSE_SCHEMA`. Keep `additionalProperties: false` and the existing `required` lists unchanged. Run `turbo build --filter=@my-binder/core` to confirm consumers pick up the new shape.
- [X] T004 Migrate `apps/mobile/src/services/api/schemas.ts` to consume the canonical schemas: delete the local `Card` type, the local `CardListResponse` type, the local `CARD_SCHEMA`, and the local `CARD_LIST_RESPONSE_SCHEMA`; replace with `export type { Card, CardList as CardListResponse } from '@my-binder/core'` and `export { CARD_RESPONSE_SCHEMA as CARD_SCHEMA, CARD_LIST_RESPONSE_SCHEMA } from '@my-binder/core'` (or update callers to import from core directly and delete the re-exports — choose whichever leaves zero local declarations). Update `apps/mobile/src/services/api/apiClient.ts`, `apps/mobile/src/services/api/queryClient.ts`, and any other call site whose import path changes. Auth-related schemas in the same file (e.g. `GOOGLE_SIGN_IN_RESPONSE_SCHEMA`, `AUTH_USER_SCHEMA`) are out of scope and stay where they are. Depends on T002 + T003.
- [X] T005 [P] Write the failing Jest tests for `useCardsInfiniteQuery` in `apps/mobile/src/hooks/useCardsInfiniteQuery.test.ts` covering: returns the validated `cards` flat list when single-page response; exposes `isLoading`/`isError` flags; the `enabled` gate is keyed off `useSession().status === 'active'`; happy path resolves through `apiClient.getCards`; transient 5xx surfaces as `isError === true`; types resolve to `Card` / `CardList` from `@my-binder/core` (plan Unit Testing Phase row 2). Can be authored in parallel with T002–T004 — runs after T004 to land green.
- [X] T006 [P] Update `apps/mobile/src/app/(authenticated)/(tabs)/_layout.test.tsx` to assert that the binder `<Tabs.Screen>` is rendered with `options.headerShown === false` while the other three tabs (`search`, `scan`, `profile`) keep their existing options unchanged (plan Unit Testing Phase row 5; research §6).
- [X] T007 Implement `apps/mobile/src/hooks/useCardsInfiniteQuery.ts` per contracts/api-client.md §2 — import `Card` and `CardList` from `@my-binder/core`, wrap `apiClient.getCards(pageParam)` with `useInfiniteQuery`, `queryKey: ['cards','list']`, `staleTime: 60_000`, `gcTime: 5*60_000`, `enabled: useSession().status === 'active'`, `getNextPageParam: (last) => last.nextCursor ?? undefined`, full JSDoc with `@example` block (Principle IX). Depends on T004 (re-exports) and T005 (failing test).
- [X] T008 Update `apps/mobile/src/app/(authenticated)/(tabs)/_layout.tsx` to add `headerShown: false` to the binder `<Tabs.Screen options={...}>` only; do not change options on `search`, `scan`, or `profile` (research §6, contracts/binder-home-ui.md §5). Make T006 pass.

**Checkpoint**: Foundation ready — user-story implementation can now begin.

> **Phase completion validation gate (Principle III)**. Run
> `turbo test --filter=@my-binder/mobile` and
> `turbo typecheck --filter=@my-binder/mobile`. Both MUST exit `0` with a
> 100% Jest pass rate. No `.skip` / `.todo` / quarantine / retry-until-green.

---

## Phase 3: User Story 1 — See My Binder Home With Branded Header (Priority: P1) 🎯 MVP

**Goal**: After signing in, the user lands on the Binder tab and sees the wireframe v3
binder-home: deep-crimson header bar (binder mark + "MY-BINDER" overline + italic-serif
"My Binder" + binder-search button + Profile button), paper-cream canvas, summary
caption, rounded binder page surface with three ring perforations, and the
prev/page-indicator/next page navigator visible above the bottom tab bar.

**Independent Test**: Sign in with an account whose collection contains ≥ 7 cards; the
rendered Binder tab matches the wireframe v3 reference (manual scenarios 1 + 3 in
`quickstart.md`).

### Tests for User Story 1 (Jest unit tests REQUIRED) ⚠️

> **NOTE**: Write these tests FIRST — they MUST FAIL before any implementation lands
> (Principle III).

- [X] T009 [P] [US1] Write the initial failing Jest tests for the feature hook in `apps/mobile/src/components/binder-home/useBinderHome.test.ts` covering the US1 surface only: returns the documented shape from contracts/binder-home-ui.md §1 with stable references (Principle X v1.16.0); summary-caption pluralisation per FR-009 (`0 CARDS · 1 PAGE`, `1 CARD · 1 PAGE`, `7 CARDS · 1 PAGE`, `N CARDS · M PAGES`); `isLoading` triggers `summaryCaption === '— CARDS · — PAGE'` (FR-010); `isError` triggers the dashes summary and `isError === true`; `onProfilePress` calls `router.navigate('/profile')` (FR-006); `onRetryPress` calls the underlying refetch.
- [X] T010 [P] [US1] Write the initial failing Jest tests for the view in `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx` covering the US1 surface only: header bar renders the binder icon + `MY-BINDER` overline + italic-serif `My Binder` title + a binder-search button (`accessibilityLabel: "Search the binder"`) + a Profile button (`accessibilityLabel: "Open profile"`) in that order (FR-001 → FR-004); tapping Profile fires `onProfilePress` (FR-006); tapping the binder-search button fires `onSearchOpen` (FR-005); summary caption renders the `summaryCaption` prop verbatim below the header (FR-008, FR-009); the binder page surface is rendered with three ring-perforation marks on its left edge (FR-013); loading state renders dashes caption + 9 empty pockets (FR-010, Edge Cases: loading); network error renders an inline retry affordance with `accessibilityLabel: "Retry loading binder"` that fires `onRetryPress` (Edge Cases: network error).

### Implementation for User Story 1

- [X] T011 [US1] Implement `apps/mobile/src/components/binder-home/useBinderHome.ts` with the **US1 portion** of the contract in contracts/binder-home-ui.md §1: consume `useCardsInfiniteQuery`; expose `cards` (memoised flat list of `data.pages.flatMap(p => p.cards) ?? []`), `isLoading`, `isError`, `onRetryPress` (memoised `useCallback` calling `refetch`); compute `summaryCaption` per data-model §3 (handles 0/1/many cards × 1/many pages plus loading + error dashes); expose `onProfilePress` as `useCallback(() => router.navigate('/profile'))`. Stable references per Principle X v1.16.0 (`useMemo`/`useCallback` with exhaustive deps; whole return wrapped in `useMemo`). Full JSDoc with `@example` (Principle IX). Search-related fields can be temporarily stubbed (`isSearchActive: false`, `searchQuery: ''`, `matchedCards: cards`, `noMatches: false`, `onSearchOpen/Change/Clear` as no-op `useCallback`s) — they are filled in by US3. Pagination fields can be stubbed (`currentPage: 1`, `totalPages: max(1, ceil(cards.length/9))`, handlers as no-op `useCallback`s) — filled in by US2. Make T009 pass.
- [X] T012 [US1] Implement `apps/mobile/src/components/binder-home/BinderHomeView.tsx` with the **US1 portion**: `const BinderHomeView: FC<BinderHomeViewProps> = ({...}) => ...` per the FC declaration rule (constitution v1.14.0); render the deep-crimson header bar (binder icon + masthead overline/title + binder-search button + Profile button on the right) using `Colors`/`Type`/`Spacing`/`Touch` tokens from `@src/constants/theme`; render the paper-cream canvas below; render the summary caption directly below the header; render the rounded binder page surface centred horizontally with three ring perforations along its left edge (FR-011 → FR-013); render the prev/page-indicator/next page-navigator skeleton (visible only — wired in US2); render an inline retry affordance when `isError` is true; render the dashed-caption + 9-empty-pocket placeholder grid when `isLoading` is true. NO imports from `@src/stores/*`, `@src/services/*`, `expo-router`, `Alert`, or `Linking` (Principle X View row + contracts/binder-home-ui.md §2 forbidden imports). Make T010 pass.
- [X] T013 [US1] Implement `apps/mobile/src/components/binder-home/BinderHomeContainer.tsx` exactly as specified in contracts/binder-home-ui.md §3 — `const BinderHomeContainer: FC = () => { const {...} = useBinderHome(); return <BinderHomeView ... /> }`; destructure every named prop, no spread, no local state, no `useEffect`. Export both `default` and named.
- [X] T014 [US1] Rewrite `apps/mobile/src/app/(authenticated)/(tabs)/binder.tsx` from its current stub into the canonical one-line route shell: `const Binder: FC = () => <BinderHomeContainer />; export default Binder;` per contracts/binder-home-ui.md §4.

**Checkpoint**: User Story 1 fully functional and testable independently — header, canvas,
summary caption, rounded binder page surface, ring perforations, and Profile shortcut all
work; the page navigator and 3×3 grid are visible but pagination is not yet wired.

> **Phase completion validation gate (Principle III)**. Run
> `turbo test --filter=@my-binder/mobile` and
> `turbo typecheck --filter=@my-binder/mobile`. Both MUST exit `0` with a
> 100% Jest pass rate. Investigate every failure at root cause.

---

## Phase 4: User Story 2 — Page Through My Collection (Priority: P1)

**Goal**: A user with > 9 cards in their collection sees their first page of 9 cards on
load and can navigate forward/backward through the remaining pages via the prev/next
pill buttons or a horizontal swipe on the binder page. The "Page N / OF M" indicator
updates on each page change. Filled and empty pockets are visually distinct; partial
last pages render only the cards that exist (no phantom cards). Page position survives
backgrounding within the active session and resets to 1 on sign-out.

**Independent Test**: Sign in with an 11-card collection (1 full page + 2); verify page
1 shows 9 filled pockets, swiping left or tapping next reveals page 2 with 2 filled
pockets and 7 empty pockets, the indicator updates from "Page 1 / OF 2" to "Page 2 /
OF 2" (manual scenario 2 in `quickstart.md`).

### Tests for User Story 2 (Jest unit tests REQUIRED) ⚠️

- [X] T015 [P] [US2] Extend `apps/mobile/src/components/binder-home/useBinderHome.test.ts` with the US2 cases: `currentPage` mirrors `binderStore.currentPage`; `totalPages` = `max(1, ceil(cards.length/9))` against the unfiltered set; `onNextPage` calls `binderStore.nextPage(totalPages)` and clamps at `totalPages` (FR-017, FR-020); `onPrevPage` calls `binderStore.prevPage()` and clamps at 1 (FR-018, FR-020); `onPageChange(p)` calls `binderStore.setPage(p, totalPages)`; `currentPage` retains its value across re-renders (background-survival proxy for SC-007). New cases MUST FAIL before T018 lands.
- [X] T016 [P] [US2] Extend `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx` with the US2 cases: when `cards.length === 11`, page 1 renders 9 occupied pockets and page 2 renders 2 occupied pockets + 7 dashed empty pockets (FR-014, FR-015, FR-016, FR-022); `<PagerView initialPage={currentPage - 1} offscreenPageLimit={1}>` is rendered and `onPageSelected` invokes `onPageChange` with the 1-based page; the page-indicator renders "Page N" / "OF M" on two lines (FR-019); the prev button is disabled and is a no-op on `currentPage === 1` (FR-020); the next button is disabled and is a no-op on `currentPage === totalPages` (FR-020); occupied pockets render `<Image>` with the card's `frontFaceImageUrl`; empty pockets render a dashed-outline placeholder distinct from the occupied state (FR-016). New cases MUST FAIL before T019 lands.
- [X] T017 [P] [US2] Extend `apps/mobile/src/hooks/useSignOutMutation.test.tsx` with one new assertion: on successful sign-out, `useBinderStore.getState().reset()` is called BEFORE `queryClient.clear()` so a fresh sign-in opens the binder on page 1 (research §8, contracts/binder-home-ui.md §6, SC-007). MUST FAIL before T020 lands.

### Implementation for User Story 2

- [X] T018 [US2] Extend `apps/mobile/src/components/binder-home/useBinderHome.ts` with the **US2 paging surface**: replace the stubbed pagination block from T011 with the real `useBinderStore` integration (`currentPage`, `nextPage`, `prevPage`, `setPage` selectors); compute `totalPages` from the unfiltered `cards` length via `pageCount` from `@src/utils/pageMath`; expose `onNextPage`/`onPrevPage`/`onPageChange` as memoised `useCallback`s with exhaustive deps that delegate to the store actions and pass the current `totalPages`. Stable references per Principle X v1.16.0. Make T015 pass.
- [X] T019 [US2] Extend `apps/mobile/src/components/binder-home/BinderHomeView.tsx` with the **US2 grid/pager surface**: render a `<PagerView>` (`react-native-pager-view`) of `totalPages` pages with `initialPage={currentPage - 1}`, `offscreenPageLimit={1}`, and `onPageSelected={(e) => onPageChange(e.nativeEvent.position + 1)}` (research §7, plan Constraints); each page slices the active card array (`matchedCards`) into 9 pockets via the `BinderPage` derivation (data-model §2) and renders occupied pockets with `<Image source={{ uri: card.frontFaceImageUrl }}>` from `expo-image` and rounded corners (FR-015), and empty pockets with a dashed-outline placeholder (FR-016, FR-022); render the two-line "Page N" / "OF M" indicator italic-serif top + small-caps bottom (FR-019); wire prev/next pill buttons to `onPrevPage`/`onNextPage`, applying a visibly disabled style on first/last page (FR-020). Make T016 pass.
- [X] T020 [US2] Amend `apps/mobile/src/hooks/useSignOutMutation.ts` `onSuccess` to call `useBinderStore.getState().reset()` immediately before `queryClient.clear()` (research §8, contracts/binder-home-ui.md §6). Make T017 pass.

**Checkpoint**: User Stories 1 + 2 both work — the binder renders the full wireframe and
the user can page through their collection (taps + swipes), the indicator updates, the
prev/next buttons disable correctly at the ends, partial last pages render correctly,
the page position survives backgrounding within the active session, and sign-out resets
the page to 1.

> **Phase completion validation gate (Principle III)**. Run
> `turbo test --filter=@my-binder/mobile` and
> `turbo typecheck --filter=@my-binder/mobile`. Both MUST exit `0` with a
> 100% Jest pass rate.

---

## Phase 5: User Story 3 — Filter My Binder With Search (Priority: P2)

**Goal**: Tapping the binder-search button collapses the masthead inline and expands a
text input that live-filters the user's collection on each keystroke. The match
predicate is "every whitespace-separated token is a case-insensitive substring of the
card's name OR set name OR set code OR card-type line". The summary caption and total
page count recompute against the filtered set; non-matching pockets render as empty
placeholders. A zero-match query renders an inline "no matches in your binder" message.
Clearing the input restores the masthead, the unfiltered binder, and the page the user
was viewing immediately before opening the search input.

**Independent Test**: Sign in with a collection that contains ≥ 1 card per scenario
(name / set / type), tap the binder-search button, type each query in turn, and confirm
the live re-flow + caption recomputation + restore-on-clear behaviour (manual scenarios
4 + 5 in `quickstart.md`).

**Story dependencies**: Logically depends on US1 (header bar exists) and US2 (paging
exists) — search re-flows pages, so paging must work first. The hook contract was
designed in T011 to leave the search-related fields stubbed out; this phase fills them
in.

### Tests for User Story 3 (Jest unit tests REQUIRED) ⚠️

- [X] T021 [P] [US3] Write the failing Jest tests for the filter utility in `apps/mobile/src/utils/binderSearch.test.ts` covering: empty / whitespace-only query returns the input array unchanged (no filter; FR-005a); single-token name match (case-insensitive); single-token `setName` match; single-token `setCode` match; single-token `typeLine` match; multi-token AND across mixed fields ("red creature" matches a Red Creature card; FR-005a all-tokens AND); zero-match input → empty array; cards missing optional `setName`/`setCode`/`typeLine` degrade to name-only matching with no false positives; the haystack lowercase + token lowercase normalisation runs once per input. Target 100% lines/branches per plan §Coverage target.
- [X] T022 [P] [US3] Extend `apps/mobile/src/components/binder-home/useBinderHome.test.ts` with the US3 cases: `onSearchOpen()` sets `isSearchActive=true`, `searchQuery=''`, captures `binderStore.currentPage` into `preSearchPage`, and resets `currentPage` to 1 of the unfiltered set (FR-005); `onSearchChange(text)` updates `searchQuery`, `matchedCards` recomputes via `binderSearch`, `totalPages` recomputes against the filtered set, `currentPage` resets to 1 of the filtered set (FR-005a, FR-005e); zero-match query yields `matchedCards.length === 0`, `totalPages === 1`, `noMatches === true`, `summaryCaption === '0 CARDS · 1 PAGE'` (FR-005d); `onSearchClear()` resets `searchQuery=''`, `isSearchActive=false`, restores `binderStore.currentPage` to `preSearchPage` against the unfiltered totalPages (FR-005c, FR-005f); whitespace-only `searchQuery` is treated as inactive — `matchedCards` equals `cards`, `noMatches === false`. New cases MUST FAIL before T025 lands.
- [X] T023 [P] [US3] Extend `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx` with the US3 cases: when `isSearchActive === true`, the masthead text is replaced inline by a `<TextInput>` (`accessibilityLabel: "Search this binder"`) and a clear/cancel control (`accessibilityLabel: "Clear search"`), with the cream canvas + summary caption + binder page still visible behind (FR-005, US3 ac. #1); typing in the input fires `onSearchChange(text)`; tapping the cancel control fires `onSearchClear()` (FR-005f); when `noMatches === true`, an inline "no matches in your binder" message is rendered inside the binder page surface in place of the grid (FR-005d, US3 ac. #5); when `isSearchActive === true` AND `searchQuery.trim().length > 0`, an active-state visual indicator is present on the search affordance (FR-005b, US3 ac. #7). New cases MUST FAIL before T026 lands.

### Implementation for User Story 3

- [X] T024 [US3] Implement `apps/mobile/src/utils/binderSearch.ts` as the pure token-AND filter — exported as `binderSearch(cards: ReadonlyArray<Card>, query: string): ReadonlyArray<Card>` per research §4 (the `Card` type is imported from `@my-binder/core`): trim and split on `/\s+/`; if zero tokens, return the input array unchanged; lowercase each token; for each card build a single lowercased haystack `name + " " + (setName ?? "") + " " + (setCode ?? "") + " " + (typeLine ?? "")`; return cards where every token is a substring of the haystack. Full JSDoc with `@example` block (Principle IX). Make T021 pass at 100% coverage.
- [X] T025 [US3] Extend `apps/mobile/src/components/binder-home/useBinderHome.ts` with the **US3 search surface**: replace the stubbed search block from T011 with `useState<{ isSearchActive: boolean; searchQuery: string; preSearchPage: number }>` (data-model §4); compute `matchedCards` as `useMemo(() => binderSearch(cards, searchQuery), [cards, searchQuery])`; recompute `totalPages` against `matchedCards.length`; recompute `summaryCaption` against the filtered count + page count (data-model §3); expose `onSearchOpen` (`useCallback` setting `isSearchActive=true, searchQuery='', preSearchPage = binderStore.currentPage` and calling `binderStore.setPage(1, totalPages)`); `onSearchChange(text)` (`useCallback` setting `searchQuery=text` and `binderStore.setPage(1, totalPagesForFilter(text))`); `onSearchClear` (`useCallback` setting `isSearchActive=false, searchQuery=''` and calling `binderStore.setPage(preSearchPage, totalPagesForFullCollection)`); compute `noMatches = isSearchActive && searchQuery.trim().length > 0 && matchedCards.length === 0`. Stable references per Principle X v1.16.0. Make T022 pass.
- [X] T026 [US3] Extend `apps/mobile/src/components/binder-home/BinderHomeView.tsx` with the **US3 inline-search surface**: when `isSearchActive` is true, replace the masthead inside the same crimson header bar with a `<TextInput value={searchQuery} onChangeText={onSearchChange} accessibilityLabel="Search this binder" autoFocus>` and a clear/cancel control on the right (`accessibilityLabel: "Clear search"` → `onSearchClear`) per FR-005; when `noMatches` is true, render the inline "no matches in your binder" message inside the binder page surface in place of the 3×3 grid (FR-005d); render an active-state visual indicator on the search affordance when the query is active (FR-005b). The cream canvas, summary caption, and binder page MUST remain visible behind the inline input. Make T023 pass.

**Checkpoint**: All three user stories independently functional. The binder home renders
the wireframe, the user can page through their collection, and they can live-filter the
binder by name + set + type with zero-match handling and prior-page restore-on-clear.

> **Phase completion validation gate (Principle III)**. Run
> `turbo test` and `turbo typecheck` across **every** workspace touched by
> US1 + US2 + US3 (just `@my-binder/mobile` for this feature). Both MUST exit
> `0` with a 100% Jest pass rate. Investigate every failure at root cause.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation against the spec's success criteria and the design tokens
inventory. No new feature work in this phase.

- [X] T027 [P] Verify constitution Principle X compliance across the new feature directory: `BinderHomeContainer` is a one-line shell with destructured named props (no spread, no state, no `useEffect`); `BinderHomeView` imports nothing from `@src/stores/*`, `@src/services/*`, `expo-router`, `Alert`, or `Linking` (contracts/binder-home-ui.md §2 forbidden-imports list); every function returned by `useBinderHome` is a `useCallback` with exhaustive deps and every non-primitive return is a `useMemo` (v1.16.0). Files audited: `apps/mobile/src/components/binder-home/{BinderHomeContainer.tsx,BinderHomeView.tsx,useBinderHome.ts}`.
- [X] T028 [P] Verify constitution Principle IX compliance across the new files: full JSDoc with `@example` blocks on `apps/mobile/src/utils/binderSearch.ts`, `apps/mobile/src/hooks/useCardsInfiniteQuery.ts`, and `apps/mobile/src/components/binder-home/useBinderHome.ts`; no `index.ts` aggregation files added to `apps/mobile/src/components/binder-home/`.
- [X] T029 [P] Verify all literals in the new code are imported from named constants — no magic numbers/strings: 9 must come from `SLOTS_PER_BINDER_PAGE` (or equivalent named constant in `apps/mobile/src/utils/pageMath.ts`); colours from `Colors`, fonts from `Type`, paddings from `Spacing`, radii from `Radius`, motion durations from `Motion`, touch targets from `Touch` (all in `apps/mobile/src/constants/theme.ts`). Files audited: `apps/mobile/src/components/binder-home/BinderHomeView.tsx`, `apps/mobile/src/components/binder-home/useBinderHome.ts`, `apps/mobile/src/utils/binderSearch.ts`.
- [X] T030 [P] Schema-of-record audit: confirm zero `Card` / `CardList` / `CARD_SCHEMA` / `CARD_LIST_RESPONSE_SCHEMA` declarations remain outside `packages/core` after this feature lands. Run `grep -rE "^\s*(export\s+)?(const|type|interface)\s+(Card|CardList|CardListResponse|CARD_SCHEMA|CARD_RESPONSE_SCHEMA|CARD_LIST_RESPONSE_SCHEMA)\b" apps/mobile/src apps/server/src` from the repo root and verify the only matches are pure re-exports (`export type { Card } from '@my-binder/core'`-style lines in `apps/mobile/src/services/api/schemas.ts`, if those re-exports were kept). Any non-re-export hit is a regression of the schema-of-record rule and MUST be fixed before this checkpoint passes.
- [X] T031 Run the full repo gate from the repo root: `turbo test` AND `turbo typecheck` MUST both exit `0`. Coverage thresholds (80% global) MUST hold per `apps/mobile/jest.config.ts`. `apps/mobile/src/utils/binderSearch.ts` MUST hit 100% lines/branches per plan §Coverage target.
- [X] T032 Walk through `specs/016-binder-home-view/quickstart.md` §3 manual scenarios 1–7 against a local simulator/emulator with a seeded test collection and confirm every spec acceptance scenario in `specs/016-binder-home-view/spec.md` US1 + US2 + US3 plus the Edge Cases section renders as written. Record any deviation as a new task — do NOT silently fix.
- [X] T033 [P] Confirm `pnpm-lock.yaml` is unchanged from the start of this feature (`git diff --stat pnpm-lock.yaml` is empty). Principle XI / plan §Dependency Currency states this feature adds zero new packages.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup; **BLOCKS** all user-story phases.
- **User Story 1 (Phase 3, P1)**: depends on Foundational; no dependency on US2/US3.
- **User Story 2 (Phase 4, P1)**: depends on Foundational AND US1 (the hook + view +
  container files are introduced in US1; US2 extends them).
- **User Story 3 (Phase 5, P2)**: depends on Foundational AND US1 AND US2 (the search
  surface is added on top of the live header + paging).
- **Polish (Phase 6)**: depends on US1 + US2 + US3.

### Within-Phase Dependencies

- **Within Phase 2**: T002 (core type extension) and T003 (core schema extension) run
  in parallel (different files in `packages/core`). T004 (mobile re-export migration)
  requires T002 + T003 because it consumes the canonical declarations. T005 (hook test)
  and T006 (layout test) can be authored in parallel — T005 lands green only after T004
  + T007. T007 (hook impl) requires T004 + T005. T008 (layout impl) requires T006.
- **Within Phase 3 (US1)**: T009 + T010 can run in parallel. T011 requires T009. T012
  requires T010. T013 requires T011 + T012. T014 requires T013.
- **Within Phase 4 (US2)**: T015 + T016 + T017 can run in parallel. T018 requires T015.
  T019 requires T016. T020 requires T017.
- **Within Phase 5 (US3)**: T021 + T022 + T023 can run in parallel. T024 requires T021.
  T025 requires T022 + T024. T026 requires T023.
- **Within Phase 6**: T027 + T028 + T029 + T030 + T033 can run in parallel. T031 + T032
  are sequential at the end.

### Parallel Opportunities

- Phase 2 cleanly forks: T002 + T003 (core changes) || T005 + T006 (test authoring).
- All `[P]` test-writing tasks within US1 (T009, T010).
- All `[P]` test-writing tasks within US2 (T015, T016, T017).
- All `[P]` test-writing tasks within US3 (T021, T022, T023).
- All `[P]` audit tasks within Polish (T027, T028, T029, T030, T033).

---

## Parallel Example: User Story 2 tests

```bash
# Three independent test files — write them concurrently before any US2 implementation
Task: "Extend apps/mobile/src/components/binder-home/useBinderHome.test.ts with US2 paging cases (T015)"
Task: "Extend apps/mobile/src/components/binder-home/BinderHomeView.test.tsx with US2 grid + indicator + button-state cases (T016)"
Task: "Extend apps/mobile/src/hooks/useSignOutMutation.test.tsx with the binderStore.reset assertion (T017)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (T009–T014)
4. **STOP + VALIDATE**: run the Phase 3 gate, then walk through `quickstart.md`
   scenarios 1 + 3 with a live simulator. The Binder tab renders the wireframe + the
   Profile shortcut works.
5. Demo / merge as MVP.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. + US1 → demo the branded binder home (header, canvas, page navigator skeleton).
3. + US2 → demo paging through a multi-page collection with prev/next + swipe + page
   memory across backgrounding + sign-out reset.
4. + US3 → demo live filter + zero-match handling + restore-on-clear.
5. Polish → run the full gate and the quickstart, then ship.

### Single-Developer Strategy (most likely)

Sequential P1 → P1 → P2 in priority order: T001 → T002–T008 (Foundational, including
the `packages/core` schema move + mobile re-export migration) → T009–T014 (US1) →
T015–T020 (US2) → T021–T026 (US3) → T027–T033 (Polish). Parallel `[P]` tasks within a
phase are still worth doing concurrently — the test-writing tasks for the same story
are usually safe to author in one editor session before any implementation lands.

---

## Notes

- `[P]` tasks touch different files and have no dependency on incomplete tasks.
- `[Story]` labels appear only on tasks inside a user-story phase (Phase 3+) for
  traceability — Setup, Foundational, and Polish tasks have no story label.
- Tests MUST be written and FAIL before the corresponding implementation lands
  (Principle III). `.skip` / `.todo` / quarantine / retry-until-green are prohibited.
- Commit after each task or logical group; the constitution requires
  test-then-implementation pairing within a single PR or branch increment.
- Every checkpoint is gated on `turbo test` + `turbo typecheck` exiting `0` with a
  100% Jest pass rate across the affected workspaces. Investigate every failure at
  root cause (bleeding state, leaky async, fixture ordering, regression).
- Avoid: vague tasks, same-file conflicts marked as `[P]`, and cross-story dependencies
  that break independence.
