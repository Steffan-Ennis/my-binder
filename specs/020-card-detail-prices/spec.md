# Feature Specification: Card Detail Sheet — Prices & 30-Day Trend

**Feature Branch**: `020-card-detail-prices` *(to be created)*
**Created**: 2026-05-22
**Status**: Draft — split out of spec `018-card-catalogue-search` (US3)
**Input**: Carved out of spec 018 (US3) by the 2026-05-22 split. Original input: "When pressing a card a slider from the bottom should come up with the card's details such as price heuristics from Card Kingdom, MTG Goldfish and TCG Player. In addition a graph of the last 30 days should show the price trend plotted from all 3 sources. We only track physical cards."

## Provenance

This spec is **User Story 3** of spec `018-card-catalogue-search`, extracted into its own specification. FR / SC numbers are renumbered for a standalone spec; the mapping to the original 018 numbers is kept for traceability:

| This spec | Spec 018 origin |
|---|---|
| FR-001 | FR-016 (sheet open + identity) |
| FR-002 | FR-017 (two price rows: Card Kingdom + TCG Player) |
| FR-003 | FR-018 (30-day two-line trend chart) |
| FR-004 | FR-019 (`—` / gap placeholders, no-data annotation) |
| FR-005 | FR-020 (dismiss + restore page position) |
| FR-006 | FR-021 (physical-printings-only scoping) |
| FR-007 | FR-028 (detail-sheet stepper — consumes spec 019's hook) |
| SC-001 | SC-005 (pocket tap → sheet) |
| SC-002 | SC-006 (chart render budget) |
| SC-003 | SC-007 (price half — no digital-only in any sheet/observation) |

## Dependencies

- **Spec `019-binder-add-remove`** — the `−  [numberOwned]  +` stepper (FR-007) consumes `useUpdateBinderEntryMutation`, the binder-mutation hook **owned by spec 019 (its FR-006) and not yet written**. The server routes (`POST` upsert, `PATCH /cards/:id`) and the `apiClient.upsertCard` / `apiClient.patchCard` client functions the hook wraps are already built; only the hook is outstanding. Land 019 first. Spec 020 MUST NOT re-implement the hook — it only requires that hook to invalidate the affected printing's `getCard` query on success (see FR-011).
- **Spec `018-card-catalogue-search`** — the sheet opens from the Catalogue's `useCatalogue` pocket-press lifecycle (and the Binder's). Spec 018 must be complete and green.

## Inherited from branch `018-card-catalogue-search` (already built — stubbed)

The wire contracts already exist; the runtime is stubbed:

- Core types: `PRICE_SOURCES` const + `PriceSource`, `PriceQuote`, `CardPricesResponse`, `PricePoint`, `CardPriceHistoryResponse`.
- Core schemas: `PRICE_QUOTE_SCHEMA`, `CARD_PRICES_RESPONSE_SCHEMA`, `PRICE_POINT_SCHEMA`, `CARD_PRICE_HISTORY_RESPONSE_SCHEMA`.
- `CardProvider` interface declares `getPrices(uuid)` and `getPriceHistory(uuid, days)`.
- Mobile `apiClient` has `getCardPrices(id)`, `getCardPriceHistory(id, days)`, and `getCard(id)`.
- **Throwing stubs** in `apps/server/src/providers/mtgjson/MtgjsonProvider.ts` — `getPrices` / `getPriceHistory` throw `"… not implemented (pending spec 018 US3 / T057)"`. This spec replaces those stubs with the real implementation.

## Background

Spec 018 ships the Catalogue (browse + filter); spec 019 adds add/remove + owned-count glyphs. This spec adds the **card detail sheet**: a bottom sheet that slides up over the canvas when a populated pocket is tapped on **either** surface (Catalogue or Binder), surfacing the card's identity, a `−  N  +` ownership stepper, two live price rows (Card Kingdom + TCG Player) plus a disabled "coming soon" MTG Goldfish row, and a 30-day price-trend chart plotting both live sources on the same axes.

Price data is served live by the MTGJSON SDK via the two new `CardProvider` methods — paper-retail observations only, provider keys `cardkingdom` and `tcgplayer`. No new entity, no migration. **MTG Goldfish** was named in the original input as a third source but MTGJSON does not publish it; it ships as a disabled "coming soon" placeholder row only (no live data, no wire slot, no plotted line) and a later spec wires it in additively.

## Designs

Two reference mockups of the card detail sheet are checked into `specs/020-card-detail-prices/designs/` and are the visual source of truth for layout (subject to the divergence noted below):

