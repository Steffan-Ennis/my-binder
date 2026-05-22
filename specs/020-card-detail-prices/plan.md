# Implementation Plan: Card Detail Sheet — Prices & 30-Day Trend

**Branch**: `020-card-detail-prices` | **Date**: 2026-05-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-card-detail-prices/spec.md`

## Summary

A bottom sheet slides up over the canvas when a populated pocket is tapped on **either** the
Catalogue or the Binder, surfacing: the printing's identity (name, set, type, oracle), a
`−  N  +` ownership stepper, three labelled price rows (Card Kingdom + TCG Player **live**;
MTG Goldfish as a disabled "coming soon" placeholder), and a 30-day two-line price-trend chart.

**Technical approach (two user-directed constraints baked in):**

1. **Mock-first UI.** The sheet, the price rows, and the SVG chart are built and fully
   unit-tested against in-memory `Card` / `CardPricesResponse` / `CardPriceHistoryResponse`
   fixtures **before** any live query or backend call exists. Backend integration is a later,
   separable phase. This de-risks the chart geometry and the four-layer wiring independent of
   server readiness.
2. **Use a real charting library — do not hand-roll one.** The trend chart uses
   **`react-native-gifted-charts@^1.4.77`** (`LineChart`), added by this feature. It builds on the
   **already-installed `react-native-svg@15.12.1`** (its required peer) and needs no gradient
   package for our thin-line design, so it is the **single** new dependency. (`react-native-svg`
   alone is a primitives renderer, not a chart library — drawing the chart from it by hand was the
   wrong reading of the directive.) The **sheet** still adds nothing: it uses Expo Router's native
   **`presentation: 'formSheet'`** (via `react-native-screens`/`expo-router`, already installed),
   mirroring the existing `catalogue-filter-sheet` + `catalogue/filter-modal.tsx` route.

Backend: implement `MtgjsonProvider.getPrices` / `getPriceHistory` against the SDK's
paper-retail dataset (`sdk.prices.today` / `sdk.prices.history`, keys `cardkingdom` /
`tcgplayer`, finish `normal`, priceType `retail`), add `cardService` orchestration, and add the
two Fastify routes (`GET /cards/:id/prices`, `GET /cards/:id/prices/history`) the mobile
`apiClient` already calls.

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`) on Node 22 (build/test toolchain) — mobile + server + core.
**Primary Dependencies**: React Native 0.81.5 + Expo SDK ~54 on React 19.1; Expo Router ~6; TanStack Query 5; **`react-native-gifted-charts@^1.4.77`** (chart — NEW; built on the already-installed `react-native-svg@15.12.1`); `react-native-screens`/Expo Router `formSheet` (sheet, already installed); server: Fastify v4 + `mtgjson-sdk@0.1.1`.
**Storage**: No new persistence. Prices are read-through from the MTGJSON SDK paper-retail dataset (no DuckDB replica, no migration). The in-memory TanStack cache holds query responses.
**Testing**: Jest — `jest-expo` (SDK 54 preset) + `@testing-library/react-native` 13 for mobile; `ts-jest` for server + core.
**Target Platform**: iOS + Android (Expo managed). Sheet via native form-sheet presentation.
**Project Type**: pnpm + Turborepo monorepo (mobile app + Fastify API + shared core).
**Performance Goals**: SC-002 — 30-day chart renders within **1 second** of the sheet appearing (≤2 plotted lines); empty-history annotation within the same window. SC-001 — 100% of populated-pocket taps open the sheet for the tapped printing.
**Constraints**: Physical printings only (SC-003 — zero digital-only in any sheet/observation). Mock-first build order. Exactly one new package (`react-native-gifted-charts`, current stable — see Dependency Currency Check). WCAG 1.4.1 — sources distinguishable without colour (FR-010).
**Scale/Scope**: One new mobile feature directory (`card-detail-sheet`) + one presentational chart + 3 query hooks + 1 geometry util; two modal route registrations (catalogue + binder); server: 2 provider methods, 2 service methods, 2 routes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — still passing.*

