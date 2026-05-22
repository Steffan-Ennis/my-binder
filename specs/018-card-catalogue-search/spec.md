# Feature Specification: Card Catalogue Search

**Feature Branch**: `018-card-catalogue-search`
**Created**: 2026-05-17
**Status**: Scope reduced to US1 + US2 (2026-05-22) — see the 2026-05-22 Clarifications entry
**Input**: User description: "Card Catalogue Search using the same design artifacts as the binder view a user should be able to do the following: Browse the Card Catalogue for a Card, the user should be able to filter by set, creature type, format legality, card super type, card sub type, card name, cmc and colour identity. Cards should be displayed according current 9 pocket visual design of the binder. The search icon should be in the header the same as the binder view (with a reusable header component across both views that takes prop slots for the sub-headers — Binder, Catalogue, etc). Search bar extends as per Image #2. An infinite query pattern should be used with pages that follow the current `cards/search/` route. The Card component should be lazy loaded and swiping left and right should lazy load the next page. When pressing a card a slider from the bottom should come up with the card's details such as price heuristics from Card Kingdom, MTG Goldfish and TCG Player. In addition a graph of the last 30 days should show the price trend plotted from all 3 sources. We only track physical cards."

> ## ⚠️ Scope reduction (2026-05-22)
>
> This spec was **split** during implementation. It now covers **only**:
> - **US1 — Browse the Card Catalogue in 9-Pocket Pages** (P1)
> - **US2 — Filter the Catalogue by Card Attributes** (P1)
> - The **shared `<Masthead />`** extraction (FR-002) and its adoption by the Binder (FR-022).
>
> The two remaining user stories are **deferred to follow-up specifications**:
> - **US4 — Add Cards From Catalogue, Remove From Binder + owned-count glyphs** → **spec `019-binder-add-remove`**.
>   The **server side of US4 is already implemented on this branch** (`number_owned` column + migration; `CardRepository.upsertIncrement` / `adjustNumberOwned`; `POST /cards` upsert + `PATCH /cards/:id` adjust, all with tests). Spec 019 is therefore mobile-only.
> - **US3 — Inspect a Card's Prices and 30-Day Trend** → **spec `020-card-detail-prices`**.
>   The core price types/schemas and the `CardProvider.getPrices` / `getPriceHistory` interface declarations are already present (the provider methods are **throwing stubs** pending 020). US3 depends on US4 (the detail-sheet stepper shares the binder-mutation hook), so 020 follows 019.
>
> The US3/US4 user stories, requirements, key entities, and success criteria below are replaced by **"DEFERRED" pointer blocks** for traceability; the canonical home for that work — full acceptance scenarios, FR text, and design — is specs 019/020. The `plan.md`, `research.md`, `data-model.md`, and `contracts/` artifacts in this folder still describe the **superseded** pre-split architecture (prop-drilled filter state + `@gorhom/bottom-sheet`; SDK-typed `cards.search`) and the full four-story scope — they need a follow-up refresh to match the as-built code (React-Context filter state in `src/context/catalogue-context/`, Expo Router modal route for the filter, SQL-native `CardSearchBuilder`, masthead with the filter-opener only and no value pills).

**Scope addition (clarify session)**: During `/speckit.clarify` the user added owned-count glyphs and add/remove-from-binder actions. **As of the 2026-05-22 split those belong to spec `019-binder-add-remove` (US4), not this spec.**

## Clarifications

### Session 2026-05-22

- Q: The catalogue work grew to four user stories and the post-Phase-4.5 implementation diverged from the design artifacts. How should the spec be closed out? → A: **Split the spec.** Spec 018 retains US1 (browse) + US2 (filter) + the shared masthead (FR-002 / FR-022). US4 (add/remove + owned counts) moves to spec `019-binder-add-remove`; its server side is already built and tested on this branch, so 019 is mobile-only. US3 (prices + 30-day trend) moves to spec `020-card-detail-prices`; the core price types and provider interface decls already exist (provider methods stubbed). The detail-sheet and add/remove FRs, key entities, and success criteria are replaced by DEFERRED pointer blocks below, each naming its new home. Closeout for 018 itself is the RED-test fix introduced by the intentional removal of the masthead value pills (only the filter-opener pill remains) and the filter-state Context refactor.

