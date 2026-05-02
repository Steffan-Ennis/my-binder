<!--
SYNC IMPACT REPORT
==================
Version change: 1.16.0 → 1.17.0
Bump type: MINOR — materially expands Principle III (Test-First Development)
  with a new sub-rule defining the **Phase completion validation gate**:
  every phase declared in a feature's `tasks.md` (Setup, Foundational, each
  User Story, Polish) MUST run the affected workspaces' full Jest suite and
  report a 100% pass rate before the phase is marked complete. Failing
  tests MUST be investigated at root cause — bleeding state, shared
  modules, leaky timers, unawaited promises, fixture ordering — and fixed
  in-place. Skip/`.todo`/quarantine/retry-until-green workarounds are
  prohibited.

  The rule complements — it does not replace — the existing co-location,
  Jest-only, and Unit Testing Phase rules already encoded in Principle III.
  No principle is removed or redefined.

Last amended: 2026-05-02

Modified principles:
  - III. Test-First Development — added the **Phase completion validation
    gate** sub-section after the existing "Test co-location rule".
    Per-workspace Jest preset table, Plan requirement, and co-location
    rule are unchanged.

Added sections / material expansions:
  - Principle III → "Phase completion validation gate" (new sub-section
    with allowed/prohibited remediation patterns and rationale).

Removed sections:
  (none)

Templates reviewed:
  ✅ .specify/templates/plan-template.md  — No change required (Unit
     Testing Phase already enumerates test files; the gate runs them).
  ✅ .specify/templates/spec-template.md  — No change required.
  ✅ .specify/templates/tasks-template.md — UPDATED: every "Checkpoint"
     marker now explicitly cites the phase-completion validation gate
     and references this principle.
  ⚠ CLAUDE.md — No change required. Active Technologies and scripts
     already cover `turbo test`; the gate is a process rule, not a
     tooling change.

Known violations to remediate (⚠ pending):
  (none — this is a forward-looking process rule. It applies to phases
  declared on or after 2026-05-02; previously-shipped phases are not
  retroactively in breach.)

Carry-over from 1.15.0 (unchanged):
  ⚠ apps/mobile/package-lock.json — npm lockfile from the create-expo-app
     bootstrap. MUST be deleted and the workspace re-resolved via
     `pnpm install` before merge.
  ⚠ apps/mobile/tsconfig.json — currently declares `paths: { "@/*": ["./*"] }`;
     Principle VII requires `@root/*` and `@src/*` aliases.
  ⚠ apps/mobile/hooks/{use-color-scheme.ts,use-color-scheme.web.ts,
     use-theme-color.ts}, apps/mobile/scripts/reset-project.js,
     apps/mobile/app/modal.tsx — leftover create-expo-app template files
     outside the Principle X four-layer structure.

Carry-over from 1.14.0 (unchanged):
  ⚠ specs/001-server-architecture/plan.md — JSDoc → TypeScript migration.
  ⚠ specs/004-card-data-provider/plan.md — JSDoc → TypeScript migration.

Deferred TODOs:
  (none)
-->

# my-binder Constitution

## Core Principles

### I. Simplicity First

This is a personal project. The minimum complexity needed to solve the problem IS the right
complexity. Features MUST NOT be added speculatively — YAGNI governs all design decisions.
Abstractions MUST earn their place by eliminating real, present duplication; hypothetical
future requirements are not sufficient justification. When two approaches exist, the simpler
one MUST be chosen unless a concrete, documented reason demands otherwise.

### II. Data Integrity

Card collection data is the primary asset of this application. The system MUST never silently
lose or corrupt card records. All write operations MUST validate input before persistence.
Any change to the data schema MUST be accompanied by a documented migration path. Destructive
operations MUST require explicit confirmation.

### III. Test-First Development

Tests MUST be written before implementation code (Red-Green-Refactor). A feature is not
considered complete until its automated tests pass. The `main` branch MUST remain green at
all times. No code reaches `main` without a corresponding test exercising its primary
behaviour.

**Test framework**: **Jest** is the chosen unit testing library across every workspace in
the monorepo. New unit and integration tests MUST be written with Jest. TypeScript sources
MUST be compiled with `ts-jest`. Alternative Jest-compatible runners (Vitest, Mocha, AVA,
node:test) are NOT permitted — alignment on a single tool eliminates configuration drift
between workspaces and keeps coverage tooling, mocking conventions, and CI invocation
identical everywhere.

The per-workspace Jest presets are pinned as follows:

- **`apps/server`**: `ts-jest` (Node test environment).
- **`apps/mobile`**: **`jest-expo`** preset (SDK 54-compatible release), with
  **`@testing-library/react-native` 13.x** for view rendering and `renderHook` for hook
  tests.
- **`packages/core`**: `ts-jest` (Node test environment); pure TypeScript module under test.

Switching any of the above to a different preset or test library requires a fresh
constitution amendment.

**Plan requirement**: Every feature plan (`specs/<feature>/plan.md`) MUST include an
explicit **Unit Testing Phase** section that identifies:

