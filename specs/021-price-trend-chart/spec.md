# Feature Specification: 30-Day Price Trend Chart

**Feature Branch**: `021-price-trend-chart`
**Created**: 2026-05-29
**Status**: Draft
**Input**: User description: "spec out the price trend chart deferred by 020-card-detail-prices"

## Provenance

This feature completes the one piece of spec `020-card-detail-prices` that was **deferred during implementation**: the visual **30-day price-trend chart**.

Spec 020 shipped the card detail sheet end-to-end *except* the chart itself. Mid-implementation the chart component was **crashing the app and was deleted**; the "30-DAY TREND" section now shows a static **"Price trend chart coming soon"** placeholder in its data-ready state. Everything *around* the chart already ships and is tested:

| Already shipped by spec 020 (reused unchanged) | This feature |
|---|---|
| `GET /cards/:id/prices/history` route + provider + service (30-day window, physical-only) | — |
| `useCardPriceHistoryQuery` (mobile query hook) | — |
| `priceSeriesToChartData` (pure geometry: 30-day axis alignment + gap markers, never zero) | — |
| `useCardDetailSheet` derivation of `chartSeries` (two live lines) + `chartLegend` (three entries) | — |
| `historyStatus` four-state mapping (`loading` / `error` / `empty` / `ready`) + skeleton / inline-error+retry / "no recent price data" annotation | preserved as-is |
| "Price trend chart coming soon" placeholder rendered in the `ready` state | **replaced by the actual chart** |

The deferral reason — the chart crashed the app — makes **reliable, crash-free rendering the headline requirement** of this feature (FR-007 / SC-003), alongside reinstating the deferred spec-020 requirements FR-003 (two-line trend + legend), FR-004 (gaps / empty annotation), and FR-010 (colour-independent source differentiation).

## Background

The card detail sheet (spec 020) slides up over the Catalogue or Binder when a populated pocket is tapped. It shows the card's identity, an ownership stepper, two live price rows (Card Kingdom + TCG Player) plus a disabled "coming soon" MTG Goldfish row, and — in the bottom "30-DAY TREND" section — what is *meant* to be a line chart plotting both live sources over the last 30 days. That chart is the only deferred piece; this feature plots it.

Because the data side already flows (the history query resolves, the geometry util produces 30-day-aligned series with gap markers, and `useCardDetailSheet` already hands the view `chartSeries` + `chartLegend` props that are presently unused), this feature is **purely the missing visual layer**: render the supplied series as a chart in the section's data-ready state, and do so without crashing on any valid input shape.

## Designs

The visual source of truth is the spec-020 mockup `specs/020-card-detail-prices/designs/filter-sheet-2.png`:

- `30-DAY PRICE TREND` heading above a line chart.
- Y-axis bounded to the observed value range (the mockup shows `$20` top / `$13` bottom).
- X-axis spanning the window, labelled `30d ago` (left) and `today` (right).
- Plotted lines for the live sources on a single shared set of axes.
- A three-item legend below the plot: **Card Kingdom**, **MTG Goldfish**, **TCG Player**.

> **Known divergence (inherited from spec 020):** the mockup draws MTG Goldfish as a third live line with a `$14.96`-style value. Per spec 020's resolved clarification, MTG Goldfish ships as a **disabled "coming soon" legend entry with no plotted line** — only **Card Kingdom** and **TCG Player** are live, so the chart plots **at most two lines**. Treat the mockup's Goldfish line as illustrative of the eventual three-source state, not the shipped data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the 30-Day Price Trend Plotted (Priority: P1)

A user opens the card detail sheet on a card that has recent price history and scrolls to the "30-DAY TREND" section. Instead of a "coming soon" placeholder, they see a line chart plotting Card Kingdom and TCG Player over the last 30 days on shared axes, with a legend naming all three sources (MTG Goldfish disabled). The trend lets them judge whether a card's price is rising, falling, or steady before deciding to buy or trade.

