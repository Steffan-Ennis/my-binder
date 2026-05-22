# Contract — Mobile hooks & components (spec 020)

Follows the **Data-fetching hook composition rule** (Principle X) and the canonical
`src/components/card/` reference.

## Query hooks (`apps/mobile/src/hooks/` — NEW)

Each mirrors `useCardImagesQuery`: typed `UseQueryResult<…, ApiError>`, `enabled` gated on
`status === 'active' && Boolean(id)`, project-default retry (`shouldRetry` / `computeRetryDelay`).

| Hook | queryFn | queryKey | Returns |
|---|---|---|---|
| `useCardDetailQuery(id)` | `apiClient.getCard(id)` | `['cards','detail', id]` | `UseQueryResult<Card, ApiError>` |
| `useCardPricesQuery(id)` | `apiClient.getCardPrices(id)` | `['cards','prices', id]` | `UseQueryResult<CardPricesResponse, ApiError>` |
| `useCardPriceHistoryQuery(id, days=30)` | `apiClient.getCardPriceHistory(id, days)` | `['cards','prices','history', id, days]` | `UseQueryResult<CardPriceHistoryResponse, ApiError>` |

> The detail query key `['cards','detail', id]` is the invalidation target of the spec-019 stepper
> mutation (FR-011). Spec FR-011's `['card', id]` shorthand maps to this namespaced key.

## Feature hook `useCardDetailSheet(options: UseCardDetailSheetOptions): CardDetailSheetViewProps`

- Composes the three query hooks; destructures only consumed fields at the boundary (rule 1).
- Derives `priceRows`, `chartSeries`, `chartLegend`, `pricesStatus`, `historyStatus`,
  `numberOwned`, `canDecrement` with `useMemo` (rule 2 + Hook memoisation rule). Goldfish row is a
  constant disabled placeholder; Goldfish is never a chart series.
- Handlers (all `useCallback`): `onClose` (`router.back()`), `onIncrement` / `onDecrement`
  (call spec-019 `useUpdateBinderEntryMutation`; `onDecrement` no-op at 0), `onRetryPrices` /
  `onRetryHistory` (`refetch` the respective query).
- Passes `error` through unwrapped (rule 3). Returns a memoised object (v1.16.0).
- **Mock-first**: during Phase A the hook is exercised with fixture data; the live query wiring
  and the spec-019 mutation land in Phase B/C.

## Presentational components

- `CardDetailSheetView` (`FC<CardDetailSheetViewProps>`) — pure JSX: hero (image + name + set +
  type + oracle), `In your binder` stepper block, three price rows (Goldfish disabled), the
  `PriceTrendChart`, skeleton (FR-008) / inline-error+retry (FR-009) / empty annotation (FR-004)
  branches, close control (FR-005). Styles via `CardDetailSheetView.theme.ts` `useStyles`.
- `PriceTrendChart` (`FC<PriceTrendChartProps>`) — thin wrapper over gifted-charts `LineChart`:
  maps `chartSeries` to `data` / `data2`, renders the 3-entry legend (Goldfish disabled, no line),
  axis labels (`30d ago` / `today`, `$min` / `$max`), and the "no recent price data" annotation
  when `historyStatus === 'empty'`. No data fetching, no state, no effects.
- `CardDetailSheetContainer` (`FC<{ printingId: string }>`) — calls the hook, passes individual
  named props (Container prop-passing rule; no spread).

## Route wiring

- `app/(authenticated)/(tabs)/catalogue/_layout.tsx` — add a `card-detail` `Stack.Screen` with
  `presentation: 'formSheet'`, `animation: 'slide_from_bottom'`, `sheetCornerRadius: 24`
  (mirrors `filter-modal`). `catalogue/card-detail.tsx` reads `printingId` route param → container.
- `app/(authenticated)/(tabs)/binder/_layout.tsx` (NEW) — promote the binder tab to a Stack with
  the binder screen + the same `card-detail` form-sheet route. Same container, Binder surface.
- `useCatalogue` / `useBinderHome` pocket-press handler → `router.navigate('/…/card-detail?id=<printingId>')`.
  Skeleton/empty pockets do not navigate (Edge Case "Tap during page load").