- **`designs/filter-sheet-1.png`** — sheet just opened: close (✕) control top-right, card thumbnail + identity (name, `LCI · LCI` set code, `Legendary Creature — Demon` type line, italic oracle blurb), the **In your binder** block with a `Catalogue → adds this printing` subtitle and a `−  0  +` stepper, the `PRICES · PHYSICAL PRINTING ONLY` heading with three labelled rows, and the top of the `30-DAY PRICE TREND` chart.
- **`designs/filter-sheet-2.png`** — scrolled to the chart: the `−  0  +` stepper, the three price rows (Card Kingdom `$17.23`, MTG Goldfish `$14.96`, TCG Player `$16.38`), and the full 30-day trend chart with `$20`/`$13` y-axis bounds, `30d ago`/`today` x-axis labels, and a three-item legend.

> **Known divergence (resolved 2026-05-22):** the mockups render MTG Goldfish as a live third source with a `$14.96` value and a plotted line. Per the clarification below, MTG Goldfish ships as a **disabled "coming soon" placeholder row** with no live value and no plotted line (MTGJSON does not publish it). Card Kingdom and TCG Player are the only two live sources. Treat the mockups' Goldfish row/line as illustrative of the eventual 3-source state, not the shipped data.

## Clarifications

### Session 2026-05-22

- Q: The mockups show 3 price sources but the spec defers MTG Goldfish to 2 — which is authoritative? → A: Ship 2 live sources (Card Kingdom + TCG Player) and render MTG Goldfish as a disabled "coming soon" placeholder row to match the mockup layout, with no live value and no plotted trend line.
- Q: What happens when the price/history request itself FAILS (network drop / 5xx), distinct from zero observations? → A: Show an inline error state with a retry affordance in the affected price/chart section, visually distinct from the empty-data "no recent price data" annotation; card identity + stepper still render and remain usable.
- Q: What does the price/chart area show while prices + 30-day history are loading? → A: Render the sheet immediately (identity + stepper) and show skeleton placeholders for the price rows and chart until each request resolves, replaced in place.
- Q: Should price sources be differentiated by something other than colour (accessibility)? → A: Yes — each source must be identifiable without relying on colour (direct text labels on rows + legend, screen-reader exposed); chart lines may add distinct markers/dash patterns (WCAG 1.4.1).
- Q: Where should the requirement that the stepper's mutation invalidates the `getCard` query be recorded — spec 019 (hook owner), spec 020 (consumer), or both? → A: Spec 020 only. The `useUpdateBinderEntryMutation` hook is owned by spec 019 (its FR-006) and not yet written; spec 020 records the consumer-side requirement and leaves spec 019 as-is.
- Q: What scope/timing for the `getCard` invalidation, given spec 019 deliberately defers the catalogue cache (Missing-only rule)? → A: Invalidate the affected printing's `['card', id]` query ONLY, on EVERY successful mutation. It is a single-printing detail query, independent of the catalogue-list defer rule.
- Q: Does the stepper's centre `numberOwned` value update optimistically or via refetch? → A: Invalidate-only (refetch) — no optimistic update; the value updates when the invalidated `getCard` query refetches. Use TanStack Query's built-in `invalidateQueries`; MUST NOT manually patch / re-implement cache reconciliation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect a Card's Prices and 30-Day Trend (Priority: P1 for this spec)

A user taps any card pocket in the Catalogue (or in their own Binder) and a sheet slides up showing that card's details: oracle/type line, an ownership stepper, current best-available physical-print prices from Card Kingdom and TCG Player as labelled rows (with MTG Goldfish shown as a disabled "coming soon" row), and a 30-day price-trend line chart plotting both live sources on the same axes. The user can dismiss the sheet by swiping it down or tapping a close control, returning to the page they were viewing.

**Why this priority**: Prices are the primary external signal that turns "I see this card" into "should I buy it / trade for it." Surfacing the two price sources MTGJSON publishes — with a 30-day trend — is what makes the catalogue genuinely useful for collection decisions.

**Independent Test**: Open the Catalogue, tap any populated pocket. Confirm the sheet renders (a) the card's identity (name, set, type), (b) the `− N +` stepper showing the user's current count (0 for unowned), (c) three labelled price rows — Card Kingdom and TCG Player live (each a `$x.xx` value or `—`) plus a disabled "coming soon" MTG Goldfish row, and (d) a 30-day chart with up to two plotted lines plus a disabled Goldfish legend entry. Tap `+` on the stepper — the count increments and the pocket glyph updates. Swipe the sheet down past threshold — it dismisses and the underlying page is unchanged.

**Acceptance Scenarios**:

