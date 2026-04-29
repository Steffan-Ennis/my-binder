# Node.js `mock.module()` and Static Imports

## How `mock.module()` works

`mock.module()` (enabled via `--experimental-test-module-mocks`) patches the module cache so that future evaluations of a module get the mocked version. It **does** work after the target module has been loaded — the key requirement is that the **consumer** of the mocked module must not yet have been evaluated.

From the Node.js docs example:
1. Import `bar.mjs` (now cached)
2. Call `mock.module('./bar.mjs', ...)` — patches the cache
3. Dynamically import `foo.mjs` **for the first time** — it evaluates fresh, resolves `bar.mjs` from the mocked cache, and picks up the mock

## The static import trap

If the consumer of the mocked module is already cached via a **static import** before `mock.module()` runs, the mock has no effect.

Static imports are hoisted and resolved before any module-level code executes. So in a test file like:

```ts
import { SomeError } from '@src/services/authService'; // static — loads the full module graph
// ...
mock.module('google-auth-library', { ... });           // too late — authService + googleVerifier already cached
// ...
const { signIn } = await import('@src/services/authService'); // returns the cache, not a fresh evaluation
```

The static import of `authService` pulls in `googleVerifier.ts`, which pulls in `google-auth-library` — all before `mock.module()` runs. The subsequent dynamic import of `authService` just returns the cached module; it is never re-evaluated, so `googleVerifier.ts` keeps its original binding to the real `OAuth2Client`.

## The fix

Remove any static import that causes the consumer to be cached before the mock is applied. If you only need a type or error class from a module, either redefine it locally or import only the type (which is erased at runtime):

```ts
import type { SomeError } from '@src/services/authService'; // type-only, erased at runtime — safe
```

Then the dynamic import after `mock.module()` will evaluate `authService.ts` for the first time and pick up the mock.

## Secondary pitfall: wrong export name

Ensure the export name in `namedExports` exactly matches what the module under test imports. A case mismatch (e.g. `Oauth2Client` vs `OAuth2Client`) means the mock export is registered under the wrong name and the real binding is left unchanged.

## Fundamental incompatibility: tsx + CommonJS + `--experimental-test-module-mocks`

Even after correctly ordering all dynamic imports, `mock.module()` may still silently fail to intercept 3rd party module imports. This is a structural incompatibility between three things used together:

- `--import tsx` — tsx registers ESM loader hooks that wrap Node's module loading pipeline
- `"module": "CommonJS"` in tsconfig — TypeScript compiles dynamic `import('x')` to `Promise.resolve().then(() => require('x'))`
- `--experimental-test-module-mocks` — hooks into Node's module system to intercept loads

tsx's loader hooks process module resolution before `--experimental-test-module-mocks` can intercept them, or tsx's internal module cache bypasses Node's standard hooks entirely. The result is that `mock.module()` is registered but never invoked — the spy is never called and the real module is always used.

This is not a fixable import-ordering problem. It affects **any** 3rd party module mock across the entire test suite and makes `node:test`'s module mocking unreliable for this stack.

### Resolution — Migrated to Jest (spec 013)

The test framework was migrated from `node:test` to **Jest 30 + ts-jest 29**. Jest's `jest.mock()` is automatically hoisted before any imports execute, which eliminates the tsx/CommonJS/loader-hook incompatibility entirely.

The `jest.mock()` pattern that replaced `mock.module()`:

```ts
// jest.mock() is hoisted above all imports — the mock is in place
// before any consumer module evaluates.
jest.mock('google-auth-library', () => {
  const mockVerifyIdToken = jest.fn();
  function OAuth2Client() {}
  OAuth2Client.prototype.verifyIdToken = mockVerifyIdToken;
  return { OAuth2Client };
});

// Static imports work correctly — googleVerifier.ts receives the mocked OAuth2Client
import { signIn } from '@src/services/authService';
```

No dynamic imports, no import ordering constraints, no `--experimental-test-module-mocks` flag required.
