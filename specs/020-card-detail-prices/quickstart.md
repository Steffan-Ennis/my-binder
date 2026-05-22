# Quickstart — Card Detail Sheet (spec 020)

How to build and verify this feature, mock-first then integrated.

## Prerequisites

```bash
nvm use            # Node 22
pnpm install
# Add the one new dependency (current stable, peer-satisfied — see plan.md Dependency Currency Check)
pnpm --filter @my-binder/mobile add react-native-gifted-charts
```

`react-native-svg` is already installed (gifted-charts' required peer). No gradient package is
added (the design uses thin lines, not filled areas).

## Phase A — Mock-first UI (no backend, no live queries)

1. Implement `src/utils/priceSeriesToChartData.ts` + test (gap handling, scaling).
2. Implement `card-detail-sheet/PriceTrendChart.tsx` (+ `.theme.ts`) over gifted-charts `LineChart`.
   Add the `LineChart` mock to `apps/mobile/jest.setup.ts`.
3. Implement `CardDetailSheetView.tsx` (+ `.theme.ts`) + `types.ts` + `fixtures.ts`.
4. Drive the view from `fixtures.ts` in tests: all 4 fixture shapes (both sources, one `—`, all
   empty, gapped). Verify three rows (Goldfish disabled), stepper disabled at 0, skeleton, inline
   error+retry, no-data annotation, close control, a11y labels.

```bash
pnpm --filter @my-binder/mobile test   # all card-detail-sheet + util + chart tests green
```

## Phase B — Hooks + wiring

5. Implement `useCardDetailQuery` / `useCardPricesQuery` / `useCardPriceHistoryQuery` (+ tests).
6. Implement `useCardDetailSheet` composing them (+ test: derivations, status mapping, reference
   stability, stepper handlers, FR-011 invalidation expectation).
7. Implement `CardDetailSheetContainer` + the `card-detail` form-sheet routes (catalogue + binder
   Stacks); wire `useCatalogue` / `useBinderHome` pocket-press → navigate with `printingId`.

## Phase C — Backend integration

8. Implement `MtgjsonProvider.getPrices` / `getPriceHistory` (replace throwing stubs) against
   `sdk.prices.today` / `sdk.prices.history` (keys `cardkingdom`/`tcgplayer`, finish `normal`,
   priceType `retail`, physical only). Update JSDoc.
9. Add `cardService.getPrices` / `getPriceHistory` (30-day window) + tests.
10. Add `GET /cards/:id/prices` and `GET /cards/:id/prices/history` routes (registered before
    `/cards/:id`) + route tests (real DataSource + offline SDK + factories).
11. Remove the fixture wiring; the live queries now feed the sheet end-to-end.

```bash
turbo test         # whole monorepo green (core builds first)
turbo typecheck
```

## Manual verification (acceptance)

- Open the Catalogue, tap a populated pocket → sheet slides up with identity + stepper + 3 price
  rows (Goldfish disabled) + 30-day chart (SC-001, SC-002).
- Tap `+` → after the spec-019 mutation settles and `['cards','detail',id]` refetches, the count
  and pocket glyph reflect the new value (FR-007/FR-011). `−` is disabled at 0.
- A printing with no observations → both live rows `—`, chart shows "no recent price data" (FR-004).
- Kill the network mid-open → inline error + retry in the price/chart section, identity + stepper
  still usable (FR-009).
- Swipe the sheet down / tap close → returns to the exact page (FR-005).
- Repeat on the Binder surface — identical behaviour (FR-001/FR-005).
- VoiceOver/TalkBack: each source row + legend entry is announced by name (not colour) (FR-010).
