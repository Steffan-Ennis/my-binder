# Implementation Plan: Migrate Server Test Framework to Jest

**Branch**: `013-migrate-jest-tests` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-migrate-jest-tests/spec.md`

## Summary

Replace `node:test` with Jest in `apps/server` to resolve a fundamental incompatibility between `tsx`, CommonJS, and `--experimental-test-module-mocks` that causes all third-party module mocking to silently fail. All 14 test files (99 named test cases) will be rewritten to use Jest APIs. `ts-jest` handles TypeScript transformation and decorator metadata emission without a separate build step.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 22
**Primary Dependencies**: Jest 29 + ts-jest 29 + @types/jest
**Storage**: N/A (existing tests use TypeORM with PostgreSQL; no storage changes)
**Testing**: Jest 29 with `ts-jest` transformer (replacing `node:test` + `tsx`)
**Target Platform**: Node 22 (apps/server development environment)
**Project Type**: Monorepo workspace — test infrastructure change in `apps/server`
**Performance Goals**: Test suite completes in comparable time to current `node:test` execution
**Constraints**: Must support TypeORM decorators (`experimentalDecorators`, `emitDecoratorMetadata`); must resolve `@src/*` and `@root/*` path aliases
**Scale/Scope**: 14 test files, 99 named test cases, 5 files using `mock.module()`, 4 files using `mock.fn()`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | PASS | Jest is the minimum-complexity solution to the mocking problem. No speculative abstractions added. |
| II. Data Integrity | PASS | No changes to data storage or schema. Tests continue to use real database where they already did. |
| III. Test-First Development | PASS | This migration preserves and fixes the test suite. All 99 test cases are rewritten with equivalent assertions. Test co-location rule is maintained — all `*.test.ts` files stay next to their source. |
| IV. Single Responsibility | PASS | Jest config has one purpose. Each test file continues to test one module. |
| V. Transparency & Legibility | PASS | Jest APIs (`describe`, `test`, `expect`, `jest.mock()`) are widely known and self-documenting. |
| VI. Layered Architecture | PASS | No changes to application layers. |
| VII. Strong Typing & Schema Validation | PASS | `ts-jest` respects `tsconfig.json` strict mode. `@types/jest` provides full type coverage for test APIs. Path alias rule preserved via `moduleNameMapper`. |

No violations. Complexity Tracking table is empty.

## Project Structure

### Documentation (this feature)

```text
specs/013-migrate-jest-tests/
├── plan.md              # This file
├── research.md          # Phase 0 — ts-jest vs alternatives, decorator support
├── quickstart.md        # Phase 1 — how to write and run tests post-migration
├── spec.md              # Feature specification
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
apps/server/
├── jest.config.ts              # NEW — Jest configuration (ts-jest, path aliases, test match)
├── package.json                # MODIFIED — test script, devDependencies
├── tsconfig.json               # UNCHANGED
└── src/
    ├── auth/
    │   ├── googleVerifier.test.ts   # REWRITTEN
    │   └── sessionJwt.test.ts       # REWRITTEN
    ├── providers/
    │   ├── registry.test.ts         # REWRITTEN
    │   └── mtgjson/
    │       └── mapper.test.ts       # REWRITTEN
    ├── repositories/
    │   ├── cardRepository.test.ts   # REWRITTEN
    │   └── userRepository.test.ts   # REWRITTEN
    ├── routes/
    │   ├── auth.test.ts             # REWRITTEN (key: jest.mock('google-auth-library'))
    │   ├── cards.test.ts            # REWRITTEN
    │   ├── docs.test.ts             # REWRITTEN
    │   ├── health.test.ts           # REWRITTEN
    │   ├── login.test.ts            # REWRITTEN
    │   └── provider.test.ts         # REWRITTEN
    └── services/
        ├── authService.test.ts      # REWRITTEN
        └── cardService.test.ts      # REWRITTEN
```

**Structure Decision**: No new directories. Tests remain co-located with source files per Constitution Principle III. The only new file is `jest.config.ts` at the workspace root.

## Complexity Tracking

> No violations to justify. Table is empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
