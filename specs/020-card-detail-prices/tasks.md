---
description: "Tasks for spec 020 — Card Detail Sheet: Prices & 30-Day Trend (US3 split out of spec 018)"
---

# Tasks: Card Detail Sheet — Prices & 30-Day Trend

**Input**: Design documents from `/specs/020-card-detail-prices/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)
**Feature branch**: `020-card-detail-prices`

**Tests**: Per Constitution Principle III, unit tests are **REQUIRED** and written **before** implementation, co-located as `<filename>.test.ts(x)`. The exact set is enumerated in `plan.md` → *Unit Testing Phase*; each test task below maps to that table.

**Build order (user-directed, baked into the plan)**: **mock-first**. The chart geometry, the chart wrapper, and the sheet view are built and fully unit-tested against in-memory fixtures (`card-detail-sheet/fixtures.ts`) **before** any live query or backend route exists. Hooks + wiring follow; the backend lands last and the runtime swaps fixtures for the live queries. The chart uses **`react-native-gifted-charts`** (a real library) — it is **not** hand-rolled from `react-native-svg`. The sheet reuses Expo Router's native `presentation: 'formSheet'` (zero new deps for the sheet), mirroring `catalogue/filter-modal.tsx`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable — different file, no dependency on an incomplete task.
- **[US1]**: the single user story in this spec (P1 — *Inspect a Card's Prices and 30-Day Trend*). Setup / Foundational / Polish tasks carry no story label.

---

## Already done on branch `018-card-catalogue-search` (wire contracts — runtime stubbed)

The wire half exists; this spec replaces the stubs with the real implementation.

- [X] Core types — `PRICE_SOURCES` (`['CARD_KINGDOM','TCG_PLAYER']` — **no Goldfish slot**), `PriceSource`, `PriceQuote`, `CardPricesResponse`, `PricePoint`, `CardPriceHistoryResponse`.
- [X] Core schemas — `PRICE_QUOTE_SCHEMA`, `CARD_PRICES_RESPONSE_SCHEMA`, `PRICE_POINT_SCHEMA`, `CARD_PRICE_HISTORY_RESPONSE_SCHEMA`.
- [X] `CardProvider` interface declares `getPrices(uuid)` / `getPriceHistory(uuid, days)`.
- [X] Mobile `apiClient.getCard(id)` / `getCardPrices(id)` / `getCardPriceHistory(id, days)`.
- [X] `MtgjsonProvider.getPrices` / `getPriceHistory` exist as **throwing stubs** (`"… not implemented (pending spec 018 US3 / T057)"`) — replaced by T029.

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: add the single new dependency and its test mock so all later mobile work compiles and tests.

- [X] T001 Add the chart dependency: `pnpm --filter @my-binder/mobile add react-native-gifted-charts` (`^1.4.77`). Confirm it lands in `apps/mobile/package.json` and that the already-installed `react-native-svg@15.12.1` (its required peer) is unchanged; do **not** add `expo-linear-gradient` (no gradient fills). See plan.md → Dependency Currency Check.
- [X] T002 [P] Add a `react-native-gifted-charts` mock to `apps/mobile/jest.setup.ts`: mock `LineChart` to a `react-native` `View` that records its received props, so chart tests assert the props passed to the chart rather than rendering the real SVG canvas (plan.md → *Mobile mocks*). `expo-router` is already mocked there — do not re-mock it.

---

## Phase 2: Foundational (blocking prerequisites for US1)

**Purpose**: the view-model types and the in-memory fixtures every mock-first task imports.

**⚠️ CRITICAL**: no US1 task can begin until this phase is complete.

- [X] T003 [P] Create `apps/mobile/src/components/card-detail-sheet/types.ts` — export `PriceRowModel`, `ChartSeries`, `ChartPoint`, `ChartLegendEntry`, `UseCardDetailSheetOptions`, and `CardDetailSheetViewProps` (identity + stepper + `priceRows` + `pricesStatus`/`historyStatus` `'loading'|'error'|'empty'|'ready'` + `chartSeries`/`chartLegend` + retry/close handlers), `Pick`'d from the query result types per data-model.md §B. Mobile-only — never crosses the wire (Principle X rule 7).
- [X] T004 [P] Create `apps/mobile/src/components/card-detail-sheet/fixtures.ts` — typed `Card`, `CardPricesResponse`, `CardPriceHistoryResponse` fixtures covering the four shapes from research.md §3: (a) both live sources present, (b) one source `null`/`—`, (c) all-empty (no-data annotation), (d) a gapped series (missing days). Used by the mock-first view/chart/hook tests; remains test-only.

**Checkpoint**: types + fixtures exist — mock-first UI can begin.

> **Phase completion validation gate (Principle III).** Run `pnpm --filter @my-binder/mobile typecheck` — exit 0 before proceeding.

---

## Phase 3: User Story 1 — Inspect a Card's Prices and 30-Day Trend (Priority: P1) 🎯 MVP

**Goal**: tapping a populated pocket on the Catalogue **or** the Binder slides up a bottom sheet showing identity, a `− N +` stepper, two live price rows (Card Kingdom + TCG Player) plus a disabled "coming soon" MTG Goldfish row, and a 30-day two-line trend chart — with skeleton/empty/error states and colour-independent source labelling.

**Independent Test**: open the Catalogue, tap a populated pocket → the sheet renders identity, the stepper at the user's count, three labelled rows (CK + TCGP live, Goldfish disabled), and a chart with ≤2 plotted lines + a disabled Goldfish legend entry. Tap `+` → count increments after refetch. Swipe down → dismisses to the unchanged page. Repeat on the Binder — identical.

### Phase A — Mock-first UI (no backend, no live queries)

#### Tests for Phase A (write first, ensure they FAIL) ⚠️

- [X] T005 [P] [US1] Test `apps/mobile/src/utils/priceSeriesToChartData.test.ts` — map `PricePoint[]` → gifted-charts `LineChart` data aligned to a 30-day axis; **missing days become gap points, not zeros** (FR-004); single-point and all-empty inputs; value scaling from the observed range (`$13`/`$20` design).
- [X] T006 [P] [US1] Test `apps/mobile/src/components/card-detail-sheet/PriceTrendChart.test.tsx` — passes ≤2 datasets (CK, TCGP) to the mocked `LineChart` + a **disabled MTG Goldfish legend entry with no dataset** (FR-003); 30-day x-axis + price y-axis labels; gap data points (FR-004); the **"no recent price data" annotation when both series are empty** (FR-004); non-colour differentiation — text labels + screen-reader roles (FR-010). Declare a module-scope `PriceTrendChartWithDefaults: FC<Partial<PriceTrendChartProps>>`; call `render(...)` only inside `it(...)`.
- [X] T007 [P] [US1] Test `apps/mobile/src/components/card-detail-sheet/CardDetailSheetView.test.tsx` — identity header name/set/type/oracle (FR-001); **three rows incl. the disabled Goldfish placeholder** (FR-002); `− N +` stepper with `−` disabled at 0 (FR-007); **skeleton placeholders while loading** (FR-008); **inline error + retry visually distinct from the empty-data annotation** (FR-009); close control (FR-005); a11y labels (FR-010). Drive from `fixtures.ts`; module-scope `CardDetailSheetViewWithDefaults`; `render(...)` only inside `it(...)` (canonical reference: `BinderHomeView.test.tsx`).

#### Implementation for Phase A

- [X] T008 [P] [US1] Implement `apps/mobile/src/utils/priceSeriesToChartData.ts` — pure function mapping a `PricePoint[]` series to the gifted-charts data shape across a 30-day axis ending today: emit gap markers (`hideDataPoint`) for missing days (never `0`), and derive value scaling from the observed range. Makes T005 pass.
- [X] T009 [P] [US1] Implement `apps/mobile/src/components/card-detail-sheet/PriceTrendChart.tsx` + `PriceTrendChart.theme.ts` — thin presentational wrapper over gifted-charts `LineChart`: map `chartSeries` → `data`/`data2`, render the three-entry legend (Goldfish disabled, **no line**), `30d ago`/`today` + `$min`/`$max` axis labels, and the "no recent price data" annotation when `historyStatus === 'empty'`. Props-only — no data fetching, no state, no effects. Styles via `useStyles`. Makes T006 pass.
- [X] T010 [US1] Implement `apps/mobile/src/components/card-detail-sheet/CardDetailSheetView.tsx` + `CardDetailSheetView.theme.ts` — `FC<CardDetailSheetViewProps>`: hero (image + name + set + type + oracle), `In your binder` `− N +` stepper block, three price rows (Goldfish disabled "coming soon"), the `<PriceTrendChart />`, and the skeleton (FR-008) / inline-error+retry (FR-009) / empty-annotation (FR-004) branches + close control (FR-005) + a11y labels (FR-010). Styles via `useStyles`. Makes T007 pass. (depends on T009)

> **Checkpoint A — validation gate (Principle III).** `pnpm --filter @my-binder/mobile test` — all `priceSeriesToChartData` + `PriceTrendChart` + `CardDetailSheetView` tests green; `pnpm --filter @my-binder/mobile typecheck` exit 0. The sheet UI renders end-to-end from fixtures.

### Phase B — Hooks + wiring

#### Tests for Phase B (write first, ensure they FAIL) ⚠️

- [X] T011 [P] [US1] Test `apps/mobile/src/hooks/useCardDetailQuery.test.ts` — queryKey `['cards','detail',id]`; `enabled` gated on `status === 'active' && Boolean(id)`; 404 surfaces as `ApiError`; default retry policy.
- [X] T012 [P] [US1] Test `apps/mobile/src/hooks/useCardPricesQuery.test.ts` — queryKey `['cards','prices',id]`; `enabled` gating; validated `CardPricesResponse`; `ApiError` passthrough.
- [X] T013 [P] [US1] Test `apps/mobile/src/hooks/useCardPriceHistoryQuery.test.ts` — queryKey `['cards','prices','history',id,days]` (default `30`); `enabled` gating; validated `CardPriceHistoryResponse`.
- [X] T014 [P] [US1] Test `apps/mobile/src/components/card-detail-sheet/useCardDetailSheet.test.ts` — composes the detail/prices/history queries; derives price rows (CK/TCGP value or `—`, Goldfish disabled) (FR-002); derives chart series via `priceSeriesToChartData`, Goldfish never a series (FR-003); maps loading→skeleton (FR-008) and failure→error (FR-009); `pricesStatus`/`historyStatus` four-state mapping incl. empty (FR-004); stepper handlers call the spec-019 mutation, `−` no-op at 0 (FR-007); **invalidates `['cards','detail',id]` on success, invalidate-only — no optimistic update, no manual cache patch** (FR-011); returned non-primitives reference-stable (Principle X v1.16.0).
- [X] T015 [P] [US1] Test `apps/mobile/src/components/card-detail-sheet/CardDetailSheetContainer.test.tsx` — destructures the hook and passes individual named props to the view (Container prop-passing rule; no spread).

#### Implementation for Phase B

- [X] T016 [P] [US1] Implement `apps/mobile/src/hooks/useCardDetailQuery.ts` — `useQuery` over `apiClient.getCard(id)`, queryKey `['cards','detail',id]`, `enabled: status === 'active' && Boolean(id)`, project-default retry, `staleTime` ~60s (mirror `useCardImagesQuery`). Makes T011 pass.
- [X] T017 [P] [US1] Implement `apps/mobile/src/hooks/useCardPricesQuery.ts` — `useQuery` over `apiClient.getCardPrices(id)`, queryKey `['cards','prices',id]`, same `enabled`/retry, `staleTime` ~60s. Makes T012 pass.
- [X] T018 [P] [US1] Implement `apps/mobile/src/hooks/useCardPriceHistoryQuery.ts` — `useQuery` over `apiClient.getCardPriceHistory(id, days)`, queryKey `['cards','prices','history',id,days]`, default `days=30`, same `enabled`/retry. Makes T013 pass.
- [X] T019 [US1] Implement `apps/mobile/src/components/card-detail-sheet/useCardDetailSheet.ts` — compose T016–T018 + spec-019 `useUpdateBinderEntryMutation`; derive `priceRows`/`chartSeries`/`chartLegend`/`pricesStatus`/`historyStatus`/`numberOwned`/`canDecrement` with `useMemo` (Goldfish a constant disabled placeholder, never a series); handlers (`useCallback`): `onClose` (`router.back()`), `onIncrement`/`onDecrement` (call the mutation; `−` no-op at 0), `onRetryPrices`/`onRetryHistory` (`refetch`); on every successful mutation invalidate **only** `['cards','detail',id]` via built-in `queryClient.invalidateQueries` (invalidate-only, no optimistic, no hand-rolled reconciliation — FR-011); pass `error` through unwrapped; return a memoised object (v1.16.0). Makes T014 pass. (depends on T008, T016–T018)
- [X] T020 [US1] Implement `apps/mobile/src/components/card-detail-sheet/CardDetailSheetContainer.tsx` — `FC<{ printingId: string }>`: call `useCardDetailSheet`, pass individual named props to `CardDetailSheetView` (no spread). Makes T015 pass. (depends on T010, T019)
- [X] T021 [US1] Create `apps/mobile/src/components/card-detail-sheet/index.ts` — pure barrel re-exporting `CardDetailSheetContainer` (Principle IX). (depends on T020)

#### Route registration + surface wiring

- [X] T022 [P] [US1] Catalogue route: create `apps/mobile/src/app/(authenticated)/(tabs)/catalogue/card-detail.tsx` reading the `id` route param → `<CardDetailSheetContainer printingId={id} />`; update `catalogue/_layout.tsx` to register a `card-detail` `Stack.Screen` with `presentation: 'formSheet'`, `animation: 'slide_from_bottom'`, `sheetAllowedDetents: [0.9]`, `sheetInitialDetentIndex: 'last'`, `sheetCornerRadius: 24` (mirror the existing `filter-modal` screen). (depends on T021)
- [X] T023 [P] [US1] Promote the Binder tab to a Stack so it can host the same sheet: create `apps/mobile/src/app/(authenticated)/(tabs)/binder/_layout.tsx` (Stack: `binder` screen + the same `card-detail` `formSheet` screen), move the current `(tabs)/binder.tsx` body to `binder/binder.tsx`, add `binder/card-detail.tsx` (same container, Binder surface), and delete the old `(tabs)/binder.tsx`. The tab `name="binder"` in `(tabs)/_layout.tsx` keeps resolving to the binder group (exactly as `catalogue/` already works) — no tabs-layout edit needed. (depends on T021)
- [ ] T024 [P] [US1] Catalogue navigation: update `apps/mobile/src/components/catalogue/useCatalogue.ts` so a populated-pocket press calls `router.navigate` to the `card-detail` route with the tapped `printingId`; skeleton/empty pockets do **not** navigate (Edge Case "Tap during page load"). Add the assertions to `apps/mobile/src/components/catalogue/useCatalogue.test.ts` (FR-001 + no-open-on-skeleton) before implementing. (depends on T022)
- [ ] T025 [P] [US1] Binder navigation: update `apps/mobile/src/components/binder-home/useBinderHome.ts` so a populated Binder pocket press opens the sheet for the tapped printing — identical behaviour to the Catalogue (FR-001). Add the assertion to `apps/mobile/src/components/binder-home/useBinderHome.test.ts` first. (depends on T023)

> **Checkpoint B — validation gate (Principle III).** `pnpm --filter @my-binder/mobile test` + `typecheck` exit 0; both surfaces open the sheet by route param. (Live data still pending the backend — the queries resolve against the real server only after Phase C; until then the spec-019 mutation is exercised against its test mock per plan.md → *Notes & cross-spec dependencies*.)

### Phase C — Backend integration

#### Tests for Phase C (write first, ensure they FAIL) ⚠️

- [ ] T026 [P] [US1] Update `apps/server/src/providers/mtgjson/MtgjsonProvider.test.ts` — `getPrices(uuid)` returns the latest CK + TCGP `retail`/`normal` observation or `null` per source; `getPriceHistory(uuid, days)` returns each source's series over the window; **physical-only — digital observations excluded** (FR-006/SC-003); MTG Goldfish never emitted. Also wrap the file's existing top-level describes into one root describe (v1.27.0 carry-over).
- [ ] T027 [P] [US1] Update `apps/server/src/services/cardService.test.ts` — `getPrices`/`getPriceHistory` orchestration: 30-day window ending today; pass-through of provider `null`/`[]`; not-found propagation. Consolidate into a single root describe (v1.27.0).
- [ ] T028 [P] [US1] Update `apps/server/src/routes/cards.test.ts` — `GET /cards/:id/prices` → validated `CardPricesResponse`; `GET /cards/:id/prices/history?days=30` → validated `CardPriceHistoryResponse`; default `days=30` when omitted; both-empty is a valid 200; auth gate; 404 on unknown id. Real-pipeline E2E: real TypeORM `DataSource` via `connectTestDatabase()`, offline-mode MTGJSON SDK as the active provider, factory-seeded entities (`apps/server/testing/*Factory.ts`); additions nest inside the file's existing root describe.

#### Implementation for Phase C

- [ ] T029 [US1] Implement `MtgjsonProvider.getPrices` / `getPriceHistory` in `apps/server/src/providers/mtgjson/MtgjsonProvider.ts` (replace the throwing stubs): define the `PriceSource → SDK key` map (`CARD_KINGDOM → 'cardkingdom'`, `TCG_PLAYER → 'tcgplayer'`); fan out two `sdk.prices.today` / `sdk.prices.history` calls (finish `normal`, priceType `retail`, **physical only**); map SDK rows to `CardPricesResponse` / `CardPriceHistoryResponse` (`amountCents` wire unit); return `null` per slot / `[]` per series when no observation; never emit Goldfish. Replace the "not implemented (pending spec 018 US3)" `@throws` JSDoc with real `@returns`/`@example` (Principle IX). Makes T026 pass.
- [ ] T030 [US1] Add `getPrices(id)` / `getPriceHistory(id, days = 30)` to `apps/server/src/services/cardService.ts` (beside `getCardImagesById`) — 30-day window ending today; delegate to `providerRegistry.getActive()`; propagate not-found; rewrite provider failure to the existing `ProviderUnavailableError`. JSDoc + `@example` (Principle IX). Makes T027 pass. (depends on T029)
- [ ] T031 [US1] Add `GET /cards/:id/prices` and `GET /cards/:id/prices/history` to `apps/server/src/routes/cards.ts`, **registered before the generic `/cards/:id`** (same precaution the existing literal-segment routes use); validate params + the `days` query (default `30`); attach the `CARD_PRICES_RESPONSE_SCHEMA` / `CARD_PRICE_HISTORY_RESPONSE_SCHEMA` response schemas; same auth gate as `GET /cards/:id`; delegate to `cardService`; map the not-found case to 404 exactly as the sibling `/cards/:id` route does, and `ProviderUnavailableError` → 503. Makes T028 pass. (depends on T030)
- [ ] T032 [US1] Integration sweep: confirm the sheet feeds end-to-end from the live `useCardDetailQuery` / `useCardPricesQuery` / `useCardPriceHistoryQuery` against the new routes; remove any temporary fixture-feeding used during mock-first dev (`fixtures.ts` stays test-only). (depends on T031 + Phase B)

> **Checkpoint C — validation gate (Principle III).** `pnpm --filter @my-binder/server test` + `typecheck` exit 0; the two new routes return the validated shapes; the mobile sheet renders live data.

**Checkpoint**: User Story 1 fully functional and testable on both surfaces.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [ ] T033 [P] Coverage config: add `src/components/card-detail-sheet/**`, `src/hooks/useCard{Detail,Prices,PriceHistory}Query.ts`, and `src/utils/priceSeriesToChartData.ts` to the mobile coverage scope in `apps/mobile/jest.config.ts`; confirm the 80/80/80/80 (lines/functions/branches/statements) thresholds hold for the new code.
- [ ] T034 Run `turbo test` + `turbo typecheck` across all three workspaces (core builds first) — both exit 0, 100% Jest pass rate, coverage thresholds honoured. No `.skip` / `xit` / `it.todo` / quarantine anywhere in the new tests.
- [ ] T035 Constitution sweep — `FC` declaration rule; style co-location (`*.theme.ts` via `useStyles`, no inline styles); hook return-value memoisation (v1.16.0); data-fetching hook composition (Principle X); Principle IX (pure `card-detail-sheet/index.ts` barrel; JSDoc + `@example` on `cardService` + `MtgjsonProvider` price methods); no new Zustand store (printing carried as the `card-detail` route param only); Dependency Currency Check on `react-native-gifted-charts` (`^1.4.77`, current stable, peers satisfied).
- [ ] T036 Manual acceptance per quickstart.md (SC-001/002/003): tap a populated pocket on the Catalogue **and** the Binder → sheet with identity + stepper + three rows (Goldfish disabled) + 30-day chart within 1s (SC-002); a printing with no observations → both live rows `—` + "no recent price data" annotation (FR-004); kill the network mid-open → inline error + retry in the price/chart section, identity + stepper still usable (FR-009); tap `+` → count + pocket glyph update after `['cards','detail',id]` refetches (FR-007/FR-011), `−` disabled at 0; swipe down / tap close → returns to the exact page + scroll (FR-005); VoiceOver/TalkBack announces each source row + legend entry by name, not colour (FR-010); zero digital-only printings reach any sheet/observation (SC-003).

---

## Dependencies & Execution Order

- **Cross-spec (hard)**: spec `019-binder-add-remove` owns `useUpdateBinderEntryMutation` (its FR-006) and is **not yet written**. Phase A/B exercise the stepper against a mocked mutation; full stepper integration (and the FR-011 invalidation firing for real) lands only once 019 is merged. Spec 020 MUST NOT re-implement the hook — it only requires it to invalidate `['cards','detail',id]` on success.
- **Cross-spec**: spec `018-card-catalogue-search` must be complete + green (the sheet opens from `useCatalogue`'s pocket-press lifecycle).
- **Phase order**: Setup (T001–T002) → Foundational (T003–T004) → US1 Phase A (T005–T010) → US1 Phase B (T011–T025) → US1 Phase C (T026–T032) → Polish (T033–T036). Mock-first is mandatory: Phase A completes against fixtures before any backend exists.
- **Within US1**: T010 needs T009; T019 needs T008 + T016–T018; T020 needs T010 + T019; T021 needs T020; T022/T023 need T021; T024 needs T022; T025 needs T023; T030 needs T029; T031 needs T030; T032 needs T031 + Phase B.

## Parallel Execution Examples

- **Setup/Foundational**: T002 ∥ T001 finish; then T003 ∥ T004.
- **Phase A tests**: T005 ∥ T006 ∥ T007 (three different files). **Phase A impl**: T008 ∥ T009, then T010.
- **Phase B query tests**: T011 ∥ T012 ∥ T013 ∥ T014 ∥ T015. **Phase B query impl**: T016 ∥ T017 ∥ T018, then T019 → T020 → T021. **Routes/nav**: T022 ∥ T023, then T024 ∥ T025.
- **Phase C tests**: T026 ∥ T027 ∥ T028 (provider / service / route files). **Phase C impl is sequential**: T029 → T030 → T031 → T032.

## Implementation Strategy (MVP-first)

This spec is a single P1 user story — US1 *is* the MVP. Deliver it in the mandated build order: a fully tested mock-first sheet (Phase A) de-risks the chart geometry and four-layer wiring with zero server dependency; Phase B wires the real query hooks + both route surfaces; Phase C implements the backend and flips the sheet to live data. Each checkpoint is independently green before the next begins.

## Notes

- **Chart**: `react-native-gifted-charts` `LineChart` (a real library) — not hand-drawn from `react-native-svg`. Geometry is the pure `priceSeriesToChartData` util; the chart component is props-only.
- **Sheet**: Expo Router native `presentation: 'formSheet'` — zero new deps; swipe-down + close + slide-up come for free, identical on both surfaces (FR-001/FR-005).
- **MTG Goldfish** stays a disabled "coming soon" row + disabled legend entry (no value, no line, no wire slot). A later spec wires real Goldfish data into the additive two→three-slot shape.
- **Query-key note**: spec FR-011 writes the detail key as `['card', id]`; this implementation uses `['cards','detail',id]` to stay in the existing `['cards','images',id]` namespace (plan.md → *Notes*). Treat the spec key as shorthand for the namespaced one.
