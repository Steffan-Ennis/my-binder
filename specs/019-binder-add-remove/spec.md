# Feature Specification: Binder Add / Remove + Owned-Count Glyphs

**Feature Branch**: `019-binder-add-remove` *(to be created)*
**Created**: 2026-05-22
**Status**: Draft — split out of spec `018-card-catalogue-search` (US4)
**Input**: Carved out of spec 018 (US4) by the 2026-05-22 split. Original input: catalogue pockets must indicate when a card is already in the user's binder and how many copies are owned; an **add to binder** action on the Catalogue screen; a **remove from binder** action on the Binder screen.

## Provenance

This spec is **User Story 4** of spec `018-card-catalogue-search`, extracted into its own specification. FR / SC numbers below are renumbered for a standalone spec; the mapping to the original 018 numbers is kept for traceability:

| This spec | Spec 018 origin |
|---|---|
| FR-001 | FR-023 (`numberOwned` model) |
| FR-002 | FR-024 (owned-count glyph) |
| FR-003 | FR-025 (Catalogue `+`) |
| FR-004 | FR-026 (Binder `−` + reflow) |
| FR-005 | FR-027 (swipe-safe glyph placement) |
| FR-006 | FR-028 (detail-sheet stepper) |
| FR-007 | FR-029 (Catalogue/Binder lock-step) |
| FR-008 | FR-030 (in-place resolution) |
| FR-009 | FR-031 (`Missing only` defer-and-refresh) |
| SC-001 | SC-011 (optimistic glyph + reconcile) |
| SC-002 | SC-012 (glyph lock-step) |
| SC-003 | SC-013 (50-cycle gesture conflict) |

## Inherited from branch `018-card-catalogue-search` (already built + tested)

The **entire server side of this feature is already implemented and tested** on the 018 branch — this spec is **mobile-only**:

- `number_owned` column on the `cards` table + its additive TypeORM migration (FR-001 / data unit). Default `1`, `CHECK (number_owned >= 1)`.
- `CardRepository.upsertIncrement(id, name, userId)` → `{ card, wasCreated }` (fresh row at `numberOwned=1`, duplicate increments).
- `CardRepository.adjustNumberOwned(id, userId, delta)` → `{status:'updated', card} | {status:'deleted'} | {status:'notfound'}` (decrement to zero deletes the row).
- `POST /cards` rewired to upsert: `201` on first insert, `200` on duplicate increment.
- `PATCH /cards/:id` with body `{ delta: 1 | -1 }`: `200` updated, `204` deleted, `404` no row, `400` on `delta` ∉ {1,-1}.
- Core types/schemas: `numberOwned?` on `CardRecord` / `Card`, `PatchCardBody`, `PATCH_CARD_BODY_SCHEMA`.
- The catalogue `searchCards` already projects `numberOwned` per row when a `userId` is supplied, and the `missing_only` filter dimension is wired through `/cards/search`.
- FR-022 (Binder adopts the shared `<Masthead />`) — **done in spec 018**. `BinderHomeView` already renders `<Masthead />`.

The Catalogue's `useCatalogue` / `CatalogueViewProps` already carry forward-reference fields for this feature (`resultsAreStale`, `onRefreshPress`, `onFilterPillRemove`) that this spec will activate.

## Background

Spec 018 shipped the read-only Catalogue (browse + filter) and the Binder home view, both rendering the 9-pocket page over the shared `<Masthead />`. This spec makes both surfaces **actionable**: the Catalogue gains an add path, the Binder gains a remove path, and both render an owned-count glyph so the user can see at a glance which printings they own and how many.

The user's binder is modelled as one row per `(printing, user)` carrying a `numberOwned` integer. Adding a duplicate increments it; removing a copy decrements it; the row is deleted when the count reaches 0. This model is already persisted server-side (see Inherited).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Cards From Catalogue, Remove From Binder (Priority: P1)

A user finds a card they want in the Catalogue (via browse or filter) and taps the inline `+` glyph-button on the pocket — the card is added to their binder and an owned-count glyph appears in the pocket's top-right showing `1`. Tapping `+` again increments the count to `2`. Switching to the Binder tab, the card is now present; the user taps the inline `−` glyph-button on the pocket to remove one copy, and the count decrements. When the count reaches `0`, the card disappears from the Binder entirely, the remaining cards re-flow forward into the freed pocket, and the page count and summary caption recompute.

