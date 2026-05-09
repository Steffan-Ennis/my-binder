# Research: Migrate Server Test Framework to Jest

**Date**: 2026-04-11
**Feature**: 013-migrate-jest-tests

## R1: TypeScript Transformer — ts-jest vs @swc/jest vs tsx

### Decision: ts-jest

### Rationale
- `ts-jest` reads `tsconfig.json` directly, inheriting `experimentalDecorators: true` and `emitDecoratorMetadata: true` — both required by TypeORM entities used in test setup (e.g., `auth.test.ts` imports `UserEntity`, `AllowedUserEntity`).
- `@swc/jest` is faster but requires separate SWC config for decorator metadata emission. SWC's decorator support has historically lagged behind TypeScript's, adding risk for no functional gain on a suite this small (99 tests).
- Continuing to use `tsx` (via a custom Jest transformer) is possible but reintroduces the exact loader hook conflicts that caused the mocking failure. Rejected outright.

### Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| `ts-jest` | Reads tsconfig directly; decorator metadata works out of the box; well-maintained | Slower than SWC (marginal for 99 tests) |
| `@swc/jest` | Faster transformation | Requires separate `.swcrc` for decorator metadata; additional config surface |
| Custom tsx transformer | Reuses existing tsx setup | Reintroduces the exact loader hook problem we're migrating away from |

---

## R2: Path Alias Resolution in Jest

### Decision: `moduleNameMapper` in jest.config.ts

### Rationale
The project uses two path aliases (`@src/*` → `./src/*`, `@root/*` → `./*`) defined in `tsconfig.json`. `ts-jest` does not resolve these automatically — Jest's `moduleNameMapper` must be configured:

```ts
moduleNameMapper: {
  '^@src/(.*)$': '<rootDir>/src/$1',
  '^@root/(.*)$': '<rootDir>/$1',
}
```

An alternative is `pathsToModuleNameMapper` from `ts-jest` which reads paths directly from tsconfig. Either approach works; the explicit mapper is clearer and avoids an import from ts-jest in the config.

### Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| Explicit `moduleNameMapper` | Simple, no extra imports, intent is clear | Must be updated if tsconfig paths change |
| `pathsToModuleNameMapper(tsconfig.paths)` | Auto-syncs with tsconfig | Adds import and parsing in config; marginal benefit for 2 aliases |

---

## R3: jest.mock() Hoisting and Static Imports

### Decision: Use `jest.mock()` at top of file; no dynamic imports required

### Rationale
Jest automatically hoists `jest.mock()` calls to the top of the file before any imports execute. This is the opposite of `node:test`'s `mock.module()`, which must be called before the consumer module is cached.

With Jest:
```ts
import { signIn } from '@src/services/authService'; // static import — fine
jest.mock('google-auth-library', () => ({ ... }));   // hoisted before import executes
```

The mock is in place before `authService` evaluates, so `googleVerifier.ts` receives the mocked `OAuth2Client`. No dynamic imports needed. This directly resolves the root cause documented in `apps/server/docs/module-mocking.md`.

---

## R4: API Mapping — node:test to Jest

### Decision: Direct mechanical mapping

| `node:test` / `node:assert` | Jest equivalent |
|------------------------------|-----------------|
| `describe(name, fn)` | `describe(name, fn)` (identical) |
| `test(name, fn)` | `test(name, fn)` (identical) |
| `before(fn)` | `beforeAll(fn)` |
| `after(fn)` | `afterAll(fn)` |
| `mock.fn()` | `jest.fn()` |
| `mock.module(specifier, opts)` | `jest.mock(specifier, factory)` |
| `mockInstance.mock.callCount()` | `mockInstance.mock.calls.length` |
| `mockInstance.mock.resetCalls()` | `mockInstance.mockClear()` |
| `mockRef.restore()` | `jest.restoreAllMocks()` / `jest.resetModules()` |
| `assert.equal(a, b)` | `expect(a).toBe(b)` |
| `assert.deepStrictEqual(a, b)` | `expect(a).toEqual(b)` |
| `assert.ok(v)` | `expect(v).toBeTruthy()` |
| `assert.strictEqual(a, b)` | `expect(a).toBe(b)` |
| `assert.throws(fn, Error)` | `expect(fn).toThrow(Error)` |
| `assert.rejects(fn, Error)` | `await expect(fn).rejects.toThrow(Error)` |
| `assert.match(str, regex)` | `expect(str).toMatch(regex)` |

### Notes
- `describe` and `test` are identical — only lifecycle hooks and assertions change.
- `mock.module()` namedExports format differs from `jest.mock()` factory format. The factory must return an object with the exports.
- Tests using `mock.fn()` for creating inline spies translate directly to `jest.fn()`.

---

## R5: TypeORM Decorator Support

### Decision: ts-jest inherits tsconfig decorator settings; no additional config

### Rationale
`auth.test.ts` imports `UserEntity` and `AllowedUserEntity` which use TypeORM decorators (`@Entity`, `@Column`, `@PrimaryGeneratedColumn`). These require `experimentalDecorators: true` and `emitDecoratorMetadata: true` in the TypeScript compiler.

`ts-jest` uses the project's `tsconfig.json` by default, which already has both flags enabled. No additional configuration needed.

The `reflect-metadata` import required by TypeORM at runtime must be available. The server's source code already imports it; tests that initialize a DataSource will trigger this import chain naturally.

---

## R6: Jest Test Environment

### Decision: `node` (default)

### Rationale
All tests are server-side (Fastify HTTP injection, TypeORM, pure logic). No DOM or browser APIs are used. Jest's default `node` environment is correct. No `testEnvironment` override needed in config.

---

## R7: mock.module() for Internal Modules (@src/db/repositories)

### Decision: Use `jest.mock('@src/db/repositories', ...)` with factory

### Rationale
Five test files mock `@src/db/repositories` using `mock.module()`. In Jest, this becomes:

```ts
jest.mock('@src/db/repositories', () => ({
  getCardRepository: jest.fn(),
  getUserRepository: jest.fn(),
}));
```

Jest's `moduleNameMapper` resolves `@src/db/repositories` to the real file path, and `jest.mock()` intercepts it before any consumer imports it. The factory function returns the mock exports.

For tests that need to change mock return values between test cases, `jest.fn().mockReturnValue(...)` or `jest.fn().mockImplementation(...)` can be set in `beforeEach` blocks.
