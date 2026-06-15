# Quickstart — 30-Day Price Trend Chart (spec 021)

## Install the chart dependency (no dev build needed)

```bash
# from apps/mobile — expo install resolves SDK-54-compatible versions and satisfies the gifted-charts peers
cd apps/mobile
npx expo install react-native-gifted-charts expo-linear-gradient react-native-svg
cd ../.. && pnpm install   # re-resolve the workspace lockfile (pnpm is canonical)
```

> `react-native-svg` (already at 15.12.1) and `expo-linear-gradient` are both **Expo SDK modules in the Expo Go bundle**, so **no `expo prebuild` and no native rebuild** are required. `expo install` pins the SDK-54-compatible versions; installing **`expo-linear-gradient`** satisfies the gifted-charts gradient peer that spec 020 skipped (a likely crash contributor — see research.md §2). This chart runs in Expo Go (`expo start`) and in dev/EAS builds alike.

## Run the tests (Red → Green)

```bash
# restore the gifted-charts mock in jest.setup.ts, then write the chart test first and watch it fail:
pnpm --filter @my-binder/mobile test PriceTrendChart
pnpm --filter @my-binder/mobile test card-detail-sheet
# full gate:
pnpm --filter @my-binder/mobile test
pnpm --filter @my-binder/mobile typecheck
turbo test && turbo typecheck   # all 4 workspaces green
```

## Manual acceptance (in Expo Go — covers SC-002 / SC-003 / FR-006)

```bash
cd apps/mobile && pnpm dev   # Expo Go on a device/simulator — no build step
```

Sign in, open the Catalogue (or Binder), tap a populated pocket, scroll to **30-DAY TREND**:

1. **FR-001 / SC-001** — a real line chart renders (not "Price trend chart coming soon"), with up to two lines.
2. **FR-002** — x-axis reads `30d ago` → `today`; y-axis bounds frame the observed range.
3. **FR-003** — legend shows **Card Kingdom**, **TCG Player** (active, each matching a line) + **MTG Goldfish** disabled "coming soon" with no line.
4. **FR-004** — a printing with observations on only some days plots without any `$0` dip; a printing with **zero** observations on both sources shows the "no recent price data" annotation (no chart).
5. **AS4** — a printing where only one source has data plots exactly one line (no false zero line for the other).
6. **FR-005** — kill the network mid-open → inline error + retry in the trend section (not the empty annotation); while loading → skeleton.
7. **FR-006 (WCAG 1.4.1)** — with a colour-blind simulation / greyscale, each line is still identifiable by its legend text label; VoiceOver/TalkBack announces each source by name.
8. **FR-007 / SC-003 — crash sweep (the deferral reason)**: open the sheet for cards covering each shape and confirm **no crash** on any:
   - both sources present, a gapped series, an all-empty series — **and especially a card with a *single* price observation** (the [#484 `data.length === 1`](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/484) trigger), and a single-source card. The single-observation case is the one most likely behind the original crash — verify it explicitly.
9. **SC-002** — the chart appears within ~1 s of the sheet opening for non-empty history.

## What this feature does NOT touch

- No server / `@my-binder/core` change — the history route, provider, and wire types are reused.
- No new query hook, store, or persistence.
- `priceSeriesToChartData.ts`, `useCardDetailSheet.ts`, `types.ts` (`ChartPoint`/`ChartSeries`), and `fixtures.ts` are **reused unchanged** — only `PriceTrendChart.tsx` (+ theme + test), the `CardDetailSheetView` ready branch, the restored `jest.setup.ts` mock, and `package.json` change.