- Which Jest test files will be created or updated, with full paths.
- The behaviours each test file will cover (one bullet per behaviour, mapped back to the
  feature's functional requirements where applicable).
- A coverage target for the new code introduced by the feature (line and branch
  percentages, expressed as a Jest `coverageThreshold` or equivalent).

A plan that omits the Unit Testing Phase MUST NOT proceed to task generation
(`/speckit.tasks`). The Unit Testing Phase complements — but does not replace — Phase 0
research or Phase 1 design artifacts.

**Test co-location rule**: Unit and integration tests MUST live in the same directory as
the file they test, named `<filename>.test.ts`. For example, `src/services/cardService.ts`
MUST be tested by `src/services/cardService.test.ts`. The only exception is **E2E tests**,
which MUST live in a dedicated `tests/e2e/` directory at the workspace root (since they
exercise the full system, not a single file). No other `tests/` directories are permitted.

Rationale: co-located tests are discovered immediately alongside the code they cover, making
it obvious when a file has no test and preventing tests from becoming detached from the module
they exercise when files are moved or renamed. Pinning Jest as the single test runner avoids
the per-workspace tooling drift (separate matchers, separate mocks, separate coverage
formats) that accumulates when each package picks its own framework. Requiring an explicit
Unit Testing Phase in every plan makes the test surface visible at design time rather than
at implementation time, when scope creep has already happened.

**Phase completion validation gate**: every phase declared in a feature's
`tasks.md` (Setup, Foundational, each User Story, and Polish) MUST be validated by
running the affected workspaces' full Jest suite **and reporting a 100% pass rate**
before the phase is marked complete. The phase's "Checkpoint" line in `tasks.md` is
not satisfied until:

```bash
turbo test --filter=<workspace>      # MUST exit 0 — every test passing
turbo typecheck --filter=<workspace> # MUST exit 0
```

…both succeed across every workspace touched by the phase. A phase that finishes
with even one failing test is incomplete by definition.

A failing test MUST be treated as a signal, not a nuisance, and MUST be investigated
at root cause before the phase advances. Common, non-exhaustive root causes that the
investigator MUST rule out:

- **Bleeding state** between tests — a shared module, a process-level singleton, a
  store left mutated by a previous test, a Jest module-cache survivor, a Zustand
  store with no `beforeEach` reset.
- **Leaky async work** — unawaited promises, timers/intervals not cleaned up,
  subscriptions not unsubscribed, fetches still in flight when the test exits.
- **Fixture ordering** — tests passing only when run in a specific order, or only
  when run in isolation; usually a symptom of bleeding state.
- **Real defects** — the test is correctly catching a regression in code under
  test, or surfacing a pre-existing bug that was previously masked.
- **Test-environment issues** — `jest-expo` / `ts-jest` config drift, mock
  hoisting bugs, transformer order, Node version mismatch.

The acceptable remediations are:

- **Fix the regression** in the code under test if the failure is correct.
- **Fix the test** if the assertion no longer matches the corrected behaviour.
- **Fix the bleed** at source — add a `beforeEach` reset, a shared `afterAll`
  cleanup, a fresh `QueryClient` per test, a `jest.resetModules()`, or
  whatever isolates the failing test from its predecessors.
- **Open a follow-up task and skip the phase exit** if the failure exposes a
  real defect that is genuinely out of scope for the current phase. The phase
  cannot exit while the test is red — it MUST be either fixed in this phase
  or rewritten to assert the corrected (already-shipped) behaviour. Carving
  the bug out into a separate, tracked work item is allowed; advancing past
  it with a still-failing assertion is not.

The prohibited remediations are:

- `it.skip(...)` / `it.todo(...)` / `xit(...)` / `describe.skip(...)` to silence
  the failure.
- Quarantining the test into a separate "flaky" suite that is excluded from
  the phase gate.
- Re-running until green ("flaky test, will retry") — a non-deterministic
  test is a defect, not a fact of life.
- Adding `setTimeout` / `await sleep(N)` to mask a race condition rather than
  awaiting the actual signal.
- Wrapping the assertion in `try { expect(...) } catch {}` or downgrading
  `expect` to `console.warn`.
- Lowering coverage thresholds to make the phase pass.

Rationale: the moment a single failing test is allowed past a phase boundary,
every subsequent phase inherits a degraded signal — "is this test failure new,
or was it already failing?" becomes ambiguous, and bisecting a regression
across multiple phases costs hours that the gate was supposed to save. State
bleeding is the most common and most pernicious cause of intermittent failures;
the bleed is always present, and "passes when re-run" only means the bleed
happens to clear in time on the second run. Treating every failure as a
must-fix root-cause investigation keeps test signal trustworthy and prevents
the gradual accumulation of `.skip`-blocks that turn a green CI badge into a
lie.

### IV. Single Responsibility

Each module, function, or file MUST have one clear, narrow purpose. Card domain logic MUST be
separated from I/O, rendering, and persistence concerns. Cross-cutting coupling between
unrelated modules is not permitted without explicit written justification in the relevant
plan or PR.

### V. Transparency & Legibility

Code MUST be readable by someone unfamiliar with the project. Identifier names MUST describe
intent, not implementation detail. Magic literals MUST be replaced by named constants.
Comments MUST explain *why*, not *what* — the code itself conveys the what.

### VI. Layered Architecture

The system is composed of four distinct layers: **Mobile App → API Server → Database** and
**API Server → Card Data Provider**. Each layer MUST communicate only with its immediately
adjacent layer. Specifically:

- The mobile app MUST NOT call the card data provider or the database directly.
- The API server is the sole integration point between the mobile app, the database, and
  any external card data provider.
- Card data sources MUST be accessed through a provider abstraction interface — never
  hard-coded to a specific external service. MTGJSON is the current default provider;
  switching providers MUST require only a configuration change, not a code change.
- New external integrations MUST be introduced as providers behind this abstraction, not
  as direct calls embedded in business logic.

Rationale: layer integrity keeps the mobile app deployable independently of provider changes,
makes the system testable at each boundary, and ensures no single external dependency can
cascade failures across all layers.

### VII. Strong Typing & Schema Validation

All source code MUST be written in TypeScript with `strict` mode enabled (`noImplicitAny`,
`strictNullChecks`, `strictFunctionTypes` at minimum). The `any` type is prohibited; use
`unknown` and narrow explicitly where the type cannot be determined statically. TypeScript
provides compile-time enforcement; runtime validation at system boundaries is a separate,
additional requirement.

All data crossing a system boundary MUST also be validated against a declared schema at
runtime. Validation MUST occur at every communication point:

- **Server — inbound requests**: every request body and path/query parameter MUST be
  validated against a JSON schema before the handler runs. Requests that fail validation
  MUST be rejected with a `VALIDATION_ERROR` (HTTP 400) before reaching service or
  repository code. TypeScript types alone are insufficient here — types are erased at
  runtime.
- **Server — outbound responses**: response shapes MUST conform to a declared schema at
  serialisation time. No ad-hoc or unchecked objects may be returned to clients.
- **Mobile — inbound API responses**: every API response MUST be validated against the
  expected schema before the data is passed to application logic or persisted locally. A
  response that does not match the expected shape MUST be treated as an error.
- **Mobile — data persistence**: data MUST be validated before it is written to local storage
  or the local database.

Schema definitions MUST be co-located with the code that owns the boundary and kept in sync
with `data-model.md` and the relevant contract documents. Shared schemas and types MUST live
in `packages/core` and MUST NOT be duplicated across workspaces.

Rationale: TypeScript's type system is erased at runtime. Boundary validation is the runtime
complement to compile-time typing — both are required. Shared types in `packages/core` ensure
mobile and server agree on the same shapes without copy-paste drift.

**Naming rule**: TypeScript type and interface names MUST NOT use Hungarian-style prefixes.
Specifically, the `I` prefix (e.g., `ICardProvider`) is prohibited — names MUST be plain
descriptive nouns (e.g., `CardProvider`). Similarly, suffixes such as `Interface` or `Type`
are not permitted.

**`type` over `interface` rule**: `type` aliases MUST be preferred over `interface` declarations
for all new TypeScript definitions. `interface` is only permitted when declaration merging is
explicitly required (e.g., augmenting a third-party module). All domain types in
`packages/core` and all server/mobile types MUST be declared with `type`.

Rationale: `type` is strictly more expressive than `interface` (it supports unions, intersections,
mapped types, and conditional types that `interface` cannot). Using `type` consistently avoids
the need to decide case-by-case, and eliminates accidental declaration merging which can produce
hard-to-debug type widening.

**File purity rule**: `.ts` and `.js` source files MUST NOT coexist within the same workspace
`src/` directory. Every workspace is either fully TypeScript (`.ts` source, compiled to `dist/`)
or fully JavaScript — never mixed. Import paths inside TypeScript source MUST NOT include `.js`
extensions when using `"module": "CommonJS"` resolution; extensions are only required under
`"module": "NodeNext"` / `"Node16"` ESM resolution. Violating either rule is a constitution
breach requiring explicit justification in the Complexity Tracking table.

**Path alias rule**: Every workspace MUST declare two TypeScript path aliases in its
`tsconfig.json` `compilerOptions.paths`:

- `@root/*` — maps to the package root (e.g., `["./*"]` in `apps/server/tsconfig.json`)
- `@src/*` — maps to the `src/` directory (e.g., `["./src/*"]` in `apps/server/tsconfig.json`)

Aliased paths MUST be used in place of any import that would traverse upward (`../`) out of
the current file's directory. Relative imports (e.g., `./sibling`) are permitted within the
same directory or into a subdirectory. The rule is: if an import path contains `../`, it MUST
be rewritten using `@src/` or `@root/` instead.

```jsonc
// apps/server/tsconfig.json — example
{
  "compilerOptions": {
    "paths": {
      "@root/*": ["./*"],
      "@src/*": ["./src/*"]
    }
  }
}
```

Rationale: upward-traversing relative paths (`../../db/client`) obscure the structural position
of the importing file and break silently when files are moved. Named aliases make every import
self-documenting and refactoring-safe.

### VIII. Error Transparency

Errors MUST never be silently swallowed. Every caught error MUST result in at least one
observable side effect — a log entry, a re-thrown error, a returned error value, or a
recorded metric. Empty catch blocks and `catch { /* ignore */ }` patterns are prohibited.

When a catch block raises a new error to replace the caught one, the original error MUST
be logged before the new error is thrown. This guarantees the original message and stack
trace are preserved in observability tooling even when the wrapper error is what reaches
the caller. Attaching the cause via `Error`'s `cause` option is encouraged but does not
substitute for logging — `cause` survives in memory but is not always serialised by every
logger or transport.

The acceptable patterns are:

- **Re-throw unchanged**: `catch (err) { throw err; }` — original preserved verbatim.
- **Log and continue**: `catch (err) { console.error(err); /* skip and proceed */ }` —
  permitted when failure of one unit must not abort a batch (the rationale MUST be
  documented in a comment or JSDoc).
- **Log and throw a new error**: `catch (err) { console.error(err); throw new MyError('...', { cause: err }); }`
  — the preferred pattern when wrapping is necessary.
- **Catch and return a sentinel**: `catch { return false; }` — permitted only when the
  absence of error is the intended signal (e.g., a liveness probe). The function MUST
  carry a JSDoc note explaining why the error is intentionally discarded.

The prohibited patterns are:

- `catch (err) { /* nothing */ }` — silent swallow.
- `catch (err) { throw new MyError('...'); }` — original error discarded; the wrapper
  reaches the caller stripped of its cause.
- `catch (err) { return null; }` without a JSDoc note explaining the intentional discard.

Rationale: silent failures produce incidents that cannot be diagnosed from logs alone.
Once an error is discarded, the only signal of its existence is downstream symptoms —
usually hours after the cause occurred. Logging the original before any wrapping or
sentinel-return makes post-incident analysis tractable and keeps stack traces intact.

### IX. Public API Discipline

Two rules govern how the public surface of a workspace is documented and where it lives.

**JSDoc rule for services and providers**: Every public function or method of a class
that lives under `apps/*/src/services/` or `apps/*/src/providers/` MUST carry a JSDoc
block. The block MUST include:

- A short description of the function's intent (the *why*, not a restatement of the
  signature).