**Why this priority**: This is the entire feature — and the headline value of spec 020's title ("Prices & 30-Day Trend") that never shipped. A single static price is a snapshot; the trend is what turns "what does it cost" into "is now a good time." It is the one deferred piece blocking spec 020 from being complete.

**Independent Test**: Open the detail sheet for a card with non-empty 30-day history. Confirm the "30-DAY TREND" section renders an actual chart (not the "coming soon" text), with up to two plotted lines (Card Kingdom, TCG Player), a 30-day x-axis (`30d ago` → `today`), a price y-axis bounded to the observed range, and a three-item legend (MTG Goldfish disabled with no line). Confirm the app does not crash for any of: both sources present, one source only, a single observation, a gapped series, and an all-empty series.

**Acceptance Scenarios**:

1. **Given** the detail sheet is open and the 30-day history has resolved with at least one observation, **When** the "30-DAY TREND" section renders its data-ready state, **Then** a line chart is shown (replacing the "coming soon" placeholder) plotting one line per live source with a shared price y-axis and a 30-day x-axis labelled `30d ago` and `today`.
2. **Given** the chart renders, **When** the legend renders, **Then** it lists three entries — **Card Kingdom**, **TCG Player** (active, each matching a plotted line) and **MTG Goldfish** (visibly disabled "coming soon", no plotted line).
3. **Given** a source has no observation on some days within the window, **When** its line renders, **Then** those days appear as a break/gap in the line rather than a dip to `$0`.
4. **Given** only one of the two live sources has any observation in the window, **When** the chart renders, **Then** exactly one line is plotted and the app does not crash or draw a false zero line for the empty source.
5. **Given** both live sources have zero observations across the entire window, **When** the section renders, **Then** the existing "no recent price data" annotation is shown instead of an empty or broken plot.
6. **Given** the history request is still loading or has failed, **When** the section renders, **Then** the existing skeleton (loading) or inline error + retry (failure) states are shown unchanged — the chart only appears in the data-ready state.
7. **Given** the chart is on screen, **When** a user who cannot perceive colour (or with colour disabled) reads it, **Then** each plotted series and legend entry is still identifiable by a non-colour cue (text label, and/or distinct marker/dash pattern).

### Edge Cases

- **Single observation in the window**: one real data point plus carried-forward gap days still renders a sensible line/point — no crash, no empty plot.
- **Flat / near-zero value range**: when all observed prices are equal (or nearly so), the y-axis still computes sensible bounds without a divide-by-zero or degenerate axis, and the chart renders.
- **All days gapped except a leading carry-forward**: the line renders the carried-forward value with hidden data dots (gap markers), not a zero baseline.
- **Re-layout while open** (rotation, dynamic type, sheet detent change): the chart re-renders without crashing.
- **Backgrounding with the sheet open**: returning within the active session shows the same chart without a re-render crash.
- **Crash safety across all input shapes**: every shape produced by the existing geometry util (both-present, one-source, single-point, gapped, all-empty) renders without an unhandled error — this is the explicit bar the deferred attempt failed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In the card detail sheet's "30-DAY TREND" section, the **data-ready state** MUST render a line chart plotting one line per **live** source (Card Kingdom, TCG Player) on a single shared set of axes, replacing the current "Price trend chart coming soon" placeholder.
- **FR-002**: The chart MUST present the last 30 days on the x-axis (labelled `30d ago` at the start and `today` at the end) and price on the y-axis, with y-axis bounds derived from the observed value range so the plotted variation is legible (per the `$13`/`$20`-style framing in the design).
- **FR-003**: The chart MUST display a legend listing all three sources — **Card Kingdom** and **TCG Player** as active entries each corresponding to a plotted line, and **MTG Goldfish** as a visibly disabled "coming soon" entry with **no plotted line**. (Reinstates spec 020 FR-003.)
- **FR-004**: Missing days within a series MUST render as a break/gap in that line rather than a value of `0`. When **both** live series are empty across the whole window, the section MUST keep rendering the existing "no recent price data" annotation in place of an empty plot. (Reinstates spec 020 FR-004.)
- **FR-005**: The chart MUST appear **only** in the section's data-ready state. The existing `loading` (skeleton), `error` (inline error + retry), and `empty` ("no recent price data") states MUST be preserved unchanged — this feature does not alter the four-state status handling.
- **FR-006**: Plotted series and legend entries MUST be distinguishable **without relying on colour alone** (WCAG 1.4.1): each carries a direct text label exposed to screen readers, and lines MAY add distinct markers or dash patterns so the two live series are tellable apart in greyscale. (Reinstates spec 020 FR-010.)
- **FR-007**: The chart MUST render reliably — for **every** valid input shape (both sources present, a single live source, a single observation, a gapped series, and an all-empty series) it MUST render without crashing the application or throwing an unhandled error. (This is the defect that caused spec 020 to defer the chart.)
- **FR-008**: The chart MUST be **presentational only**. It MUST consume the already-derived `chartSeries` (lines) and `chartLegend` (entries) values produced by the existing detail-sheet hook and introduce **no new data fetching, no new wire types or schemas, no provider change, and no backend change**. The existing history query, geometry util, and derivation logic are reused unchanged.

