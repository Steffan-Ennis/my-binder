# Feature Specification: Binder Home View

**Feature Branch**: `016-binder-home-view`
**Created**: 2026-05-10
**Status**: Draft
**Input**: User description: "the binder-home view was missed during the tasks and implementation steps of `specs/002-mobile-binder-app/plan.md`. Migrate the feature to a new spec. Lift the design from `specs/002-mobile-binder-app/My-Binder--wireframe-v3.html` (binder-view screenshot). Including the header bar with the Search and profile buttons. Here is the SVG markup for the icon."

## Clarifications

### Session 2026-05-10

- Q: What does the top-bar Search button on the binder-home header do — and how does it differ from the bottom-tab Search? → A: The top-bar Search button performs an **in-binder search**: it searches across the cards already in the user's binder and navigates to the page containing the matching card. The bottom-tab Search button performs a **catalogue search** across all cards (not just the user's collection) and is a different feature; the two buttons are NOT interchangeable shortcuts. Throughout this spec, the top-bar Search shortcut is named **"binder search"** and the bottom-tab Search is named **"catalogue search"** to keep the two distinct.
- Q: When the binder-search query matches more than one card in the user's collection, what should happen? → A: **Filter the binder.** While a query is active, the binder pages re-flow to show only the matching cards in their natural order; non-matching pockets render as empty placeholders, the page count and "N CARDS" caption recompute against the filtered set, and the user pages through filtered results until the query is cleared. Clearing the query restores the full binder and the prior page position.
- Q: What field(s) should the binder-search query match against in the user's collection? → A: **Card name, set, and card type** (case-insensitive substring match across all three fields). A card matches the active query if the query string is a case-insensitive substring of the card's name, the card's set name or set code, or the card's type line (e.g. "Creature", "Instant"). Matches across any of the three fields are treated equivalently — there is no per-field weighting or ranking.
- Q: When the user taps the binder-search button, where should the search text input appear? → A: **Inline header replacement.** Tapping the binder-search button collapses the masthead text and expands a text input to fill the header bar in its place, with a clear/cancel control on the right. The cream canvas, summary caption, and binder page remain visible behind so the user sees pages re-flow live as they type. Dismissing or clearing the input collapses the text field and restores the masthead.
- Q: How should the binder-search query handle multi-word input (e.g. typing "red creature")? → A: **All-tokens AND.** The query is split on whitespace into tokens; a card matches only if EVERY token is a case-insensitive substring of at least one of the card's name, set name/code, or card-type line (each token can match independently against any of the three fields). Empty/whitespace-only queries are treated as inactive (no filter). There is no quoted-phrase syntax in scope.

## Background

Spec 002 (`Mobile Binder App`) defined two user stories: P1 Sign in with Google, and P2 Browse the Binder Home Screen. Tasks T075–T082 of `specs/002-mobile-binder-app/tasks.md` covered the binder-home implementation (`useBinderHome`, `BinderHomeView`, `BinderHomeContainer`, and the `binder.tsx` route shell). When spec 002 was implemented, only the P1 sign-in flow shipped; the binder-home tasks were skipped and the `apps/mobile/src/components/binder-home/` directory remains empty. The `(authenticated)/(tabs)/binder.tsx` route currently has no functional view.

This spec **migrates** the binder-home feature out of spec 002 and into a dedicated, scope-focused feature so it can be planned, tasked, and shipped independently. It also adds requirements that were missing from spec 002:

