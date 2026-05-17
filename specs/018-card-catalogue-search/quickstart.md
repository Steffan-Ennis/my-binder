# Quickstart: Card Catalogue Search

**Spec**: [./spec.md](./spec.md) | **Plan**: [./plan.md](./plan.md) | **Data model**: [./data-model.md](./data-model.md) | **Contracts**: [./contracts/api.md](./contracts/api.md), [./contracts/ui.md](./contracts/ui.md)

End-to-end guide to running and verifying spec 018 locally. Assumes the
spec 002 / 016 / 017 stack is already running (Postgres, the Fastify
server on `:3000`, the Expo dev server on `:8081`).

---

## 1. Prerequisites

```bash
# from repo root
nvm use                                              # Node 22
pnpm install                                         # picks up @gorhom/bottom-sheet

# bring up local Postgres + run the one new migration (adds cards.number_owned)
pnpm --filter @my-binder/server migration:run
```

Verify migration landed:

```bash
psql "$DATABASE_URL" -c '\d cards'                   # should show `number_owned integer not null default 1`
```

Price data is served live from the MTGJSON SDK's existing parquet
cache — no migration, no seed step. If `apps/server/data/mtgjson-cache/`
is empty (first-time setup), the SDK populates it on first start when
`offline: false` is in effect. Local dev uses `offline: true` against
a pre-populated cache; if your cache is empty, run the server in
online mode once to populate it.

Start the dev loop:

```bash
turbo dev                                            # starts server + mobile in parallel
```

---

## 2. Smoke-test the server endpoints

### 2.1 Catalogue search with filters

```bash
# Auth token from a logged-in session — the simplest way is to sign in
# inside the mobile app and copy the JWT from the network panel.
export JWT="eyJ…"

# Filtered catalogue browse — first page (9 results), red instants in Modern
curl -s "http://localhost:3000/cards/search?colors=R&formats=Modern&limit=9&page=1" \
  -H "Authorization: Bearer $JWT" | jq

# Expected: response carries `cards[]`, `total`, `page`, `limit`, `totalPages`,
# and every card carries `numberOwned` (0 for unowned printings).

# `missing_only=true` — the same browse restricted to printings the user doesn't own
curl -s "http://localhost:3000/cards/search?colors=R&formats=Modern&missing_only=true&limit=9&page=1" \
  -H "Authorization: Bearer $JWT" | jq

# Unauthenticated browse — no `numberOwned` field, no `missing_only` support
curl -s "http://localhost:3000/cards/search?name=bolt&limit=9" | jq
```

### 2.2 Add to / remove from binder

```bash
# First add — creates the row at numberOwned=1
curl -s -X POST "http://localhost:3000/cards" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"id":"6ca7af0b-4b6a-59ba-90be-6da4f62bcff1","name":"Lightning Bolt"}' | jq

# Second add — increments to numberOwned=2 (HTTP 200, not 409)
curl -s -X POST "http://localhost:3000/cards" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"id":"6ca7af0b-4b6a-59ba-90be-6da4f62bcff1","name":"Lightning Bolt"}' | jq

# Decrement back to 1
curl -s -X PATCH "http://localhost:3000/cards/6ca7af0b-4b6a-59ba-90be-6da4f62bcff1" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"delta":-1}' | jq

# Decrement to 0 (returns 204; row deleted)
curl -i -X PATCH "http://localhost:3000/cards/6ca7af0b-4b6a-59ba-90be-6da4f62bcff1" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"delta":-1}'
```

### 2.3 Prices

```bash
# Latest observation per source
curl -s "http://localhost:3000/cards/6ca7af0b-4b6a-59ba-90be-6da4f62bcff1/prices" \
  -H "Authorization: Bearer $JWT" | jq

# 30-day history per source
curl -s "http://localhost:3000/cards/6ca7af0b-4b6a-59ba-90be-6da4f62bcff1/prices/history?days=30" \
  -H "Authorization: Bearer $JWT" | jq

# When MTGJSON has no observation for a given printing/source, that
# slot comes back `null` (latest) or `[]` (history); the endpoints
# never 404 for "no data" — only for "no such printing UUID".
```

---

## 3. Mobile end-to-end walkthrough

Open the Expo dev server URL on a simulator or physical device (signed in
with a Google account on the allow-list).

### 3.1 US1 — Browse the catalogue

1. From the Binder tab, tap **Search** in the bottom tab bar.
2. Verify the masthead reads **"Catalogue"** (italic-serif) with the
   `MY-BINDER` overline above it, identical visual treatment to the
   Binder's masthead.
3. The first 9 catalogue cards land in the 3×3 pocket grid. Skeleton
   shimmers render in any unfilled pocket while the first fetch is in
   flight; populated pockets render the card front-face (via the spec
   017 `<Card />` component).
4. Swipe **left** on the binder page surface — the next 9 cards fetch and
   render; the page indicator increments to `2 of many`.
5. Swipe **right** — the previous page reappears instantly (in-cache).
6. The italic centred "N of many" indicator stays visible at the bottom
   of the canvas. **No flanking arrow buttons** — verify the canvas has
   only the text indicator (FR-010 / 2026-05-17 Clarification).

### 3.2 US2 — Filter the catalogue

1. Tap the search button in the masthead. The masthead text collapses
   and an inline text input expands across the header bar.
2. Type `bolt`. The grid re-flows to printings whose name contains
   "bolt"; the page indicator restarts at `1 of M`.
3. Tap **Filters** (the ⌅ pill that appears in the masthead's
   filter-pill row when search is active).
4. The filter sheet slides up from the bottom. Verify each filter
   dimension (Set, Format legality, Card super type, Card sub type,
   Creature type, CMC, Colour identity) has the chip layout from the
   wireframe.
