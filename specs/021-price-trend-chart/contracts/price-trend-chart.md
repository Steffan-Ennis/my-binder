# Contract — `PriceTrendChart` component & test mock (spec 021)

This feature exposes **no new external/wire interface** (no API, no schema, no `@my-binder/core` change). The only contract is the **mobile component prop interface** and the **restored Jest mock** of the chart library. Follows Principle X (presentational leaf view) and Principle III (Mobile mocking conventions).

## Component `PriceTrendChart`

`apps/mobile/src/components/card-detail-sheet/PriceTrendChart.tsx` — **feature-internal** (NOT exported from `index.ts`).

```ts
const PriceTrendChart: FC<PriceTrendChartProps>;

type PriceTrendChartProps = {
  chartSeries: ChartSeries[];      // 0–2 live series; each { key, label, color, data: ChartPoint[] }
  chartLegend: ChartLegendEntry[]; // exactly 3 entries: CK active, MTG Goldfish disabled, TCGP active
};
```

**Contract guarantees:**

- **Props-only.** No data fetching, no `useState`, no `useEffect`, no subscriptions (Principle X leaf view). Inputs arrive as props from `useCardDetailSheet` (unchanged).
- **Rendered only in the `ready` history state.** `CardDetailSheetView` mounts `<PriceTrendChart/>` only when `historyStatus === 'ready'`; the chart never receives an all-empty `chartSeries` (the `empty` branch owns the "no recent price data" annotation — FR-004/FR-005).
- **Two lines via one `LineChart`.** Card Kingdom → `data`, TCG Player → `data2`. A series with no observations is **omitted** (no false-zero line) — AS4.
- **Single-point guard (FR-007).** Any series with `data.length === 1` is padded to 2 points before reaching `LineChart` (the [#484](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/484) crash trigger). A `length === 0` series is omitted.
- **Explicit `width` (FR-007).** A finite `width` (from `useWindowDimensions().width` − sheet padding) is **always** passed; the chart never auto-measures to `NaN`/`0` inside the `formSheet`.
- **Gaps (FR-004).** `ChartPoint.hideDataPoint` markers (already produced by `priceSeriesToChartData`) hide the dot on missing days so a gap reads as a gap at the carried-forward value — never `$0`.
- **Legend (FR-003).** Rendered from `chartLegend` as plain RN views: CK + TCGP active (swatch + label), MTG Goldfish disabled "coming soon" with **no plotted line**.
- **Axis labels (FR-002).** `30d ago` (left) / `today` (right) x-labels; `$min` / `$max` y-bounds from the observed range.
- **Colour-independent (FR-006).** Every line + legend entry carries a text label and screen-reader exposure (`accessibilityLabel`/`accessibilityRole`); the disabled Goldfish entry sets `accessibilityState={{ disabled: true }}`. No information by colour alone (WCAG 1.4.1).
- **Styles** via `useStyles` in `PriceTrendChart.theme.ts` (Style co-location) — no inline `StyleSheet.create`.

## Jest mock contract (`apps/mobile/jest.setup.ts`) — RESTORE

Spec 020 added this mock then removed it during the deferral cleanup. Restore it:

```ts
// Shared mock — NOT per-test jest.mock(...). Records props for assertion.
jest.mock('react-native-gifted-charts', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    LineChart: (props) => <View testID="line-chart" {...passthroughTestProps(props)} />,
  };
});
```

- `LineChart` → a `react-native` `View` recording `data`, `data2`, `width`, and axis/legend props so tests assert **what the chart hands the library**, not the real SVG canvas.
- Tests use `jest.spyOn` against this shared mock for per-test variation (Mobile mocking conventions); they do **not** add in-file `jest.mock('react-native-gifted-charts')`.
- `expo-router` is already mocked in `jest.setup.ts` — do not re-mock.

## Upstream contract reused unchanged (spec 020)

- `priceSeriesToChartData(points, { days }) → ChartPoint[]` — gifted-charts geometry, gap markers, 30-day axis.
- `useCardDetailSheet` derivation of `chartSeries` / `chartLegend` / `historyStatus`.
- `useCardPriceHistoryQuery(id, days=30)` and `GET /cards/:id/prices/history?days=30`.

This feature touches **none** of the above — it only consumes `chartSeries` + `chartLegend` in the `ready` branch.
