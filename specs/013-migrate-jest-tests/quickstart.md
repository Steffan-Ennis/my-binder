# Quickstart: Jest Test Framework in apps/server

**Date**: 2026-04-11
**Feature**: 013-migrate-jest-tests

## Running Tests

```bash
# Run all tests
cd apps/server
pnpm test

# Run a single test file
pnpm test -- src/routes/auth.test.ts

# Run tests matching a name pattern
pnpm test -- --testNamePattern="POST /auth/google"

# Run in watch mode during development
pnpm test -- --watch
```

## Writing a New Test

Create a `*.test.ts` file next to the source file it tests (Constitution Principle III):

```ts
// src/services/myService.test.ts
import { myFunction } from '@src/services/myService';

describe('myFunction', () => {
  test('returns expected value', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

## Mocking a Third-Party Module

`jest.mock()` is automatically hoisted before imports — no dynamic imports needed:

```ts
import { signIn } from '@src/services/authService';

jest.mock('google-auth-library', () => {
  const verifyIdTokenMock = jest.fn();
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: verifyIdTokenMock,
    })),
  };
});

describe('signIn', () => {
  test('calls verifyIdToken', async () => {
    // The mock is already in place when authService loads
    await signIn('some-token');
    // Assert against mock...
  });
});
```

## Mocking an Internal Module

```ts
import { getCardRepository } from '@src/db/repositories';

jest.mock('@src/db/repositories', () => ({
  getCardRepository: jest.fn(),
  getUserRepository: jest.fn(),
}));

const mockGetCardRepo = getCardRepository as jest.Mock;

beforeEach(() => {
  mockGetCardRepo.mockReturnValue({
    find: jest.fn().mockResolvedValue([]),
  });
});
```

## Lifecycle Hooks

| node:test | Jest |
|-----------|------|
| `before(fn)` | `beforeAll(fn)` |
| `after(fn)` | `afterAll(fn)` |
| — | `beforeEach(fn)` |
| — | `afterEach(fn)` |

## Assertion Cheat Sheet

| node:assert | Jest |
|-------------|------|
| `assert.equal(a, b)` | `expect(a).toBe(b)` |
| `assert.deepStrictEqual(a, b)` | `expect(a).toEqual(b)` |
| `assert.ok(v)` | `expect(v).toBeTruthy()` |
| `assert.throws(fn)` | `expect(fn).toThrow()` |
| `assert.rejects(fn)` | `await expect(fn).rejects.toThrow()` |
| `assert.match(s, /re/)` | `expect(s).toMatch(/re/)` |

## End-to-End Success Criteria

1. `pnpm test` in `apps/server` exits with code 0
2. All 99+ named test cases pass
3. `auth.test.ts` mock spy for `google-auth-library` reports call count >= 1 after sign-in request
4. No `node:test` or `node:assert` imports remain in any test file