5. Select **Modern** under Format legality and **R** under Colour
   identity. Tap **Apply**. The sheet dismisses, and the catalogue grid
   re-flows to the AND-intersection of `name:bolt`, `formats:[Modern]`,
   and `colors:[R]`.
6. Verify the masthead's filter-pill row shows three pills: `Format:
   Modern`, `Colour: R`, and the ⌅ Filters opener.
7. Tap the `×` on the `Format: Modern` pill — the catalogue re-flows
   immediately.

### 3.3 US3 — Inspect a card's details and prices

1. With the catalogue showing populated pockets, tap any card. The
   detail sheet slides up.
2. Verify the sheet header shows the card name in italic-serif.
3. Verify the hero shows the card art, set code · set name, type line,
   and an oracle blurb.
4. Verify the stepper renders "In your binder" + `−  N  +` where `N` is
   the user's current `numberOwned` for the tapped printing.
5. Verify the prices section shows two rows (Card Kingdom and TCG
   Player). Rows MTGJSON has observations for show a `$x.xx` value;
   rows MTGJSON does not track for that printing show `—`. MTG
   Goldfish is deferred to a follow-up specification (see the spec's
   2026-05-18 Clarifications entry) — no third row is rendered.
6. Verify the 30-day chart shows up to two lines on the same axes
   with a legend (one line per source MTGJSON has observations for
   within the window). If both series are empty for that printing,
   the chart shows the axes only with a "no recent price data"
   annotation.
7. Swipe down on the sheet past the threshold — it dismisses and the
   catalogue restores to the same page and scroll position it was on.

### 3.4 US4 — Add from Catalogue, remove from Binder

1. From the Catalogue, find a card that has no owned-count glyph (i.e.
   the user does not own it yet).
2. Tap the `+` glyph-button at the bottom-right of the pocket. The
   owned-count glyph appears in the top-right showing `×1`. The mutation
   resolves in under a second (SC-011).
3. Tap `+` again — the glyph updates to `×2`.
4. Open the detail sheet for that printing — the stepper shows `2`.
5. Tap `+` in the stepper — both the stepper and the pocket glyph
   update to `3`.
6. Switch to the Binder tab. The new card is present. Verify the
   masthead is the same component the Catalogue used (subtitle reads
   "Binder").
7. The binder pocket for that card shows `×3` in the top-right glyph
   (visible because count >= 2 per FR-024).
8. Tap the `−` glyph-button at the bottom-right of the pocket. The
   glyph updates to `×2`.
9. Tap the `−` glyph two more times — the pocket disappears on the
   second tap (count reached 0; row deleted; FR-026); the binder grid
   re-flows; the summary caption recomputes.

### 3.5 Defer-and-refresh (FR-031)

1. Open the Catalogue, turn on **Missing only** in the filter sheet,
   tap **Apply**.
2. The catalogue restricts to unowned printings.
3. Tap `+` on any pocket. The owned-count glyph appears immediately
   (optimistic update) — and the pocket **stays put** even though it
   now violates the `Missing only` filter.
4. A small gold-bordered "Results out-of-date — tap to refresh" banner
   appears at the top of the canvas.
5. Tap the banner — the catalogue re-runs the query and the just-added
   pocket disappears.
6. (Alternative) Switch to another tab and back — the same re-fetch
   happens without needing the explicit tap.

---

## 4. Test execution

### 4.1 Per-workspace

```bash
# Server tests — exercises new repository + new routes + per-user joins
pnpm --filter @my-binder/server test

# Mobile tests — feature hooks, view tests, sheet integration
pnpm --filter @my-binder/mobile test

# Core schema tests — Ajv compile + a few positive/negative cases per new schema
pnpm --filter @my-binder/core test
```

### 4.2 Phase gates (Principle III)

Each phase exit in `tasks.md` runs:

```bash
turbo test --filter=@my-binder/server  --filter=@my-binder/mobile  --filter=@my-binder/core
turbo typecheck --filter=@my-binder/server  --filter=@my-binder/mobile  --filter=@my-binder/core
```

Both MUST exit `0`. No `.skip` / `xit` / `describe.skip` is permitted to
bypass a failing test (Principle III's Phase completion validation gate).

---

## 5. Acceptance checklist

A working installation of spec 018 satisfies every box below.

- [ ] **FR-001** Catalogue tab visually matches Binder tab (header,
      canvas, ring perforations, pocket grid).
- [ ] **FR-002** The Binder and the Catalogue render the same
      `<Masthead />` component (search the source — exactly one
      `<Masthead />` import, used in two places).
- [ ] **FR-003** Tapping the search button on the Catalogue collapses
      the masthead text and expands an inline search input.
- [ ] **FR-005** All filter dimensions are present in the filter sheet
      and produce correct results when applied alone or in combination.
- [ ] **FR-009 / FR-010 / FR-011** 3×3 grid; swipe-only page nav; lazy
      page fetching; in-cache backward navigation.
- [ ] **FR-013** Indicator reads `N of many` while more pages are
      pending; `N of M` once the result set ends.
- [ ] **FR-014** Swipe forward at the genuine end of results is a no-op.
- [ ] **FR-015** Zero-match filter combination renders the
      "no cards match these filters" panel and the clear-all affordance.
- [ ] **FR-016 → FR-021** Detail sheet shows identity, prices, 30-day
      chart, physical-only.
- [ ] **FR-022** Binder tab uses the shared masthead; no regressions in
      spec 016 behaviours (in-binder search, Profile shortcut).
- [ ] **FR-023 → FR-031** `numberOwned` model + on-pocket glyph + `+` /
      `−` glyph-buttons + stepper + defer-and-refresh banner all
      function as described above.
- [ ] **SC-001 → SC-013** All success criteria from the spec are
      observable in the running app.