### Session 2026-05-17

- Q: How should owned copies be modelled when the user adds a duplicate, and how is the count indicated on a card pocket? → A: A single binder row per `(printing, user)` carrying a `numberOwned` integer (incremented on add, decremented on remove; the row is deleted when `numberOwned` reaches 0). A small glyph in the top-right of the card pocket renders the current `numberOwned` value. On the Catalogue, the glyph appears only when `numberOwned ≥ 1` (so the user can see at a glance which cards they already own and how many). On the Binder, the glyph appears whenever `numberOwned ≥ 2` (a single-copy entry needs no badge).
- Q: Where do the add-to-binder and remove-from-binder controls live? → A: **Both** surfaces. Inline glyph-buttons render directly on each pocket — a `+` glyph on every Catalogue pocket (single tap increments `numberOwned`) and a `−` glyph on every Binder pocket (single tap decrements `numberOwned`; the card disappears from the binder when the count reaches 0). In addition, the card detail sheet renders a `−  [numberOwned]  +` stepper that works on both surfaces (the stepper is the source of truth for larger adjustments and for showing the live count alongside the prices). The inline pocket glyph-buttons MUST be placed so they do not conflict with the horizontal swipe-page gesture (e.g. small, edge-anchored, requiring an explicit tap rather than a drag).
- Q: Should the Catalogue let the user filter by ownership? → A: **Yes — a single `Missing only` toggle** (boolean), not a tri-state filter. When OFF (default), the Catalogue shows all printings matching the other active filters. When ON, the Catalogue restricts results to printings whose `numberOwned` for the signed-in user is 0. The toggle lives in the same additional-filters control as the rest of the filters from FR-005, and is combined with them as AND (per FR-006). An "owned only" inverse is intentionally out of scope — users who want to browse their owned cards already have the Binder tab for that.
- Q: How does the Catalogue react when `+` or `−` changes a card's ownership while the `Missing only` toggle is ON? → A: **Defer the re-filter.** The just-added (or removed) pocket stays put — the owned-count glyph updates immediately so the user sees their action take effect — and a small "results out-of-date — refresh" affordance appears within the canvas. The result set re-applies only when the user taps that affordance or leaves and returns to the Catalogue tab. This preserves the user's scroll anchor during an "add a bunch of missing cards" workflow and matches the pattern used by TCGplayer / Moxfield deck-build mode. Cards that fall out of any other active filter follow the same defer-and-refresh rule.
- Q: Is the owned-count glyph scoped per-printing or per-card-name? → A: **Per-printing.** The glyph on the M21 Lightning Bolt pocket counts only the user's M21 copies; the M20 printing renders an independent glyph for that printing's count; the `Missing only` toggle similarly evaluates `numberOwned = 0` per-printing. This matches the catalogue's natural data unit (printings, not card names), keeps the glyph consistent with the per-printing price section (FR-017) and the per-printing `+` action (FR-025 adds the specific printing tapped), and aligns with the existing `Card` data model where the row's primary key is the printing UUID. Users who want a "do I own any printing of this card" view continue to use the binder-search (spec 016, FR-005a) on the Binder tab.
- Q: Should page navigation use tap-buttons, swipe gestures, or both? → A: **Gesture only.** Page turn on both the Catalogue and the Binder is driven exclusively by a horizontal swipe on the binder page (swipe left → next page, swipe right → previous page). The canvas renders a small centred italic "N of M" page indicator (matching the shipped Binder view) but NO flanking arrow buttons. This supersedes the "tap a circular next/previous-page button **or** swipe" wording inherited from spec 016 FR-017 / FR-018 — spec 018 drops the button requirement, and the corresponding clause in spec 016 is treated as out-of-date pending its own update. The `design/wireframe.html` clickable wireframe renders small dashed "swipe ↔" pill tap-zones around the indicator for click-through demo purposes only; those zones are NOT part of the shipped surface.

