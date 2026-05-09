# Phase 1 Quickstart: Validating Public API Discipline Compliance

**Feature**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Data Model**: [data-model.md](./data-model.md)
**Date**: 2026-04-28

This document is the executable validation walkthrough for the refactor. Each section maps
to one user story (US1, US2, US3) and ends with the exact commands a reviewer runs to
prove the story is done. Together they exercise SC-001 through SC-006.

## Prerequisites

- On branch `013-migrate-jest-tests` (the spec mandates no new branch).
- `pnpm install` has run at least once.
- Working tree is otherwise clean of unrelated changes (use `git status` to confirm).

## US1 walkthrough — `MtgjsonProvider` extraction

### Step 1.1 — Confirm starting state

```bash
# MtgjsonProvider currently lives inline in index.ts
grep -c "^export class MtgjsonProvider" apps/server/src/providers/mtgjson/index.ts
# Expected: 1

# MtgjsonProvider.ts does not yet exist
test ! -f apps/server/src/providers/mtgjson/MtgjsonProvider.ts && echo "OK"
# Expected: OK
```

### Step 1.2 — Verify the move (after the implementation lands)

```bash
# Class declaration moved to MtgjsonProvider.ts
grep -c "^export class MtgjsonProvider" apps/server/src/providers/mtgjson/MtgjsonProvider.ts
# Expected: 1

# Class declaration removed from index.ts
grep -c "^export class MtgjsonProvider" apps/server/src/providers/mtgjson/index.ts
# Expected: 0

# index.ts contains only re-exports
grep -vE '^\s*(//|$)' apps/server/src/providers/mtgjson/index.ts
# Expected output: only `export { ... } from './...';` lines
```

### Step 1.3 — JSDoc preservation check

```bash
# Count JSDoc blocks on MtgjsonProvider methods (should be 8: constructor + 7 methods)
grep -c "^\s*\*\s@example" apps/server/src/providers/mtgjson/MtgjsonProvider.ts
# Expected: ≥ 6 (the public methods that have @example blocks)
```

### Step 1.4 — Build and test

```bash
turbo typecheck --filter=@my-binder/server
# Expected: exit 0, no new errors

pnpm --filter @my-binder/server test -- src/providers/mtgjson/index.test.ts
# Expected: exit 0, all tests pass
```

### Step 1.5 — Caller-side stability (FR-011 / SC-006)

```bash
# Verify app.ts and the test file still import via the barrel path — no edits
git diff apps/server/src/app.ts apps/server/src/providers/mtgjson/index.test.ts
# Expected: no import-line changes; only unrelated changes are permitted
```

**Story complete when**: all five steps pass.

## US2 walkthrough — `packages/core` barrels

### Step 2.1 — Confirm starting state

```bash
# Inline declarations exist in both barrel files
grep -E "^(export\s+(interface|const|type)\s)" packages/core/src/types/index.ts | wc -l
# Expected: ≥ 7 (Card, CardList, CreateCardBody, UpdateCardBody, CardIdParams, HealthResponse, ErrorBody)

grep -E "^(export\s+(const|type)\s)" packages/core/src/constants/index.ts | wc -l
# Expected: ≥ 7 (AUTH_ERROR_CODES, AuthErrorCode, SESSION_JWT_TTL_DAYS, AUTH_IDENTITY_KIND, ERROR_CODES, ErrorCode, HTTP_STATUS)

# New peer files do not yet exist
test ! -f packages/core/src/types/crud.ts && echo "OK: types/crud.ts absent"
test ! -f packages/core/src/constants/authIdentity.ts && echo "OK: constants/authIdentity.ts absent"
```

### Step 2.2 — Verify peer files exist post-refactor

```bash
# Types peer files
ls packages/core/src/types/{crud,health,errorBody}.ts
# Expected: all three list

# Constants peer files
ls packages/core/src/constants/{authIdentity,sessionJwt,errorCodes,httpStatus}.ts
# Expected: all four list
```

### Step 2.3 — Verify both barrel files contain only re-exports

```bash
# Types barrel
grep -vE '^\s*(//|$)' packages/core/src/types/index.ts
# Expected: only `export * from './...';` lines (5 of them)

# Constants barrel
grep -vE '^\s*(//|$)' packages/core/src/constants/index.ts
# Expected: only `export * from './...';` lines (4 of them)

# Strict SC-001 check: no inline declarations remain
grep -E "^(export\s+(interface|class|function|const|type)\s)" packages/core/src/types/index.ts
# Expected: empty output
grep -E "^(export\s+(interface|class|function|const|type)\s)" packages/core/src/constants/index.ts
# Expected: empty output
```

### Step 2.4 — Build and test the whole monorepo

