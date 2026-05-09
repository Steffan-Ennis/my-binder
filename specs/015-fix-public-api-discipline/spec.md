# Feature Specification: Fix Public API Discipline Violations (Principle IX)

**Feature Branch**: `013-migrate-jest-tests` *(reusing current branch — explicit user instruction; no new branch)*
**Created**: 2026-04-28
**Status**: Draft
**Input**: User description: "Remediate the four violations of Principle IX (Public API Discipline) introduced by constitution v1.11.0."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extract `MtgjsonProvider` from its directory's barrel file (Priority: P1)

A developer opening `apps/server/src/providers/mtgjson/` to understand the provider implementation today finds the class declared inside `index.ts`. The constitution requires `index.ts` files to be barrel re-exports only. After this story is complete, the class lives in a clearly-named sibling file (`MtgjsonProvider.ts`) and `index.ts` re-exports it (along with `mapCardSetToCardRecord` from `mapper.ts`). All existing JSDoc on the class and its methods is preserved verbatim.

**Why this priority**: This is the named violation called out in the constitution Sync Impact Report and is the canonical example of the rule. Fixing it first establishes the pattern for the rest of the work and proves the structural change does not break tests or builds.

**Independent Test**: Can be verified by (a) reading `apps/server/src/providers/mtgjson/index.ts` and confirming it contains only `export … from './…';` statements, (b) running the existing test file `apps/server/src/providers/mtgjson/index.test.ts` and confirming all tests pass, and (c) running `turbo typecheck --filter=@my-binder/server` and confirming it exits with no errors.

**Acceptance Scenarios**:

1. **Given** the current branch with the `MtgjsonProvider` class declared inline in `index.ts`, **When** the refactor is complete, **Then** `MtgjsonProvider` is declared in `MtgjsonProvider.ts` and `index.ts` contains only re-export statements.
2. **Given** the existing test file `apps/server/src/providers/mtgjson/index.test.ts` imports from `@src/providers/mtgjson/index`, **When** the refactor is complete, **Then** the test file's imports continue to resolve via the barrel without modification.
3. **Given** the JSDoc blocks added in the previous session (constructor, `close`, `lookup`, `checkLegality`, `search`, `isReachable`, `enrichCards`, `enrichCard`), **When** the class is moved, **Then** every JSDoc block is present on the moved class with identical wording, fenced code blocks, and example bodies.
4. **Given** other code in the repository that imports `MtgjsonProvider` (e.g., `apps/server/src/app.ts`), **When** the refactor is complete, **Then** existing import paths continue to resolve and require no caller-side changes.

---

### User Story 2 - Make `packages/core` barrel files pure re-exports (Priority: P2)

A developer importing `Card`, `CreateCardBody`, `AUTH_ERROR_CODES`, or `ERROR_CODES` from `@my-binder/core` today receives them from inline declarations buried inside `packages/core/src/types/index.ts` and `packages/core/src/constants/index.ts`. After this story, those declarations live in named peer files grouped by concern (e.g., `card.ts`, `errorCodes.ts`, `authIdentity.ts`, `sessionJwt.ts`), and the two `index.ts` files contain only re-export statements.

**Why this priority**: These are real violations but they live in the shared `packages/core` workspace where breakage would cascade across both `apps/server` and the future mobile app. The change is purely structural — every import path that worked before MUST still work after — but the blast radius warrants doing it after the lower-risk provider extraction in US1 has proven the pattern.

