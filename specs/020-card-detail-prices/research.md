# Phase 0 Research — Card Detail Sheet (spec 020)

All Technical-Context unknowns are resolved below. No `NEEDS CLARIFICATION` remains.

## 1. Charting: how to render the 30-day two-line trend

- **Decision**: Use **`react-native-gifted-charts@^1.4.77`** (`LineChart`). It is *not* installed
  — this feature adds it. It builds on the **already-installed `react-native-svg@15.12.1`**
  (a required peer); `expo-linear-gradient` / `react-native-linear-gradient` are *optional* peers
  for gradient fills only, which our thin-line design does not use, so **we add exactly one new
  package**. A thin presentational `PriceTrendChart` wraps `LineChart`; a pure util
  `src/utils/priceSeriesToChartData.ts` maps each `PricePoint[]` series onto a 30-day axis (with
  gaps) and into the gifted-charts data shape.
- **Rationale**: The earlier read of *"don't reimplement an SVG graph library, use one already
  available"* as "draw it by hand with `react-native-svg`" was wrong — `react-native-svg` is a
  primitives renderer, **not** a chart library. The directive means *use a real charting library
  rather than reinventing one*. The project had none, so one is added. `react-native-gifted-charts`
  is the lightest real option for a 2-line trend: it reuses the SVG dep already present, has a
  simple multi-dataset `LineChart` API with gap + dashed-line + legend support, is actively
  maintained, runs on Expo/native/web, and has no native module beyond `react-native-svg` (so it
  is New-Architecture / Expo SDK 54 safe). Peer ranges are wildcards (`react: *`,
  `react-native: *`) — no conflict with React 19.1 / RN 0.81.5.
- **Alternatives considered** (user-reviewed): `victory-native (XL)` — most customizable but pulls
  in `@shopify/react-native-skia` (large native dep), overkill for two lines; `react-native-wagmi-charts`
  — purpose-built for price charts but Reanimated-2-era, real compatibility risk on Reanimated 4 /
  React 19; `react-native-graph` (margelo) — Skia-based, line-only, Skia-heavy. All rejected in
  favour of the lightest library that still provides a real chart API (Principle I).
- **Gap handling (FR-004)**: gifted-charts renders a multi-point line per source; missing days map
  to gap points so a line breaks rather than dipping to zero. `priceSeriesToChartData` aligns each
  series to the 30-day axis and emits gap markers.
- **Empty handling (FR-004)**: when both live series are empty, `PriceTrendChart` renders the axes
  region with a "no recent price data" annotation instead of an empty plot (decided in the wrapper,
  not inside `LineChart`).
- **MTG Goldfish (FR-002/FR-003)**: rendered as a disabled legend entry only — never passed as a
  `LineChart` dataset, so no line is plotted.

## 2. Sheet presentation: how the bottom sheet slides up + dismisses

- **Decision**: Use Expo Router's native **`presentation: 'formSheet'`** route option (via
  `react-native-screens`, already installed), mirroring the existing
  `catalogue/_layout.tsx` + `catalogue/filter-modal.tsx` pattern (`animation: 'slide_from_bottom'`,
  `sheetAllowedDetents`, `sheetCornerRadius: 24`). A new `card-detail` route renders
  `<CardDetailSheetContainer />`.
- **Rationale**: Zero new dependencies; the swipe-down-to-dismiss + close affordance + slide-up
  animation are provided natively. Reuses a proven in-repo pattern, so the Binder/Catalogue
  open/dismiss behaviour (FR-001/FR-005) is identical by construction. Dismiss restores the
  underlying page because the sheet is a stacked route over the unchanged screen.
- **Alternatives considered**: `@gorhom/bottom-sheet` (new dep, rejected per the same directive
  and Principle XI); a hand-rolled `reanimated` + `gesture-handler` sheet (more code, reinvents
  what `formSheet` already gives — rejected by Principle I).
- **Both surfaces**: register the `card-detail` form-sheet route under the catalogue Stack **and**
  under a new binder Stack (binder tab promoted to a Stack like the catalogue tab). The component
  is shared; only the route file is duplicated per surface.

## 3. Build order: mock-first before backend integration

