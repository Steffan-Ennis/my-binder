# Implementation Plan: 30-Day Price Trend Chart

**Branch**: `021-price-trend-chart` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-price-trend-chart/spec.md`

## Summary

Re-introduce the 30-day price-trend chart that spec 020 deferred (its chart crashed the app and was deleted). The card detail sheet's "30-DAY TREND" section currently renders a `"Price trend chart coming soon"` placeholder in its data-ready state; this feature replaces it with a real line chart plotting **Card Kingdom** and **TCG Player** over the last 30 days, with a three-item legend (MTG Goldfish disabled) and colour-independent source differentiation.

**Technical approach (per the chosen direction — SVG, keep Expo Go):** render with **`react-native-gifted-charts@^1.4.77`**, the same SVG-based library spec 020 used. Install it together with its peers — **`react-native-svg`** (already present at 15.12.1) and **`expo-linear-gradient`** — via **`expo install react-native-gifted-charts expo-linear-gradient react-native-svg`** so Expo resolves SDK-54-compatible versions. All three are **Expo SDK modules in the Expo Go bundle**, so this adds **no native module outside Expo Go** and **keeps the app running in Expo Go** (unlike a Skia/`react-native-graph` path, which was evaluated and rejected for forcing a development build). Because gifted-charts was the library that crashed, the plan **leads with a crash root-cause investigation** before re-wiring the chart: the most likely triggers — confirmed against the library's issue tracker and docs — are **(a) a `data.length === 1` crash ([gifted-charts #484](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/484))** hit by cards with a single price observation, and **(b) the chart auto-measuring to a NaN/0 width inside the native `formSheet`** (gifted-charts requires an explicit `width` in constrained containers). The plan guards both. The spec-020 data layer — history query, route, provider, the `priceSeriesToChartData` geometry util, `ChartPoint`/`ChartSeries`, and `chartSeries`/`chartLegend` derivation — is **reused unchanged** (realigning with spec FR-008 and the spec's Out-of-Scope line). The only new code is the re-created presentational `PriceTrendChart` and its mock.

## Technical Context

**Language/Version**: TypeScript ~5.9 (`strict: true`), Node 22 (build/test toolchain only)
**Primary Dependencies**: React Native 0.81.5 + Expo SDK ~54.0 on React 19.1; Expo Router ~6 (`formSheet`); TanStack Query 5; **`react-native-gifted-charts@^1.4.77`** (re-introduced) with its peers **`react-native-svg@15.12.1`** (already installed) + **`expo-linear-gradient`** (Expo SDK module — installed to satisfy the gifted-charts gradient peer, whose absence in spec 020 is a likely crash contributor). All installed via **`expo install`** for SDK-pinned versions.
**Storage**: N/A — no new persistence. Prices/history read through the existing TanStack in-memory cache (data layer unchanged).
**Testing**: Jest 30 + `jest-expo` (SDK 54 preset) + `@testing-library/react-native` 13; `react-native-gifted-charts` re-mocked in `apps/mobile/jest.setup.ts` (the mock spec 020 removed during the deferral cleanup is restored).
**Target Platform**: iOS + Android. **Runs in Expo Go** (no native module added — `react-native-svg` is in the Expo Go bundle) as well as dev/EAS builds.
**Project Type**: Mobile app (`apps/mobile`) — single-workspace change; no server/core change.
**Performance Goals**: trend chart renders within 1 s of the sheet appearing for non-empty history (SC-002).
**Constraints**: **Crash-free across every input shape** (both-present / single-source / single-observation / gapped / all-empty) — SC-003, the defect that caused the deferral; colour-independent source differentiation (WCAG 1.4.1, FR-006); two live lines only (Goldfish never plotted).
**Scale/Scope**: one new component (`PriceTrendChart` + theme + test), edits to `CardDetailSheetView` (ready branch) + its test, one restored Jest-setup mock, one re-added dependency. ~30 observations × 2 series per render. `priceSeriesToChartData` / `ChartPoint` / `ChartSeries` / the hook derivation are **untouched**.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| **I. Simplicity First** | Minimum complexity; no speculative abstraction; no dead code | ✅ **PASS** — adds exactly **one** JS-only package on an already-installed peer; reuses the surviving spec-020 data layer (no new util, no shape change); no native module. The chosen SVG path is the simpler of the two evaluated (Skia was rejected as heavier — see research.md §1). |
| **II. Data Integrity** | No silent data loss | ✅ N/A — read-only chart over existing data |
| **III. Test-First Development** | Tests before code; Jest; co-located; single root describe; mobile mocks in `jest.setup.ts`; `*WithDefaults` view-test pattern | ✅ Unit Testing Phase below; `PriceTrendChart.test.tsx` written first; gifted-charts mock restored in `jest.setup.ts` per Mobile mocking conventions; `PriceTrendChartWithDefaults` per Mobile view test conventions; single root describe |
| **IV. Single Responsibility** | One concern per file | ✅ `PriceTrendChart` renders only; geometry stays in the untouched `priceSeriesToChartData`; derivation stays in the untouched hook |
| **V. Transparency & Legibility** | Intent-revealing identifiers; no `c`/`p`/`data` placeholders | ✅ `series`, `chartWidth`, `observedOn` — full words |
| **VI. Layered Architecture** | Mobile → API only | ✅ No layer change; chart consumes hook-derived props |
| **VII. Strong Typing & Schema Validation** | `strict`, no `any`, `type` over `interface`, `@root`/`@src` aliases | ✅ `PriceTrendChartProps` as `type`; reuses existing `ChartSeries`/`ChartLegendEntry`/`ChartPoint`; no wire-boundary change → no new schema |
| **VIII. Error Transparency** | Errors surfaced, not swallowed | ✅ `error`/`empty`/`loading` branches unchanged; chart renders only in `ready` |
| **IX. Public API Discipline** | Pure barrel `index.ts`; JSDoc `@example` on public fns | ✅ `card-detail-sheet/index.ts` stays a pure barrel (re-exports `CardDetailSheetContainer` only — `PriceTrendChart` is feature-internal); JSDoc + `@example` on `PriceTrendChart` |
| **X. Component Architecture (Mobile)** | Screen → Container → Hook → View; FC rule; memoisation; data-fetching composition; state locality | ✅ `PriceTrendChart` is a leaf presentational `FC`, props-only (no state/effect/fetch); `chartSeries`/`chartLegend` already derived in the hook with `useMemo`; chart width derived from `useWindowDimensions` is a pure render value (no effect); no new store |
| **XI. Dependency Currency** | New packages at current stable | ✅ `react-native-gifted-charts@^1.4.77` **is** current stable (released 2026-05-19) — see Dependency Currency Check |

**Initial gate result: PASS — no violations, no Complexity Tracking rows required.** The earlier Skia/`react-native-graph` draft of this plan carried a justified Simplicity deviation; the chosen SVG path removes it entirely. Phase 0 is unblocked.

### Dependency Currency Check (Principle XI)

This feature adds packages, so the table is required. **All are installed via `expo install`** (not `pnpm add`) so Expo resolves the versions compatible with SDK 54 / RN 0.81 — the Principle XI framework-mandated version path.

| Package | Workspace | Chosen version | Current stable | Justification (only if off-stable) |
|---|---|---|---|---|
| `react-native-gifted-charts` | `apps/mobile` | `^1.4.77` | `^1.4.77` (2026-05-19) | _current stable — no entry needed_ |
| `expo-linear-gradient` | `apps/mobile` | resolved by `expo install` (Expo-pinned for SDK 54) | Expo-pinned | **Framework carve-out (Principle XI)** — Expo SDK pins the version compatible with SDK 54; `expo install` uses that pin rather than npm-latest. Not a downgrade. |
| `react-native-svg` | `apps/mobile` | `15.12.1` (already installed) | `15.12.1` (SDK 54 pin) | _already at the SDK-54 pin — `expo install` re-confirms it_ |

> `react-native-svg` (already installed) and `expo-linear-gradient` are both **Expo SDK modules bundled in Expo Go**, so **no `expo prebuild` / dev-build step** is required. `expo-linear-gradient` is a declared gifted-charts peer; installing it (which spec 020 skipped) removes a "missing peer" failure class — a likely crash contributor (research.md §2).
>
> **Note on the crash + version:** `^1.4.77` is the same version spec 020 shipped, so the crash is **not** a version bug fixed since — it must be fixed at the call site (install the gradient peer + single-point guard + explicit `width`). See research.md §2.

## Project Structure

### Documentation (this feature)

```text
specs/021-price-trend-chart/
├── plan.md              # This file
├── research.md          # Phase 0 — library choice (SVG vs Skia), crash root-cause, Expo Go
├── data-model.md        # Phase 1 — reused view models + the single-point guard
├── quickstart.md        # Phase 1 — install (no dev build) + manual crash-sweep acceptance
├── contracts/
│   └── price-trend-chart.md   # Phase 1 — PriceTrendChart prop + gifted-charts mock contract
└── tasks.md             # Phase 2 (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

