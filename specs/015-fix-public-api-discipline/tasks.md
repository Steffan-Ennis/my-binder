# Tasks: Fix Public API Discipline Violations (Principle IX)

**Input**: Design documents from `/specs/015-fix-public-api-discipline/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md
**Branch**: `013-migrate-jest-tests` (current branch — no checkout)

**Tests**: NOT requested. The existing Jest test suite is the regression net (FR-009). No new test tasks are generated.

**Organization**: Tasks are grouped by user story (US1, US2, US3) so each story can be implemented and verified independently. The three stories share no source files and have no inter-story dependencies, so they can ship in priority order or even in parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3). Setup, Foundational, and Polish phases carry no story label.
- Include exact file paths in descriptions.

## Path Conventions

- Server source: `apps/server/src/`
- Shared types/constants: `packages/core/src/`
- Spec artifacts: `specs/015-fix-public-api-discipline/`

---

## Phase 1: Setup

**Purpose**: Capture pre-refactor baseline so caller-side stability (FR-011, SC-006) is verifiable later.

- [X] T001 Capture baseline: from repo root, run `turbo typecheck` and `turbo test`, paste exit codes and any pre-existing warnings into a scratch note (or the PR description) so post-refactor parity is provable. No file edits in this task.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pre-requisites that MUST be complete before any user story begins.

*No tasks. This is a pure structural refactor — none of US1, US2, US3 depend on shared infrastructure beyond the existing project setup. The three stories are independent of each other.*

---

## Phase 3: User Story 1 - Extract `MtgjsonProvider` from its directory's barrel file (Priority: P1) 🎯 MVP

**Goal**: Move the `MtgjsonProvider` class out of `apps/server/src/providers/mtgjson/index.ts` into a sibling `MtgjsonProvider.ts` and collapse `index.ts` to a barrel re-export.

**Independent Test**: `pnpm --filter @my-binder/server test -- src/providers/mtgjson/index.test.ts` passes; `apps/server/src/providers/mtgjson/index.ts` contains only re-export statements; `apps/server/src/app.ts` and the test file imports remain unedited (FR-011 / SC-006).

### Implementation for User Story 1

- [X] T002 [US1] Create `apps/server/src/providers/mtgjson/MtgjsonProvider.ts` containing the entire `MtgjsonProvider` class moved verbatim from `apps/server/src/providers/mtgjson/index.ts`. Move all four imports at the top of `index.ts` (`MtgjsonSDK, CardSet` from `mtgjson-sdk`; `CardRecord, CardNotFoundResult, LegalityResult, SearchQuery` from `@my-binder/core`; `CardProvider, LookupOptions` from `@src/providers/interface`; `mapCardSetToCardRecord` from `@src/providers/mtgjson/mapper`). Move all eight JSDoc blocks (constructor, `close`, `lookup`, `checkLegality`, `search`, `isReachable`, `enrichCards`, `enrichCard`) verbatim including every fenced `@example` block. Move all method bodies unchanged — sequential awaits in `enrichCard`, log+try/catch in `enrichCards`, `for await...of` in `collectCards`. No other code changes.
- [X] T003 [US1] Reduce `apps/server/src/providers/mtgjson/index.ts` to exactly two lines: `export { MtgjsonProvider } from './MtgjsonProvider';` and `export { mapCardSetToCardRecord } from './mapper';`. Delete every other line including the imports and the entire class body.
- [X] T004 [US1] Validate US1 checkpoint from repo root: run `turbo typecheck --filter=@my-binder/server` (expect exit 0); run `pnpm --filter @my-binder/server test -- src/providers/mtgjson/index.test.ts` (expect all tests pass); run `git diff apps/server/src/app.ts apps/server/src/providers/mtgjson/index.test.ts | grep -E "^[+-]\s*import"` (expect empty output). Record the validation results in the PR description.

**Checkpoint**: US1 complete. `MtgjsonProvider` lives in its own file, `index.ts` is a barrel, no caller edits required, tests pass.

---

## Phase 4: User Story 2 - Make `packages/core` barrel files pure re-exports (Priority: P2)

**Goal**: Move every inline declaration out of `packages/core/src/types/index.ts` and `packages/core/src/constants/index.ts` into named peer files grouped by concern. Both barrels collapse to re-exports only.

**Independent Test**: `turbo typecheck` passes; `turbo test` passes; `grep -E "^(export\s+(interface|class|function|const|type)\s)" packages/core/src/{types,constants}/index.ts` produces empty output; consumer files (`apps/server/src/repositories/cardRepository.ts`, `apps/server/src/routes/cards.ts`) show no import-line changes.

### Types peer files (parallelizable — different new files)

- [X] T005 [P] [US2] Create `packages/core/src/types/crud.ts` containing `Card`, `CardList`, `CreateCardBody`, `UpdateCardBody`, `CardIdParams` interfaces moved verbatim from the inline declarations in `packages/core/src/types/index.ts`. See `data-model.md §B.4` for the exact contents. Preserve `interface` keyword (NOT migrating to `type` aliases — that is a separate spec to keep this refactor structural-only per FR-002).
- [X] T006 [P] [US2] Create `packages/core/src/types/health.ts` containing the `HealthResponse` interface moved verbatim from `packages/core/src/types/index.ts`. See `data-model.md §B.5`.
- [X] T007 [P] [US2] Create `packages/core/src/types/errorBody.ts` containing the `ErrorBody` interface moved verbatim from `packages/core/src/types/index.ts`. See `data-model.md §B.6`.

### Constants peer files (parallelizable — different new files)

- [X] T008 [P] [US2] Create `packages/core/src/constants/authIdentity.ts` containing `AUTH_ERROR_CODES`, `AuthErrorCode`, `AUTH_IDENTITY_KIND` moved verbatim from `packages/core/src/constants/index.ts`. See `data-model.md §C.2`.
- [X] T009 [P] [US2] Create `packages/core/src/constants/sessionJwt.ts` containing `SESSION_JWT_TTL_DAYS` moved verbatim from `packages/core/src/constants/index.ts`. See `data-model.md §C.3`.
- [X] T010 [P] [US2] Create `packages/core/src/constants/errorCodes.ts` containing `ERROR_CODES`, `ErrorCode` moved verbatim from `packages/core/src/constants/index.ts`. See `data-model.md §C.4`.
- [X] T011 [P] [US2] Create `packages/core/src/constants/httpStatus.ts` containing `HTTP_STATUS` moved verbatim from `packages/core/src/constants/index.ts`. See `data-model.md §C.5`.

### Reduce barrels (depend on the peer files above)

- [X] T012 [P] [US2] Reduce `packages/core/src/types/index.ts` to exactly five lines: `export * from './card';`, `export * from './auth';`, `export * from './crud';`, `export * from './health';`, `export * from './errorBody';`. Delete every inline declaration. Depends on T005, T006, T007.
- [X] T013 [P] [US2] Reduce `packages/core/src/constants/index.ts` to exactly four lines: `export * from './authIdentity';`, `export * from './sessionJwt';`, `export * from './errorCodes';`, `export * from './httpStatus';`. Delete every inline declaration. Depends on T008, T009, T010, T011.

### Validate

- [X] T014 [US2] Validate US2 checkpoint from repo root: `turbo typecheck` (expect exit 0); `turbo test` (expect exit 0); `git diff apps/server/src/repositories/cardRepository.ts apps/server/src/routes/cards.ts apps/server/src/app.ts apps/server/src/providers/mtgjson/index.test.ts | grep -E "^[+-]\s*import"` (expect empty output); `grep -E "^(export\s+(interface|class|function|const|type)\s)" packages/core/src/types/index.ts packages/core/src/constants/index.ts` (expect empty output). Record results in PR description.

**Checkpoint**: US2 complete. Both `packages/core` barrels are pure re-exports, all caller imports unchanged, tests pass.

---

## Phase 5: User Story 3 - Backfill JSDoc with examples on services and providers (Priority: P3)

**Goal**: Every public function or class method under the audited service and provider files carries a JSDoc block matching the reference style (description, `@param` incl. options sub-fields, `@returns`, `@throws` where applicable, ≥1 fenced TypeScript `@example`).

**Independent Test**: For each in-scope file, `grep -c "^\s*\*\s@example"` returns ≥ 1 per public function/method, and a manual review against the reference style in `apps/server/src/providers/mtgjson/MtgjsonProvider.ts` confirms compliance.

In-scope files (4):
- `apps/server/src/providers/registry.ts`
- `apps/server/src/services/authService.ts`
- `apps/server/src/services/cardService.ts`
- `apps/server/src/services/efsService.ts`

Explicit exemptions (recorded for reviewers, no task):
- `apps/server/src/providers/interface.ts` — type-only (R6).
- `apps/server/src/providers/mtgjson/mapper.ts` — pure mapper (R6).
- `apps/server/src/providers/mtgjson/MtgjsonProvider.ts` — already compliant (reference implementation).
- All `*.test.ts` files.

### Implementation for User Story 3 (parallelizable — different files)

- [X] T015 [P] [US3] Audit `apps/server/src/providers/registry.ts` and add a JSDoc block to every exported function. Each block MUST contain a description, `@param` for every parameter (include options sub-fields), `@returns`, `@throws` where the function may throw, and at least one fenced TypeScript `@example` showing a realistic call. Reference style: `apps/server/src/providers/mtgjson/MtgjsonProvider.ts` (post-T002).
- [X] T016 [P] [US3] Audit `apps/server/src/services/authService.ts` and add a compliant JSDoc block to every exported function and every public method on every exported class. Same JSDoc shape as T015. Pay particular attention to error codes raised so `@throws` enumerates them.
- [X] T017 [P] [US3] Audit `apps/server/src/services/cardService.ts` and add a compliant JSDoc block to every exported function and every public method on every exported class. Same JSDoc shape as T015.
- [X] T018 [P] [US3] Audit `apps/server/src/services/efsService.ts` and add a compliant JSDoc block to `initEfs`. Replace the existing one-line description with a full block including `@param efsPath - ...`, `@returns`, an `@example` showing a Lambda-startup invocation pattern, and a JSDoc note explaining the intentional `console.error` swallow on parquet-cache cleanup (Principle VIII rationale per the existing `MtgjsonProvider.isReachable` precedent).

### Validate

- [X] T019 [US3] Validate US3 checkpoint from repo root: `turbo typecheck` (expect exit 0); `turbo test` (expect exit 0); `grep -c "^\s*\*\s@example" apps/server/src/providers/registry.ts apps/server/src/services/authService.ts apps/server/src/services/cardService.ts apps/server/src/services/efsService.ts` (expect each line ≥ 1, ideally one per public function/method). Record results in PR description.

**Checkpoint**: US3 complete. All in-scope service and provider files carry compliant JSDoc.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation against the spec's success criteria and repo-wide documentation hygiene.

- [X] T020 Run the full quickstart.md walkthrough end-to-end (sections US1, US2, US3, and "End-to-end validation"). Record SC-001 through SC-006 verification output in the PR description. SC-005 requires manually spot-checking five randomly chosen service/provider imports via "Go to Definition" in the IDE — list the five sampled imports.
- [X] T021 Update `CLAUDE.md` "Folder Structure" section to reflect the post-refactor reality: add `MtgjsonProvider.ts` next to the now-barrel `index.ts` under `apps/server/src/providers/mtgjson/`; add the four new constant peer files (`authIdentity.ts`, `sessionJwt.ts`, `errorCodes.ts`, `httpStatus.ts`) and three new type peer files (`crud.ts`, `health.ts`, `errorBody.ts`) under `packages/core/src/`. Append an entry to "Recent Changes" naming spec 015.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies. Run T001 first.
- **Phase 2 (Foundational)**: Empty for this refactor.
- **Phase 3 (US1)**: Depends only on T001 (baseline). Independent of US2 and US3.
- **Phase 4 (US2)**: Depends only on T001. Independent of US1 and US3.
- **Phase 5 (US3)**: Depends only on T001. Independent of US1 and US2 — though if US1 lands first, the reference style file `MtgjsonProvider.ts` is in its post-extract location and easier to point reviewers at.
- **Phase 6 (Polish)**: Depends on US1, US2, AND US3 being complete.

### Within Phase 3 (US1)

- T002 → T003 (T003 cannot run until the class exists in `MtgjsonProvider.ts`).
- T004 depends on T002 + T003.

### Within Phase 4 (US2)

- T005, T006, T007 [P] — types peer files, all independent (different new files).
- T008, T009, T010, T011 [P] — constants peer files, all independent (different new files).
- T012 depends on T005 + T006 + T007.
- T013 depends on T008 + T009 + T010 + T011.
- T012 and T013 can run in parallel with each other (different barrel files).
- T014 depends on T012 + T013.

### Within Phase 5 (US3)

- T015, T016, T017, T018 [P] — JSDoc backfill, all independent (different files).
- T019 depends on T015 + T016 + T017 + T018.

### User Story Independence

- US1, US2, US3 touch disjoint sets of files. They can be implemented in any order or in parallel by separate workers.
- Recommended order is priority-driven: US1 (MVP) first to prove the pattern, then US2 and US3 in parallel.

### Parallel Opportunities

- All seven peer-file creations in Phase 4 (T005-T011) can run in a single batch.
- The two barrel reductions in Phase 4 (T012, T013) can run together once their respective peer files exist.
- All four JSDoc backfills in Phase 5 (T015-T018) can run in a single batch.
- US1 entirely (T002-T004) can proceed in parallel with all of US2 and US3.

---

## Parallel Example: Phase 4 peer-file creation

```bash
# Launch all seven peer-file creations together (different new files):
Task: "Create packages/core/src/types/crud.ts (T005)"
Task: "Create packages/core/src/types/health.ts (T006)"
Task: "Create packages/core/src/types/errorBody.ts (T007)"
Task: "Create packages/core/src/constants/authIdentity.ts (T008)"
Task: "Create packages/core/src/constants/sessionJwt.ts (T009)"
Task: "Create packages/core/src/constants/errorCodes.ts (T010)"
Task: "Create packages/core/src/constants/httpStatus.ts (T011)"
```

## Parallel Example: Phase 5 JSDoc backfill

```bash
# Launch all four JSDoc backfills together (different files, no shared state):
Task: "Backfill JSDoc on apps/server/src/providers/registry.ts (T015)"
Task: "Backfill JSDoc on apps/server/src/services/authService.ts (T016)"
Task: "Backfill JSDoc on apps/server/src/services/cardService.ts (T017)"
Task: "Backfill JSDoc on apps/server/src/services/efsService.ts (T018)"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete T001 (baseline capture).
2. Complete T002 → T003 → T004 (US1 — extract `MtgjsonProvider`, reduce barrel, validate).
3. **STOP and VALIDATE**: tests pass, no caller edits, `index.ts` is a barrel.
4. Ship US1 alone if a smaller PR is preferred. The constitution-violation banner from the Sync Impact Report is partially cleared (1 of 4 violations remediated).