### Key Entities

- **Trend Chart**: The line chart rendered in the detail sheet's "30-DAY TREND" data-ready state. Plots up to two live series over a 30-day axis with a price axis and a three-item legend.
- **Chart Series**: One plotted line for a live source (Card Kingdom or TCG Player), already shaped by the existing geometry util into 30-day-aligned points with gap markers for missing days. MTG Goldfish is never a series.
- **Chart Legend Entry**: One of three labelled legend rows — two active (matching the plotted lines) and one disabled (MTG Goldfish "coming soon", no line).

## Success Criteria *(mandatory)*

- **SC-001**: 100% of detail-sheet opens on a card with non-empty 30-day history render the plotted line chart; the "coming soon" placeholder no longer appears in the data-ready state on any device.
- **SC-002**: The trend chart renders within 1 second of the sheet appearing for cards with non-empty history; cards with empty history continue to render the "no recent price data" annotation within the same window. (Inherits spec 020 SC-002.)
- **SC-003**: Zero application crashes when the chart is exercised across the full range of input shapes — both sources present, a single live source, a single observation, a gapped series, and an all-empty series — verified before release.
- **SC-004**: The two live series remain distinguishable with colour removed (greyscale / colour-blind simulation): a tester can correctly match each line to its source using a non-colour cue (label, marker, or dash pattern) in 100% of cases.

## Assumptions

- Spec `020-card-detail-prices` is merged and its data layer is intact and correct. This feature adds only the visual chart and wires it into the existing data-ready branch of the "30-DAY TREND" section.
- The chart consumes the existing `chartSeries` / `chartLegend` props already produced by `useCardDetailSheet` and the 30-day-aligned, gap-marked points already produced by `priceSeriesToChartData` — both are reused without modification.
- The 30-day window ends today; earlier history is not surfaced (inherited from spec 020).
- Exactly two live sources are plotted (Card Kingdom + TCG Player); MTG Goldfish remains a disabled placeholder with no line, pending a later spec that adds it additively (inherited from spec 020).
- The chart is **static** for this feature — it presents the trend at a glance. Tapping a point to read a specific day's exact price (tooltip / scrubbing) is not included.
- Reliable rendering is achieved with a real charting capability rather than hand-drawn primitives (consistent with the project's "use a real library, not primitives" guidance); the specific rendering approach and the root-cause fix for the prior crash are implementation decisions for the planning phase.

## Out of Scope

- **Interactive tooltips / scrubbing** to read a specific day's exact price or date.
- **Historic windows other than 30 days** (90-day, 1-year) — inherited from spec 020.
- **MTG Goldfish as a plotted/live line** — it stays a disabled "coming soon" legend entry with no line; a later spec wires it in additively.
- **Any backend, wire-type, schema, provider, service, or query-hook change** — the data layer shipped with spec 020 and is reused unchanged.
- **Re-deriving or changing the price geometry** (`priceSeriesToChartData`) or the four-state `historyStatus` mapping — both are preserved as-is.