**Why this priority**: Owning cards is the entire reason the binder exists. Without an add path the Catalogue is read-only browsing; without a remove path the Binder accretes mistakes. These two actions, together with the owned-count glyph, turn the Catalogue from a reference tool into the primary on-ramp for growing the user's collection.

**Independent Test**: Sign in with an empty binder, open the Catalogue, tap the `+` glyph on any card pocket, and confirm (a) the pocket's owned-count glyph appears showing `1`, (b) the Binder tab now contains that card, (c) tapping `+` a second time bumps the glyph to `2` and the Binder reflects `numberOwned = 2`, (d) tapping the `−` glyph on the Binder pocket decrements to `1`, and (e) tapping `−` again removes the card from the Binder, re-flows the grid, and removes the Catalogue glyph.

**Acceptance Scenarios**:

1. **Given** the user is on the Catalogue, **When** they tap the `+` glyph-button on a pocket whose `numberOwned` is 0, **Then** `numberOwned` becomes 1 for that printing, the owned-count glyph appears in the pocket's top-right showing `1`, and the card is now present in the user's Binder.
2. **Given** the user is on the Catalogue and a pocket already shows an owned-count glyph (e.g. `2`), **When** they tap the `+` glyph-button on that pocket, **Then** `numberOwned` becomes 3, the Catalogue glyph updates to `3`, and the Binder reflects the new count.
3. **Given** the user is on the Binder with a card whose `numberOwned` is 3, **When** they tap the `−` glyph-button on the pocket, **Then** `numberOwned` becomes 2 and the on-pocket glyph updates accordingly.
4. **Given** the user is on the Binder with a card whose `numberOwned` is 1, **When** they tap the `−` glyph-button on the pocket, **Then** `numberOwned` becomes 0, the pocket is removed from the Binder, the subsequent pockets re-flow forward into the freed position, and the summary caption + page count recompute against the new total.
5. **Given** the inline `+` / `−` glyph-buttons are present on pockets, **When** the user performs a horizontal swipe to page through the binder, **Then** the swipe gesture is unaffected by the glyph-buttons — the page advances and the buttons do not absorb the gesture.
6. **Given** the user has added a card from the Catalogue, **When** they swipe back to the same Catalogue page later in the session, **Then** that card's pocket still shows the owned-count glyph with the current count without requiring a re-fetch.
7. **Given** `Missing only` is ON in the Catalogue, **When** the user taps `+` on a pocket, **Then** the pocket **stays put**, the owned-count glyph updates immediately, and a non-blocking "results out-of-date — refresh" affordance appears inside the canvas (FR-009).

### Edge Cases

