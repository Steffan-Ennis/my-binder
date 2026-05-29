---
description: "Tasks for spec 019 — Binder Add / Remove + Owned-Count Glyphs (US4 split out of spec 018)"
---

# Tasks: Binder Add / Remove + Owned-Count Glyphs

**Input**: Split out of `specs/018-card-catalogue-search` (User Story 4) on 2026-05-22.
**Prerequisites**: spec.md (this folder). For detailed data shapes and the optimistic-cache contract, see `specs/018-card-catalogue-search/data-model.md` §1–§3 and `contracts/api.md` / `contracts/ui.md` (these still describe the pre-split design and need a refresh — read with that caveat).

**Tests**: Per Constitution Principle III, unit tests are REQUIRED for every behaviour and MUST be written before implementation. Co-locate `<filename>.test.ts(x)` beside the file under test.

**Status legend**: `[X]` already done on branch 018 · `[ ]` remaining.

---

## Already done on branch `018-card-catalogue-search` (server side)

These were implemented and tested before the split. Verify they remain green; do not re-implement.

- [X] Server T043/T044 — `CardRepository.upsertIncrement` + `adjustNumberOwned` in `apps/server/src/repositories/cardRepository.ts` (+ `cardRepository.test.ts` coverage).
- [X] Server T045/T046 — `POST /cards` upsert (201/200) + `PATCH /cards/:id` adjust (200/204/404/400) in `apps/server/src/routes/cards.ts` (+ `cards.test.ts` coverage).
- [X] Foundational — `number_owned` column + migration; `numberOwned` on `CardRecord`/`Card`; `PatchCardBody` + `PATCH_CARD_BODY_SCHEMA`; `searchCards` per-user `numberOwned` projection; `missing_only` wired through `/cards/search`.
- [X] FR-022 — Binder adopts shared `<Masthead />` (`BinderHomeView` renders `<Masthead />`).

> **Closeout dependency**: spec 018's 🔴 build-green prerequisite (stale catalogue tests + orphaned `search.test.tsx` + removed `buildPills`) MUST be resolved before layering this feature on top.

---

## Phase 1: Mobile mutation hook (Foundational for this spec)

### Tests first ⚠️

- [ ] T101 [P] Tests — `apps/mobile/src/hooks/useUpdateBinderEntryMutation.test.tsx`: `onMutate({delta:+1})` optimistically increments `numberOwned` in `['cards','list']` AND in every `['catalogue','search', …]` cache; `onMutate({delta:-1})` at `numberOwned=1` removes the row from `['cards','list']` and zeroes the catalogue cache row; `onError` rolls back both caches to the snapshot; `onSettled` invalidates `['cards','list']` but does NOT invalidate the catalogue caches (FR-009); `onSettled` publishes the `binderMutationLanded` signal that `useCatalogue` subscribes to.

### Implementation

- [ ] T102 Implement `apps/mobile/src/hooks/useUpdateBinderEntryMutation.ts`: `useMutation` over `apiClient.upsertCard` (add) and `apiClient.patchCard` (increment/decrement); `onMutate` snapshots + optimistically updates both cache spaces; `onError` restores; `onSettled` invalidates `['cards','list']` and publishes an internal `binderMutationLanded` event (in-memory `EventTarget`/pub-sub). Export `useBinderMutationLandedSignal()`. Makes T101 pass. *(`apiClient.upsertCard` / `patchCard` already exist from 018 foundational T015.)*

---

## Phase 2: Catalogue add path + owned-count glyph + defer-and-refresh

### Tests first ⚠️

- [ ] T103 [P] Tests — extend `apps/mobile/src/components/catalogue/useCatalogue.test.ts` + `CatalogueView.test.tsx`: tapping `+` on a pocket invokes the mutation with `{delta:+1}` and does NOT navigate; the owned-count glyph appears in the optimistic frame; the refresh banner appears after a mutation while a filter is active and disappears after `onRefreshPress`; mutating without an active filter does not set the stale flag.

### Implementation