- **Decision**: Three phases — (A) **mock-first UI**: `priceChartGeometry`, `PriceTrendChart`,
  `CardDetailSheetView`/`.theme`, and the price-row/stepper sub-components, all driven by
  in-memory fixtures in `card-detail-sheet/fixtures.ts` and fully unit-tested; (B) **hooks +
  wiring**: `useCardDetailQuery` / `useCardPricesQuery` / `useCardPriceHistoryQuery`,
  `useCardDetailSheet`, the container, and the route registration; (C) **backend integration**:
  provider methods + service + routes, then swap fixtures for the live queries.
- **Rationale**: Honours the user directive *"component using mock data before integrating with
  the backend."* The chart geometry and four-layer wiring are the highest-risk parts and are
  proven against deterministic fixtures before the server even returns data — and the server
  price routes don't exist yet, so the UI is unblocked by mock-first.
- **Fixtures**: typed `Card`, `CardPricesResponse`, `CardPriceHistoryResponse` covering: both
  sources present, one source `—`, all-empty (no-data annotation), and a gapped series.

## 4. TanStack query keys + invalidation

- **Decision**: `useCardDetailQuery` → `['cards','detail',id]`; `useCardPricesQuery` →
  `['cards','prices',id]`; `useCardPriceHistoryQuery` → `['cards','prices','history',id,days]`.
  The stepper's spec-019 mutation invalidates **only** `['cards','detail',id]` for the tapped
  printing on success (FR-011), via built-in `queryClient.invalidateQueries` — invalidate-only,
  no optimistic update, no manual cache patching.
- **Rationale**: Consistent with the established `['cards','images',id]` namespace and the
  per-endpoint hook convention (`useCardImagesQuery`). Prices/history are unaffected by an
  ownership change, so they are not invalidated. Reconciles spec FR-011's `['card', id]` shorthand
  to the namespaced key.
- **Retry/enabled**: reuse the project `queryClient` defaults (`retry: shouldRetry` 3× on
  5xx/network, skip 4xx; `computeRetryDelay`); `enabled: status === 'active' && Boolean(id)`
  exactly like `useCardImagesQuery`. `staleTime` ~60s for detail/prices.

## 5. Backend: SDK paper-retail price extraction

- **Decision**: Implement `MtgjsonProvider.getPrices(uuid)` and `getPriceHistory(uuid, days)`
  against the SDK paper-retail dataset — `sdk.prices.today` (latest per source) and
  `sdk.prices.history` (per-source series) — provider keys `cardkingdom` / `tcgplayer`, finish
  `normal`, priceType `retail`. Map to `CardPricesResponse` / `CardPriceHistoryResponse`
  (`@my-binder/core`). Add `cardService.getPrices`/`getPriceHistory` (30-day window ending today)
  and the two Fastify routes the mobile `apiClient` already calls.
- **Rationale**: The wire types/schemas and the `CardProvider` interface methods already exist
  (spec 018); the routes + service + provider impl are the missing half. **Physical-only**
  (FR-006/SC-003): paper-retail dataset excludes MTGO/Arena by construction. **No MTG Goldfish**
  — MTGJSON does not publish it; the two-slot wire shape is unchanged and Goldfish is a
  mobile-only disabled placeholder row.
- **Open detail (resolved at implementation)**: the exact SDK accessor names/units (cents vs.
  dollars) are confirmed against `mtgjson-sdk@0.1.1` at implementation time; `amountCents` is the
  wire unit per `PriceQuote`/`PricePoint`. Existing `cardService.test.ts` / `provider.test.ts`
  already stub `getPrices`/`getPriceHistory` returning `{ cardKingdom, tcgPlayer }` shapes — the
  contract is fixed; only the SDK plumbing is new.

## 6. Accessibility (FR-010, WCAG 1.4.1)

- **Decision**: Each price row and each chart legend entry carries a direct text label (source
  name + value) and an `accessibilityLabel`; the disabled Goldfish row exposes
  `accessibilityState={{ disabled: true }}`. Chart lines may additionally use distinct
  dash/marker patterns so the two live series are tellable apart without colour.
- **Rationale**: The mockups distinguish sources by colour only; text labels + SR exposure + an
  optional non-colour line treatment remove the colour-only dependency.