All changes are confined to `apps/mobile`. No `apps/server`, `packages/core`, or `packages/infrastructure` change. The geometry util, view-model types, and the feature hook are **untouched** (reused from spec 020).

```text
apps/mobile/
├── src/
│   ├── components/
│   │   └── card-detail-sheet/
│   │       ├── PriceTrendChart.tsx           # NEW (re-created) — presentational FC over gifted-charts LineChart
│   │       ├── PriceTrendChart.theme.ts      # NEW — useStyles tokens for chart container/legend/axis
│   │       ├── PriceTrendChart.test.tsx      # NEW (write first) — props → mocked LineChart, legend, axis, crash-safety shapes
│   │       ├── CardDetailSheetView.tsx        # EDIT — ready-branch placeholder → <PriceTrendChart …/>
│   │       ├── CardDetailSheetView.test.tsx   # EDIT — assert chart renders in ready state (was "coming soon")
│   │       ├── useCardDetailSheet.ts          # UNCHANGED — already supplies chartSeries/chartLegend
│   │       ├── types.ts                       # EDIT (additive) — add PriceTrendChartProps; ChartPoint/ChartSeries kept
│   │       ├── fixtures.ts                     # UNCHANGED — already covers the four history shapes
│   │       └── index.ts                        # UNCHANGED — pure barrel (PriceTrendChart stays internal)
│   └── utils/
│       ├── priceSeriesToChartData.ts          # UNCHANGED — gifted-charts geometry, already tested
│       └── priceSeriesToChartData.test.ts     # UNCHANGED
├── jest.setup.ts                              # EDIT — restore the react-native-gifted-charts mock (removed at deferral)
├── jest.config.ts                             # UNCHANGED — coverage scope already covers card-detail-sheet
└── package.json                               # EDIT — add react-native-gifted-charts + expo-linear-gradient (+ re-confirm react-native-svg) via `expo install`
```