**Independent Test**: Can be verified by (a) reading the two `index.ts` files and confirming each contains only `export … from './…';` lines, (b) confirming `card.ts` does not contain duplicate type declarations (the inline `Card`/`CardList`/etc. in the current `types/index.ts` are likely a merge artifact and may overlap with `card.ts`'s exports — investigation and dedup is part of this story), and (c) running `turbo typecheck` from the repo root with no new errors and `turbo test` passing.

**Acceptance Scenarios**:

1. **Given** `packages/core/src/types/index.ts` currently re-exports from `card.ts` and `auth.ts` *and* declares `Card`, `CardList`, `CreateCardBody`, `UpdateCardBody` inline, **When** the refactor is complete, **Then** `index.ts` contains only re-export statements and the four types are declared in exactly one peer file each.
2. **Given** the inline `Card` type may duplicate or conflict with the type already exported by `card.ts`, **When** the investigation finds duplicates, **Then** the duplicate is removed and the surviving declaration is the one in `card.ts` (or whichever peer file is canonical), with no runtime or type behaviour change for callers.
3. **Given** `packages/core/src/constants/index.ts` currently declares all five named constant groups inline, **When** the refactor is complete, **Then** each group lives in a peer file grouped by concern (e.g., auth-related constants in `authIdentity.ts` and `errorCodes.ts`, JWT constants in `sessionJwt.ts`), and `index.ts` contains only re-exports.
4. **Given** existing consumers import constants from `@my-binder/core` (the package's exported barrel), **When** the refactor is complete, **Then** those imports continue to resolve without caller-side changes.

---

### User Story 3 - Backfill JSDoc with examples on services and providers (Priority: P3)

A developer browsing `apps/server/src/services/` or `apps/server/src/providers/` today sees mixed JSDoc coverage — `MtgjsonProvider` is fully documented (the reference style), but other public methods are bare. After this story, every public function or class method in those directories carries a JSDoc block with description, `@param` (including options sub-fields), `@returns`, `@throws` (where applicable), and at least one fenced TypeScript `@example`.

**Why this priority**: This is the largest mechanical change and least likely to break runtime behaviour, but also least urgent — JSDoc is read by IDE tooling and human reviewers, and absence of JSDoc does not produce test failures. Doing it last lets US1 and US2 ship independently and avoids one large mixed-purpose PR.

**Independent Test**: Can be verified by listing every exported function and every public method on every exported class under the two directories (excluding type-only files like `interface.ts` and pure data mappers like `mapper.ts`) and confirming each has a JSDoc block matching the reference style. A manual checklist in the implementation tasks captures the file-by-file audit; once each file's checkbox is ticked, the story is done.

**Acceptance Scenarios**:

1. **Given** the reference implementation in `MtgjsonProvider.ts` (post-US1) with full JSDoc, **When** another service or provider is reviewed, **Then** every public function or method matches the same shape: description, `@param`, `@returns`, `@throws` (if applicable), and at least one fenced TypeScript `@example`.
2. **Given** type-only files (containing only `type`/`interface` declarations and no runtime behaviour) and pure data mapper files (e.g., `mapper.ts`), **When** the audit runs, **Then** those files are explicitly excluded from the JSDoc requirement and their exclusion is recorded in the task list.
3. **Given** a service or provider with a method whose behaviour is non-obvious from the signature (e.g., returns a sentinel value, throws a tagged error), **When** the JSDoc is written, **Then** the `@returns` and `@throws` entries describe those edge cases explicitly.

---

### Edge Cases

- **Duplicate type declarations between `types/index.ts` and `types/card.ts`**: If the inline `Card`/`CardList`/`CreateCardBody`/`UpdateCardBody` types in `index.ts` overlap with types already exported from `card.ts`, the inline copies MUST be removed (treat them as merge artifacts) and the surviving declaration is whichever file is the more recently authored or more complete shape — to be decided at the planning step after reading both files in full.
- **Test file deep-imports**: The existing test `apps/server/src/providers/mtgjson/index.test.ts` imports `MtgjsonProvider` via `@src/providers/mtgjson/index`. After US1, the same path MUST still resolve through the new barrel. Tests SHOULD NOT be rewritten to deep-import `@src/providers/mtgjson/MtgjsonProvider`; the public surface stays at the barrel.
- **Caller imports of moved symbols**: Anywhere `MtgjsonProvider` is imported (e.g., `apps/server/src/app.ts`) MUST continue to work via the barrel without change. Caller-side edits are a regression signal, not an expected outcome.
- **Constants peer-file naming**: When grouping inline constants into peer files, name files by concern (e.g., `authIdentity.ts`, `errorCodes.ts`, `sessionJwt.ts`) rather than by the constant identifier. A file containing two related constants (`AUTH_ERROR_CODES` + `AuthErrorCode`) groups them; unrelated constants get separate files.
- **JSDoc on functions whose entire surface is implied by types**: Even when the type signature appears self-explanatory, the JSDoc requirement is non-negotiable per Principle IX. The block MUST exist and MUST include at least one `@example`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After the refactor, every `index.ts` file under `apps/*/src/` and `packages/*/src/` MUST contain only re-export statements (`export ... from './...'`, `export type ... from './...'`, `export * from './...'`). The sole carve-out is `apps/server/index.ts`, which is the package entry-point per Principle IX.
- **FR-002**: `MtgjsonProvider` MUST be declared in a file named `MtgjsonProvider.ts` inside `apps/server/src/providers/mtgjson/`. The class body, all method implementations, all JSDoc blocks (including the recently added `@example` blocks and the explanatory comments on `enrichCards` and `enrichCard`) MUST be moved verbatim. No code changes beyond moving the symbol are permitted in this step.
- **FR-003**: After US1, `apps/server/src/providers/mtgjson/index.ts` MUST re-export `MtgjsonProvider` from `./MtgjsonProvider` and `mapCardSetToCardRecord` from `./mapper`, plus any other symbols the directory currently exposes.
- **FR-004**: After US2, the inline declarations of `Card`, `CardList`, `CreateCardBody`, `UpdateCardBody` MUST NOT exist in `packages/core/src/types/index.ts`. Each type MUST be declared in exactly one peer file. If a duplicate exists in `card.ts`, the duplicate MUST be removed in favour of a single canonical definition.
- **FR-005**: After US2, the inline declarations of `AUTH_ERROR_CODES`, `AuthErrorCode`, `SESSION_JWT_TTL_DAYS`, `AUTH_IDENTITY_KIND`, `ERROR_CODES`, and any other constants currently inline in `packages/core/src/constants/index.ts` MUST be moved to peer files grouped by concern. The peer files MUST be named descriptively (e.g., `authIdentity.ts`, `errorCodes.ts`, `sessionJwt.ts`).
- **FR-006**: After US3, every exported function and every public class method under `apps/server/src/services/**/*.ts` and `apps/server/src/providers/**/*.ts` MUST carry a JSDoc block. The block MUST include: a description paragraph, an `@param` for every parameter (with options sub-fields described as `@param opts.foo - ...` where applicable), `@returns`, `@throws` for every error code raised, and at least one `@example` block wrapped in triple-backtick fenced TypeScript.
- **FR-007**: Files that are type-only (`*.ts` containing only `type`/`interface` declarations and no runtime behaviour) and pure data-mapper files (e.g., `mapper.ts` containing only deterministic input→output transformations) are excluded from FR-006. The excluded set MUST be enumerated in the task list at planning time.
- **FR-008**: `turbo typecheck` (run from the repo root, applying to all workspaces) MUST exit zero with no new errors at every story checkpoint.
- **FR-009**: `turbo test` (run from the repo root) MUST exit zero at every story checkpoint. The existing tests in `apps/server/src/providers/mtgjson/index.test.ts` MUST NOT be modified during US1 except to update import paths if and only if barrel resolution proves infeasible — and the planning step MUST default to "do not modify" unless a concrete blocker emerges.
- **FR-010**: The branch on which this work happens MUST be `013-migrate-jest-tests` (the current branch). No new branch is created and no checkout is performed for this spec. Commits land on the current branch and ship through whatever PR mechanism is already in flight for that branch.
- **FR-011**: All consumer-side import paths (e.g., `import { MtgjsonProvider } from '@src/providers/mtgjson/index'` or `import { ERROR_CODES } from '@my-binder/core'`) MUST continue to resolve without modification. Caller-side import edits are explicitly out of scope and are a regression signal if they become necessary.

### Key Entities *(included because the feature involves source-tree organization)*

- **Barrel file**: An `index.ts` file whose sole purpose is to re-export symbols from sibling files in the same directory. Contains no class, function, type, or constant declarations of its own. Carve-out exists for package-root entry-points.
- **Peer file**: A non-barrel source file that declares a class, function, type, or constant. The file name describes the symbol or group of related symbols it owns (e.g., `MtgjsonProvider.ts`, `errorCodes.ts`).
- **Public function/method**: An exported function, or a non-private method on an exported class, in a service or provider workspace. Subject to the JSDoc requirement of FR-006.
- **Type-only file**: A source file containing only `type` aliases and `interface` declarations (no runtime values, no function bodies). Excluded from FR-006.
- **Pure mapper file**: A source file whose exports are deterministic, side-effect-free input→output transformations (e.g., `mapCardSetToCardRecord`). Excluded from FR-006 unless the transformation has non-obvious behaviour worth documenting — to be judged in the planning step.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero `index.ts` files under `apps/*/src/` or `packages/*/src/` declare their own classes, functions, types, constants, or runtime values, with the sole carve-out for `apps/server/index.ts`. Verifiable by inspection: every line in every qualifying `index.ts` matches the pattern `^export\s+(\*|\{|type\s)`.
- **SC-002**: 100% of audited public functions and methods (per FR-006/FR-007) carry a JSDoc block including description, `@param`, `@returns`, and at least one `@example`. Verifiable by file-by-file checklist in the task list.
- **SC-003**: `turbo typecheck` from the repo root exits zero at every story checkpoint (after US1, after US2, after US3) with no new errors compared to pre-refactor.
- **SC-004**: `turbo test` from the repo root exits zero at every story checkpoint. No test in the existing `apps/server/src/providers/mtgjson/index.test.ts` requires modification unless the planning step explicitly approves a single, justified exception.
- **SC-005**: A developer unfamiliar with the codebase, opening any service or provider symbol via "Go to Definition" in the IDE, traverses at most one re-export step before landing on the file that declares the symbol. Verifiable by spot-checking five randomly selected imports of services or providers post-refactor.
- **SC-006**: Pre- and post-refactor diffs of caller files (any file that *imports* a moved or extracted symbol) MUST contain zero changes to import statements. Caller files MAY change for unrelated reasons, but no import path edit MAY be attributed to this refactor.

## Assumptions

- The existing tests in `apps/server/src/providers/mtgjson/index.test.ts` exercise enough of the public surface that "all tests pass" is a sufficient regression signal for US1. No new tests are required by this spec.
- The mobile app workspace `apps/mobile/*` is not yet implemented and contains no source files requiring remediation. Should the mobile workspace gain source code before this spec ships, the planning step MUST audit it for index-file purity violations.
- The `apps/server/src/repositories/` directory is not in scope for the JSDoc requirement under FR-006 — Principle IX mentions services and providers explicitly. Repositories MAY be added in a follow-up amendment if the constitution is broadened.
- `packages/infrastructure/` (CDK stack) is not in scope. The constitution rule covers `apps/*/src/` and `packages/*/src/`; the infrastructure package's `bin/` and `lib/` directories follow CDK convention rather than the barrel pattern.
- The two `card.ts` and `auth.ts` files already existing under `packages/core/src/types/` and the `card.ts` schema file under `packages/core/src/schemas/` already follow the peer-file pattern. The remediation work in US2 is confined to removing the inline duplicates from the two `index.ts` files.
