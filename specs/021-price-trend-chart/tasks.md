# Tasks: 30-Day Price Trend Chart

**Input**: Design documents from `/specs/021-price-trend-chart/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/price-trend-chart.md

**Tests**: Per Constitution Principle III, **unit tests are REQUIRED** and MUST be written with **Jest** (`<filename>.test.tsx` co-located beside the file under test), **written first and made to FAIL before implementation**. The real SVG render (crash-safety SC-002/SC-003) is verified by the quickstart manual sweep in Expo Go.

**Organization**: This feature has a single user story (US1, P1). Setup installs the dependency; Foundational restores the test mock and adds the one additive type; US1 writes the tests then implements the chart and wires it into the view; Polish runs the validation gate and the manual crash-sweep.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1)
- All paths are absolute from the repo root; this feature touches **only** `apps/mobile`

## What is NOT touched (reused unchanged from spec 020 — do NOT edit)

> The data layer shipped by spec 020 is reused as-is (FR-008 + spec Out-of-Scope). **Do not edit** any of:
> - `apps/mobile/src/utils/priceSeriesToChartData.ts` (+ `.test.ts`) — geometry / 30-day axis / gap markers
> - `apps/mobile/src/components/card-detail-sheet/useCardDetailSheet.ts` (+ `.test.ts`) — already derives `chartSeries` / `chartLegend` / `historyStatus`
> - `apps/mobile/src/components/card-detail-sheet/fixtures.ts` — already covers the four history shapes
> - `apps/mobile/src/components/card-detail-sheet/index.ts` — pure barrel; `PriceTrendChart` stays feature-internal (Principle IX)
> - `apps/server/*`, `packages/core/*` — no wire-type, schema, route, provider, or service change

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the re-introduced chart dependency and its peers at the SDK-54-pinned versions, keeping the app in Expo Go (no native build).

- [X] T001 Install the chart dependency and peers via `expo install` from `apps/mobile`: run `npx expo install react-native-gifted-charts expo-linear-gradient react-native-svg` (resolves SDK-54-compatible versions; `expo-linear-gradient` satisfies the gifted-charts peer that spec 020 skipped — research.md §2), then run `pnpm install` at the repo root to re-resolve `pnpm-lock.yaml`. Verify `apps/mobile/package.json` now declares `react-native-gifted-charts` (`^1.4.77`) and `expo-linear-gradient`, with `react-native-svg` re-confirmed at the SDK-54 pin. No `expo prebuild` / native rebuild.

**Checkpoint**: Dependency present; `pnpm --filter @my-binder/mobile typecheck` can resolve `react-native-gifted-charts` types.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Restore the test mock and add the single additive type that BOTH the US1 test and the component depend on.

**⚠️ CRITICAL**: No US1 work can begin until this phase is complete — the chart test cannot run without the restored mock, and neither the test nor the component compile without `PriceTrendChartProps`.

- [X] T002 [P] Restore the `react-native-gifted-charts` mock in `apps/mobile/jest.setup.ts`: replace the spec-020 deferral comment (lines ~51–53, "the chart … is deferred; the dependency was removed, so there is no chart mock here") with a shared `jest.mock('react-native-gifted-charts', …)` factory that maps `LineChart` to a `react-native` `View` with `testID="line-chart"` recording its received props (`data`, `data2`, `width`, axis/legend props) so tests assert the props handed to the library, not the real SVG canvas (contracts/price-trend-chart.md "Jest mock contract"). Do NOT re-mock `expo-router` (already mocked there). Per-test `jest.mock(...)` is prohibited — tests use `jest.spyOn` against this shared mock.
- [X] T003 [P] Add the additive `PriceTrendChartProps` type to `apps/mobile/src/components/card-detail-sheet/types.ts`: `export type PriceTrendChartProps = { chartSeries: ChartSeries[]; chartLegend: ChartLegendEntry[] };` (data-model.md §B). `ChartPoint` / `ChartSeries` / `ChartLegendEntry` / `CardDetailSheetViewProps` are already present — leave them unchanged.

**Checkpoint**: Mock restored, type exported. `pnpm --filter @my-binder/mobile typecheck` exits 0.

> **Phase completion validation gate (Constitution Principle III).** Run `turbo test --filter=@my-binder/mobile` and `turbo typecheck --filter=@my-binder/mobile`. **Both MUST exit 0 and the Jest suite MUST report a 100% pass rate.** Any failure MUST be investigated at root cause and fixed in-place. `.skip` / `.todo` / quarantine / retry-until-green are prohibited.

---

## Phase 3: User Story 1 - See the 30-Day Price Trend Plotted (Priority: P1) 🎯 MVP

**Goal**: Replace the "Price trend chart coming soon" placeholder in the detail sheet's "30-DAY TREND" data-ready state with a real line chart plotting Card Kingdom and TCG Player over 30 days, with a three-item legend (MTG Goldfish disabled), colour-independent source differentiation, and crash-free rendering across every input shape.

**Independent Test**: Open the detail sheet for a card with non-empty 30-day history → the section renders an actual chart (not "coming soon") with up to two plotted lines (Card Kingdom, TCG Player), a 30-day x-axis (`30d ago` → `today`), a price y-axis bounded to the observed range, and a three-entry legend (MTG Goldfish disabled, no line). The app does not crash for any of: both sources present, one source only, a single observation, a gapped series, an all-empty series.

### Tests for User Story 1 (Jest unit tests REQUIRED — write FIRST, ensure they FAIL) ⚠️

> **NOTE: Write these tests FIRST and confirm they FAIL before any implementation (Principle III).** Each file wraps its `it(...)` in exactly one top-level `describe(...)` named for the module under test; `render(...)` is called only inside `it(...)`; a module-scope `*WithDefaults: FC<Partial<…Props>>` wrapper is declared (canonical reference: `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx`). Use `jest.spyOn` against the shared `react-native-gifted-charts` mock from T002 — no in-file `jest.mock`.

- [X] T004 [P] [US1] Write `apps/mobile/src/components/card-detail-sheet/PriceTrendChart.test.tsx` (NEW) with a module-scope `PriceTrendChartWithDefaults: FC<Partial<PriceTrendChartProps>>`, asserting against the mocked `LineChart` (testID `line-chart`): passes ≤2 datasets — Card Kingdom → `data`, TCG Player → `data2` (FR-001); renders a **3-entry legend** including the **disabled MTG Goldfish** entry with `accessibilityState={{ disabled: true }}` and no plotted line (FR-003); x-axis labelled `30d ago` / `today` and y-bounds `$min` / `$max` from the observed range (FR-002); each line + legend entry carries a non-colour text label and screen-reader role/label (FR-006); a **single-source input plots exactly one line** with no false-zero second line (AS4); a **single-observation series does NOT crash** — a `data.length === 1` series is padded to 2 points before reaching `LineChart` ([#484](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/484), FR-007); an **explicit finite `width`** is always passed, never NaN/0 (FR-007); gap points (`hideDataPoint`) are carried through with no `$0` dip (FR-004). Confirm the suite FAILS (component does not exist yet).
- [X] T005 [P] [US1] Update `apps/mobile/src/components/card-detail-sheet/CardDetailSheetView.test.tsx`: replace the `describe('trend chart deferral (FR-003 deferred)', …)` block (lines ~235–239 asserting `getByText('Price trend chart coming soon')`) with an assertion that the `ready` history state now renders the chart (e.g. `getByTestId('line-chart')` from the shared mock) and **no** "coming soon" text (FR-001). Keep the existing `loading`→skeleton, `error`→inline retry, and `empty`→"no recent price data" assertions unchanged (FR-005). Confirm the updated block FAILS before implementation.

### Implementation for User Story 1

- [X] T006 [P] [US1] Create `apps/mobile/src/components/card-detail-sheet/PriceTrendChart.theme.ts` (NEW): a `useStyles` hook returning tokens for the chart container, legend row/swatch/label (incl. a disabled-entry style), and axis labels — sourced from `apps/mobile/constants/theme.ts`. No inline `StyleSheet.create` in the component (Style co-location).
- [X] T007 [US1] Create `apps/mobile/src/components/card-detail-sheet/PriceTrendChart.tsx` (NEW) — presentational `FC<PriceTrendChartProps>`, props-only (no `useState`/`useEffect`/fetch): renders one `react-native-gifted-charts` `LineChart` with Card Kingdom → `data` and TCG Player → `data2`, **omitting** a series with `data.length === 0` (no false-zero line) and **padding any `data.length === 1` series to 2 identical points** (the #484 single-point crash guard — FR-007); always passes an **explicit finite `width`** derived from `useWindowDimensions().width` minus the sheet's horizontal padding (FR-007, no auto-measure in the `formSheet`); renders the `30d ago`/`today` x-labels and `$min`/`$max` y-bounds (FR-002); renders the legend from `chartLegend` as plain RN views — CK + TCGP active (swatch + label), MTG Goldfish disabled "coming soon" with no line (FR-003); attaches `accessibilityRole`/`accessibilityLabel` to every line + legend entry and `accessibilityState={{ disabled: true }}` to the Goldfish entry (FR-006); imports styles from `PriceTrendChart.theme.ts` (T006); JSDoc with `@example` on the component. Depends on T003, T006. Makes T004 pass. Keep it feature-internal (do NOT export from `index.ts`).
- [X] T008 [US1] Wire the chart into `apps/mobile/src/components/card-detail-sheet/CardDetailSheetView.tsx`: import `PriceTrendChart`, add `chartSeries` and `chartLegend` to the component's prop destructure (currently absent — lines ~75–90 destructure `historyStatus`/`onRetryHistory` but not the chart props), and in the "30-DAY TREND" section replace the `ready`-branch `<Text style={styles.trendPlaceholder}>Price trend chart coming soon</Text>` (line ~164) with `<PriceTrendChart chartSeries={chartSeries} chartLegend={chartLegend} />`. Leave the `loading` / `error` / `empty` branches unchanged (FR-005). Update the file's leading comment to reflect that the chart is no longer deferred. Depends on T007. Makes T005 pass.

**Checkpoint**: The "30-DAY TREND" section renders a real chart in the `ready` state across all input shapes; US1 is fully functional and independently testable.

> **Phase completion validation gate (Constitution Principle III).** Run `turbo test --filter=@my-binder/mobile` and `turbo typecheck --filter=@my-binder/mobile`. **Both MUST exit 0 and Jest MUST report a 100% pass rate**, honouring the existing `./src/components/card-detail-sheet/` 85%-line coverage threshold in `apps/mobile/jest.config.ts`. Investigate every failure at root cause before Polish.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Full-workspace verification and the real-render crash-sweep that the unit tests (mocked `LineChart`) cannot cover.

- [X] T009 Run the full gate: `pnpm --filter @my-binder/mobile test`, `pnpm --filter @my-binder/mobile typecheck`, then `turbo test && turbo typecheck` (all 4 workspaces). All MUST exit 0 with a 100% Jest pass rate and coverage thresholds honoured.
  - **Mobile (this feature): GREEN** — `@my-binder/mobile` 49 suites / 328 tests pass; `turbo typecheck` 4/4 workspaces pass; `card-detail-sheet/` coverage thresholds honoured (`PriceTrendChart.tsx` 100% stmts/branches/funcs/lines). `@my-binder/core` 34 tests pass.
  - **Pre-existing, out-of-scope:** `@my-binder/server` has 4 failing tests in `registry.test.ts` / `provider.test.ts` (`Error: parquet read failed` from the MTGJSON SDK — no parquet cache/network in this environment). Verified by stashing all spec-021 changes and re-running: the same 4 fail on a clean tree. This feature touches no server code or deps (lockfile diff adds only the mobile chart packages), so these failures are environmental and unrelated.
- [ ] T010 Run the quickstart manual acceptance in Expo Go (`cd apps/mobile && pnpm dev`) per `specs/021-price-trend-chart/quickstart.md` — verify FR-001/002/003/004/005/006 and the **SC-003 crash-sweep across all five input shapes**, especially a card with a **single price observation** (the [#484](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/484) trigger that caused the original deferral), plus SC-002 (chart within ~1 s) and SC-004 (greyscale/VoiceOver source differentiation).
  - **MANUAL — pending user.** Requires a device/simulator running Expo Go; cannot be automated in this environment. The crash root-cause fixes it validates are unit-covered (single-point pad + explicit finite width in `PriceTrendChart.test.tsx`), but the real SVG render across all five shapes must still be swept by hand before sign-off.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 blocks everything (the package must resolve).
- **Foundational (Phase 2)**: Depends on T001. T002 + T003 are parallel; both BLOCK US1.
- **User Story 1 (Phase 3)**: Depends on Phase 2. Tests (T004, T005) before implementation (T006→T007→T008).
- **Polish (Phase 4)**: Depends on US1 completion.

### Task-Level Dependencies

- T001 → (T002, T003) → (T004, T005) → T006 → T007 → T008 → T009 → T010
- T002 ∥ T003 (different files)
- T004 ∥ T005 (different files; both must FAIL before T006–T008)
- T006 ∥ T004/T005 (theme is standalone), but T006 precedes T007 (component imports the theme)
- T007 requires T003 (type) + T006 (theme); satisfies T004
- T008 requires T007; satisfies T005

### Within User Story 1

- Tests (T004, T005) MUST be written and FAIL before implementation (Principle III)
- Theme (T006) before component (T007)
- Component (T007) before view wiring (T008)

### Parallel Opportunities

- Phase 2: T002 and T003 together
- Phase 3 tests: T004 and T005 together (and T006 can be authored alongside them)

---

## Parallel Example: Phase 2 + US1 test-writing

```bash
# Foundational (different files, no inter-dependency):
Task: "Restore react-native-gifted-charts mock in apps/mobile/jest.setup.ts"   # T002
Task: "Add PriceTrendChartProps to apps/mobile/src/components/card-detail-sheet/types.ts"  # T003

# US1 tests (write first, confirm RED):
Task: "Write PriceTrendChart.test.tsx"            # T004
Task: "Update CardDetailSheetView.test.tsx ready-state assertion"  # T005
```

---

## Implementation Strategy

### MVP (this feature = User Story 1 only)

1. Phase 1: install the dependency (`expo install`) — no dev build.
2. Phase 2: restore the mock + add the type (CRITICAL — blocks US1).
3. Phase 3: write the two tests RED → theme → component → wire the view → GREEN.
4. **STOP and VALIDATE**: `turbo test && turbo typecheck` green; coverage threshold honoured.
5. Phase 4: Expo Go crash-sweep across all five input shapes (the deferral bar).

### Notes

- [P] tasks = different files, no dependencies
- This feature has one user story; there is no cross-story independence to preserve
- Verify the two tests FAIL before implementing (T004/T005 before T006–T008)
- The single-point guard (pad length-1 → 2) and the explicit `width` are the two crash root-cause fixes (research.md §2) — both are pure render-time logic, covered by T004
- Commit after each task or logical group
- **Phase completion validation gate (Principle III)**: every Checkpoint is gated on `turbo test` + `turbo typecheck` exiting 0 with a 100% Jest pass rate; `.skip` / `.todo` / quarantine / retry-until-green are prohibited