- An `@param` entry for every parameter. When a parameter is an options object, each
  recognised sub-field MUST also be described (`@param opts.foo - ...`).
- A `@returns` entry describing the return shape and any sentinels (e.g.,
  `CardNotFoundResult`, `false` from a liveness probe).
- A `@throws` entry for every error the function may throw, including the error code
  if one is attached.
- An `@example` block wrapped in triple-backtick fenced TypeScript showing at least
  one realistic call. Multiple `@example` blocks are encouraged when behaviour varies
  across input shapes (e.g., success vs. not-found, with vs. without optional args).

`apps/server/src/providers/mtgjson/index.ts` is the canonical reference for compliant
JSDoc on a provider class. New services and providers MUST adopt this style; existing
ones MUST be backfilled.

Private methods, internal helpers, and type-only files (interfaces, mappers without
behaviour) are exempt unless their behaviour is non-obvious from a one-line comment.

Rationale: services and providers are the contract that the rest of the application
consumes. Examples-in-source make the contract discoverable from an IDE without a
separate reading pass through call sites, and they remain accurate because they sit
next to the implementation they describe.

**Index file purity rule**: Files named `index.ts` (or `index.js`) MUST be reserved
for re-exporting behaviour declared in *other* files within the same directory. They
MUST NOT declare their own classes, functions, types, constants, or runtime values
beyond the re-exports themselves.

