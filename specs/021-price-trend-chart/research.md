# Phase 0 Research — 30-Day Price Trend Chart (spec 021)

The chosen direction is **SVG-based charting that keeps the app in Expo Go** (no new native module). This phase records why that beats the Skia alternative, which SVG library to use, and — critically — the **root cause of the crash that caused spec 020 to defer the chart**, since re-introducing the same library without fixing the trigger would simply reproduce it.

## 1. Library choice: `react-native-gifted-charts` (SVG) over a Skia path

- **Decision**: Re-introduce **`react-native-gifted-charts@^1.4.77`** (`LineChart`), built on the **already-installed `react-native-svg@15.12.1`**. Install via **`expo install react-native-gifted-charts expo-linear-gradient react-native-svg`** so Expo pins SDK-54-compatible versions and the workspace tree resolves through the Expo CLI rather than raw npm-latest. **`expo-linear-gradient` is installed** — it is a declared gifted-charts peer (see §2: its absence in spec 020 is a likely crash contributor), and it is an Expo SDK module already in the Expo Go bundle, so it costs nothing against the Expo-Go promise. Do **not** use `@shopify/react-native-skia` / `react-native-graph` / `victory-native` (XL).
- **Why SVG, not Skia**: `react-native-svg` is **bundled in Expo Go**, so an SVG chart adds **zero native modules** and the app keeps running in Expo Go. The project's *current* native deps (`react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens`, `react-native-svg`) are **all** in the Expo Go bundle — so adding `@shopify/react-native-skia` (required by `react-native-graph` and by `victory-native` XL) would be the **first** dependency to force a development build / EAS Build. The user chose to avoid that.
- **Why gifted-charts specifically** (among SVG options):
  - It is **actively maintained** and at **current stable** (v1.4.77, 2026-05-19) — satisfies Principle XI. `victory-native@legacy` is the **frozen** legacy branch (superseded by the Skia XL rewrite) → would be a Principle XI deprecated-dependency strike; `react-native-chart-kit` is stale.
  - It is the library spec 020 already designed the data layer around: `priceSeriesToChartData` emits the gifted-charts `{ value, hideDataPoint }` shape, `ChartSeries.data` is `ChartPoint[]`, and `useCardDetailSheet` already derives `chartSeries`/`chartLegend`. Reusing it means **the geometry, types, and derivation are untouched** (realigns with spec FR-008 + Out-of-Scope) — the only new code is the presentational chart.
  - It is the project's own recorded preference ("use a real library, not primitives — chart = `react-native-gifted-charts`"). The SVG path is a *real chart library*, **not** hand-drawn `react-native-svg` primitives.
- **Alternatives considered**: (a) `react-native-graph` / `victory-native` XL (Skia) — rejected: forces a dev build, the explicit thing the user wants to avoid. (b) `victory-native@legacy` (SVG) — rejected: frozen/legacy (Principle XI). (c) Hand-draw with `react-native-svg` — rejected by project memory (real lib, not primitives).

## 2. Crash root cause — why the spec-020 chart crashed, and the fix

This is the headline risk (FR-007/SC-003). The chart is being re-introduced with the **same library and version** that crashed (v1.4.77 is current stable — the crash is *not* a since-fixed version bug), so the trigger must be fixed at the call site, not by a bump.