### Session 2026-05-18

- Q: The MTGJSON SDK (the source for catalogue + price data) does not publish MTG Goldfish observations — only Card Kingdom, Cardmarket, TCG Player, CardHoarder, and Cardsphere. How should the third price source named in the original input be resolved? → A: **Defer MTG Goldfish to a future specification.** This spec ships the price section and 30-day trend chart with **two** sources — Card Kingdom and TCG Player — both backed by MTGJSON's `cardkingdom` and `tcgplayer` provider keys (paper retail observations only, per FR-021). Adding MTG Goldfish requires bespoke ingestion work (third-party data acquisition, scheduling, licensing review) that is out of scope here; a follow-up specification will own that work and, when it lands, will add the third row + line to the same detail-sheet UI without further changes to the catalogue itself. Every occurrence of "MTG Goldfish" in this spec is therefore removed from in-scope language; the three-source acceptance scenarios, FRs, and success criteria are revised to two sources, and a single Out-of-Scope entry records the deferral.

## Background

This spec covers the **Catalogue** tab — the bottom-tab Search destination introduced as a `<ComingSoonContainer />` stub in spec 002 and explicitly distinguished from the in-binder search defined by spec 016. Where the binder-search (spec 016) filters the cards the user already owns, the **catalogue search** browses **every printing in the global card catalogue** so the user can discover, look up, and inspect cards they do not (yet) own.

The catalogue reuses the binder's 9-pocket page metaphor: the visual identity, masthead, paper-cream canvas, and pocket grid are the same materials the user already knows from the Binder tab — only the data underneath changes (catalogue printings instead of personal collection) and the paging behaviour changes (infinite/lazy-loaded pages of search results instead of a finite owned collection).

One cross-cutting concern sits alongside the catalogue feature itself (in this reduced scope):

1. A **shared masthead component** is extracted from the binder-home header (spec 016, FR-001–FR-007) so the Binder and Catalogue tabs render the same crimson header bar, the same right-aligned circular action buttons (search + profile), and the same inline-search expand behaviour. Each consumer passes its own sub-title text (e.g. "My Binder" vs "Catalogue") and its own scoped search behaviour into the same component via slot props.

> **DEFERRED — moved to spec `020-card-detail-prices`:** A **card detail sheet** opening from the bottom of the screen on pocket tap, surfacing Card Kingdom + TCG Player price heuristics and a 30-day price-trend chart (physical printings only; MTG Goldfish further deferred per the 2026-05-18 entry).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the Card Catalogue in 9-Pocket Pages (Priority: P1)

A user opens the Catalogue tab and lands on the global card catalogue rendered in the same crimson-header + cream-canvas + 9-pocket-grid layout as the Binder tab. They see the first page of catalogue results (9 card front faces) and can swipe left to load the next page, swipe right to return to the previous page, with new pages appended lazily on demand. The masthead labels the screen "Catalogue" (not "My Binder") so the user always knows which surface they are on.

**Why this priority**: This is the entire reason to ship the Catalogue tab — give the user a way to look at cards beyond the ones they already own, in a layout that feels native to the binder metaphor. Without this story the Catalogue tab is the existing `<ComingSoonContainer />` stub.

**Independent Test**: Can be fully tested by signing in and tapping the Catalogue tab from the bottom bar. Confirm the rendered screen shows a crimson header with a "Catalogue" sub-title, a cream canvas below, and a 3×3 pocket grid populated with 9 card front faces from the catalogue. Swipe left and confirm the next 9 cards load and the page indicator increments; swipe right and confirm the prior page reappears without re-fetching.

**Acceptance Scenarios**:

1. **Given** the user is authenticated, **When** they tap the Catalogue tab from the bottom tab bar, **Then** the Catalogue screen renders with the same crimson header + paper-cream canvas + binder-page surface visual treatment as the Binder tab, with the masthead sub-title reading "Catalogue".
2. **Given** the Catalogue screen first renders, **When** the initial page of results returns, **Then** the binder page shows up to 9 catalogue cards in a 3×3 grid using the same pocket, image-fit, and rounded-corner treatment as the Binder tab.
3. **Given** the user is on page 1 of the catalogue, **When** they swipe left horizontally on the binder page, **Then** the next 9 catalogue cards load and the page indicator increments by one.
4. **Given** the user is on page N (N > 1), **When** they swipe right horizontally on the binder page, **Then** the prior 9-card page is shown without re-fetching from the server (the page is served from the in-session cache).
5. **Given** the catalogue page indicator, **When** the user is on page N of a result set that has more pages to load, **Then** the indicator renders "Page N" / "OF many" (or an equivalent open-ended affordance) so the user understands the catalogue extends beyond what is currently loaded — distinct from the binder's finite "OF M" indicator.
6. **Given** a catalogue page is currently loading the next results, **When** the next-page swipe is requested before the data arrives, **Then** the next page renders with skeleton/placeholder pockets that resolve to card front faces as the data lands, with no blocking spinner that hides the page.
7. **Given** the user is on the last available page of results, **When** they attempt to swipe forward, **Then** the swipe gesture is a no-op (no wrap-around) and the page indicator stays on its current value.

---

### User Story 2 - Filter the Catalogue by Card Attributes (Priority: P1)

A user opens the Catalogue and refines the result set by combining one or more of the supported filters: card name, set, format legality, card super type, card sub type, creature type, converted mana cost (CMC), and colour identity. The 9-pocket grid re-flows to show only matching cards, paging restarts from page 1 of the filtered set, and the active filters are visible at all times so the user knows what is being applied.

**Why this priority**: The catalogue holds tens of thousands of printings; unfiltered browsing is not a viable discovery path. Filters are how the user actually finds the card they came for. Co-prioritised with US1 because a catalogue tab that cannot be narrowed is unusable at real-world scale.

**Independent Test**: Can be fully tested by opening the Catalogue, applying each filter independently (e.g. name contains "bolt", set = "M21", format = "Standard", super type = "Legendary", sub type = "Goblin", creature type = "Elf", CMC range 2–4, colour identity = "R"), and confirming that the grid re-flows to show only matching cards, that the page indicator restarts at page 1, that the active filters are surfaced visually, and that clearing the filters restores the full catalogue browse from page 1.

**Acceptance Scenarios**:

1. **Given** the Catalogue is shown, **When** the user taps the header search button, **Then** the masthead text collapses and an inline text input expands to fill the header bar with a clear/cancel control on the right (the same expand behaviour the binder-search uses in spec 016) and keyboard focus moves to the input.
2. **Given** the catalogue search input is open and the user has typed a card-name query, **When** the user submits or pauses typing, **Then** the catalogue re-runs against the typed name and the grid re-flows from page 1 of the filtered set.
3. **Given** the catalogue search affordance is open, **When** the user opens the additional-filters control, **Then** they see filter controls for each of: set, format legality, card super type, card sub type, creature type, CMC (range or exact), and colour identity. The card-name filter remains the search input itself.
4. **Given** the user has applied two or more filters at once, **When** the catalogue refetches, **Then** the result set contains only cards that satisfy **every** filter (AND across filter dimensions), paged 9 per page.
5. **Given** at least one filter is active, **When** the catalogue renders, **Then** an unmistakable visual indicator (active state on the search button, an active-filter chip row, or both) is present so the user knows the catalogue is filtered and is not a full-catalogue browse.
6. **Given** at least one filter is active, **When** the user clears all filters (via a clear-all affordance or by individually removing each filter), **Then** the catalogue restores the full unfiltered browse starting from page 1.
7. **Given** the active filters return zero matches, **When** the catalogue rerenders, **Then** the canvas shows a single page of empty pockets with an inline "no cards match these filters" message and a "clear filters" affordance.