- **Permitted in `index.ts`**: `export { Foo } from './foo';`, `export type { Bar } from './bar';`, `export * from './baz';`.
- **Prohibited in `index.ts`**: class/function/type/const declarations, top-level
  computation, side effects, or local helper definitions.

The compliant pattern is `<Symbol>.ts` containing the declaration, with a sibling
`index.ts` containing only the re-exports. For example:

```ts
// apps/server/src/providers/mtgjson/MtgjsonProvider.ts
export class MtgjsonProvider implements CardProvider { /* ... */ }

// apps/server/src/providers/mtgjson/index.ts
export { MtgjsonProvider } from './MtgjsonProvider';
export { mapCardSetToCardRecord } from './mapper';
```

**Carve-out**: an `index.ts` file referenced by `package.json` `main` or `bin` (i.e.,
the application entry-point) is exempt from this rule. Such a file's purpose is to
bootstrap the runtime, not to aggregate exports — `apps/server/index.ts` is the
canonical example. The carve-out applies only to the package-root entry-point; nested
`src/**/index.ts` files MUST follow the purity rule regardless.

Rationale: index files exist to give a directory a single import path. When they also
declare behaviour, the directory has two competing entry points (the index file and
the file the index would otherwise have re-exported), and refactoring becomes
ambiguous — *"where does `MtgjsonProvider` actually live?"* becomes a question with no
single right answer. Keeping declarations in named files and using `index.ts` strictly
as a barrel preserves a single source of truth per symbol.

### X. Component Architecture (Mobile)

**Every UI feature in `apps/mobile` MUST follow the Screen → Container → Hook → View
pattern. This is non-negotiable.** The pattern applies to every component from first
scaffolding onward — there is no "small component" carve-out.

