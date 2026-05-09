# Feature Specification: Migrate Server Test Framework to Jest

**Feature Branch**: `013-migrate-jest-tests`
**Created**: 2026-04-11
**Status**: Draft
**Input**: User description: "migrate server testing framework to Jest and rewrite the unit tests."

## Background

The `apps/server` package currently uses Node's built-in `node:test` runner with `tsx` for TypeScript transformation. A fundamental incompatibility between `tsx`, CommonJS (`"module": "CommonJS"` in tsconfig), and `--experimental-test-module-mocks` means third-party module mocking silently fails across the entire test suite. `mock.module()` is registered but never invoked — the spy is never called and the real module is always used. This is documented in `apps/server/docs/module-mocking.md`.

Jest has reliable module mocking that works correctly with TypeScript regardless of module format, making it the chosen replacement.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Developer can run all tests with Jest (Priority: P1)

A developer runs the test suite and all 14 test files execute successfully under Jest with a single command, producing the same coverage and assertions as before.

**Why this priority**: Unblocks the entire test suite. No tests are currently verifiable due to broken module mocking — this restores confidence in the suite as a whole.

**Independent Test**: Can be fully tested by running `pnpm test` in `apps/server` and observing all tests pass.

**Acceptance Scenarios**:

1. **Given** Jest is installed and configured, **When** the developer runs `pnpm test` in `apps/server`, **Then** all 14 test files are discovered and executed, reporting pass/fail per test.
2. **Given** the test suite runs, **When** any single test fails, **Then** Jest reports the failing test name, file, and assertion detail clearly.
3. **Given** the test suite runs, **When** all tests pass, **Then** the exit code is `0`.

---

### User Story 2 — Third-party module mocking works reliably (Priority: P1)

A developer writing a test that depends on `google-auth-library` (or any other third-party module) can mock that module and verify their mock is actually called.

**Why this priority**: This is the root cause of the migration. If mocking still fails after the migration, the migration has not solved the problem.

**Independent Test**: Can be fully tested by running `auth.test.ts` in isolation and verifying the `OAuth2Client` spy's call count is greater than zero after a sign-in request.

**Acceptance Scenarios**:

1. **Given** a test mocks `google-auth-library` with `jest.mock()`, **When** code that calls `OAuth2Client.verifyIdToken()` is exercised, **Then** the mock implementation is invoked, not the real Google SDK call.
2. **Given** a Jest mock is set up before the module under test is imported, **When** the module under test is imported, **Then** it receives the mocked dependency.
3. **Given** a mock spy is configured, **When** the test assertion checks spy call data, **Then** the call count reflects the real number of invocations.

---

### User Story 3 — Existing test assertions and coverage are preserved (Priority: P2)

All existing test assertions from the 14 `node:test` test files are rewritten to equivalent Jest assertions, with no reduction in what is tested.

**Why this priority**: The migration must not silently drop coverage. Every assertion that was correct in the old framework must exist in the new one.

**Independent Test**: Can be fully tested by comparing the test case count between old and new implementations and running the full suite.

**Acceptance Scenarios**:

1. **Given** a test file previously had N named test cases, **When** the Jest rewrite is complete, **Then** the rewritten file contains at least N equivalent test cases.
2. **Given** a test was checking an HTTP response status code, **When** rewritten in Jest, **Then** the same status code is asserted with an equivalent Jest matcher.
3. **Given** the auth test relies on a real database for integration-style setup, **When** rewritten in Jest, **Then** the same setup and teardown logic is preserved using `beforeAll`/`afterAll`.

---

### Edge Cases

- What happens when a test file imports a module that itself imports `google-auth-library` statically — does Jest's automatic mock hoisting handle it correctly?
- How does Jest resolve the `@src/*` TypeScript path aliases defined in `tsconfig.json`?
- What happens when tests share module-level state (e.g., a singleton Fastify instance or DataSource) — does Jest's module isolation cause unexpected resets between test files?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `apps/server` package MUST use Jest as its test runner, replacing `node:test`.
- **FR-002**: Jest MUST be configured to handle TypeScript files in `apps/server/src/` without a prior build step.
- **FR-003**: Jest MUST resolve TypeScript path aliases (`@src/*`) to match the paths declared in `tsconfig.json`.
- **FR-004**: All 14 existing test files MUST be rewritten using Jest APIs (`describe`, `test`/`it`, `expect`, `beforeAll`, `afterAll`, `beforeEach`, `afterEach`, `jest.mock()`).
- **FR-005**: `jest.mock('google-auth-library', ...)` MUST intercept the module before the module under test is evaluated, so spy call counts correctly reflect actual invocations.
- **FR-006**: The `test` script in `apps/server/package.json` MUST invoke Jest.
- **FR-007**: Jest MUST be installed as a `devDependency`; the `--experimental-test-module-mocks` flag MUST be removed from the test script.
- **FR-008**: All previously existing assertions MUST be preserved in the rewritten tests with semantically equivalent Jest matchers.
- **FR-009**: Tests that use a real database (TypeORM + PostgreSQL) for integration-level setup MUST continue to use that same setup — no in-memory fakes unless the original test already used one.

### Key Entities

- **Test file**: One of the 14 `*.test.ts` files under `apps/server/src/` — each maps one-to-one to a source module and must be rewritten.
- **Jest configuration**: A `jest.config.ts` (or equivalent) in `apps/server/` defining the transformer, module name mapper, test match pattern, and test environment.
- **Module mock**: A `jest.mock('<module-path>', factory)` call that replaces a dependency before the module under test loads it, used specifically for `google-auth-library`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 14 test files run to completion under Jest with zero failures on a clean checkout.
- **SC-002**: The `google-auth-library` mock spy in `auth.test.ts` reports a call count of at least 1 after a sign-in request is exercised — confirming the mock is active and not silently bypassed.
- **SC-003**: The total number of named test cases in the rewritten suite is equal to or greater than the count in the original `node:test` suite.
- **SC-004**: Running `pnpm test` in `apps/server` completes without requiring any manual pre-build or environment setup beyond what already existed.
- **SC-005**: No `node:test` or `node:assert` imports remain in any test file after the migration.