### Incremental Delivery

1. T001 → US1 → ship.
2. US2 (T005-T014) → ship. Three of four violations cleared.
3. US3 (T015-T019) → ship. All four violations cleared; constitution v1.11.0 fully satisfied.
4. T020 + T021 (Polish) → final PR or amend last story PR.

### Single-PR Delivery (recommended for this refactor)

Because all three stories share no source files and the validation gates are the same (`turbo typecheck`, `turbo test`, no caller edits), bundling them into one PR is reasonable and matches the "one bundled PR was the right call here" preference noted on similar refactors. Sequence:

1. T001 (baseline).
2. T002 → T003 → T004 (US1).
3. T005-T011 in parallel → T012 + T013 in parallel → T014 (US2).
4. T015-T018 in parallel → T019 (US3).
5. T020 → T021 (Polish).
6. Open one PR with the full diff and the validation evidence inline.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps each task to its user story for traceability against spec.md.
- No new tests are generated by this task list. Existing Jest tests are the regression net per FR-009.
- Caller-side import edits are explicitly out of scope (FR-011) and a regression signal — verified at every checkpoint.
- The branch `013-migrate-jest-tests` MUST NOT change during execution (FR-010).
- Constitution violations being remediated:
  1. `MtgjsonProvider` declared in `index.ts` → fixed by US1.
  2. `Card`/`CardList`/`CreateCardBody`/`UpdateCardBody`/`CardIdParams`/`HealthResponse`/`ErrorBody` inline in `types/index.ts` → fixed by US2.
  3. `AUTH_ERROR_CODES`/`AuthErrorCode`/`SESSION_JWT_TTL_DAYS`/`AUTH_IDENTITY_KIND`/`ERROR_CODES`/`ErrorCode`/`HTTP_STATUS` inline in `constants/index.ts` → fixed by US2.
  4. JSDoc backfill across services and providers → fixed by US3.