1. **Given** the user is on the Catalogue (or Binder), **When** they tap a card pocket, **Then** a bottom sheet slides up over the canvas containing the card's name, set, and type/oracle text plus the price section and the 30-day trend chart.
2. **Given** the sheet is open, **When** the prices section renders, **Then** three labelled rows are visible — **Card Kingdom**, **MTG Goldfish**, **TCG Player** — where Card Kingdom and TCG Player display the most-recent observed price for the **physical printing** the user is inspecting and MTG Goldfish renders as a visibly disabled "coming soon" placeholder carrying no value.
3. **Given** the sheet is open, **When** the trend chart renders, **Then** a single chart shows the last 30 days on the x-axis and price on the y-axis, with up to two plotted lines (Card Kingdom, TCG Player) plus a disabled MTG Goldfish legend entry that has no plotted line.
4. **Given** a source has no observation for the card (or for some days within the window), **When** that row or line renders, **Then** the missing value is shown as a clearly non-numeric placeholder (`—` for the row, a gap in the line) rather than `0`.
5. **Given** the sheet is open, **When** the user swipes it downward past a threshold or taps the close control, **Then** the sheet dismisses and returns the user to the exact page and scroll position they were on before opening it.
6. **Given** the card has multiple printings, **When** the sheet renders, **Then** prices and trend are scoped to the specific printing (set + collector number) the user tapped.
7. **Given** the sheet is open, **When** the user taps `+` / `−` on the stepper, **Then** the mutation fires (via spec 019's `useUpdateBinderEntryMutation`), the affected printing's `getCard` query is invalidated, and the stepper's centre value + underlying pocket glyph reflect the new `numberOwned` once the invalidated `getCard` query refetches; `−` is a visibly-disabled no-op at `numberOwned = 0`.

### Edge Cases

- **Tap during page load**: Tapping a pocket still rendering a skeleton MUST NOT open an empty sheet — either wait for the underlying card record or resolve the image inside the sheet.
- **No price data at all**: Zero observations across both live sources for the entire 30-day window → both live rows render `—` and the chart renders its axes with a "no recent price data" annotation instead of an empty plot.
- **Price request fails**: A network error or non-2xx response on the prices or price-history request (distinct from zero observations) renders an inline error state with a retry affordance in the affected section, visually distinct from the "no recent price data" annotation; the card identity and stepper remain functional.
- **Prices still loading**: Between sheet open and price/history resolution, the price rows and chart show skeleton placeholders while the identity and stepper are already interactive.
- **Background while sheet is open**: Backgrounding the app with the sheet open and returning within the active session keeps the sheet open on the same card.
- **Digital-only printing reaches the sheet**: Digital-only printings are excluded from catalogue results upstream (spec 018 / SC-007); if one is ever reached, the price section MUST make clear no physical prices are tracked, and physical/digital observations MUST NOT be mixed in one series.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Tapping a populated pocket on the Catalogue or the Binder MUST open a bottom sheet sliding up over the canvas. The sheet MUST display the card's name, set name + code, and type line at minimum.
- **FR-002**: The sheet MUST display three labelled price rows in this order — **Card Kingdom**, **MTG Goldfish**, **TCG Player**. Card Kingdom and TCG Player are live, each showing the most-recent observed price for the specific physical printing tapped (set + collector number). **MTG Goldfish MUST render as a visibly disabled "coming soon" placeholder row** — de-emphasised, carrying no live price value and no plotted trend line — because MTGJSON does not publish it (live data deferred to a later spec).
- **FR-003**: The sheet MUST render a 30-day price-trend chart plotting, on a single set of axes, one line per **live** source (Card Kingdom, TCG Player) with a legend, the last 30 days on the x-axis, and price on the y-axis. The legend MUST list MTG Goldfish as a disabled "coming soon" entry with no plotted line.
- **FR-004**: Missing observations MUST render as a clearly non-numeric placeholder (`—` for a row, a gap in the line). When **both** sources have zero observations across the entire 30-day window, the chart MUST render its axes with a "no recent price data" annotation in place of an empty plot.
- **FR-005**: The sheet MUST be dismissable by both a downward swipe past a threshold and an explicit close control. Dismissal MUST return the user to the exact page and scroll position they were on before opening it.
- **FR-006**: The price section and 30-day trend MUST be scoped to **physical printings only**. Digital-only printings (MTGO/Arena-exclusive) MUST be excluded upstream (spec 018) or, if shown, MUST make clear no physical prices are tracked. The chart MUST NOT mix physical and digital observations in one series.
- **FR-007**: The sheet MUST render a `−  [numberOwned]  +` stepper alongside the price section. The centre value MUST reflect the current `numberOwned` for the signed-in user; `+` fires a `delta: +1` mutation, `−` fires a `delta: −1` mutation but never below 0 (visibly disabled at 0). It MUST behave identically from either surface. **The stepper consumes `useUpdateBinderEntryMutation` from spec `019-binder-add-remove`.** The displayed centre value refreshes per the invalidate-only model in **FR-011** (no optimistic update).
- **FR-008**: On sheet open, the card identity and ownership stepper MUST render immediately from the already-available card record; the live price rows and the 30-day chart MUST show **skeleton placeholders** while the price and price-history requests are in flight, each replaced in place once it resolves.
- **FR-009**: If the price or price-history request **fails** (network error or non-2xx response) — as distinct from returning zero observations — the affected price/chart section MUST render an **inline error state with a retry affordance**, visually distinct from the "no recent price data" annotation of FR-004. The card identity and the ownership stepper MUST remain usable.
- **FR-010**: Price sources MUST be distinguishable without relying on colour. Each price row and legend entry MUST carry a direct text label and be exposed to screen readers; chart lines MAY add distinct markers or dash patterns so the two live series are tellable apart without colour (WCAG 1.4.1 — no colour-only encoding).
- **FR-011**: On every **successful** stepper mutation, the consumed `useUpdateBinderEntryMutation` hook MUST invalidate the `getCard` query for **the affected printing only** (`['card', id]`) using TanStack Query's built-in `queryClient.invalidateQueries`. The implementation MUST NOT manually patch the cache or otherwise re-implement reconciliation — invalidation alone is what triggers TanStack to refetch the affected record. The stepper's centre `numberOwned` value is **invalidate-only (no optimistic update)**: it updates when the invalidated `getCard` query refetches. Invalidation is scoped to the single affected printing and fires regardless of any catalogue-list defer rule (spec 019 FR-009), which it does not touch. *(The hook is built in spec `019-binder-add-remove` (FR-006); this requirement constrains the behaviour spec 020 needs from it and does not amend spec 019.)*

### Key Entities

- **Card Detail Sheet**: The bottom sheet rendered on pocket tap. Carries the identity of the specific printing tapped (so prices/trend are scoped), the current price rows, the 30-day trend series, and the ownership stepper.
- **Price Observation**: A `(card-printing, source, day, price)` tuple where source ∈ {Card Kingdom, TCG Player} and the printing is physical.
- **Price Source**: A live source is Card Kingdom (`cardkingdom`) or TCG Player (`tcgplayer`); at most one observation per printing per source per day. **MTG Goldfish** is a presentation-only placeholder source (no live observations, no wire slot, no plotted line) rendered as a disabled "coming soon" row pending a later spec.

## Success Criteria *(mandatory)*

- **SC-001**: 100% of taps on a populated pocket open the card detail sheet for the specific printing tapped (verified on both the Catalogue and Binder surfaces).
- **SC-002**: The 30-day price-trend chart renders within 1 second of the sheet appearing for cards with non-empty price history (at most two lines); cards with empty history render the "no recent price data" annotation within the same window.
- **SC-003**: Zero digital-only printings appear in any detail sheet or in any price observation in the 30-day trend (verified across the catalogue index).

## Assumptions

- Daily price observations are sourced from the MTGJSON SDK paper-retail dataset — `sdk.prices.today` + `sdk.prices.history`, provider keys `cardkingdom` and `tcgplayer`, finish `normal`, priceType `retail`. One observation per printing per source per day.
- The 30-day trend renders the most recent 30 calendar days ending today; earlier history is not surfaced.
- The detail sheet is shared between Catalogue and Binder; FR-001 / FR-005 behave identically on either surface.
- Card identity metadata (name, set, type, oracle, image) is available from the existing card data layer (providers from specs 001 / 004 / 010).
- Spec 019's `useUpdateBinderEntryMutation` is the binder-mutation hook the stepper calls; it is **owned by spec 019 (FR-006) and not yet written** (the `POST`/`PATCH` server routes and the `apiClient.upsertCard` / `apiClient.patchCard` client functions it wraps are already built and tested). Spec 020 does not re-implement binder mutations.
- The `getCard` refresh after a stepper mutation relies on TanStack Query's built-in `queryClient.invalidateQueries` (invalidate the affected printing's `['card', id]`); spec 020 MUST NOT hand-roll cache patching or any equivalent reconciliation. Invalidation triggers TanStack's own refetch of the affected record.

## Out of Scope

- **MTG Goldfish as a *live* price source.** MTGJSON does not publish it; live ingestion requires bespoke acquisition/scheduling/licensing. This spec ships **two live sources** plus a disabled "coming soon" Goldfish placeholder row (UI only — no value, no line, no wire slot); a later spec wires real Goldfish data into the existing slot additively.
- **Historic windows other than 30 days** (90-day, 1-year).
- **Buying / linking out to retailer pages.** Prices are for awareness only.