```bash
turbo typecheck
# Expected: exit 0 across all workspaces

turbo test
# Expected: exit 0 across all workspaces

# Spot-check that the four caller files still resolve their imports
turbo typecheck --filter=@my-binder/server
# Expected: exit 0
```

### Step 2.5 — Caller-side stability (FR-011 / SC-006)

```bash
# These four files MUST show zero import-line changes from the refactor
git diff apps/server/src/repositories/cardRepository.ts apps/server/src/routes/cards.ts \
        apps/server/src/app.ts apps/server/src/providers/mtgjson/index.test.ts | \
  grep -E "^[+-]\s*import"
# Expected: empty output
```

**Story complete when**: all five steps pass.

## US3 walkthrough — service/provider JSDoc backfill

### Step 3.1 — Build the audit list

For each file in scope, list every public function/method and confirm it carries a
compliant JSDoc block.

In-scope files:

- `apps/server/src/providers/registry.ts`
- `apps/server/src/services/authService.ts`
- `apps/server/src/services/cardService.ts`
- `apps/server/src/services/efsService.ts`

Already-compliant (reference style, no action):

- `apps/server/src/providers/mtgjson/MtgjsonProvider.ts` — completed during the prior
  session that produced this spec.

Excluded (FR-007, R6):

- `apps/server/src/providers/interface.ts` (type-only)
- `apps/server/src/providers/mtgjson/mapper.ts` (pure mapper)
- `apps/server/src/providers/**/*.test.ts` (tests)

### Step 3.2 — Mechanical verification

```bash
# Count @example blocks across in-scope files (lower bound check)
grep -c "^\s*\*\s@example" \
  apps/server/src/providers/registry.ts \
  apps/server/src/services/authService.ts \
  apps/server/src/services/cardService.ts \
  apps/server/src/services/efsService.ts
# Expected: each line ≥ 1 (one @example per public function/method, minimum)
```

### Step 3.3 — Build and test

```bash
turbo typecheck
# Expected: exit 0

turbo test
# Expected: exit 0
```

### Step 3.4 — Manual review

Open each in-scope file in an editor and confirm, for every public function/method:

- Description paragraph present (the *why*, not the *what*).
- `@param` for every parameter; options-object sub-fields described.
- `@returns` describing return shape and any sentinels.
- `@throws` for every error code raised.
- At least one `@example` block fenced as triple-backtick TypeScript.

**Story complete when**: every in-scope file passes the four steps.

## End-to-end validation (after all three stories)

### SC-001 — Index file purity, monorepo-wide

```bash
# Find every index.ts under in-scope src dirs
find apps/server/src packages/core/src -name index.ts -type f -print
# For each, confirm the file contains only re-export statements
for f in $(find apps/server/src packages/core/src -name index.ts -type f); do
  echo "=== $f ==="
  grep -vE '^\s*(//|$|export\s+(\*|\{|type\s))' "$f"
done
# Expected: under each `=== file ===` line, no output (every line is a re-export).
# apps/server/index.ts is intentionally excluded from this glob (it's at apps/server/, not apps/server/src/).
```

### SC-003 / SC-004 — Type and test gates

```bash
turbo typecheck && turbo test
# Expected: exit 0 from both
```

### SC-005 — Single-hop "Go to Definition"

Spot-check five randomly chosen imports of services/providers in the codebase. For each,
"Go to Definition" in the IDE MUST land on a peer file (e.g., `MtgjsonProvider.ts`,
`authService.ts`) within at most one re-export step. Record the five sampled imports in
the PR description as evidence.

### SC-006 — Caller-side import stability

```bash
# Diff every file that imports a moved/extracted symbol.
# Expected: no `^[+-]\s*import` lines attributable to this refactor.
git diff origin/main -- \
  apps/server/src/app.ts \
  apps/server/src/repositories/cardRepository.ts \
  apps/server/src/routes/cards.ts \
  apps/server/src/providers/mtgjson/index.test.ts \
  | grep -E "^[+-]\s*import"
# Expected: empty output
```

## Done checklist (paste into PR description)

- [ ] US1: `MtgjsonProvider` extracted; `index.ts` is a barrel.
- [ ] US1: `index.test.ts` runs with no source-side edits.
- [ ] US2: `packages/core/src/types/index.ts` and `constants/index.ts` are barrels.
- [ ] US2: All seven inline types and all five constant groups live in named peer files.
- [ ] US2: `cardRepository.ts` and `routes/cards.ts` import paths unchanged.
- [ ] US3: `registry.ts`, `authService.ts`, `cardService.ts`, `efsService.ts` carry full JSDoc.
- [ ] `turbo typecheck` exits 0.
- [ ] `turbo test` exits 0.
- [ ] No caller-side import edits in the diff.