**Structure Decision**: Mobile-only change inside the existing `apps/mobile/src/components/card-detail-sheet/` feature directory (Principle X four-layer unit). The chart is a **feature-internal leaf component** — *not* exported from `index.ts` (only `CardDetailSheetContainer` is public, Principle IX). This restores the structure spec 020 designed before the chart was deferred; the only files touched are the chart itself, the view's `ready` branch, the restored mock, and the re-added dependency.

## Unit Testing Phase

*GATE: REQUIRED per Constitution Principle III.*

**Test framework**: Jest 30 + `jest-expo` (SDK 54 preset) + `@testing-library/react-native` 13.

> **Mobile mocks:** `react-native-gifted-charts` is a third-party dependency, so its mock MUST live in `apps/mobile/jest.setup.ts` (Mobile mocking conventions). Spec 020 added this mock then removed it during the deferral cleanup — **restore it**: mock `LineChart` to a `react-native` `View` that records its received props (`data`, `data2`, `width`, axis/legend props) so chart tests assert the props passed rather than rendering the real SVG canvas. Per-test `jest.mock(...)` is prohibited — use `jest.spyOn` against the shared mock. `expo-router` is already mocked there; do not re-mock it.
>
> **Mobile view tests:** `PriceTrendChart.test.tsx` and the `CardDetailSheetView.test.tsx` edits MUST call `render(...)` only inside `it(...)` and declare a module-scope `PriceTrendChartWithDefaults: FC<Partial<PriceTrendChartProps>>` (canonical reference: `BinderHomeView.test.tsx`).
>
> **Single root describe:** every test file wraps its `it(...)` calls in exactly one top-level `describe(...)` named for the module under test.