---

> ### ⛔ User Story 3 - Inspect a Card's Prices and 30-Day Trend (Priority: P2) — DEFERRED → spec `020-card-detail-prices`
>
> Tapping a populated pocket opens a bottom sheet showing the card's identity, two labelled price rows (Card Kingdom + TCG Player), and a 30-day two-line price-trend chart; missing observations render as `—`/gaps; the sheet dismisses by swipe-down or close and restores the underlying page. **Moved out of spec 018 by the 2026-05-22 split.** Already present on-branch for 020 to inherit: the core price types/schemas and the `CardProvider.getPrices`/`getPriceHistory` interface declarations (provider methods are throwing stubs). Depends on US4 (spec 019) for the shared binder-mutation hook behind the stepper. Full acceptance scenarios live in spec 020.

---

> ### ⛔ User Story 4 - Add Cards From Catalogue, Remove From Binder (Priority: P1) — DEFERRED → spec `019-binder-add-remove`
>
> Inline `+` glyph on each Catalogue pocket and `−` glyph on each Binder pocket, an owned-count glyph driven by `numberOwned`, a `− [numberOwned] +` stepper in the detail sheet, optimistic mutations, and the `Missing only` defer-and-refresh affordance. **Moved out of spec 018 by the 2026-05-22 split.** The **server side is already implemented and tested on this branch** — `number_owned` column + migration, `CardRepository.upsertIncrement`/`adjustNumberOwned`, `POST /cards` upsert (200/201), `PATCH /cards/:id` adjust (200/204/404) — so spec 019 is mobile-only. The Binder's masthead adoption (FR-022) is **already done in spec 018**. Full acceptance scenarios live in spec 019.

---

### Edge Cases

- **Empty catalogue load**: When the catalogue's initial page fetch fails after a transient retry, the canvas shows an inline retry affordance inside the binder page surface — the header, masthead, and page indicator remain visible.
- **Filter combination yields zero**: When the active filter combination matches no cards, render a single page of empty pockets with "no cards match these filters" inline and a clear-all affordance. The page indicator shows "Page 1 / OF 1".
- **Very large filter result**: When the filtered result set is in the thousands, the user must still be able to swipe forward and backward without the previously loaded pages being evicted from cache mid-session (so swiping back is instant). Memory pressure may evict images outside the visible window but must not evict the page structure.
- **Switching tabs while filtered**: When the user navigates away from the Catalogue tab to another bottom tab and returns within the same session, the active filters and current page position are preserved.
- **Network change while paging**: When the network drops mid-page-load, the in-flight page renders the inline retry affordance inside the next-page pockets without disturbing the previously loaded pages.

> **DEFERRED edge cases** (Tap during page load, No price data at all, Background while sheet is open) moved to spec `020-card-detail-prices`. (Add/remove tap during pending mutation, Decrement below zero, Remove the card the binder-search is filtered against) moved to spec `019-binder-add-remove`.

## Requirements *(mandatory)*

### Functional Requirements

**Catalogue tab and shared masthead**

- **FR-001**: The Catalogue tab MUST render the same crimson header bar, paper-cream canvas, ring-perforated binder-page surface, and 3×3 pocket grid visual treatment as the Binder tab (per spec 016, FR-002 / FR-011 / FR-012 / FR-013 / FR-014).
- **FR-002**: A **shared masthead component** MUST exist that both the Binder tab and the Catalogue tab render. Each consumer MUST be able to pass, at minimum: (a) the **sub-title text** ("My Binder", "Catalogue", and any future tab using the same masthead), (b) the **on-search callback** that defines what tapping the search button does in that consumer's context (in-binder filter vs catalogue search), and (c) the **on-profile callback** for the profile shortcut. The crimson surface, overline text ("MY-BINDER"), binder icon, right-aligned circular action buttons (search + profile), and inline-expand search behaviour MUST be shared rendering owned by the masthead component itself.
- **FR-003**: Tapping the header search button on the Catalogue tab MUST open an inline text input that replaces the masthead text within the same header bar (the same expand behaviour the binder-search uses in spec 016, FR-005). The Catalogue search input MUST treat its text content as the **card-name filter** for the catalogue.
- **FR-004**: The Catalogue search MUST NOT navigate to or modify the user's in-binder search (the two surfaces are distinct features — see spec 016 Clarifications).

