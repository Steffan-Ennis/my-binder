# Implementation Plan: Fix Public API Discipline Violations (Principle IX)

**Branch**: `013-migrate-jest-tests` *(reusing current branch — explicit user instruction; FR-010)*
**Date**: 2026-04-28
**Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-fix-public-api-discipline/spec.md`

## Summary

Three structural refactors land Principle IX (Public API Discipline) compliance on the current
branch without changing any runtime behaviour:

1. Extract `MtgjsonProvider` from `apps/server/src/providers/mtgjson/index.ts` into a sibling
   `MtgjsonProvider.ts`; the `index.ts` collapses to a barrel re-exporting `MtgjsonProvider`
   and `mapCardSetToCardRecord`.
2. Empty `packages/core/src/types/index.ts` and `packages/core/src/constants/index.ts` of all
   inline declarations. Move types into peer files (`crud.ts`, `health.ts`, `errorBody.ts`)
   and constants into peer files grouped by concern (`authIdentity.ts`, `errorCodes.ts`,
   `httpStatus.ts`, `sessionJwt.ts`). Both `index.ts` files become re-export-only barrels.
3. Backfill JSDoc with `@example` blocks across `apps/server/src/services/*.ts` (excluding
   `efsService.ts` if it proves to be a thin filesystem helper) and `apps/server/src/providers/registry.ts`.
   Reference style is the post-extract `MtgjsonProvider.ts`.

The work runs on `013-migrate-jest-tests`. No new branch is created. No caller-side import
edits are expected — the barrel files preserve every external import path.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Node 22
**Primary Dependencies**: Fastify v4, `@duckdb/node-api`, `mtgjson-sdk@0.1.1`, `google-auth-library`, `jsonwebtoken`, `pg` + TypeORM 0.3.x (per spec 011), Jest 29 + ts-jest 29
**Storage**: N/A for this refactor — no schema or persistence changes
**Testing**: Jest 29 + ts-jest 29 (per spec 013); existing tests in `apps/server/src/providers/mtgjson/index.test.ts`, `mapper.test.ts`, `registry.test.ts`, `authService.test.ts`, `cardService.test.ts` are the regression net
**Target Platform**: AWS Lambda (`@fastify/aws-lambda` v6) for runtime; local development on macOS/Linux Node 22
**Project Type**: pnpm + Turborepo monorepo (`apps/server`, `apps/mobile`, `packages/core`, `packages/infrastructure`)
**Performance Goals**: N/A — refactor must not regress runtime behaviour but introduces no new performance targets
**Constraints**: Caller-side import paths MUST remain stable (FR-011); `turbo typecheck` and `turbo test` MUST exit zero at every story checkpoint (FR-008, FR-009); branch MUST stay on `013-migrate-jest-tests` (FR-010)
**Scale/Scope**: 1 provider class extraction; 9 inline types + 5 constant groups moved out of two barrel files; estimated 5-8 service/provider files for JSDoc backfill

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Each principle assessed against the planned work:

| # | Principle | Status | Notes |
|---|---|---|---|
| I | Simplicity First | ✅ Pass | Refactor reduces complexity by collapsing barrel + declaration into separate concerns. No new abstractions introduced. |
| II | Data Integrity | ✅ Pass | No data writes, no schema changes. Out of scope. |
| III | Test-First Development | ✅ Pass (refactor exception) | This is a structural refactor with no new behaviour. The existing test suite (Jest, per spec 013) is the regression net. The constitution requires tests for new behaviour; pure renames/moves do not require new tests. |
| IV | Single Responsibility | ✅ Pass | Splits files that currently mix declaration with re-export — explicit SRP improvement. |
| V | Transparency & Legibility | ✅ Pass | Symbol locations become obvious from file names. |
| VI | Layered Architecture | ✅ Pass | Layer boundaries unchanged. Provider abstraction (`CardProvider` interface, `registry.ts`) untouched. |
| VII | Strong Typing & Schema Validation | ✅ Pass | No `any` introduced; types preserved verbatim. The `Card` type duplication between `types/index.ts` and `types/card.ts` is investigated and resolved in research.md. |
| VIII | Error Transparency | ✅ Pass | Error-handling code in `MtgjsonProvider` (the only meaningfully altered file) is moved verbatim — try/catch with logging on `enrichCards` is preserved. |
| IX | Public API Discipline | ✅ Pass (this is the principle being enforced) | Every change in this plan brings the codebase into compliance with the rule the principle defines. |

**Result**: All nine gates pass. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/015-fix-public-api-discipline/
├── plan.md              # This file
├── research.md          # Phase 0 output (decisions)
├── data-model.md        # Phase 1 output (file-layout target state)
├── quickstart.md        # Phase 1 output (validation walkthrough)
├── contracts/           # Phase 1 output — empty for this internal refactor; see notes
├── checklists/
│   └── requirements.md  # Spec quality checklist (created by /speckit.specify)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
apps/server/src/
├── providers/
│   ├── interface.ts                # Type-only — exempt from JSDoc rule (FR-007)
│   ├── registry.ts                 # JSDoc backfill target (US3)
│   └── mtgjson/
│       ├── index.ts                # AFTER US1: barrel re-export only
│       ├── MtgjsonProvider.ts      # AFTER US1: extracted class with full JSDoc (already authored)
│       ├── mapper.ts               # Pure mapper — exempt (FR-007)
│       └── *.test.ts               # Existing tests — unchanged (FR-009)
├── services/
│   ├── authService.ts              # JSDoc backfill target (US3)
│   ├── cardService.ts              # JSDoc backfill target (US3)
│   ├── efsService.ts               # JSDoc backfill target — verify at task time it has runtime behaviour (US3)
│   └── *.test.ts                   # Existing tests — unchanged
└── index.ts                        # Entry-point — exempt under Principle IX carve-out

packages/core/src/
├── types/
│   ├── index.ts                    # AFTER US2: barrel re-export only
│   ├── auth.ts                     # Existing peer file — unchanged
│   ├── card.ts                     # Existing peer file — unchanged
│   ├── crud.ts                     # NEW: Card, CardList, CreateCardBody, UpdateCardBody, CardIdParams
│   ├── health.ts                   # NEW: HealthResponse
│   └── errorBody.ts                # NEW: ErrorBody
├── constants/
│   ├── index.ts                    # AFTER US2: barrel re-export only
│   ├── authIdentity.ts             # NEW: AUTH_ERROR_CODES, AuthErrorCode, AUTH_IDENTITY_KIND
│   ├── sessionJwt.ts               # NEW: SESSION_JWT_TTL_DAYS
│   ├── errorCodes.ts               # NEW: ERROR_CODES, ErrorCode
│   └── httpStatus.ts               # NEW: HTTP_STATUS
└── schemas/                        # Already peer-file pattern — unchanged
```

**Structure Decision**: pnpm + Turborepo monorepo (Option 2 / web-service variant of the
template). Server lives in `apps/server`; shared types/constants live in `packages/core`.
The refactor touches three locations only: `apps/server/src/providers/mtgjson/`,
`packages/core/src/types/`, and `packages/core/src/constants/`. JSDoc backfill spans
`apps/server/src/services/` and the rest of `apps/server/src/providers/`.

**Contracts directory note**: this is a purely internal structural refactor. There are no
external interface contracts (REST endpoints, library APIs) being introduced or modified.
Per the plan-template guidance ("Skip if project is purely internal"), the `contracts/`
directory is created but left empty for this feature, with a `README.md` placeholder
explaining why.

## Complexity Tracking

*Constitution Check passed all nine gates. No entries required.*