### Test files to create or update

| Test file | Status | Behaviours covered (mapped to FR-### where applicable) |
|---|---|---|
| `apps/mobile/src/components/card-detail-sheet/PriceTrendChart.test.tsx` | new | passes ≤2 datasets (`data`=CK, `data2`=TCGP) to the mocked `LineChart` (FR-001); renders a **3-entry legend** incl. the **disabled MTG Goldfish** entry with no plotted line (FR-003); `30d ago`/`today` x-labels + `$min`/`$max` y-labels (FR-002); each line + legend entry carries a non-colour text label + screen-reader role (FR-006); **single-source input plots exactly one line** (AS4); **a single-observation series does NOT crash** — guarded before reaching `LineChart` (FR-007, [#484](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/484)); an **explicit `width` is always passed** (never NaN/0 in the `formSheet`) (FR-007); gap data points carried (no `$0`) (FR-004) |
| `apps/mobile/src/components/card-detail-sheet/CardDetailSheetView.test.tsx` | update | the `ready` history state now renders `<PriceTrendChart/>` (not the "coming soon" text) (FR-001); `loading`→skeleton, `error`→inline retry, `empty`→"no recent price data" branches unchanged (FR-005) |

> `useCardDetailSheet.test.ts`, `priceSeriesToChartData.test.ts`, and `fixtures.ts` are **not** changed — the data layer they cover is reused as-is. If the single-point guard is implemented inside the chart (not the hook), only the two files above change.

### Coverage target

Project floor: **80% lines / 80% functions / 80% branches / 80% statements**. The existing `./src/components/card-detail-sheet/` 85%-line threshold in `apps/mobile/jest.config.ts` continues to apply and already covers `PriceTrendChart.tsx`. No threshold change.

```jsonc
// apps/mobile/jest.config.ts — unchanged thresholds apply to the new chart
{
  "coverageThreshold": {
    "global": { "branches": 80, "functions": 80, "lines": 80, "statements": 80 },
    "./src/components/card-detail-sheet/": { "lines": 85 }
  }
}
```

### Test execution

`pnpm --filter @my-binder/mobile test` locally; `turbo test` in CI (must exit 0, 100% pass, thresholds honoured). `pnpm --filter @my-binder/mobile typecheck` exit 0. The real SVG render (SC-002/SC-003 crash-safety) is covered by the **quickstart manual acceptance** — and unlike the Skia path, it can be exercised **directly in Expo Go** across all five input shapes, including the single-observation case that triggered the original crash.

## Complexity Tracking

> No Constitution violations — table intentionally empty. (The prior Skia/`react-native-graph` draft required a justified Simplicity deviation for adding `@shopify/react-native-skia`; choosing the SVG path on the already-installed `react-native-svg` removes that deviation, so no justification is needed.)
