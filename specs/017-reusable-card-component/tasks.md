---

description: "Task list for feature 017 — Reusable Card Component"
---

# Tasks: Reusable Card Component (feature 017)

**Input**: Design documents from `/specs/017-reusable-card-component/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Tests**: Per Constitution Principle III, **unit tests are REQUIRED** for every
file added or modified in this feature, written with **Jest** and co-located as
`<filename>.test.ts(x)` beside the file under test. No contract or integration
test suites are added — every behaviour is reachable through co-located unit
tests on the new mobile component, the new hook, the updated `apiClient`, the
updated server routes, and the updated server service.

**Organization**: Tasks are grouped by user story (US1 → US3) so each story can
be implemented, run, and validated independently. Cross-cutting setup
(schema/type drops, helper exports, theme rollover) lives in Phase 1 / 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1, US2, US3) for user-story-phase tasks only
- Each task carries an exact file path

## Path Conventions

This feature is a **mobile feature with a small server + core tightening**.
Three workspaces are touched (`packages/core`, `apps/server`, `apps/mobile`).
All paths in this file are **repository-rooted absolute** within the monorepo.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Drop the now-phantom `frontFaceImageUrl` from the wire contract and
export the existing retry helpers so the new mobile hook can reuse them
without re-implementation. These tightenings are blocking prerequisites for
US1 and have no dependency on any user-story work.

- [X] T001 [P] Drop `frontFaceImageUrl?: string` from the `Card` interface in `packages/core/src/types/crud.ts` (per data-model.md "Modifications to existing types / schemas" diff); preserve the surrounding `setName?`, `setCode?`, `typeLine?` fields and update the JSDoc block that mentions `frontFaceImageUrl`.
- [X] T002 [P] Drop the `frontFaceImageUrl` entry from the `properties` block of `CARD_RESPONSE_SCHEMA` in `packages/core/src/schemas/card.ts` (also drop its accompanying comment); leave `CARD_IMAGES_RESPONSE_SCHEMA` and every other schema untouched.
- [X] T003 [P] Export `isFourXX` and `computeRetryDelay` from `apps/mobile/src/services/api/queryClient.ts` as named exports (currently file-private per research.md R1); do not change their behaviour. Reuse target is `useCardImagesQuery` in Phase 3.
- [X] T004 Run `pnpm --filter @my-binder/core build` and `pnpm --filter @my-binder/core typecheck` to confirm the core type/schema drop compiles cleanly before any consumer reads the new shape.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the server-side schema-tightening end-to-end (service +
route + tests) so that every downstream user story sees a wire contract that
matches the new `Card` type from Phase 1. Also add the new `apiClient`
method that the mobile hook in US1 will call. Nothing US1/US2/US3 can pass
until this phase is green.

**⚠️ CRITICAL**: No user story work can begin until Phase 2 is complete and
its validation gate (below) passes.

- [X] T005 [P] Delete the `scryfallNormalImageUrl` helper at the top of `apps/server/src/services/cardService.ts` (orphaned once `enrichCard` stops calling it — see data-model.md "`scryfallNormalImageUrl` helper — delete"). Image URL construction stays in `apps/server/src/providers/mtgjson/scryfallImages.ts:buildScryfallImageUrls` (unchanged).
- [X] T006 Drop the `frontFaceImageUrl` computation from `enrichCard` in `apps/server/src/services/cardService.ts` per the diff in data-model.md (keep `setCode`, `setName`, `typeLine` enrichment intact). Depends on T005.
- [X] T007 [P] Update `apps/server/src/services/cardService.test.ts` — remove the four `frontFaceImageUrl` assertion blocks at lines 142–189; keep the `describe('getCardImagesById')` block at line 299 unchanged. After this edit, every surviving assertion in the file must still pass against the post-T006 service.
- [X] T008 [P] Update `apps/server/src/routes/cards.test.ts` — at lines 137–153, rename the test "returns 200 with enriched setCode and frontFaceImageUrl" to "returns 200 with enriched setCode without frontFaceImageUrl" and invert the assertion to `expect(body.frontFaceImageUrl).toBeUndefined()`. The `GET /cards/images/:id` block at lines 205–239 must remain unchanged.
- [X] T009 Add `getCardImages(id: string): Promise<CardImages>` to `apps/mobile/src/services/api/apiClient.ts` per the contract in contracts/api.md §4 ("Mobile client contract"): GET `/cards/images/${encodeURIComponent(id)}`, throw `ApiError.fromResponse` on non-ok, validate the parsed JSON against the compiled `validateCardImages` Ajv validator (re-exported from `apps/mobile/src/services/api/schemas.ts`), throw `new ApiError('SCHEMA_MISMATCH', ..., 502)` if validation fails, otherwise return the parsed `CardImages`. Type import comes from `@my-binder/core`.
- [X] T010 Extend `apps/mobile/src/services/api/apiClient.test.ts` with three new test cases for `getCardImages`: (a) 200 returns the parsed `CardImages` object, (b) 404 throws `ApiError` with `kind === 'CARD_NOT_FOUND'`, (c) 503 throws `ApiError` with `kind === 'PROVIDER_UNAVAILABLE'`. Use the existing `fetch`-mock pattern at the top of the file; do not introduce a new mock module.

**Checkpoint**: Foundation ready — user story implementation can now begin.

> **Phase completion validation gate (Constitution Principle III).** Run
> `turbo test --filter=@my-binder/core --filter=@my-binder/server --filter=@my-binder/mobile`
> and `turbo typecheck --filter=@my-binder/core --filter=@my-binder/server --filter=@my-binder/mobile`.
> **Both MUST exit 0 and the Jest suite MUST report a 100% pass rate.** Any
> failing test MUST be investigated at root cause (bleeding state, leaky
> async, fixture ordering, regression, real defect) and fixed in-place
> before the checkpoint passes. `.skip` / `.todo` / quarantine /
> retry-until-green are prohibited.

---

## Phase 3: User Story 1 — Card image self-loads inside the dashed-border frame (Priority: P1) 🎯 MVP

**Goal**: A single `<Card id="..." footprint="pocket" />` element, dropped into
the binder home view, paints a dashed-border-skeleton frame on first frame and
swaps to the rendered image when `/cards/images/:id` resolves — with zero
layout shift in the 3×3 grid. Every spec 016 behavioural test on
`BinderHomeView` continues to pass without modification of the assertions
(SC-006).

**Independent Test**: Open the binder home view on a fresh session (no warm
image cache). Confirm that every visible slot shows the dashed-border frame
+ skeleton within the first paint, that each slot independently swaps to the
rendered card image as its per-card request resolves, and that the
surrounding grid does not reflow. Run `pnpm --filter @my-binder/mobile test`
— `BinderHomeView.test.tsx` SC-006 assertions still pass.

### Tests for User Story 1 (Jest unit tests REQUIRED — write FIRST, ensure they FAIL before implementation)

- [X] T011 [P] [US1] Co-located test for the new TanStack hook in `apps/mobile/src/hooks/useCardImagesQuery.test.ts` — happy path returns parsed `CardImages` (FR-003); same id renders to two component instances dedupe to one request (FR-007); unmount mid-fetch is cancellation-safe with no warning logged (FR-013); id-prop change discards in-flight and re-keys the query (FR-012). Wrap each `it` block in a fresh `QueryClient({ defaultOptions: { queries: { retry: false } } })` + `QueryClientProvider` (research.md R2); reuse the mock pattern from the existing `apps/mobile/src/hooks/useCardsInfiniteQuery.test.ts`.
- [X] T012 [P] [US1] Co-located test for the hook layer in `apps/mobile/src/components/card/useCard.test.ts` — covers: derives discriminated `loading | loaded | notFound | error` view-state from `useCardImagesQuery` output; picks `images.medium` for `footprint='pocket'` and `images.large` for `footprint='detail'` (FR-009, research.md R5); identity-stable return object across re-renders with identical inputs (constitution v1.16.0 Hook return-value memoisation rule).
- [X] T013 [P] [US1] Co-located test for the pure view layer in `apps/mobile/src/components/card/CardView.test.tsx` — declare `CardViewWithDefaults: FC<Partial<CardViewProps>>` at module scope (v1.24.0 rule, canonical reference `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx`); call `render(...)` only inside `it(...)` blocks; cover the loading state (`testID="card-loading"`, FR-002, US1-AS1) and the loaded state (`testID="card-loaded"` + `expo-image` source url, FR-004, US1-AS2); assert outer dimensions are identical across the loading and loaded states (FR-011, SC-004); assert that loaded-at-`footprint='pocket'` ALSO emits `testID="pocket-occupied"` (SC-006 backward compat, research.md R6).
- [X] T014 [P] [US1] Co-located test for the container wiring in `apps/mobile/src/components/card/CardContainer.test.tsx` — passes `id` + `footprint` props through to `useCard`, threads the resulting `CardViewProps` into `<CardView />`, and verifies that the container itself owns no view state (Principle X four-layer rule). Use `react-test-renderer`'s `act` + a `useCard` mock or a `QueryClientProvider` with seeded data — match whichever pattern the existing `apps/mobile/src/components/binder-home/BinderHomeContainer.test.tsx` uses, if present, otherwise the in-line mock pattern from `LoginContainer.test.tsx`.

### Implementation for User Story 1

- [X] T015 [P] [US1] Add `apps/mobile/src/components/card/types.ts` declaring `CardFootprint = 'pocket' | 'detail'`, `CardViewState = { kind: 'loading' } | { kind: 'loaded'; imageUrl: string } | { kind: 'notFound' } | { kind: 'error'; onRetry: () => void }`, and `CardViewProps = { state: CardViewState; footprint: CardFootprint }` per data-model.md "Entities — Card view state / Card view props". These types are mobile-only (do not cross the wire) — do NOT add them to `@my-binder/core`.
- [X] T016 [US1] Implement the new `apps/mobile/src/hooks/useCardImagesQuery.ts`: thin `useQuery` wrapper with `queryKey: ['cards', 'images', id]`, `queryFn: () => apiClient.getCardImages(id)`, per-query `retry: shouldRetry` where `shouldRetry(failureCount, error) = failureCount < 5 && !isFourXX(error)` (RETRY_BUDGET = 5 per FR-006, research.md R1), `retryDelay: computeRetryDelay`, `enabled: status === 'active' && Boolean(id)`, and JSDoc that records the deliberate "5 vs. project default 3" deviation per the Complexity Tracking note in plan.md. Re-uses the `isFourXX` and `computeRetryDelay` exports added in T003. Depends on T003, T009, T011.
- [X] T017 [P] [US1] Add `apps/mobile/src/components/card/CardView.theme.ts` — `useStyles` hook that returns the StyleSheet for the dashed border, the skeleton frame, the `expo-image` `style`, and the not-found/error fallback rows. Lift the dashed-border tokens (border width, dash pattern, border radius, inner padding) from `apps/mobile/src/components/binder-home/BinderHomeView.theme.ts`'s `pocket`/`pocketEmpty` rules and put `BinderHomeView.theme.ts` on a pass-through that re-uses these card-level tokens (research.md R7). Both footprints share the same dashed-border styling, only the outer aspect ratio differs.
- [X] T018 [US1] Implement `apps/mobile/src/components/card/CardView.tsx` [pure-view, dashed-border, animated skeleton, fallback states] — function component that renders a `<View>` with the dashed-border style from T017 and switches on `props.state.kind`:
  - `'loading'` → animated skeleton fill inside the frame; emit `testID="card-loading"`.
  - `'loaded'` → `<Image source={{ uri: state.imageUrl }} />` from `expo-image`; emit `testID="card-loaded"` and (when `props.footprint === 'pocket'`) ALSO emit `testID="pocket-occupied"` (research.md R6 — SC-006 backward compat).
  - `'notFound'` → small Ionicons "help-circle-outline" glyph + "Card not found" caption; emit `testID="card-not-found"`.
  - `'error'` → small Ionicons "warning-outline" glyph + "Couldn't load" caption + `<Pressable onPress={state.onRetry}>Retry</Pressable>`; emit `testID="card-error"` on the outer view and `testID="card-retry"` on the pressable.
  Use a single `Animated.Value` interpolated 0.6 → 1.0 → 0.6 on a 1.2s loop for the skeleton pulse (research.md R7 — no new dependency). Depends on T015, T017.
- [X] T019 [US1] Implement `apps/mobile/src/components/card/useCard.ts` — `(id: string, footprint: CardFootprint) => CardViewProps`. Calls `useCardImagesQuery(id)` from T016 and derives the discriminated `CardViewState` from `{ isPending, isError, data, error, refetch }`. Picks `data.medium` for `footprint === 'pocket'` and `data.large` for `footprint === 'detail'` (research.md R5 — `variantForFootprint`). Maps an `ApiError` with `kind === 'CARD_NOT_FOUND'` to `{ kind: 'notFound' }` (FR-005), any other error after retries to `{ kind: 'error', onRetry: refetch }` (FR-006), pending to `{ kind: 'loading' }`, and a populated `data` to `{ kind: 'loaded', imageUrl }`. Memoise the returned object with `useMemo` and the `onRetry` callback with `useCallback` per constitution v1.16.0. Depends on T015, T016.
- [X] T020 [US1] Implement `apps/mobile/src/components/card/CardContainer.tsx` — function component that takes `{ id, footprint }`, calls `useCard(id, footprint)`, and renders `<CardView {...viewProps} />`. The container owns no `useState` / no `useEffect`; all state lives in `useCard` (Principle X four-layer rule). Depends on T018, T019.
- [X] T021 [US1] Add `apps/mobile/src/components/card/index.ts` — pure barrel re-export: `export { default as Card } from './CardContainer';` and `export type { CardFootprint, CardViewProps } from './types';` (Principle IX — no declarations in barrel). Depends on T020, T015.
- [X] T022 [US1] Update `apps/mobile/src/components/binder-home/BinderHomeView.tsx` — replace the inline occupied-pocket `<Image>` markup with `<Card id={card.id} footprint="pocket" />` (imported from `@src/components/card`). Keep the empty-pocket branch (`<View testID="pocket-empty" />`) and the page-level loading ring (`testID="binder-page-ring"`) unchanged. Drop any remaining reference to `card.frontFaceImageUrl` from the file. Depends on T021.
- [X] T023 [US1] Update `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx` — strip `frontFaceImageUrl` from the `makeCard()` factory (no longer on `Card` post-T001). Wrap the test render in a `QueryClientProvider` + fresh `QueryClient` per `it` (mirroring research.md R2 / quickstart.md "Testing your consumer"); pre-seed images for the test cards via `queryClient.setQueryData(['cards','images', id], { small, medium, large })` so embedded `<Card />` instances resolve to the loaded state without a real network call. The SC-006 assertions (`screen.getAllByTestId('pocket-occupied').length === 9`, `pocket-empty`, `binder-page-ring`) must remain bit-identical. Depends on T022.

**Checkpoint**: User Story 1 fully functional and testable independently — the
binder home view renders the new `<Card />` for every occupied slot, each
slot self-loads its image through `/cards/images/:id`, the dashed-border-
skeleton interstitial is visible on cold cache, and SC-006 holds.

> **Phase completion validation gate (Constitution Principle III).** Run
> `turbo test --filter=@my-binder/mobile` and
> `turbo typecheck --filter=@my-binder/mobile`. **Both MUST exit 0 and
> Jest MUST report a 100% pass rate.** Investigate every failure at root
> cause before moving to US2.

---

## Phase 4: User Story 2 — Warm-cache renders feel instant (Priority: P2)

**Goal**: A card viewed earlier in the same session, revisited on another
screen (or re-rendered in two slots on one screen), paints from the
in-memory TanStack cache on its first paint — no skeleton interstitial,
exactly one outgoing request per unique id.

**Independent Test**: Render a screen that displays card X, wait for the
image to load, navigate away, navigate back. Assert that the second mount
shows `testID="card-loaded"` on its first paint (no `card-loading` ever
appears for that id). Separately, render two `<Card id={X} ... />` instances
on the same screen and assert exactly one `apiClient.getCardImages` call is
issued.

### Tests for User Story 2 (Jest unit tests REQUIRED — write FIRST, ensure they FAIL before implementation)

- [X] T024 [P] [US2] Extend `apps/mobile/src/hooks/useCardImagesQuery.test.ts` with two warm-cache cases: (a) the same `id` queried twice in the same `QueryClient` fires `fetch` exactly once (FR-007 — request deduplication via shared queryKey); (b) a query pre-seeded via `queryClient.setQueryData(['cards', 'images', id], images)` resolves to `data` on the very first hook call without entering an `isPending` state (FR-008 — within-session warm-cache hit). Use a fresh `QueryClient` per `it` block per research.md R2.
- [X] T025 [P] [US2] Extend `apps/mobile/src/components/card/CardView.test.tsx` with one assertion: when the `state` prop is `{ kind: 'loaded', imageUrl }` on first render (i.e., the warm-cache path), the rendered tree contains `testID="card-loaded"` **and never** `testID="card-loading"` — even within the same render pass (no skeleton flash).

### Implementation for User Story 2

- [X] T026 [US2] No production code change is required for US2 — the warm-cache behaviour falls out of `useCardImagesQuery`'s use of the singleton `queryClient` from `apps/mobile/src/services/api/queryClient.ts` (research.md R2) and the deterministic `['cards','images', id]` queryKey set in T016. This task records that confirmation in the JSDoc of `useCardImagesQuery.ts`: add a single sentence noting "FR-007 (dedup) and FR-008 (warm-cache) are inherited from the shared queryClient — no additional logic." Depends on T016.

**Checkpoint**: User Story 2 verified — same-session revisits and duplicate
slots resolve from cache; only the test surface grew.

> **Phase completion validation gate (Constitution Principle III).** Run
> `turbo test --filter=@my-binder/mobile` and
> `turbo typecheck --filter=@my-binder/mobile`. **Both MUST exit 0 and
> Jest MUST report a 100% pass rate.** Investigate every failure at root
> cause before moving to US3.

---

## Phase 5: User Story 3 — Broken or missing card image fails gracefully (Priority: P3)

**Goal**: Any card whose image cannot be retrieved — 404 from the server
or 5xx/network after the 5-attempt budget is exhausted — exits the
skeleton state and surfaces a distinct fallback inside the same dashed-
border frame. The user can tap "Retry" on the error fallback to start a
fresh request, and the 5-attempt cycle re-arms.

**Independent Test**: (a) Render `<Card id="<known-bad>" footprint="pocket" />`
with a server that returns 404; assert the slot reaches
`testID="card-not-found"` immediately (no retry burst). (b) Render the
same with a server that returns 503; assert exactly 5 outgoing requests
issue with delays 1s → 2s → 4s → 8s → 16s before the slot reaches
`testID="card-error"` with a `card-retry` button. (c) Tap retry; assert a
fresh `getCardImages` call issues.

### Tests for User Story 3 (Jest unit tests REQUIRED — write FIRST, ensure they FAIL before implementation)

- [X] T027 [P] [US3] Extend `apps/mobile/src/hooks/useCardImagesQuery.test.ts` with three cases: (a) a 404 `ApiError` surfaces immediately, `failureCount === 1`, no further retries (FR-005, FR-006 4xx skip-retry); (b) a 503 `ApiError` retries exactly 4 more times (5 total attempts) with delays matching `computeRetryDelay` output (1s → 2s → 4s → 8s → 16s, capped at 30s) before surfacing the error to the consumer (FR-006); (c) after exhaustion, calling `refetch()` issues a fresh attempt cycle and resets the failure counter (spec edge case "Repeated retries"). Use `jest.useFakeTimers()` to drive the back-off schedule deterministically.
- [X] T028 [P] [US3] Extend `apps/mobile/src/components/card/useCard.test.ts` with two cases: (a) `ApiError({ kind: 'CARD_NOT_FOUND' })` from `useCardImagesQuery` maps to `{ kind: 'notFound' }` view-state (FR-005); (b) `ApiError({ kind: 'PROVIDER_UNAVAILABLE' })` after the retry budget exhausts maps to `{ kind: 'error', onRetry }` where invoking `onRetry()` triggers a `refetch` on the underlying query and reference-equality of the `onRetry` function across re-renders holds while inputs are unchanged (constitution v1.16.0).
- [X] T029 [P] [US3] Extend `apps/mobile/src/components/card/CardView.test.tsx` with two cases: (a) the `{ kind: 'notFound' }` state renders `testID="card-not-found"` inside the same dashed-border outer frame as the loading state (FR-011 — identical outer dimensions); (b) the `{ kind: 'error', onRetry }` state renders `testID="card-error"`, a tappable `testID="card-retry"` that invokes the passed `onRetry` once per tap (FR-006), and the outer dimensions match the loading state (FR-011, SC-004).

### Implementation for User Story 3

- [X] T030 [US3] All error-surface code paths are already produced by T016 (`useCardImagesQuery` 4xx/5xx handling), T018 (`CardView` `'notFound'` and `'error'` branches), and T019 (`useCard` state derivation). This task is the integration-pass: re-run the US3 test file from T027/T028/T029 against the implementation, and patch any mismatch between the `ApiError.kind` discriminant the server actually returns and the kind `useCard` maps on. **Do not** introduce new error kinds — if a mismatch surfaces, fix the mapping in `apps/mobile/src/components/card/useCard.ts` or the `ApiError.fromResponse` path in `apps/mobile/src/services/api/ApiError.ts`, whichever already owns the taxonomy. Depends on T016, T018, T019, T027, T028, T029.

**Checkpoint**: All three user stories independently functional. 404 surfaces
instantly, 5xx/network exhausts the 5-attempt budget then surfaces a retry
affordance, retries re-arm cleanly, and every state shares the dashed-border
outer frame.

> **Phase completion validation gate (Constitution Principle III).** Run
> `turbo test` and `turbo typecheck` across **every** workspace touched by
> US1+US2+US3 (`@my-binder/core`, `@my-binder/server`, `@my-binder/mobile`).
> **Both MUST exit 0 and Jest MUST report a 100% pass rate.** Investigate
> every failure at root cause before the Polish phase begins.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Coverage uplift to the per-feature 90% floor for the new card
slice + hook, quickstart validation, and a small documentation pass on the
swagger doc string that mentions `frontFaceImageUrl` (if any).

- [X] T031 [P] Add the per-feature coverage threshold block to `apps/mobile/jest.config.ts` per plan.md "Coverage target" — bump `apps/mobile/src/components/card/**/*.{ts,tsx}` and `apps/mobile/src/hooks/useCardImagesQuery.ts` to `branches/functions/lines/statements: 90`; keep the project `global` floor at 80. Re-run `pnpm --filter @my-binder/mobile test -- --coverage` and confirm the new files meet the 90% threshold; backfill any uncovered branches inside the existing test files (T011/T012/T013/T014/T024/T027/T028/T029) — do not add new test files.
- [X] T032 [P] Grep `apps/server/src/` for any remaining lexical reference to `frontFaceImageUrl` (route OpenAPI annotations, JSDoc, swagger description blocks in `apps/server/src/routes/cards.ts` / `apps/server/src/routes/docs.ts`) and remove each occurrence; the field is no longer part of the wire contract. Re-run `pnpm --filter @my-binder/server typecheck` to confirm no dead references remain.
- [X] T033 [P] Grep `apps/mobile/src/` for any remaining lexical reference to `card.frontFaceImageUrl` outside the test scaffolding and remove it. Common drop points: any helper that constructed a fallback `<Image />` URL.
- [ ] T034 (MANUAL — requires device/simulator; not executed by /speckit.implement) Run the quickstart walkthrough end-to-end on a development device or simulator: cold-launch the app, navigate to the binder home view, observe every visible slot transition from `card-loading` → `card-loaded` without a layout shift; revisit a previously-loaded page within the same session, observe instant `card-loaded` on first paint (no skeleton). Force a 404 (e.g., temporarily edit a test card row to use a fake UUID in dev) and observe `card-not-found`. Force a 503 (e.g., point the dev `apiClient` baseUrl at a closed port) and observe 5 retries followed by `card-error` + tap-to-retry. Roll back the dev tweaks afterwards. This is the manual SC-002 / SC-003 / SC-004 / SC-005 / SC-006 confirmation.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup, T001–T004)**: no dependencies — start immediately.
- **Phase 2 (Foundational, T005–T010)**: depends on Phase 1 completion (T001 wires the type used by T009; T002 underpins T007/T008 assertions; T003 is a hard prerequisite for T016). **Blocks all user stories.**
- **Phase 3 (US1)**: depends on Phase 2 completion. MVP.
- **Phase 4 (US2)**: depends on Phase 3 completion (US2 reuses T016).
- **Phase 5 (US3)**: depends on Phase 3 completion (US3 reuses T016/T018/T019); independent of Phase 4 but conventionally runs after.
- **Phase 6 (Polish)**: depends on Phase 5 completion.

### Within-phase task dependencies

- **T004** depends on T001 + T002 (core build/typecheck after both drops).
- **T006** depends on T005 (helper deletion preceded the call-site removal).
- **T007 / T008** can run in parallel with each other once the file is open — different files — but both must follow T006 for assertions to match runtime.
- **T010** depends on T009 (test the method only after it exists).
- **T015** must precede T016/T017/T018/T019/T020 (every new card-slice file imports `CardFootprint` / `CardViewState` / `CardViewProps`).
- **T016** depends on T003 + T009 + T011 (helpers exported, apiClient method available, failing test in place).
- **T017 / T018 / T019** can run in parallel (different files), each depending on T015.
- **T020** depends on T018 + T019 (renders the view and uses the hook).
- **T021** depends on T020 + T015 (barrel re-exports the container + the public types).
- **T022** depends on T021 (consumer imports the new barrel).
- **T023** depends on T022 (test-file update follows the view-file update).
- **T026** depends on T016 (JSDoc note on the existing hook file).
- **T030** depends on T016 + T018 + T019 + T027 + T028 + T029.
- **T031–T034** depend on the corresponding tested files existing.

### Parallel opportunities

- **Phase 1**: T001, T002, T003 in parallel; T004 follows.
- **Phase 2**: T005 → T006; T007, T008 in parallel after T006; T009 in parallel with the test-file edits; T010 follows T009.
- **Phase 3 (US1) tests**: T011, T012, T013, T014 in parallel.
- **Phase 3 (US1) implementation**: T015 first; then T017, T016 (after T011), and the type-only `useCard` skeleton can be drafted in parallel; T018 + T019 in parallel after T015 + T017; T020 follows T018 + T019; T021 follows T020; T022 follows T021; T023 follows T022.
- **Phase 4 (US2)**: T024, T025 in parallel; T026 follows.
- **Phase 5 (US3)**: T027, T028, T029 in parallel; T030 follows.
- **Phase 6**: T031, T032, T033 in parallel; T034 follows.

---

## Parallel Example: User Story 1 tests (write before implementation)

```bash
# Four test files, four different paths — write all four in parallel:
Task: "T011 [P] [US1] useCardImagesQuery.test.ts"
Task: "T012 [P] [US1] useCard.test.ts"
Task: "T013 [P] [US1] CardView.test.tsx"
Task: "T014 [P] [US1] CardContainer.test.tsx"

