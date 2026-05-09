# Tasks: Migrate Server Test Framework to Jest

**Input**: Design documents from `/specs/013-migrate-jest-tests/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install Jest and create configuration

- [X] T001 Install Jest devDependencies (`jest`, `ts-jest`, `@types/jest`) in apps/server/package.json
- [X] T002 Create Jest configuration file at apps/server/jest.config.ts with ts-jest transformer, `moduleNameMapper` for `@src/*` and `@root/*` path aliases, `testMatch` for `src/**/*.test.ts`, and `node` test environment
- [X] T003 Update `test` script in apps/server/package.json to invoke `jest` (replacing `node --import tsx --experimental-test-module-mocks --test "src/**/*.test.ts"`)

---

## Phase 2: Foundational (Validation)

**Purpose**: Verify Jest can discover and run a single trivial test before rewriting all 14 files

**CRITICAL**: This phase proves the toolchain (ts-jest, path aliases, decorators) works before committing to the bulk rewrite

- [X] T004 Rewrite apps/server/src/routes/health.test.ts (1 test, no mocking, simplest file) — replace `node:test`/`node:assert` imports with Jest APIs, replace `before`/`after` with `beforeAll`/`afterAll`, replace `assert.equal` with `expect().toBe()`
- [X] T005 Run `pnpm test -- src/routes/health.test.ts` in apps/server and verify it passes — confirms ts-jest transformer, path alias resolution, and test discovery all work

**Checkpoint**: Jest toolchain validated — bulk rewrite can proceed

---

## Phase 3: User Story 1 — All Tests Run Under Jest (Priority: P1)

**Goal**: Rewrite the 9 test files that do NOT use `mock.module()` — pure `node:test`/`node:assert` → Jest API translation

**Independent Test**: Run `pnpm test` in apps/server — all 10 files (including health from Phase 2) should pass

### Implementation for User Story 1

- [X] T006 [P] [US1] Rewrite apps/server/src/providers/registry.test.ts (8 tests) — replace `node:test`/`node:assert` imports with Jest globals, replace `assert.equal`/`assert.deepStrictEqual`/`assert.ok`/`assert.throws` with `expect().toBe()`/`.toEqual()`/`.toBeTruthy()`/`.toThrow()`
- [X] T007 [P] [US1] Rewrite apps/server/src/routes/provider.test.ts (6 tests) — replace imports, `before`/`after` → `beforeAll`/`afterAll`, translate assertions
- [X] T008 [P] [US1] Rewrite apps/server/src/providers/mtgjson/mapper.test.ts (6 tests) — replace imports, translate assertions
- [X] T009 [P] [US1] Rewrite apps/server/src/auth/googleVerifier.test.ts (6 tests) — replace imports, translate assertions
- [X] T010 [P] [US1] Rewrite apps/server/src/auth/sessionJwt.test.ts (6 tests) — replace imports, translate assertions
- [X] T011 [P] [US1] Rewrite apps/server/src/routes/login.test.ts (4 tests) — replace imports, `before`/`after` → `beforeAll`/`afterAll`, translate assertions
- [X] T012 [P] [US1] Rewrite apps/server/src/repositories/userRepository.test.ts (4 tests) — replace `mock.fn()` with `jest.fn()`, translate assertions
- [X] T013 [P] [US1] Rewrite apps/server/src/repositories/cardRepository.test.ts (6 tests) — replace `mock.fn()` with `jest.fn()`, translate assertions
- [X] T014 [P] [US1] Rewrite apps/server/src/services/authService.test.ts (4 tests) — replace imports, `before` → `beforeAll`, translate assertions
- [X] T015 [US1] Run `pnpm test` in apps/server and verify all 10 rewritten files pass (45 tests from T006-T014 + 1 from T004)

**Checkpoint**: 10 of 14 files pass under Jest. All non-mocking tests confirmed working.

---

## Phase 4: User Story 2 — Third-Party Module Mocking Works (Priority: P1)

**Goal**: Rewrite the 4 test files that use `mock.module()` → `jest.mock()`, proving Jest's mock hoisting resolves the tsx/CommonJS incompatibility

**Independent Test**: Run `pnpm test -- src/routes/auth.test.ts` and verify the `OAuth2Client.verifyIdToken` spy call count >= 1 after sign-in

### Implementation for User Story 2

- [X] T016 [P] [US2] Rewrite apps/server/src/services/cardService.test.ts (17 tests) — replace `mock.module('@src/db/repositories')` with `jest.mock('@src/db/repositories', () => ({...}))`, replace `mock.fn()` with `jest.fn()`, replace `before` with `beforeAll`, translate all assertions
- [X] T017 [P] [US2] Rewrite apps/server/src/routes/cards.test.ts (21 tests) — replace `mock.module('@src/db/repositories')` with `jest.mock()` factory, replace inline mock stores, translate assertions
- [X] T018 [P] [US2] Rewrite apps/server/src/routes/docs.test.ts (9 tests) — replace `mock.module('@src/db/repositories')` with `jest.mock()` factory, translate assertions
- [X] T019 [US2] Rewrite apps/server/src/routes/auth.test.ts (11 tests) — replace `mock.module('google-auth-library')` with `jest.mock('google-auth-library', () => ({...}))` using hoisted factory, convert `verifyIdTokenSpy` to `jest.fn()`, preserve real TypeORM DataSource setup in `beforeAll`, replace `googleMock.restore()` with `jest.restoreAllMocks()` in `afterAll`, translate all assertions. **KEY VALIDATION**: After rewrite, add assertion that `verifyIdTokenSpy` call count >= 1 in the happy-path test to prove the mock is active.
- [X] T020 [US2] Run `pnpm test` in apps/server and verify all 14 files pass (99 total tests). Specifically confirm auth.test.ts happy-path test passes with spy call count >= 1.

**Checkpoint**: All 14 files pass. Module mocking confirmed working for both internal (`@src/db/repositories`) and third-party (`google-auth-library`) modules.

---

## Phase 5: User Story 3 — Assertions Preserved (Priority: P2)

**Goal**: Audit and confirm no test cases were dropped or weakened during the rewrite

**Independent Test**: Compare named test count per file between old and new implementations; total must be >= 99

### Implementation for User Story 3

- [X] T021 [US3] Audit all 14 rewritten test files — count named `test()` calls per file and compare against baseline: registry(8), provider(6), mapper(6), googleVerifier(6), sessionJwt(6), login(4), health(1), userRepository(4), cardRepository(6), cardService(17), cards(21), docs(9), authService(4), auth(11). Total must be >= 99. Document any added tests (e.g., spy call count assertion in auth.test.ts).
- [X] T022 [US3] Verify no `node:test` or `node:assert` imports remain — run grep across apps/server/src/**/*.test.ts for `from 'node:test'` and `from 'node:assert'`; result must be zero matches
- [X] T023 [US3] Run full suite `pnpm test` in apps/server one final time — all tests pass, exit code 0

**Checkpoint**: Migration verified complete. All assertions preserved, no framework remnants.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and documentation

- [X] T024 [P] Update apps/server/docs/module-mocking.md — add a resolution section noting the migration to Jest resolved the tsx/CommonJS/mock.module() incompatibility, with a brief example of the jest.mock() pattern that replaced it
- [X] T025 [P] Remove `--experimental-test-module-mocks` and `--import tsx` from any remaining scripts or CI config that referenced the old test runner (check apps/server/package.json and any turbo.json test pipeline config)
- [X] T026 Run `pnpm turbo test` from repo root to confirm the test pipeline works across all workspaces (apps/server tests pass under Jest; other workspaces unaffected)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — validates toolchain
- **US1 (Phase 3)**: Depends on Phase 2 — bulk rewrite of non-mocking files
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with Phase 3 but benefits from Phase 3 completing first (builds confidence in the pattern)
- **US3 (Phase 5)**: Depends on Phases 3 and 4 — audit requires all files rewritten
- **Polish (Phase 6)**: Depends on Phase 5

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2. Covers 10 files with no mock.module() usage.
- **US2 (P1)**: Independent after Phase 2. Covers 4 files with mock.module() → jest.mock() translation. Can run in parallel with US1.
- **US3 (P2)**: Depends on both US1 and US2 completing — verification pass across all 14 files.

### Within Each User Story

- All rewrite tasks marked [P] within a story can run in parallel (different files)
- The verification task at the end of each story (T015, T020, T023) must run after all rewrites in that story

### Parallel Opportunities

- T006–T014 (US1 rewrites): All 9 files can be rewritten in parallel
- T016–T018 (US2 rewrites): 3 of 4 mock.module() files can be rewritten in parallel
- T019 (auth.test.ts) benefits from T016–T018 completing first to validate the jest.mock() pattern, but is not blocked by them
- T024–T025 (Polish) can run in parallel

---

## Parallel Example: User Story 1

```text
# Launch all US1 rewrites together (9 files, no dependencies between them):
Task: "Rewrite registry.test.ts"          # T006
Task: "Rewrite provider.test.ts"          # T007
Task: "Rewrite mapper.test.ts"            # T008
Task: "Rewrite googleVerifier.test.ts"    # T009
Task: "Rewrite sessionJwt.test.ts"        # T010
Task: "Rewrite login.test.ts"             # T011
Task: "Rewrite userRepository.test.ts"    # T012
Task: "Rewrite cardRepository.test.ts"    # T013
Task: "Rewrite authService.test.ts"       # T014

# Then verify:
Task: "Run pnpm test — all 10 files pass" # T015
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (install deps, create config)
2. Complete Phase 2: Foundational (validate toolchain with health.test.ts)
3. Complete Phase 3: US1 — rewrite 9 non-mocking files
4. Complete Phase 4: US2 — rewrite 4 mock.module() files
5. **STOP and VALIDATE**: `pnpm test` — all 99 tests pass, spy call count confirmed
6. The mocking problem is solved at this point

### Full Delivery

7. Complete Phase 5: US3 — audit assertion counts, verify no node:test remnants
8. Complete Phase 6: Polish — update docs, clean CI config, run turbo pipeline

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are both P1 but split by mocking complexity: US1 = mechanical API translation, US2 = mock.module() → jest.mock() pattern change
- The API mapping table in research.md is the primary reference for each rewrite task
- auth.test.ts (T019) is the single most important file — it validates the entire migration rationale
- Commit after each phase checkpoint, not after each individual file rewrite