- **Primary suspect — `data.length === 1` crash**: gifted-charts [**Issue #484** — "LineChart Crash when data.length is 1, everything fine when data is not available or more than 1"](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/484). A card with **exactly one price observation** in the 30-day window produces a single-point series. `priceSeriesToChartData` currently carries the value forward across gap days *only when the input is non-empty*, but a one-observation input can still collapse to a degenerate single rendered point depending on the window — and an empty live source paired with a one-point source feeds `LineChart` a length-1 dataset. This is the most likely original trigger (a single observation is a common real case).
  - **Fix**: guard before `LineChart` — a series with `< 2` plottable points is either (a) padded to 2 points (duplicate the observation so a flat line draws) or (b) rendered as a single dot via gifted-charts' point-only mode. The plan pads to 2 (simpler, always draws a line). Covered by a dedicated unit test (FR-007).
- **Secondary suspect — NaN/0 width inside the native `formSheet`**: gifted-charts auto-measures its parent; inside an Expo Router `presentation: 'formSheet'` the measured width can be `0`/`NaN` on first layout, producing invalid SVG path coordinates → crash or blank. The docs explicitly call for an explicit `width` prop in constrained containers.
  - **Fix**: always pass an **explicit `width`** computed from `useWindowDimensions().width` minus the sheet's horizontal padding (a pure render value — no effect). Never rely on auto-measure. Covered by a unit test asserting a finite `width` prop is always passed (FR-007).
- **Additional suspect — missing `expo-linear-gradient` peer**: `react-native-gifted-charts` declares a linear-gradient module (`react-native-linear-gradient` / `expo-linear-gradient`) as a peer and references it internally. Spec 020 deliberately **did not install it** ("no gradient fills"), which can surface as a "missing module / undefined component" error at chart render — a plausible contributor to the original crash independent of the data shape.
  - **Fix**: install **`expo-linear-gradient`** (Expo SDK module, in the Expo Go bundle) via `expo install`. This satisfies the peer regardless of whether gradient fills are used. No native build step is added.
- **Tertiary hygiene**: ensure no `NaN`/`Infinity` value reaches `data`/`data2` (e.g. from a divide in y-scaling) and that an all-empty history never reaches the chart at all (the `historyStatus === 'empty'` branch owns the "no recent price data" annotation — FR-004). Both already hold in the surviving derivation; re-verified by tests.
- **Verification split**: unit tests (mocked `LineChart`) prove the **prop contract** for every input shape — including the length-1 case — so no exception is thrown in the React tree; the **quickstart manual sweep in Expo Go** proves the real SVG render does not crash on a single-observation card (the exact scenario most likely behind the original crash).

## 3. Two lines, legend, gaps, axes — all native to gifted-charts

Unlike the Skia single-line library, gifted-charts handles the multi-line shape directly, so no overlay/hand-built workarounds are needed:

- **Two lines**: pass Card Kingdom as `data` and TCG Player as `data2` to one `LineChart` (FR-001). When only one live source has observations, pass only `data` (one line, no false-zero second line — AS4).
- **Gaps (FR-004)**: `priceSeriesToChartData` already emits gap points with `hideDataPoint: true` carrying the last-known value (never `$0`); gifted-charts hides those dots so a gap reads as a gap while the line stays continuous at a real value. **Reused unchanged.**
- **Empty (FR-004)**: when both series are empty the chart is never rendered — the view's `empty` branch shows "no recent price data". **Reused unchanged.**
- **Legend (FR-003)**: rendered as plain `react-native` views from the existing `chartLegend` (3 entries): Card Kingdom + TCG Player active, MTG Goldfish disabled "coming soon" with no line. **Reused unchanged.**
- **Axis labels (FR-002)**: `30d ago`/`today` x-labels and `$min`/`$max` y-bounds via gifted-charts axis props (or plain `Text`), derived from the observed range — matching the `$13`/`$20` design framing.
- **Colour independence (FR-006, WCAG 1.4.1)**: each line + legend entry carries a text label and screen-reader exposure; lines may add distinct dash/marker patterns.

## 4. Runtime: Expo Go works (no dev build required)

- **Decision**: This feature requires **no `expo prebuild` and no new native build**. `react-native-svg` (gifted-charts' only native peer) is already installed and is part of the Expo Go bundle, so the chart renders in Expo Go (`expo start`) as well as dev/EAS builds.
- **Rationale**: this was the deciding factor in choosing the SVG path — the manual crash-sweep acceptance (§2) can be run directly in Expo Go on a device, with no build step, which also makes iterating on the crash fix fast.

## 5. Testing strategy (Principle III)

- **Decision**: **Restore** the `react-native-gifted-charts` mock in `apps/mobile/jest.setup.ts` (spec 020 added it, then removed it during the deferral cleanup) — `LineChart` → a `react-native` `View` recording its props (`data`, `data2`, `width`, axis/legend props). Write `PriceTrendChart.test.tsx` **first** (Red), covering every input shape incl. the length-1 case and the explicit-`width` assertion, then implement. Update `CardDetailSheetView.test.tsx` (ready → chart). `useCardDetailSheet.test.ts`, `priceSeriesToChartData.test.ts`, and `fixtures.ts` are unchanged.
- **Rationale**: mirrors spec 020's mock-first approach (the geometry/hook half is already proven); the mock makes the prop contract deterministic and CI-safe, and the real-render crash safety is verified in Expo Go.

## Sources

- [react-native-gifted-charts — GitHub](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts)
- [gifted-charts Issue #484 — LineChart crash when data.length is 1](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/484)
- [gifted-charts LineChart props (width, axis, legend)](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/blob/master/docs/LineChart/LineChartProps.md)
- [react-native-svg — Expo Documentation (bundled in Expo Go)](https://docs.expo.dev/versions/latest/sdk/svg/)
- [Victory Native (XL) requires native modules / dev build](https://github.com/FormidableLabs/victory-native-xl)