# Then the foundational types + theme (also independent files):
Task: "T015 [P] [US1] types.ts"
Task: "T017 [P] [US1] CardView.theme.ts (after BinderHomeView.theme.ts pass-through is staged)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup (T001–T004) — schema/type drop + helper export.
2. Complete Phase 2: Foundational (T005–T010) — server tightening + new apiClient method.
3. Complete Phase 3: User Story 1 (T011–T023) — the four-layer card slice + binder-home swap.
4. **STOP and VALIDATE**: run `turbo test` + `turbo typecheck` per the
   Phase 3 gate; manually open the binder on a dev build and confirm the
   dashed-border-skeleton → image transition is correct on cold cache.
5. Ship the MVP — the only user-visible value (US1) is delivered.

### Incremental Delivery

1. Complete Phase 1 + Phase 2 → contract tightened.
2. Complete Phase 3 (US1) → MVP shipped, binder home migrates.
3. Complete Phase 4 (US2) → no production code shipped, but warm-cache
   guarantees are now covered by tests; ship the test growth.
4. Complete Phase 5 (US3) → not-found and error fallbacks are now covered;
   ship the integration confirmation.
5. Complete Phase 6 → coverage threshold + dead-reference cleanup + manual
   quickstart walkthrough.

### Parallel Team Strategy

