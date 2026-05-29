# Quickstart: Binder Home View

**Feature**: 016-binder-home-view
**Date**: 2026-05-10
**Phase**: 1 (Design & Contracts)

This document is the integration guide for the binder-home feature: what to install (nothing
new), how to run it locally, how to validate end-to-end, and how to map the spec's success
criteria onto runnable checks.

---

## 1. Prerequisites

All prerequisites are inherited from spec 002 — there is **nothing new to install**.

```bash
nvm use            # Node 22
pnpm install       # workspace deps; lock unchanged by this spec
turbo build        # builds @my-binder/core first; required by apps/mobile
```

The mobile workspace must already be bootstrapped (spec 002 §Bootstrap-cleanup
phase). Verify:

```bash
ls apps/mobile/src/components/binder-home/  # should be empty before this feature lands
ls apps/mobile/src/hooks/useCardsInfiniteQuery.ts 2>/dev/null && echo "already created"
```

The server (`apps/server`) must be reachable from the device/simulator — point the mobile
app at it via `apps/mobile/.env` (`API_BASE_URL=http://localhost:3000` for local dev).

---

## 2. Run the mobile app locally

```bash
# Terminal 1 — start the server
pnpm --filter @my-binder/server dev

# Terminal 2 — start Expo
pnpm --filter @my-binder/mobile dev

# Then either:
#   i) press 'i' to open the iOS Simulator
#   ii) press 'a' to open the Android emulator (run `pnpm --filter @my-binder/mobile adb:reverse` first)
```

After signing in with an allowlisted Google account, the app should land on the Binder
tab and render this feature.

---

## 3. Manual validation scenarios

These scenarios exercise the spec's User Stories. Each one corresponds to one or more
acceptance scenarios + functional requirements; numbers in `[…]` map to spec.md.

### Scenario 1 — Branded header + canvas (US1)

1. Sign in with a Google account whose collection contains ≥ 7 cards.
2. Verify the top of the Binder tab shows a deep-crimson header bar with:
   - the binder icon on the left,
   - the "MY-BINDER" overline above the italic-serif "My Binder" title,
   - a binder-search button and a Profile button on the right (in that order). [FR-001 → FR-004]
3. Verify the area below the header is paper-cream with a centred summary caption of the
   form `"N CARDS · M PAGE(S)"`. [FR-008, FR-009]
4. Verify a single rounded "binder page" surface is centred horizontally inside the canvas
   with three small ring perforations along its left edge. [FR-011 → FR-013]
5. Verify the bottom of the canvas shows a circular previous-page button, the centred
   "Page N / OF M" indicator, and a circular next-page button. [FR-019]

### Scenario 2 — Page through the collection (US2)

1. Use a collection with **11 cards** (1 full page + 2). [SC-006]
2. On page 1, verify all 9 pockets are filled with the user's first nine card front faces.
   [FR-014, FR-015]
3. Tap **Next** OR swipe **left** on the binder page; verify the page indicator changes
   from `"Page 1 / OF 2"` to `"Page 2 / OF 2"` and exactly two pockets are filled
   (cards 10 and 11) with the remaining seven rendered as dashed-outline empty
   placeholders. [FR-017, FR-022, FR-016]
4. Tap **Next** again; verify nothing happens and the next button is visibly disabled.
   [FR-020]
5. Tap **Prev** OR swipe **right**; verify the page indicator returns to
   `"Page 1 / OF 2"`. [FR-018]
6. On page 1, tap **Prev**; verify nothing happens and the prev button is visibly
   disabled. [FR-020]

### Scenario 3 — Header navigation (US1 → Profile shortcut)

1. From the Binder tab, tap the **Profile** button in the header.
2. Verify the app navigates to the Profile tab (the same destination as the bottom-tab
   Profile icon). [FR-006, SC-004]

### Scenario 4 — Inline binder-search (US3)

1. From the Binder tab with a populated collection, tap the **binder-search** button in
   the header.