1. A **branded header bar** that sits inside the Binder tab (above the binder content), reproducing the wireframe v3 masthead (binder icon + "MY-BINDER" overline + "My Binder" italic-serif title) and exposing a **binder-search** button (live filter over the user's collection that re-flows binder pages to show only matching cards — see Clarifications) and a **Profile** circular icon button on the right. The masthead binder-search button is intentionally distinct from the bottom-tab catalogue Search.
2. A **collection summary caption** ("7 CARDS · 1 PAGE") that orients the user before they scan the grid.
3. A **paged binder canvas** with a paper-cream background, rounded outer page, perforated ring guides at the spine, and large rounded prev/next pill buttons flanking a centred "Page N of M" indicator.

The Profile header button acts as a **shortcut** to the bottom-tab Profile destination. The Search header button is **not** a shortcut to the bottom-tab Search — it opens an inline header search input that live-filters the user's collection and re-flows the binder pages to show only matching cards (see Clarifications). The bottom tab bar remains the navigation between the four feature areas. The existing P2 acceptance criteria from spec 002 (3×3 grid, occupied/empty pockets, paging, partial last pages, empty collection) are carried forward verbatim and extended with the additional design language elements above.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See My Binder Home With Branded Header (Priority: P1)

After signing in, the user lands on the Binder tab and sees their binder home screen rendered as a digital recreation of the wireframe v3 layout. A deep-crimson header bar at the top carries the masthead (binder icon, the wide-tracked "MY-BINDER" overline, and the italic-serif "My Binder" title) plus two circular icon buttons on the right: a binder-search button (live filter over the user's collection — see US3) and a Profile shortcut. Below the header, a paper-cream canvas shows the user's collection summary, the 3×3 pocket grid, and a page navigator at the bottom. The visual continuity between the crimson cover (login/header) and the cream interior (binder pages) reinforces the binder-as-physical-object metaphor.

**Why this priority**: This is the home screen of the authenticated experience. Without it the Binder tab is a blank route and the app has no purpose to return to. It is also the first place the user spends meaningful time after signing in, so the visual identity defined by the wireframe must land here.

**Independent Test**: Can be fully tested by signing in with an account that has at least 7 cards in its collection and confirming the rendered Binder tab matches the wireframe v3 reference: crimson header with masthead and two circular buttons, cream canvas, "N CARDS · M PAGE(S)" summary, 3×3 grid populated with the user's first nine card front faces, and a "Page 1 of M" indicator flanked by previous/next pill buttons at the bottom.

**Acceptance Scenarios**:

1. **Given** the user is authenticated and on the Binder tab, **When** the binder-home screen first renders, **Then** the top of the screen shows a deep-crimson header bar containing the binder icon, the wide-tracked "MY-BINDER" overline, the italic-serif "My Binder" title, and two circular icon buttons on the right (binder-search and Profile, in that order).
2. **Given** the binder-home screen is shown, **When** the user looks below the header, **Then** the screen background is a paper-cream surface (visually distinct from the crimson header) and the area immediately below the header shows a centred caption of the form "N CARDS · M PAGE" / "M PAGES" describing the user's collection.
3. **Given** the binder-home screen is shown, **When** the canvas renders, **Then** a single rounded "binder page" surface is centred horizontally with three small ring perforations on its left edge, evoking a 3-ring binder page.
4. **Given** the binder-home screen is shown, **When** the user looks at the bottom of the canvas, **Then** a circular previous-page button (left), a centred "Page N" / "OF M" indicator (two lines, italic), and a circular next-page button (right) are visible above the bottom tab bar.
5. **Given** the binder-home screen is shown, **When** the user taps the Search button in the header, **Then** the app opens a binder-search input scoped to the user's collection (NOT the bottom-tab catalogue search). While a query is active, the binder pages re-flow to show only the cards matching the query in their natural order; the summary caption and total page count recompute against the filtered set; clearing the query restores the full binder and the page the user was viewing before searching.
6. **Given** the binder-home screen is shown, **When** the user taps the Profile button in the header, **Then** the app navigates to the Profile tab (the same destination as the bottom-tab Profile icon).

---

### User Story 2 - Page Through My Collection (Priority: P1)

A user with more than 9 cards in their collection sees their first page of 9 cards on load and can navigate forward and backward through the remaining pages using either the previous/next pill buttons or a horizontal swipe gesture on the binder page. The current page number and total page count are always visible. Cards already filled and empty pockets are visually distinct.

**Why this priority**: Paging is the core verb of the binder experience and the only way to access cards beyond the first nine. Without it the binder is functionally a single-page snapshot. It is co-prioritised with US1 because a binder-home screen that does not page is incomplete.

**Independent Test**: Can be fully tested by signing in with an account that has 11 cards (1 full page + 2), confirming page 1 shows 9 cards, swiping left or tapping next reveals page 2 with 2 filled pockets and 7 empty pockets, and confirming the page indicator updates from "Page 1 / OF 2" to "Page 2 / OF 2".

**Acceptance Scenarios**:

1. **Given** the user has more than 9 cards and is on page 1, **When** they tap the next-page button or swipe left on the binder page, **Then** the next 9-pocket page is revealed and the page indicator increments by one.
2. **Given** the user is on a page after page 1, **When** they tap the previous-page button or swipe right on the binder page, **Then** the prior 9-pocket page is revealed and the page indicator decrements by one.
3. **Given** the user is on page 1, **When** they tap the previous-page button, **Then** nothing happens (no wrap-around, no error) and the previous-page button appears in a visibly disabled state.
4. **Given** the user is on the last page, **When** they tap the next-page button, **Then** nothing happens (no wrap-around, no error) and the next-page button appears in a visibly disabled state.
5. **Given** a card slot is occupied by a card in the user's collection, **When** the slot renders, **Then** the card's front-face image fills the pocket with rounded corners.
6. **Given** a card slot is empty (because the user's collection has fewer cards than the page can hold), **When** the slot renders, **Then** the slot shows a dashed-outline empty-pocket placeholder visually distinct from a filled pocket.
7. **Given** the user has 11 cards (1 full page + 2), **When** the user is on page 2, **Then** exactly 2 pockets are filled (with the 10th and 11th cards) and 7 pockets render the empty-pocket placeholder. No phantom cards are shown.

---

### User Story 3 - Filter My Binder With Search (Priority: P2)

A user with many cards in their collection taps the binder-search button in the header, sees the masthead text collapse to reveal an inline text input, and starts typing. As they type, the binder pages re-flow live to show only the cards whose name, set name/code, or card-type line contains every typed token (case-insensitive). The summary caption ("N CARDS · M PAGES") and total page count update on each keystroke against the filtered set. When they clear the input or tap the cancel control, the masthead returns and the binder restores both its full unfiltered contents and the page they were viewing before searching.

**Why this priority**: Once a binder grows past a few pages, manual paging to find a specific card is tedious. Search makes the binder usable at scale. It is co-prioritised behind US1 and US2 because a binder-home view that does not render at all (US1) or cannot page (US2) cannot be searched against either.

**Independent Test**: Can be fully tested by signing in with a collection that includes at least one card per matching scenario (e.g. one card whose name contains "bolt", one whose set is "M21", one whose type contains "Creature"), tapping the binder-search button, typing each query in turn, and confirming that the binder pages re-flow to show only matching cards in their natural order with non-matching slots rendered as empty placeholders, that the summary caption recomputes correctly on each keystroke, and that clearing the input restores the full binder and prior page position.

**Acceptance Scenarios**:

1. **Given** the binder-home screen is shown with the masthead visible, **When** the user taps the binder-search button, **Then** the masthead text collapses, an inline text input expands to fill the header bar with a clear/cancel control on the right, and keyboard focus moves to the input. The cream canvas, summary caption, and binder page remain visible behind the header.
2. **Given** the search input is open and empty, **When** the user has not yet typed anything, **Then** the binder still shows the full unfiltered collection and the summary caption shows the unfiltered card and page count.
3. **Given** the search input is open, **When** the user types a single token (e.g. "bolt"), **Then** on each keystroke the binder pages re-flow to show only the cards whose name, set name/code, or card-type line contains that token (case-insensitive); the summary caption updates to "K CARDS · J PAGE(S)" against the filtered set; non-matching slots render as empty placeholders.
4. **Given** the search input is open with a multi-token query (e.g. "red creature"), **When** the filter applies, **Then** only cards whose name + set + type collectively contain every token (each token can match any one of the three fields) are shown.
5. **Given** the search input is open and the user types a query that matches zero cards, **When** the filter applies, **Then** the binder shows a single page of empty pockets with an inline "no matches in your binder" message inside the canvas, the summary caption shows "0 CARDS · 1 PAGE", and the user can clear the query to return to the full binder.
6. **Given** an active binder-search query is filtering the binder, **When** the user taps the clear/cancel control or empties the input, **Then** the masthead text returns, the binder restores the full unfiltered collection, and the user is returned to the page they were viewing immediately before opening the search input.
7. **Given** an active binder-search query, **When** the binder is filtered, **Then** an unmistakable visual indicator (active state on the search button or a chip showing the query) is present so the user knows the binder is filtered and is not seeing their full collection.

---

### Edge Cases

- **Empty collection**: When the user has 0 cards, the binder-home screen still renders the header, the cream canvas, the binder page with 9 empty-pocket placeholders, the summary caption "0 CARDS · 1 PAGE", and the page indicator "Page 1 / OF 1". Both prev and next page buttons appear disabled.
- **Loading state**: While the user's collection is being fetched for the first time, the canvas renders the binder page with 9 empty pockets and the summary caption shows a placeholder dash ("— CARDS · — PAGE") so the layout does not jump when data arrives.
- **Network error**: When the collection fetch fails after a transient retry, the canvas shows an inline retry affordance inside the binder page surface (replacing the grid) without removing the header or the page indicator. The summary caption and page indicator both render dashes.
- **Singular vs plural**: The summary caption uses "1 PAGE" when the collection fits on a single page and "M PAGES" otherwise. "1 CARD" / "N CARDS" follows the same rule.
- **Header buttons and active tab**: The header's binder-search and Profile buttons are visible only on the Binder tab; switching to another tab via the bottom tab bar reveals that tab's own content (which may not have a header bar). The Profile header button is a shortcut to the Profile tab; the binder-search button opens an in-binder search and is **not** a shortcut to the bottom-tab catalogue search.
- **Large collection performance**: For 1,000 cards (≈112 pages), swiping forward should not visibly stutter, and the prev/next buttons should remain responsive within one frame. Pages outside the visible window should not retain decoded images indefinitely.
- **Background while paged**: When the user backgrounds the app on page 17 and returns within the active session window, the binder reopens on page 17 (last viewed page is preserved for the session). When the session has expired, see the spec 002 sign-in flow — the user is returned to login and the page position is reset on next sign-in.

## Requirements *(mandatory)*

### Functional Requirements

**Header bar**

- **FR-001**: The Binder tab MUST render a header bar at the top of the screen, above the binder canvas and below the device status bar.
- **FR-002**: The header bar MUST use the same crimson cover surface as the login screen so the masthead reads as continuous binder cover material.
- **FR-003**: The header bar MUST contain, on the left, a binder icon (the spec's binder-with-fanned-cards mark) followed by a two-line text block: a wide-tracked "MY-BINDER" overline (small caps, accent gold) above an italic-serif "My Binder" title (large, soft cream/rose).
- **FR-004**: The header bar MUST contain, on the right, two circular icon buttons in this order: a binder-search button (magnifying-glass glyph) and a Profile button (person glyph). Both buttons MUST sit on a translucent dark surface so they read against the crimson background.
- **FR-005**: Tapping the binder-search button MUST open an in-binder search input scoped to the cards already in the user's collection. The input MUST replace the masthead text inline within the same crimson header bar (the masthead collapses, the text input expands to fill its space, and a clear/cancel control appears on the right). The cream canvas, summary caption, and binder page MUST remain visible behind the input so the user sees pages re-flow live as they type. The binder-search button MUST NOT navigate to the bottom-tab catalogue Search route.
- **FR-005e**: The binder pages MUST re-flow continuously as the user types (live filter), with no submit step required. The summary caption and total page count MUST recompute on each keystroke against the current query.
- **FR-005f**: Dismissing or clearing the inline search input (via the clear/cancel control or by emptying the field) MUST collapse the input, restore the masthead text in the header, restore the full unfiltered binder, and return the user to the page they were viewing immediately before the input was opened.
- **FR-005a**: While a binder-search query is active, the binder pages MUST re-flow to render ONLY the cards matching the query, in their natural collection order, packed into 9-pocket pages. Non-matching slots MUST render as empty-pocket placeholders. The summary caption MUST recompute as "K CARDS · J PAGE(S)" where K is the number of matching cards and J = `ceil(K / 9)` (J ≥ 1 even when K is 0). A card matches the query if, after splitting the query on whitespace into tokens, EVERY token is a case-insensitive substring of at least one of the card's name, set name/code, or card-type line (each token can match independently against any of the three fields). An empty or whitespace-only query MUST be treated as inactive (no filter applied).
- **FR-005b**: When a binder-search query is active, an unmistakable visual indicator (e.g. an active state on the search button or a chip/banner showing the current query) MUST appear so the user knows the binder is filtered.
- **FR-005c**: Clearing the binder-search query MUST restore the full unfiltered binder and return the user to the page they were viewing immediately before the query was entered.
- **FR-005d**: Submitting a binder-search query that matches zero cards MUST keep the search active, recompute the summary caption to "0 CARDS · 1 PAGE", and render a single page of empty-pocket placeholders with an inline "no matches in your binder" message inside the canvas. The user MUST be able to clear the query from this state and return to the full binder.
- **FR-006**: Tapping the Profile button MUST navigate the user to the Profile tab (the same route the bottom-tab Profile icon activates).
- **FR-007**: Both header buttons MUST meet a minimum touch target of 48×48 px (Material baseline) with at least 8 px of horizontal spacing between them.

**Collection summary caption**

- **FR-008**: A single-line summary caption MUST appear directly below the header bar, centred horizontally on the cream canvas.
- **FR-009**: The summary caption MUST display the total card count and total page count in the form "N CARDS · M PAGE" (singular) or "N CARDS · M PAGES" (plural). The card noun MUST also pluralise on N.
- **FR-010**: While the collection is loading or has errored, the summary caption MUST render placeholder dashes (e.g. "— CARDS · — PAGE") so the layout does not jump.

**Binder page surface**

- **FR-011**: The binder canvas MUST render on a paper-cream background (visually distinct from the crimson header) so the cover-to-page transition is obvious.
- **FR-012**: A single rounded "binder page" surface MUST be centred horizontally inside the canvas and fill the available width with consistent inset margins.
- **FR-013**: The binder page surface MUST display three small ring perforations along its left edge, evenly spaced vertically, evoking a 3-ring binder page.
- **FR-014**: Each binder page surface MUST contain a 3×3 grid of card pockets (9 pockets per page).
- **FR-015**: An occupied pocket MUST display the card's front-face image, scaled to fit, with rounded corners matching the pocket's inner radius.
- **FR-016**: An empty pocket MUST display a dashed-outline placeholder on the cream surface, visibly distinct from any occupied pocket and from the surrounding page.

**Paging**

- **FR-017**: The user MUST be able to navigate to the next page by tapping a circular next-page button or by swiping left horizontally on the binder page.
- **FR-018**: The user MUST be able to navigate to the previous page by tapping a circular previous-page button or by swiping right horizontally on the binder page.
- **FR-019**: A two-line page indicator MUST be centred between the previous and next buttons, rendering "Page N" on the first line (italic display serif) and "OF M" on the second line (small caps).
- **FR-020**: When the user is on the first page, the previous-page button MUST appear visibly disabled and tapping it MUST be a no-op. When the user is on the last page, the next-page button MUST appear visibly disabled and tapping it MUST be a no-op. There is no page wrap-around.
- **FR-021**: The total page count MUST equal `ceil(N / 9)` where N is the total number of cards. When N is 0, the total page count MUST be 1.
- **FR-022**: When the collection has a partial last page (e.g. 11 cards on the last of 2 pages), the partial page MUST render the remaining cards in their natural order and fill the remaining pockets with empty-pocket placeholders. No phantom cards.
- **FR-023**: When the user backgrounds the app and returns within the active session window, the binder MUST reopen on the page they last viewed.

### Key Entities *(include if feature involves data)*

- **Binder Page View**: The current visible page of the binder, identified by a 1-based page number and bound to a 9-pocket layout.
- **Pocket**: One of nine positions on a page; either occupied (renders a card front face) or empty (renders the placeholder).
- **Collection Summary**: A small derived view of the user's collection — total card count and total page count — rendered as the caption below the header.
- **Binder Search**: The header magnifying-glass button and the active-query state it manages. While a query is active, the binder is rendered against the filtered subset of the user's collection (matching cards only, repacked into 9-pocket pages, page count and summary caption recomputed). Distinct from the bottom-tab catalogue Search.
- **Binder Search Query**: The text the user is currently filtering by. Has at least two states: inactive (no filter, full binder shown) and active (filter applied, prior page position retained for restore-on-clear).
- **Profile Shortcut**: The header person-glyph button. Navigates to the same Profile route the bottom-tab Profile icon activates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After authentication, the binder-home screen renders and is interactive within 2 seconds on a standard mobile device — measured from successful sign-in to the first frame on which the grid and the page indicator are both visible.
- **SC-002**: Page navigation between binder pages completes within one display frame on a standard mobile device, with no perceptible stutter when paging forward or backward through a 100-card collection.
- **SC-003**: 100% of test collections from 0 cards to 1,000 cards render the binder layout without overlap, clipping of pockets, or layout errors.
- **SC-004**: 100% of taps on the header Profile button land on the Profile route in both portrait and landscape on iOS and Android. 100% of taps on the header binder-search button open the in-binder search affordance and never land on the bottom-tab catalogue Search route.
- **SC-005**: 95% of users in usability testing correctly identify, without prompting, that the header magnifying-glass icon searches within their binder while the bottom-tab Search icon searches the full card catalogue.
- **SC-006**: 100% of partial-last-page renders display only the cards that exist, with no phantom cards in unfilled pockets.
- **SC-007**: After backgrounding the app on page N (N > 1) and returning within the active session window, 100% of resumes restore the user to page N.

## Assumptions

- The app already authenticates the user and routes them to the Binder tab (delivered by spec 002, US1).
- The Profile tab route already exists as a `<ComingSoonContainer />` placeholder (delivered by spec 002). The header Profile shortcut targets that route regardless of its placeholder state and inherits the eventual Profile destination without re-work.
- The bottom-tab catalogue Search is a separate feature owned by a future spec; this spec does NOT depend on it being implemented and does NOT route the header binder-search button to it.
- The bottom tab bar from spec 002 remains the primary navigation between the four tabs. The header shortcuts are additive convenience targets, not a replacement.
- Card front-face images are sourced from the server (spec 001 / 014) and made available to the mobile client by the existing card-collection query layer planned in spec 002; this spec does not redefine how images are fetched, only how they are rendered.
- The binder visual identity continues to follow the wireframe v3 design tokens (deep crimson cover, dusty gold accent, rose body text, paper-cream interior). No new colour tokens are introduced; if the cream interior surface is not yet present in the existing token set, it is added during planning as a derived addition rather than a new clarification here.
- The binder icon used in the header masthead is the existing binder mark from `specs/002-mobile-binder-app/icon.svg` (binder body with three cards fanning out of the top-left corner). The icon is recoloured at render time to harmonise with the dusty-gold accent on the crimson background.
- The header binder-search and Profile glyphs reuse the same icon family already used by the bottom tab bar in spec 002 so the visual language is consistent. The shared glyph does NOT imply shared destination — see Clarifications.
- Page-position memory across backgrounding survives only the active session. Across sign-out/sign-in cycles the binder always opens on page 1.