Each feature lives in its own directory under `src/components/<feature-name>/` and
consists of exactly three files:

```
apps/mobile/src/components/<feature-name>/
├── <Feature>Container.tsx   ← orchestration: calls hook, passes named props to view
├── use<Feature>.ts          ← business logic: state, effects, store calls, handlers
└── <Feature>View.tsx        ← pure JSX: props-only, no store/service imports
```

Screens (Expo Router route files) live under `apps/mobile/app/` at the workspace root.
Each route file is a navigation entry point only — it MUST render exactly one container
and contain no other logic. The default export MUST be a function component with no
local state, declared per the Component declaration rule below:

```tsx
// apps/mobile/app/login.tsx
import { FC } from 'react';
import { LoginContainer } from '@src/components/login/LoginContainer';

const Login: FC = () => <LoginContainer />;
export default Login;
```

Layout files (`apps/mobile/app/**/_layout.tsx`) are permitted to declare the route
hierarchy (e.g., `<Stack />`) and to enforce auth gates with `<Redirect />`, but they
MUST NOT host feature business logic. An auth-gate layout like
`app/(authenticated)/_layout.tsx` may consume `useSession()` and render
`<Redirect href="/login" />` when the session is inactive — this is the canonical
Expo Router pattern and counts as Screen-layer behaviour.

**Layer rules.** Each layer has a fixed responsibility and a fixed list of forbidden
imports. Any import that violates the "Forbidden" column is a constitution breach
requiring justification in the relevant plan's Complexity Tracking table.

| Layer | Location | Responsibility | Forbidden |
|---|---|---|---|
| Screen (route file) | `apps/mobile/app/**/*.tsx` (Expo Router) | Navigation entry point — renders a single container | State, `useState`, `useEffect`, store imports, JSX beyond a single container element |
| Layout (route layout) | `apps/mobile/app/**/_layout.tsx` (Expo Router) | Declare route hierarchy (`<Stack />`, `<Tabs />`) and auth gates (`<Redirect />`) | Feature business logic, view JSX beyond router primitives, direct service calls |
| Container | `src/components/<feature>/<Feature>Container.tsx` | Call hook, destructure result, pass individual named props to the view | Business logic, store imports, service calls, `useState`, `useEffect` |
| Hook | `src/components/<feature>/use<Feature>.ts` | All state, effects, store calls, side-effecting handlers; returns a typed result object | JSX, direct DOM/native API access (use a sub-hook or service) |
| View | `src/components/<feature>/<Feature>View.tsx` | Pure JSX rendering of received props; presentational only | Store imports, service imports, navigation imports, `Alert`, `useState`, `useEffect`, `useReducer` |
| Shared hook | `src/hooks/` | Cross-feature hooks (e.g. `useInference`) | JSX |
| Utility | `src/utils/` | Pure functions (format, parse, math) | React, hooks, JSX, side effects |

**Component declaration rule.** Every functional React component in `apps/mobile`
— Screen, Container, and View — MUST be declared as a `const` arrow function
typed with React's `FC` generic from `react`. Components that render
`children` MUST use `FC<PropsWithChildren<...>>` (importing
`PropsWithChildren` from `react`). Bare-function declarations
(`function Foo(props: FooProps) { ... }`), untyped arrow components
(`const Foo = (props) => ...`), and ad-hoc `JSX.Element` return-type
annotations on plain functions are prohibited.

The compliant patterns are:

```tsx
// REQUIRED — component without children
import { FC } from 'react';

type CardTileProps = {
  title: string;
  onPress: () => void;
};

const CardTile: FC<CardTileProps> = ({ title, onPress }) => (
  <Pressable onPress={onPress}>
    <Text>{title}</Text>
  </Pressable>
);

export { CardTile };

// REQUIRED — component that renders children
import { FC, PropsWithChildren } from 'react';

type ScreenFrameProps = {
  variant: 'light' | 'dark';
};

const ScreenFrame: FC<PropsWithChildren<ScreenFrameProps>> = ({ variant, children }) => (
  <View style={styles[variant]}>{children}</View>
);

export { ScreenFrame };

// REQUIRED — Screen-layer component with no props
import { FC } from 'react';

const Login: FC = () => <LoginContainer />;
export default Login;
```

The prohibited patterns are:

```tsx
// PROHIBITED — bare function declaration, no FC annotation
function CardTile({ title, onPress }: CardTileProps) {
  return <Pressable onPress={onPress}><Text>{title}</Text></Pressable>;
}

// PROHIBITED — untyped arrow component
const CardTile = ({ title, onPress }) => (
  <Pressable onPress={onPress}><Text>{title}</Text></Pressable>
);

// PROHIBITED — manual JSX.Element annotation in place of FC
const CardTile = ({ title, onPress }: CardTileProps): JSX.Element => (
  <Pressable onPress={onPress}><Text>{title}</Text></Pressable>
);

// PROHIBITED — children inlined into the props type instead of PropsWithChildren
type ScreenFrameProps = {
  variant: 'light' | 'dark';
  children: React.ReactNode;
};
const ScreenFrame: FC<ScreenFrameProps> = ({ variant, children }) => (
  <View style={styles[variant]}>{children}</View>
);
```