2. Verify the masthead text collapses, an inline `<TextInput>` expands to fill the header
   bar with a clear control on the right, and keyboard focus moves to the input. The
   cream canvas, summary caption, and binder page remain visible. [FR-005, US3 ac. #1]
3. Type `"bolt"` (or any token expected to match a card by name).
4. On each keystroke, verify the binder pages re-flow to show only matching cards in
   their natural collection order; non-matching slots render as empty placeholders; the
   summary caption recomputes to `"K CARDS · J PAGE(S)"`. [FR-005a, FR-005e, US3 ac. #3]
5. Type a multi-token query such as `"red creature"`. Verify only cards whose
   name + set + type collectively contain every token are shown. [FR-005a, US3 ac. #4]
6. Clear the input (tap the clear control or backspace to empty). Verify the masthead
   text returns and the binder restores the full unfiltered collection AND the page you
   were viewing immediately before opening the input. [FR-005f, FR-005c, US3 ac. #6]
7. Open search again, type a query that matches **zero cards** (e.g. `"qqzzxx"`).
   Verify the binder shows a single page of empty pockets with an inline
   `"no matches in your binder"` message and the summary caption shows
   `"0 CARDS · 1 PAGE"`. Clear the query; verify the full binder returns. [FR-005d, US3 ac. #5]

### Scenario 5 — Search button is NOT the bottom-tab Search (US3 / Clarifications)

1. Tap the binder-search button in the header. Verify the inline input opens **inside the
   header** — the app does NOT navigate to the bottom-tab Search route. [FR-005, SC-004]
2. Tap the bottom-tab **Search** icon. Verify the app navigates to the Search tab (placeholder
   `<ComingSoonContainer />` from spec 002), not the binder-search affordance.

### Scenario 6 — Empty / loading / error states (Edge Cases)

1. Sign in with an account that has **0 cards**. Verify the binder renders the header,
   cream canvas, 9 empty pockets, summary caption `"0 CARDS · 1 PAGE"`, and the page
   indicator `"Page 1 / OF 1"` with both prev and next buttons disabled.
2. Throttle the network (Chrome DevTools network tab on web debugger, or Charles Proxy on
   device). Verify the canvas renders 9 empty pockets and the summary caption shows
   `"— CARDS · — PAGE"` while the request is in flight.
3. Stop the server (`Ctrl-C` the `apps/server` dev process) and reopen the Binder tab.
   Verify an inline retry affordance replaces the grid, with the header, summary caption
   dashes, and page indicator dashes still rendered. Tap retry; verify the request
   re-fires.

### Scenario 7 — Page memory across backgrounding (SC-007)

1. Page to **page 17** in a collection of ≥ 17 pages.
2. Background the app (home button / app switcher).
3. Reopen the app within the active session window. Verify the binder reopens on
   page 17. [FR-023, SC-007]
4. Sign out, then sign back in. Verify the binder opens on page 1 (page memory is
   reset on sign-out per the same FR).

---

## 4. Automated test commands

```bash
# Mobile-only run (fast feedback while building)
pnpm --filter @my-binder/mobile test

# Watch the binder-home directory specifically
pnpm --filter @my-binder/mobile test -- --watch src/components/binder-home

# Filter test files by the new utility
pnpm --filter @my-binder/mobile test -- src/utils/binderSearch

# Coverage summary (matches the constitution's 80% gate)
pnpm --filter @my-binder/mobile test -- --coverage

# Full repo gate — MUST be green before each phase exit (Principle III)
turbo test
turbo typecheck
```

Both `turbo test` and `turbo typecheck` MUST exit `0` before the corresponding
phase in `tasks.md` is marked complete.

---

## 5. Mapping spec success criteria to runnable checks

| SC | Where it is verified |
|---|---|
| **SC-001** — render within 2 s of sign-in | Manual scenario 1; future Detox/Maestro spec for automation |
| **SC-002** — paging within one frame on a 100-card collection | Manual scenario 2 + DevTools profiler; not unit-tested |
| **SC-003** — 0–1000 cards render without overlap or layout errors | Manual scenarios 6 (0 cards) + 1/2 (small collection); a 1000-card snapshot suite is out of scope here |
| **SC-004** — Profile + binder-search button targeting | Manual scenarios 3 + 5; `useBinderHome.test.ts` asserts `onProfilePress` calls `router.navigate('/profile')` and `onSearchOpen` toggles state without any router call |
| **SC-005** — usability identification of header search vs bottom-tab Search | Out of scope for unit tests — verified by the spec's clarification record + UX review |
| **SC-006** — partial last page renders only existing cards | Manual scenario 2 step 3; `BinderHomeView.test.tsx` asserts the partial-page render |
| **SC-007** — backgrounding restores last page; sign-out resets to page 1 | Manual scenario 7; `useBinderHome.test.ts` + the amended `useSignOutMutation.test.tsx` cover the store-reset half |

---

## 6. Reference paths

| Concern | Path |
|---|---|
| Feature directory | `apps/mobile/src/components/binder-home/` |
| Cross-feature hook | `apps/mobile/src/hooks/useCardsInfiniteQuery.ts` |
| Filter utility | `apps/mobile/src/utils/binderSearch.ts` |
| Page-math utility (existing) | `apps/mobile/src/utils/pageMath.ts` |
| Binder store (existing) | `apps/mobile/src/stores/binderStore.ts` |
| Card schemas (modified) | `apps/mobile/src/services/api/schemas.ts` |
| Tabs layout (modified) | `apps/mobile/src/app/(authenticated)/(tabs)/_layout.tsx` |
| Binder route shell (modified) | `apps/mobile/src/app/(authenticated)/(tabs)/binder.tsx` |
| Sign-out mutation (cross-spec amend) | `apps/mobile/src/hooks/useSignOutMutation.ts` |