- [ ] T104 Extend `apps/mobile/src/components/catalogue/useCatalogue.ts`: consume `useUpdateBinderEntryMutation`; add `onPocketAddPress(id)` → mutation `{delta:+1}`; set `resultsAreStale` when `binderMutationLanded` fires AND any filter dimension is active (FR-009); `onRefreshPress` invalidates `['catalogue','search',…]` and clears the stale flag. *(`resultsAreStale` / `onRefreshPress` already declared on `CatalogueViewProps` — activate them.)* All callbacks memoised (Principle X v1.16.0).
- [ ] T105 Extend `apps/mobile/src/components/catalogue/CatalogueView.tsx` (+ `CatalogueView.theme.ts`): overlay a `catalogue-pocket-action-add` `+` glyph-button on every populated pocket (edge-anchored, `hitSlop`, `pointerEvents:'box-only'` per FR-005); overlay a `catalogue-owned-glyph` `×N` glyph top-right when `numberOwned ≥ 1` (FR-002); render the `catalogue-refresh-hint` gold-bordered banner when `resultsAreStale` (FR-009).

---

## Phase 3: Binder remove path + owned-count glyph

### Tests first ⚠️

- [ ] T106 [P] Tests — `apps/mobile/src/components/binder-home/useBinderHome.test.ts`: `onPocketRemove(id)` invokes `useUpdateBinderEntryMutation` with `{delta:-1}`; the binder grid recomputes `totalPages` and summary caption when a row is removed (FR-004).
- [ ] T107 [P] Tests — `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx`: each populated pocket renders a `−` glyph-button; tapping it fires `onPocketRemove(id)`; the owned-count `×N` glyph is visible iff `numberOwned ≥ 2` (FR-002); existing spec-016 assertions (`pocket-occupied`, `pocket-empty`, `binder-page-ring`) remain green.

### Implementation

- [ ] T108 Extend `apps/mobile/src/components/binder-home/useBinderHome.ts`: consume `useUpdateBinderEntryMutation`; expose `onPocketRemove(id)` → `{delta:-1}`; ensure derived `totalPages` and `summaryCaption` recompute when the binder cache changes (FR-004). Callbacks memoised.
- [ ] T109 Extend `apps/mobile/src/components/binder-home/BinderHomeView.tsx` (+ shared pocket component): add the `−` glyph-button overlay (mirrors the catalogue `+` placement; `binder-pocket-action-remove`) and the `×N` owned-count glyph visible when `numberOwned ≥ 2` (FR-002). Reuse the shared `CardPocket` overlay slots so Catalogue `+` and Binder `−` share placement logic (FR-005).

---

## Phase 4: Polish & validation

- [ ] T110 Run `turbo test` + `turbo typecheck` across `@my-binder/core`, `@my-binder/server`, `@my-binder/mobile`. Both exit 0, 100% Jest pass rate. Re-verify spec 016 binder behaviours (in-binder search, Profile shortcut) have not regressed.
- [ ] T111 Manual acceptance: empty binder → Catalogue `+` → glyph `×1` + Binder contains card; `+` again → `×2`; Binder `−` twice → pocket disappears, grid reflows, caption + page count recompute; `Missing only` ON + `+` → pocket stays, refresh banner appears, tap banner → pocket drops (SC-001/002/003).
- [ ] T112 Constitution sweep on touched files (FC declaration rule, style co-location, hook memoisation v1.16.0, data-fetching composition v1.26.0, Principle IX JSDoc + `@example` on new public functions). Confirm no `.skip`/`xit`/`it.todo`.

---

## Notes

- **Server is done** — this spec is mobile-only apart from verification.
- **Cross-spec dependency**: spec `020-card-detail-prices` depends on T102 (`useUpdateBinderEntryMutation`) for the detail-sheet stepper (FR-006). Land this spec first.
- Original 018 task IDs for traceability: T101↔T047/T048, T103↔T051, T104↔T049, T105↔T050, T106↔T053, T107↔T052, T108↔T055, T109↔T054.