**Filters**

- **FR-005**: The Catalogue MUST expose user-editable filters for each of: card **name** (substring match, case-insensitive), **set** (one or more sets), **format legality** (e.g. Standard, Modern, Legacy, Vintage, Commander, Pauper — at least the major constructed formats), **card super type** (e.g. Legendary, Basic, Snow), **card sub type** (e.g. Equipment, Aura, Saga), **creature type** (e.g. Elf, Goblin, Wizard), **converted mana cost (CMC)** as a numeric range or exact value, **colour identity** (one or more of W, U, B, R, G, and colourless), and a **`Missing only` toggle** (boolean; when ON, restricts results to printings whose `numberOwned` for the signed-in user is 0).
- **FR-006**: When two or more filters are active simultaneously, the catalogue result set MUST be the conjunction (AND) of every active filter. Within a single filter dimension that accepts multiple values (e.g. selecting both "Goblin" and "Elf" as creature types, or "R" and "G" as colour identities), values MUST be combined as an inclusive match (OR within the dimension).
- **FR-007**: The active filter state MUST be visible to the user at all times while any filter is active (e.g. via active-filter chips, a visibly active search button, or a persistent filter summary), so the user can distinguish a filtered catalogue from an unfiltered browse.
- **FR-008**: The user MUST be able to clear individual filters and clear all filters in one action. Clearing all filters MUST restore the full unfiltered catalogue starting from page 1.

**Result presentation and paging**

- **FR-009**: Catalogue results MUST be presented in the 9-pocket binder-page grid (3×3), one page per binder-page surface, identical in layout to the Binder tab (per spec 016, FR-014 / FR-015 / FR-016).
- **FR-010**: Page navigation MUST be driven by **horizontal swipe gesture** on the binder page — swipe left advances to the next page, swipe right returns to the previous page. The canvas MUST render a small centred italic "Page N of M" indicator (single-line, body-size, matching the shipped Binder view) below the binder page surface. The canvas MUST NOT render flanking arrow buttons around the indicator. This explicitly supersedes the tap-or-swipe wording of spec 016 FR-017 / FR-018 — see the 2026-05-17 Clarifications entry; spec 016 is treated as out-of-date on this point until its own follow-up update.
- **FR-011**: Pages of catalogue results MUST be fetched lazily as the user nears the end of the loaded set — a swipe forward MUST trigger the next page fetch if it is not already in cache. Pages already loaded in the current session MUST be served from cache on backward navigation without re-fetching.
- **FR-012**: While a page of results is loading, the binder-page surface MUST render skeleton/placeholder pockets in the page's 9 positions so the layout does not jump when data arrives. Skeleton pockets MUST be visually distinguishable from both occupied pockets and the binder's empty-pocket placeholder.
- **FR-013**: The page indicator MUST clearly communicate, when the underlying result set is open-ended (still has more pages to load), that the catalogue extends beyond the currently known page count — e.g. "N of many" rendered in the same single-line italic style as the finite "N of M" indicator, distinguished only by the trailing word ("many" vs the resolved count) — distinct from the binder's finite "N of M" indicator (spec 016, FR-019).
- **FR-014**: When the user reaches the genuine end of the result set (no more pages exist), the swipe-forward gesture MUST be a no-op (no wrap-around). No button-disabled state is required because no pager buttons exist (FR-010).
- **FR-015**: When the result set is empty (zero matches for the active filters), the canvas MUST render a single page of empty pockets with an inline "no cards match these filters" message and a "clear filters" affordance.

**Card detail sheet and prices** — ⛔ DEFERRED → spec `020-card-detail-prices`