Props types MUST follow the `type <Component>Props = { ... }` shape (consistent
with Principle VII's `type` over `interface` rule), MUST live in the same file
as the component they describe, and MUST be named with the literal suffix
`Props` so that `tsc` errors and IDE rename actions stay greppable.
Components without props MUST simply use `FC` without a generic argument
(`const Login: FC = () => ...`); explicit empty-object generics
(`FC<{}>`, `FC<Record<string, never>>`) are not required and add noise.

Rationale: `FC` is the contract surface React's type system already provides
for "this is a component, not just a function that returns JSX." Pinning every
component to that contract gives the codebase a single, greppable shape, makes
the children boundary explicit (PropsWithChildren is a positive declaration
rather than a stray `children` field that may or may not be honoured), and
keeps display names attached for React DevTools without requiring per-component
`.displayName` assignments. Restricting prop types to the `<Component>Props`
naming convention means a type-error message naming `LoginViewProps` always
points at exactly one file, keeping refactor blast radius proportional to the
component being changed.

**Container prop-passing rule.** Containers MUST explicitly destructure the hook
result and pass individual named props to the view. Spread operators applied to a
hook's return value are prohibited:

```tsx
// REQUIRED
const { storageInfo, downloadedModels, handleDownload } = useModelManager();
return (
  <ModelManagerView
    storageInfo={storageInfo}
    downloadedModels={downloadedModels}
    onDownload={handleDownload}
  />
);

// PROHIBITED — hides dependencies, breaks static analysis, masks unused fields
return <ModelManagerView {...useModelManager()} />;
```

Spreading hides the contract between the hook and the view. When the hook adds a
field, a spread silently passes it through; when the hook removes a field, the view
breaks at runtime instead of at `tsc` time. Named props make the data flow visible
at the call site and let TypeScript catch every drift.

**Hook return-value memoisation rule.** Every non-primitive value produced inside
an `apps/mobile` hook (any file under `apps/mobile/src/components/<feature>/
use<Feature>.ts` or `apps/mobile/src/hooks/`) MUST be memoised before it is
returned, passed to a child component, or used as a dependency of another hook.

- **Functions** (event handlers, callbacks, factory functions) MUST be wrapped in
  `useCallback` with an exhaustive dependency array.
- **Objects, arrays, class instances, and any other non-primitive value** MUST be
  wrapped in `useMemo` with an exhaustive dependency array.
- **Primitives** — `string`, `number`, `boolean`, `null`, `undefined`, `bigint`,
  `symbol` — are exempt. Their values are compared by value, so a fresh primitive
  per render is identity-stable when the underlying data is unchanged.

The rule applies regardless of whether the value is returned from the hook,
captured in a closure, or passed downward. Values read directly from a Zustand
selector or TanStack Query result are already reference-stable and do not need
re-wrapping; values *derived* from them (e.g., `data.map(transform)`,
`{ ...query.data, foo }`, `() => mutation.mutate(arg)`) MUST be memoised at the
hook boundary.

The compliant patterns are:

```ts
// REQUIRED — function wrapped in useCallback
import { useCallback, useMemo } from 'react';

const useBinderHome = () => {
  const currentPage = useBinderStore((s) => s.currentPage);             // primitive — exempt
  const cards = useCardsInfiniteQuery();                                 // query result — already stable

  const visibleCards = useMemo(
    () => cards.data?.pages.flatMap((p) => p.items) ?? [],
    [cards.data],
  );                                                                     // derived array — useMemo

  const handleSwipeRight = useCallback(() => {
    useBinderStore.getState().setCurrentPage(currentPage + 1);
  }, [currentPage]);                                                     // function — useCallback

  return { currentPage, visibleCards, handleSwipeRight };
};
```

The prohibited patterns are:

```ts
// PROHIBITED — fresh function reference every render breaks React.memo
//              on the view and re-fires every downstream useEffect.
const useBinderHome = () => {
  const handleSwipeRight = () => {
    /* ... */
  };
  return { handleSwipeRight };
};

// PROHIBITED — fresh array literal every render; the view's FlatList
//              re-keys every row even when `data` is unchanged.
const useBinderHome = () => {
  const cards = useCardsInfiniteQuery();
  return { visibleCards: cards.data?.pages.flatMap((p) => p.items) ?? [] };
};

// PROHIBITED — fresh object literal every render forces every consumer
//              that depends on `config` to recompute.
const useBinderHome = () => {
  return { config: { columns: 3, rows: 3 } };
};
```

Rationale: React compares non-primitive values by reference. A new function,
object, or array on every render forces every consumer to re-render even when
the underlying data has not changed, breaks `React.memo` on the view layer,
breaks the dependency arrays of downstream `useEffect` / `useMemo` /
`useCallback` (turning them into "fire every render" hazards), and amplifies
cost across the four-layer split. Memoising at the hook boundary makes the
hook→container→view contract reference-stable by construction and lets the
`react-hooks/exhaustive-deps` lint rule verify that every dependency is
declared. This rule pairs with the **Container prop-passing rule** above —
named props plus stable references give the view a contract the type system
*and* the React reconciler can both rely on.

**`useEffect` usage discipline.** `useEffect` is an escape hatch for synchronising
React state with **external systems** (browser/native APIs, subscriptions, network
resources, third-party widgets). It MUST NOT be used for any of the following
React-internal concerns:

1. **Computing state from props or other state.** Derive the value in the render
   path or with `useMemo`. An effect that watches `propA` and writes
   `setStateDerivedFromA(transform(propA))` is always wrong — it forces an extra
   render and creates a window where state and props disagree.
2. **Handling user events.** Put the logic in the event handler that triggered it.
   Effects that watch a "clicked" or "submitted" flag and react to it are anti-
   patterns; the navigation, mutation, or notification belongs in the handler
   itself.
3. **Resetting state when props change.** Pass a `key` prop to the component so
   React unmounts and remounts it with fresh state. Effects that compare prop
   values to old values via refs and call `setState` to "reset" duplicate React's
   own machinery.
4. **Notifying parent components of state changes.** Call the parent callback from
   the same handler that mutated the state, not from an effect that watches the
   state. Effect-based notification creates ordering bugs and double-fires when
   the parent re-renders.
5. **Chaining effects to drive other effects.** If effect A's only purpose is to
   trigger effect B, derive the result directly or call both updates from one
   event handler. Each link in the chain adds a render cycle.

`useEffect` IS appropriate for: subscribing to a store outside the React tree,
attaching listeners to a native API, fetching when no framework-provided data hook
is available, and starting/stopping animations bound to mount/unmount.

Two technical rules govern every `useEffect` that does ship:

- **Cleanup is mandatory** for every effect that subscribes, opens a connection,
  schedules a timer, or starts an async operation whose result the component will
  consume. The cleanup function MUST cancel the subscription/timer/operation so a
  fast unmount does not leak handles or call `setState` on an unmounted component.
- **Exhaustive dependencies are mandatory.** The `react-hooks/exhaustive-deps` rule
  MUST be enabled at the lint level. Suppression
  (`// eslint-disable-next-line react-hooks/exhaustive-deps`) is permitted only with
  an adjacent comment naming the invariant that makes the missing dependency safe
  (e.g., "ref is stable across renders", "callback intentionally captures the
  initial value"). Suppression without justification is a constitution breach.

Rationale: the four-layer split makes every component testable in three independent
slices — the hook can be unit-tested with renderHook-style tools (Principle III's
Jest mandate), the view can be snapshot-tested with no providers or store mocks,
and the container is a one-line glue file requiring no test of its own. Spreading
hook results hides the hook→view contract; named props make the data flow visible
and let `tsc` enforce it. The `useEffect` rules cut off the most common React bug
class — effects that fight the render loop and produce stale UI — before it enters
the codebase. These rules align with React's official "You Might Not Need an
Effect" guidance and the canonical React `eslint-plugin-react-hooks` ruleset.

## Technology Stack

The system is a **monorepo** managed with **pnpm workspaces** and **Turborepo**. Each
workspace is built and deployed independently. The repository root is not a deployable unit.

### Repository Structure

```
my-binder/                     # Repo root (private — not published)
├── apps/
│   ├── server/                # Fastify API server (spec 001)
│   └── mobile/                # Mobile app (spec 002)
├── packages/
│   └── core/                  # Shared TypeScript types, schemas, and constants
├── turbo.json                 # Turborepo pipeline definition
├── pnpm-workspace.yaml        # pnpm workspace manifest
└── package.json               # Root package (engines, scripts only)
```

### Workspace Responsibilities

- **`apps/server`**: TypeScript (Node 22) Fastify API server. Compiled with `tsc`; output
  runs on Node 22. Depends on `packages/core`. Node built-ins are preferred over third-party
  packages. Deployed as a Docker container. `tsconfig.json` MUST enable `strict: true`.
- **`apps/mobile`**: TypeScript mobile application targeting iOS 15.1+ and Android API 24+.
  Depends on `packages/core`. `tsconfig.json` MUST enable `strict: true` and declare the
  `@root/*` + `@src/*` path aliases (Principle VII). Framework: **React Native 0.81.5 +
  Expo SDK ~54.0** (managed workflow) on **React 19.1**. Language: **TypeScript ~5.9**.
  Routing: **Expo Router ~6.0** (file-based, built on `@react-navigation/native-stack` 7
  + `@react-navigation/bottom-tabs` 7) — routes live in `apps/mobile/app/` at the
  workspace root. Store artifacts are produced via EAS Build. Test stack: Jest 30 +
  `jest-expo` preset + `@testing-library/react-native` 13.x (per Principle III). The
  workspace layout MUST follow Principle X:
  `apps/mobile/{app,src/{components,hooks,services,stores,utils}}/`. The
  `npx create-expo-app` bootstrap additionally produces template directories
  (`assets/`, `constants/`, `hooks/`, `scripts/`) and an `eslint.config.js` flat
  config at the workspace root; `assets/` and `constants/theme.ts` are sanctioned to
  stay (the design tokens live in `constants/theme.ts`); the rest MUST be merged into
  `src/` per Principle X or deleted. Package manager: **pnpm only** — any
  `package-lock.json` produced by the bootstrap MUST be deleted before merge.
  Switching the framework, routing library, Jest preset, or view-test library
  requires a constitution amendment.
- **`packages/core`**: Shared TypeScript code consumed by both apps. Contains: TypeScript
  interfaces and types, JSON Schema constants (Principle VII), and named constants (error
  codes, status values). MUST NOT contain application-specific business logic. MUST NOT
  depend on `apps/*`. Compiled to CommonJS + ESM with declaration files (`.d.ts`).

### Build Tooling

- **TypeScript**: All source files are `.ts`. `tsc` compiles each workspace independently.
  `tsconfig.json` at each workspace root; a root `tsconfig.base.json` provides shared
  compiler settings. `strict: true` is non-negotiable and MUST NOT be disabled or
  selectively suppressed with `@ts-ignore` or `as any` casts without documented justification
  in the relevant plan or PR.
- **pnpm**: Package manager for all workspaces. `pnpm-lock.yaml` is the canonical lock file.
  Direct `node_modules` manipulation outside of pnpm is prohibited.
- **Turborepo**: Task orchestration. `turbo.json` defines the task dependency graph. Tasks:
  `build` (tsc), `test`, `dev`, `typecheck` (tsc --noEmit). Turborepo ensures `packages/core`
  is built before dependents. Remote cache MAY be used to skip unchanged workspaces in CI.
- Apps are deployed separately: `apps/server` deploys as a Docker container; `apps/mobile`
  deploys via the platform app store pipeline.

### Other Stack Components

- **Database**: DuckDB (embedded, file-based). Lives in `apps/server`. The `.duckdb` file is
  persisted via Docker volume mount at `DB_PATH`. No separate database container.
- **Card Data Provider**: MTGJSON is the default provider. Provider abstraction (Principle VI)
  must be in place before any provider-specific code is written. Lives in `apps/server`.
- **Containerisation**: `apps/server` MUST run as a self-contained container. No secrets may
  be baked into container images; all runtime configuration MUST be supplied via environment
  variables. `apps/mobile` is not containerised.

## Development Workflow

All changes merged to `main` MUST pass the full test suite and `tsc --noEmit` across all
workspaces. Features are developed on branches and integrated via pull request. Commits MUST
be atomic and their messages MUST describe the intent of the change (not just the mechanism).
Breaking changes to card data structures MUST include a documented migration path before
merging.

### Feature Design Documentation

Every feature MUST be fully designed and documented before implementation begins. The following
artifacts are required in `specs/<feature>/` before any implementation task is written or
executed:

| Artifact | Purpose |
|---|---|
| `spec.md` | User-facing requirements and acceptance criteria (technology-agnostic) |
| `plan.md` | Technical approach, tech stack, file structure, Constitution Check |
| `data-model.md` | Entity definitions, field types, validation rules, relationships |
| `contracts/` | Interface contracts for every API boundary the feature exposes |
| `quickstart.md` | Concrete integration scenarios and end-to-end success criteria |

`research.md` is required when the plan references unresolved technology decisions. A feature
plan that leaves any of the mandatory artifacts absent MUST NOT proceed to task generation.

Rationale: implementation without a written design produces code that cannot be reviewed
against intent, makes schema drift undetectable, and forces rework when boundary contracts
are discovered late.

### Task Verification Documentation

Every task is not considered complete until a corresponding documentation step has been
fulfilled as part of its verification criteria. Documentation MUST be written or updated
before the task is marked done — it is not a follow-up activity.

Documentation files MUST live in `<package>/docs/*.md` (e.g.,
`apps/server/docs/database.md`, `packages/core/docs/schemas.md`). The `README.md` at the
package root covers orientation and startup; `docs/` is for deeper reference material that
would make `README.md` unwieldy:

- Architecture and design decisions for the component
- Data model and migration notes
- API contract details (beyond what `contracts/` specifies at spec time)
- Configuration reference
- Operational runbooks

A task that introduces a new module, API route, data model change, or configuration option
MUST produce or update at least one `docs/*.md` file that describes what was added. Tasks
that are purely mechanical (dependency bumps, formatting, rename-only refactors) are exempt.

Rationale: documentation written after the fact is rarely written at all. Embedding it as a
verification gate inside each task ensures the codebase and its docs stay in sync
incrementally rather than drifting apart over time.

## Governance

This constitution supersedes all informal practices and verbal agreements. Amendments require
a version bump per semantic versioning:
- **MAJOR**: backward-incompatible removal or redefinition of a principle.
- **MINOR**: new principle added, or existing principle or section materially expanded.
- **PATCH**: clarification, wording improvement, or non-semantic refinement.

Each feature plan MUST include a Constitution Check (as defined in
`.specify/templates/plan-template.md`) verifying compliance with all ten principles before
implementation begins. Violations MUST be justified in the plan's Complexity Tracking table.

**Version**: 1.17.0 | **Ratified**: 2026-03-21 | **Last Amended**: 2026-05-02