- **Add/remove tap during pending mutation**: Rapid `+`/`−` taps MUST reflect the user's intent immediately (optimistic update) and reconcile against the server's authoritative count when each round-trip resolves. A failed mutation MUST roll back the glyph to the last server-confirmed value with an inline error toast — the user MUST never see a count that diverges from the server beyond the in-flight window.
- **Decrement below zero**: A `−` tap on a pocket whose `numberOwned` is already 0 (only reachable in the detail-sheet stepper, since the Binder never shows a 0-count pocket) MUST be a visibly-disabled no-op.
- **Remove the card the binder-search is filtered against**: When a binder-search query (spec 016 FR-005a) is active and the user removes the last copy of a card whose entry was the only match, the binder's filtered view recomputes to show the "no matches in your binder" empty state (spec 016 FR-005d). Clearing the search restores the full (now smaller) binder.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every card record reachable from either the Catalogue or the Binder MUST carry a `numberOwned` integer (≥ 0) representing the number of physical copies of that specific printing the signed-in user owns. The binder is modelled as one row per `(printing, user)` carrying `numberOwned`; adding increments, removing decrements, and a row with `numberOwned = 0` MUST NOT appear in the binder. *(Persisted server-side already — see Inherited.)*
- **FR-002**: A small **owned-count glyph** MUST render in the top-right of each card pocket displaying the current `numberOwned` value **for the specific printing** that pocket represents (per-printing scope, not aggregated across card names). On the **Catalogue** the glyph MUST render whenever `numberOwned ≥ 1`. On the **Binder** the glyph MUST render whenever `numberOwned ≥ 2` (single-copy entries need no badge). The glyph MUST be visually subordinate to the card art (small, corner-anchored, translucent backdrop). Different printings of the same card name MUST render independent glyphs.
- **FR-003**: Every **Catalogue** pocket MUST expose an inline `+` glyph-button. Tapping it MUST increment that printing's `numberOwned` by 1 for the signed-in user. The owned-count glyph (FR-002) MUST update immediately on tap.
- **FR-004**: Every **Binder** pocket MUST expose an inline `−` glyph-button. Tapping it MUST decrement that printing's `numberOwned` by 1. When `numberOwned` reaches 0, the pocket MUST be removed, subsequent pockets MUST re-flow forward, and the binder's summary caption and page count (spec 016 FR-009 / FR-021) MUST recompute.
- **FR-005**: The inline `+` / `−` glyph-buttons MUST be positioned and sized so they do not conflict with the horizontal swipe-page gesture (spec 016 FR-017 / FR-018; spec 018 FR-010) — small, edge-anchored, triggered only by a discrete tap (not a drag/swipe).
- **FR-006**: The card detail sheet (spec `020-card-detail-prices`) MUST render a `−  [numberOwned]  +` stepper. The stepper's centre value MUST reflect the current `numberOwned`; `+` increments by 1, `−` decrements by 1 but never below 0 (visibly disabled at 0). It MUST behave identically from either surface. **Split note:** the stepper *UI* is built in spec 020 (it lives in the detail sheet); this spec owns the underlying mutation hook (`useUpdateBinderEntryMutation`) the stepper calls. Spec 020 therefore depends on this spec.
- **FR-007**: The Catalogue's owned-count glyph MUST keep in lock-step with the binder's contents — adding from the Catalogue MUST make the printing a binder row and show the catalogue glyph; removing the last copy MUST remove the binder row and the catalogue glyph.
- **FR-008**: Adding from the Catalogue MUST NOT require navigating away from the Catalogue tab; removing from the Binder MUST NOT require navigating away from the Binder tab. Both actions MUST resolve in-place with masthead, canvas, and current page position preserved.
- **FR-009**: When an add/remove changes a card's ownership such that it would no longer satisfy an active filter (e.g. `Missing only` ON + `+`), the Catalogue MUST **defer the re-filter** — the pocket stays put, the glyph updates immediately, and a single non-blocking "results out-of-date — refresh" affordance appears inside the canvas. The result set re-applies only on tapping that affordance OR on leaving and returning to the Catalogue tab within the session. User-driven filter mutations (changing a value, clearing, typing) re-apply immediately; the defer rule applies ONLY to ownership mutations from `+`/`−`/stepper.

### Key Entities

- **Binder Card Entry**: One row per `(printing, user)` carrying `numberOwned` (≥ 1 while it exists; deleted at 0). Surfaces the owned-count to the Binder renderer (when ≥ 2) and the Catalogue renderer (when ≥ 1). *(Already modelled server-side.)*
- **Owned-Count Glyph**: A small corner-anchored indicator on a pocket displaying `numberOwned`. Identical visual on both surfaces; visibility thresholds differ per FR-002.
- **Owned-Count Stepper**: The `−  [numberOwned]  +` control inside the detail sheet (built in spec 020). Single mutation-truth shared by both surfaces.

## Success Criteria *(mandatory)*

- **SC-001**: Tapping the inline `+` on a Catalogue pocket or `−` on a Binder pocket updates the on-screen owned-count glyph within one display frame (optimistic) and reconciles against the server-confirmed value within 1 second in the median case on a standard network.
- **SC-002**: In 100% of test runs, a Catalogue pocket's owned-count glyph reflects the user's binder state to within one in-flight mutation — the Catalogue glyph never diverges from the Binder's actual contents beyond the optimistic window.
- **SC-003**: Across at least 50 add-then-remove cycles in a single session, swiping the Catalogue and Binder pages remains responsive within one frame and no swipe gesture is absorbed by the inline `+` / `−` glyph-buttons (gesture-conflict instrumentation).

## Assumptions

- The 018 server endpoints (`POST` upsert, `PATCH` adjust) and the `number_owned` column are the canonical mutation surface; this spec wires the mobile client to them.
- Optimistic mutations use TanStack Query `onMutate`/`onError`/`onSettled` over both the `['cards','list']` (binder) and `['catalogue','search', …]` (catalogue) caches. The defer-and-refresh rule (FR-009) means `onSettled` invalidates the binder cache but NOT the catalogue caches.
- The shared `<Masthead />` is already adopted by the Binder (spec 018 / FR-022); this spec does not re-derive it.

## Out of Scope

- **Card detail sheet, prices, 30-day trend** — spec `020-card-detail-prices`. (This spec only provides the mutation hook the sheet's stepper consumes.)
- **Bulk add/remove, quantity entry fields** — single-step `+`/`−` only.
- **Undo / history of binder mutations.**