> FR-016–FR-021 (bottom-sheet open on pocket tap; two labelled Card Kingdom + TCG Player price rows; 30-day two-line trend chart; `—`/gap placeholders for missing observations; swipe-down/close dismissal restoring page position; physical-printings-only scoping) **moved to spec 020**. Note: FR-021's "exclude digital-only printings from catalogue results" guarantee for the **browse path** is retained in this spec as **SC-007**. The core price types/schemas and provider interface decls already exist on-branch for 020 to inherit.

**Cross-surface consistency**

- **FR-022**: The shared masthead component (FR-002) MUST be adopted by the existing binder-home view from spec 016 as part of shipping this feature, replacing the current per-screen header implementation with the shared component. The Binder tab's behaviour MUST not regress: the binder-search inline expand, the in-binder filter behaviour from spec 016 FR-005 / FR-005a–f, and the Profile shortcut from spec 016 FR-006 MUST all continue to work exactly as specified there. *(Done in spec 018 — `BinderHomeView` renders the shared `<Masthead />`.)*

**Owned-count indicator and add / remove from binder** — ⛔ DEFERRED → spec `019-binder-add-remove`

> FR-023–FR-031 (per-`(printing, user)` `numberOwned` model; owned-count glyph with Catalogue ≥1 / Binder ≥2 thresholds; inline `+`/`−` glyph-buttons; detail-sheet stepper; swipe-safe glyph placement; catalogue/binder lock-step; in-place resolution; `Missing only` defer-and-refresh) **moved to spec 019**. The **server side is already implemented and tested on this branch** (FR-023's `number_owned` model + the upsert/adjust repository methods and the `POST`/`PATCH` routes); spec 019 covers the mobile UI for FR-024–FR-031.

### Key Entities *(include if feature involves data)*

- **Catalogue Browse**: An infinite, paged view over the global card catalogue. Identified by the currently active filter set and the currently loaded set of pages. Has a "head" position (current visible page) and a "tail" position (highest page loaded so far).
- **Catalogue Filter Set**: The collection of currently applied filters — name, set, format legality, super type, sub type, creature type, CMC, colour identity — combined as AND across dimensions and OR within a dimension. The empty filter set corresponds to the unfiltered browse.
- **Catalogue Page**: A 9-card slice of the result set for the current filter set, identified by 1-based page number, occupying one binder-page surface. May be in one of three load states: not-yet-loaded, loading (skeleton), or loaded.
- **Masthead Component**: The shared crimson header rendered by both the Binder and Catalogue tabs. Accepts sub-title text, an on-search callback, and an on-profile callback from its consumer.

> **DEFERRED entities** — *Card Detail Sheet*, *Price Observation*, *Price Source* → spec `020-card-detail-prices`. *Binder Card Entry*, *Owned-Count Glyph*, *Owned-Count Stepper* → spec `019-binder-add-remove` (the *Binder Card Entry* `numberOwned` model is already implemented server-side on this branch).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Catalogue tab renders its first interactive page (header + canvas + first 9 catalogue pockets either populated or in skeleton state) within 2 seconds of being tapped from the bottom tab bar on a standard mobile device.
- **SC-002**: Page navigation between consecutive catalogue pages already loaded in the current session completes within one display frame on a standard mobile device, with no perceptible stutter.
- **SC-003**: Swiping forward into an unloaded page reveals the skeleton page within one display frame; the page resolves to populated pockets within 1.5 seconds in the median case on a standard network.
- **SC-004**: For at least 95% of catalogue result sets, the active filters produce a refined result set where every returned card satisfies every active filter (verified by sampling result sets across each filter dimension and combinations).
- **SC-007**: Zero digital-only printings appear in any catalogue result (verified across the entire catalogue index). *(The detail-sheet / price-observation half of the original SC-007 moves to spec 020.)*
- **SC-008**: The shared masthead component is adopted by both the Binder and Catalogue tabs; the Binder tab's existing spec-016 behaviours (in-binder search, Profile shortcut) regress in zero test cases.
- **SC-009**: 95% of users in usability testing correctly identify, without prompting, that the Catalogue search filters the global card catalogue while the Binder search (spec 016) filters only their own collection.
- **SC-010**: The Catalogue tab preserves the user's active filter set and current page position across in-session tab switches in 100% of test runs.

> **DEFERRED success criteria** — SC-005 (pocket tap opens detail sheet), SC-006 (30-day chart render budget) → spec `020-card-detail-prices`. SC-011 (optimistic glyph update), SC-012 (catalogue/binder glyph lock-step), SC-013 (50-cycle gesture-conflict) → spec `019-binder-add-remove`.

## Assumptions

- The Catalogue tab is the bottom-tab Search destination introduced as a `<ComingSoonContainer />` stub in spec 002. This spec replaces that stub with the catalogue view.
- The user is already authenticated by the time they can reach the Catalogue tab (delivered by spec 002 US1). No anonymous catalogue browsing is in scope for this spec.
- The Binder tab's design tokens (crimson cover, dusty gold accent, paper-cream interior, ring-perforated binder page) defined for spec 016 are reused as-is. No new colour or typography tokens are introduced.
- The reusable card pocket / card-front-face rendering work from spec 017 (`Reusable Card Component`) is the source of truth for how a single card pocket renders in this view. This spec consumes that component rather than redefining card rendering.
- The shared masthead component (FR-002, FR-022) is **extracted from** the existing binder-home header (spec 016) as part of shipping this feature. Spec 016's functional behaviour is treated as the canonical reference for the masthead's visual contract.
- The card-name filter on the Catalogue search performs a case-insensitive substring match by default. Quoted phrases, boolean operators, and other advanced query syntax are out of scope for this spec.
- Format legality covers at least the major constructed formats present in the existing card data (Standard, Modern, Legacy, Vintage, Commander, Pauper). Limited formats (Sealed, Draft) and casual formats (Brawl variants) are not in initial scope.
- "Physical printings only" means non-digital printings — printings that have a paper edition. MTGO-exclusive and Arena-exclusive printings are excluded from catalogue results (SC-007). Paper printings that also have a digital release ARE in scope.
- Card images, identity metadata (name, set, type, oracle text), and format legality information are available from the existing card data layer (provider abstraction from specs 001 / 004 / 010). This spec does not redefine how that data is fetched.
- Pagination follows the existing `/cards/search/` endpoint contract; expanding that endpoint's filter dimensions to cover everything in FR-005 is an expected planning-phase outcome of this spec.

> **DEFERRED assumptions** (30-day trend window; price-observation sourcing from `sdk.prices.today`/`history`; the detail sheet being shared across Catalogue + Binder) moved to spec `020-card-detail-prices`.

## Out of Scope

- **Add to binder / remove from binder + owned-count glyphs (US4).** Deferred to spec `019-binder-add-remove`. The server side is already implemented and tested on this branch; spec 019 covers the mobile UI.
- **Card detail sheet, prices, and the 30-day trend chart (US3).** Deferred to spec `020-card-detail-prices`. Core price types/schemas and provider interface decls already exist (provider methods stubbed); spec 020 implements the rest. Depends on spec 019.
- **Wishlist / saved searches.** The Catalogue does not persist queries or favourites across sessions in this spec.
- **Sort controls** (cheapest first, alphabetical, release date). Result ordering is whatever the underlying search returns; explicit user-facing sort is out of scope here.
- **Advanced query syntax** (boolean operators, quoted phrases, field-scoped queries like `t:creature`). Name search is plain substring match in scope.
- **Digital-only printings and digital marketplaces.** Excluded from catalogue results (SC-007).
- **Price-related out-of-scope items** — buying / retailer click-out, historic windows other than 30 days, and **MTG Goldfish as a price source** — move with the detail sheet to spec `020-card-detail-prices` (MTGJSON does not publish MTG Goldfish; spec 020 ships two sources and a later spec adds the third additively). See the 2026-05-18 Clarifications entry.