| Principle | Compliance |
|---|---|
| **I. Simplicity First** | One new dep (`react-native-gifted-charts`) — the lightest real chart library, reusing the installed `react-native-svg` and needing no gradient package. Sheet adds nothing (reuses the `catalogue-filter-sheet` form-sheet route pattern). ✅ |
| **II. Data Integrity** | Read-only feature. No schema change, no migration, no writes except the stepper, which delegates to spec 019's already-validated `PATCH /cards/:id`. ✅ |
| **III. Test-First** | Unit Testing Phase below enumerates every test file with behaviours mapped to FRs; mock-first means the UI is test-covered before integration. Single-root-describe + co-location + mobile view/mocking conventions honoured. ✅ |
| **IV. Single Responsibility** | New feature dir `card-detail-sheet/` imports only `@my-binder/core` + shared hooks/utils; the chart and geometry are isolated; no cross-feature `*.theme.ts` import. ✅ |
| **V. Transparency & Legibility** | Identifier intent rule observed (no `state`/`data`/`e`/`c` short names; full-word callback params). ✅ |
| **VI. Layered Architecture** | Mobile Screen → Container → Hook → View; server Route → Service → Provider. ✅ |
| **VII. Strong Typing & Schema Validation** | Wire types/schemas reused from `@my-binder/core` (`CardPricesResponse`, `CardPriceHistoryResponse`, `PriceQuote`, `PricePoint`); mobile validates via existing Ajv validators in `schemas.ts`. Mobile-only view/option types in feature `types.ts`. ✅ |
| **VIII. Error Transparency** | FR-009 inline error + retry state distinct from FR-004 empty-data annotation; ApiError surfaced unchanged through the query result (Data-fetching hook composition rule #3). ✅ |
| **IX. Public API Discipline** | New `card-detail-sheet/index.ts` is a pure barrel; new server provider/service methods carry full JSDoc (`@param`/`@returns`/`@throws`/`@example`). ✅ |
| **X. Component Architecture (Mobile)** | Four-layer feature dir; `FC`-typed components; `Use<Feature>Options` named type; view props `Pick`'d from the query result types; hook return values memoised; styles in `*.theme.ts` via `useStyles`; state local to the hook (no new Zustand store); chart side-effect-free (geometry in a util). ✅ |
| **XI. Dependency Currency** | One new package, pinned to current stable — see Dependency Currency Check below. ✅ |

### Dependency Currency Check (Principle XI)

This feature adds **one** new package to `apps/mobile`. `react-native-svg` (chart peer) is
already installed (`15.12.1`); the sheet/gestures/animation reuse already-installed
`react-native-screens` / `react-native-gesture-handler` / `react-native-reanimated`; the optional
`expo-linear-gradient` peer is **not** added (no gradient fills in the design).

| Package | Workspace | Chosen version | Current stable | Justification (only if off-stable) |
|---|---|---|---|---|
| `react-native-gifted-charts` | `apps/mobile` | `^1.4.77` | `1.4.77` | _current stable — no entry needed_ |

> Peer check: gifted-charts peers are `react: *`, `react-native: *`, `react-native-svg` (✅
> installed). It ships no custom native module beyond `react-native-svg`, so it is
> New-Architecture / Expo SDK 54 compatible. Install via
> `pnpm --filter @my-binder/mobile add react-native-gifted-charts` (a plain JS+SVG package, not
> an Expo config-plugin module).

## Project Structure

### Documentation (this feature)

```text
specs/020-card-detail-prices/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (SVG chart, form-sheet, mock-first, query keys)
├── data-model.md        # Phase 1 — entities (view models + wire types reused from core)
├── quickstart.md        # Phase 1 — how to run/verify the sheet (mock-first then integrated)
├── contracts/           # Phase 1 — server route contracts + mobile hook/query contracts
│   ├── prices-routes.md
│   └── mobile-hooks.md
├── designs/             # Checked-in mockups (filter-sheet-1.png, filter-sheet-2.png)
├── spec.md
└── tasks.md             # Phase 2 — created by /speckit.tasks, NOT here
```

### Source Code (repository root)

```text
apps/mobile/
├── src/
│   ├── app/(authenticated)/(tabs)/
│   │   ├── catalogue/
│   │   │   ├── _layout.tsx              # UPDATE — register `card-detail` formSheet route alongside `filter-modal`
│   │   │   └── card-detail.tsx          # NEW — route: <CardDetailSheetContainer printingId={…} /> (reads route param)
│   │   └── binder/                       # NEW dir — promote binder tab to a Stack so it can host the modal route
│   │       ├── _layout.tsx              # NEW — Stack: binder screen + `card-detail` formSheet route
│   │       ├── binder.tsx               # MOVE — current (tabs)/binder.tsx body
│   │       └── card-detail.tsx          # NEW — same container, opened from the Binder surface
│   ├── components/
│   │   └── card-detail-sheet/           # NEW feature (Principle X four-layer)
│   │       ├── CardDetailSheetContainer.tsx
│   │       ├── useCardDetailSheet.ts
│   │       ├── CardDetailSheetView.tsx
│   │       ├── CardDetailSheetView.theme.ts
│   │       ├── PriceTrendChart.tsx       # presentational wrapper around gifted-charts <LineChart> (props-only)
│   │       ├── PriceTrendChart.theme.ts
│   │       ├── types.ts                  # Pick'd view props, UseCardDetailSheetOptions, PriceRowModel, ChartSeries
│   │       ├── fixtures.ts               # mock Card / prices / history for the mock-first phase + tests
│   │       └── index.ts                  # barrel (Principle IX)
│   ├── hooks/                            # cross-feature TanStack query hooks
│   │   ├── useCardDetailQuery.ts         # NEW — getCard → ['cards','detail',id]
│   │   ├── useCardPricesQuery.ts         # NEW — getCardPrices → ['cards','prices',id]
│   │   └── useCardPriceHistoryQuery.ts   # NEW — getCardPriceHistory → ['cards','prices','history',id,days]
│   └── utils/
│       └── priceSeriesToChartData.ts     # NEW — pure map: PricePoint[] → gifted-charts LineChart data (30-day axis + gaps)

apps/server/src/
├── providers/mtgjson/MtgjsonProvider.ts  # UPDATE — implement getPrices / getPriceHistory (replace throwing stubs)
├── services/cardService.ts               # UPDATE — add getPrices / getPriceHistory orchestration (30-day window)
└── routes/cards.ts                       # UPDATE — add GET /cards/:id/prices and GET /cards/:id/prices/history
```

**Structure Decision**: This is the existing pnpm + Turborepo monorepo. The mobile feature
follows the established four-layer pattern (canonical reference: `src/components/card/`), and
the sheet reuses the Expo Router `formSheet` route pattern already proven by
`catalogue/filter-modal.tsx`. Because the sheet must open from **both** surfaces (FR-001/FR-005),
the `card-detail` form-sheet route is registered under the catalogue Stack **and** under a new
binder Stack (the binder tab is promoted from a single screen to a Stack, exactly as the
catalogue tab already is). The **component** is shared (one `card-detail-sheet/` directory); only
the thin route file is duplicated per surface. The presentational `PriceTrendChart` lives inside
the feature directory and is fed ready-shaped props by the view (geometry math is a pure util),
following the precedent set by `src/components/icons/` for presentational SVG components.

## Unit Testing Phase

*GATE: REQUIRED per Constitution Principle III. Completed below — task generation is unblocked.*

**Test framework**: Jest — `jest-expo` (SDK 54) + `@testing-library/react-native` 13 (mobile);
`ts-jest` (server + core). No alternative runner.

> **Mobile mocks:** `react-native-gifted-charts` is a new third-party dependency, so per the
> Mobile mocking convention (Principle III) its mock entry MUST land in
> `apps/mobile/jest.setup.ts` in the same PR — mock `LineChart` to a `react-native` `View` that
> records its received props (so `PriceTrendChart.test.tsx` asserts the props passed to the chart
> rather than rendering the real SVG canvas). `react-native-svg` itself is already transformed by
> the `jest-expo` preset (it renders in the existing `src/components/icons/*` tests). `expo-router`
> (`useRouter`, `Stack`) is already mocked in `jest.setup.ts`; navigation from
> `useCatalogue`/`useBinderHome` to the `card-detail` route is asserted via the existing router
> mock (`jest.spyOn`, never in-file `jest.mock`).
>
> **Mobile view tests:** `CardDetailSheetView.test.tsx` and `PriceTrendChart.test.tsx` MUST call
> `render(...)` only inside `it(...)` blocks and declare module-scope
> `CardDetailSheetViewWithDefaults: FC<Partial<CardDetailSheetViewProps>>` /
> `PriceTrendChartWithDefaults: FC<Partial<PriceTrendChartProps>>` wrappers for shared prop
> defaults (canonical reference: `BinderHomeView.test.tsx`).
>
> **Server route tests:** the new `/cards/:id/prices*` route tests live inside `cards.test.ts`
> as real-pipeline E2E tests — no service/provider mocks; real TypeORM `DataSource` via the
> shared `connectTestDatabase()`; offline-mode MTGJSON SDK registered as the active provider;
> seeded entities via `apps/server/testing/*Factory.ts`. Single-root-describe rule: additions
> nest inside the file's existing root describe.

### Test files to create or update

| Test file | Status | Behaviours covered (mapped to FR-### where applicable) |
|---|---|---|
| `apps/mobile/src/utils/priceSeriesToChartData.test.ts` | new | Map `PricePoint[]` → gifted-charts `LineChart` data aligned to a 30-day axis; **missing days become gap points, not zeros** (FR-004); single-point + all-empty inputs; value scaling from observed range (`$13`/`$20` design) |
| `apps/mobile/src/components/card-detail-sheet/PriceTrendChart.test.tsx` | new | Passes ≤2 datasets (CK, TCGP) to the mocked `LineChart` + **disabled MTG Goldfish legend entry, no dataset** (FR-003); 30-day x-axis + price y-axis labels; gap data points (FR-004); **"no recent price data" annotation when both empty** (FR-004); non-colour differentiation — text labels + SR roles (FR-010) |
| `apps/mobile/src/components/card-detail-sheet/CardDetailSheetView.test.tsx` | new | Identity header (name/set/type/oracle) (FR-001); **three rows incl. disabled Goldfish placeholder** (FR-002); `−  N  +` stepper, `−` disabled at 0 (FR-007); **skeleton placeholders while loading** (FR-008); **inline error + retry distinct from empty-data** (FR-009); close control (FR-005); a11y labels (FR-010) |
| `apps/mobile/src/components/card-detail-sheet/useCardDetailSheet.test.ts` | new | Composes detail/prices/history queries; derives price rows (CK/TCGP values or `—`, Goldfish disabled) (FR-002); derives chart series (FR-003); maps loading→skeleton (FR-008) and failure→error (FR-009); stepper handlers call the binder mutation; **invalidates `['cards','detail',id]` on success, invalidate-only (no optimistic)** (FR-011); returned non-primitives reference-stable (Principle X v1.16.0) |
| `apps/mobile/src/components/card-detail-sheet/CardDetailSheetContainer.test.tsx` | new | Destructures the hook and passes individual named props to the view (Container prop-passing rule) |
| `apps/mobile/src/hooks/useCardDetailQuery.test.ts` | new | queryKey `['cards','detail',id]`; `enabled` gated on active session + id; 404 surfaces as `ApiError`; default retry policy |
| `apps/mobile/src/hooks/useCardPricesQuery.test.ts` | new | queryKey `['cards','prices',id]`; enabled gating; validated `CardPricesResponse`; error passthrough |
| `apps/mobile/src/hooks/useCardPriceHistoryQuery.test.ts` | new | queryKey `['cards','prices','history',id,days]` (default 30); enabled gating; validated `CardPriceHistoryResponse` |
| `apps/mobile/src/components/catalogue/useCatalogue.test.ts` | update | Tapping a populated pocket navigates to the `card-detail` route with the tapped printing id (FR-001); skeleton/empty pockets do not open the sheet (Edge Case "Tap during page load") |
| `apps/mobile/src/components/binder-home/useBinderHome.test.ts` | update | Tapping a populated Binder pocket opens the sheet for the tapped printing (FR-001, identical behaviour) |
| `apps/server/src/providers/mtgjson/MtgjsonProvider.test.ts` | update | `getPrices` returns latest CK + TCGP retail/normal observation or `null` per source; `getPriceHistory` returns each source's series over `days`; **physical-only — digital observations excluded** (FR-006/SC-003); MTG Goldfish never emitted. (Also wraps the file's existing top-level describes into one root per the v1.27.0 carry-over TODO.) |
| `apps/server/src/services/cardService.test.ts` | update | `getPrices`/`getPriceHistory` orchestration: 30-day window ending today; pass-through of provider `null`/`[]`; not-found propagation. (Consolidate into single root describe per v1.27.0 TODO.) |
| `apps/server/src/routes/cards.test.ts` | update | `GET /cards/:id/prices` → validated `CardPricesResponse`; `GET /cards/:id/prices/history?days=30` → validated `CardPriceHistoryResponse`; auth gate; 404 on unknown id. Real DataSource + offline SDK + factory-seeded data. |

### Coverage target

Project floor — **80% lines / 80% functions / 80% branches / 80% statements** for the new code
this feature introduces. No deviation requested.

```jsonc
// jest.config.* — coverageThreshold for this feature's new code
{
  "coverageThreshold": {
    "global": { "branches": 80, "functions": 80, "lines": 80, "statements": 80 }
  }
}
```

### Test execution

Locally per workspace: `pnpm --filter @my-binder/mobile test` and
`pnpm --filter @my-binder/server test`. In CI and pre-merge via `turbo test` (core builds
first). The `main` branch stays green per Principle III.

## Complexity Tracking

> No constitution violations. The one new dependency (`react-native-gifted-charts`) is current
> stable and peer-satisfied (Dependency Currency Check passes — not a complexity violation). No
> new Zustand store, no off-stable selections, no layer-rule breaches. The table is intentionally
> empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_ | — | — |

## Notes & cross-spec dependencies

- **Spec 019 gating (FR-007/FR-011).** `useUpdateBinderEntryMutation` is **not yet built**
  (owned by spec 019; `useCatalogue` currently holds a `{ mutate: () => {} }` placeholder). The
  mock-first phase exercises the stepper handlers against a mocked mutation; full stepper
  integration lands only after spec 019. Per FR-011, the consumed hook MUST invalidate
  `['cards','detail',id]` for the tapped printing via TanStack `invalidateQueries` (invalidate-only,
  no optimistic update) — this plan does not re-implement that hook.
- **Query-key reconciliation.** Spec FR-011 writes the detail query as `['card', id]`; this plan
  uses **`['cards','detail',id]`** to stay in the existing `['cards','images',id]` /
  `['catalogue','search',…]` namespace. Treat the spec's `['card', id]` as shorthand for this key.
- **Server scope is larger than "replace the stubs."** The `/cards/:id/prices` and
  `/cards/:id/prices/history` routes do **not** exist yet (only the throwing provider stubs and
  the mobile `apiClient` callers do). Backend phase adds the routes + `cardService` methods +
  the real provider implementation.
