# Tasks: Sequential Card Enrichment

**Input**: Design documents from `/specs/014-sequential-card-enrichment/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Core Fix

**Purpose**: Replace parallel enrichment with sequential async generator and re-enable legalities

- [ ] T001 [US1] Add private async generator method `enrichCards(cards: CardSet[]): AsyncGenerator<CardRecord>` to `MtgjsonProvider` in apps/server/src/providers/mtgjson/index.ts — iterates cards sequentially, yielding `await this.enrichCard(card)` for each
- [ ] T002 [US1] Add private collector method `collectCards(cards: CardSet[]): Promise<CardRecord[]>` to `MtgjsonProvider` in apps/server/src/providers/mtgjson/index.ts — consumes `enrichCards` generator via `for await...of`, collects results into array
- [ ] T003 [US1] Update `search()` in apps/server/src/providers/mtgjson/index.ts — replace `Promise.all(cards.map(card => this.enrichCard(card)))` with `this.collectCards(cards)`, remove TODO comment
- [ ] T004 [US2] Re-enable `sdk.legalities.isLegal(card.uuid, 'commander')` in `enrichCard()` in apps/server/src/providers/mtgjson/index.ts — uncomment the call, remove `commanderLegal = false` default destructuring

**Checkpoint**: `search()` enriches cards sequentially with both identifiers and legalities.

---

## Phase 2: Validation

**Purpose**: Verify the fix works on both cold and warm caches

- [ ] T005 [US1] Cold cache test — clear parquet cache, start server, call `GET /cards/search?name=bolt`, verify all cards return with non-null `imageRef` and boolean `commanderLegal`, no file-access errors
- [ ] T006 [US1] Warm cache test — repeat the same search without clearing cache, verify same results with faster response
- [ ] T007 [US2] Commander legality test — search for "Channel" (banned), verify `commanderLegal` is `false`; search for "Lightning Bolt" (legal), verify `commanderLegal` is `true`
- [ ] T008 Run `turbo typecheck` from repo root to confirm no type errors introduced

**Checkpoint**: Fix validated end-to-end. No type regressions.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Depends on Phase 1 completion

### Within Phase 1

- T001 → T002 → T003 (sequential — each builds on the previous)
- T004 is independent of T001-T003 but benefits from being done alongside T003 (same file, same edit session)

### Within Phase 2

- T005, T006, T007 are sequential (T006 depends on T005 cache state; T007 is independent but logically follows)
- T008 can run in parallel with T005-T007

---

## Implementation Strategy

1. Complete Phase 1: All 4 tasks in a single edit session (one file, tightly coupled changes)
2. Complete Phase 2: Validate cold cache, warm cache, legality data, and type safety
3. **STOP and VALIDATE**: Server starts, search works, legalities are accurate