With two developers:

1. Both complete Phase 1 + Phase 2 together (server tightening pairs well).
2. Dev A: Phase 3 tests (T011–T014) → Phase 3 implementation (T015–T023).
3. Dev B (after T015 lands): Phase 4 test/implementation (T024–T026) and
   Phase 5 tests (T027–T029) in alternation, since both reuse Dev A's
   `useCardImagesQuery` from T016.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps each user-story-phase task to its spec story for traceability; Setup / Foundational / Polish tasks have no story label.
- Every user story is independently completable and testable through its own checkpoint and validation gate.
- **Tests are written FIRST per Principle III** — every T0xx-test task must be authored and asserted to FAIL before the corresponding T0yy-implementation task begins.
- **Phase completion validation gate (Principle III)**: every Checkpoint above is gated on `turbo test` + `turbo typecheck` exiting 0 with a **100% Jest pass rate** across the affected workspaces. Investigate every failure at root cause (bleeding state, leaky async, fixture ordering, regression). `.skip` / `.todo` / quarantine / retry-until-green are prohibited.
- Commit after each task or each logical group of parallel tasks; do not stack multiple unrelated diffs in one commit.
- Avoid: vague tasks, same-file conflicts (every [P] marker on this list has been verified to point at a distinct file), cross-story dependencies that break independent testability.
