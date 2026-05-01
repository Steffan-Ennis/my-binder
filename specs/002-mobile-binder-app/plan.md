# Implementation Plan: Mobile Binder App

**Branch**: `feat/002-scaffold-mobile-app` *(see Branch note below)* | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-mobile-binder-app/spec.md`

> **Branch note**: The current working branch (`feat/002-scaffold-mobile-app`) does not match
> speckit's `NNN-name` convention, so `.specify/scripts/bash/setup-plan.sh` aborts on the branch
> check. The plan was written manually against `specs/002-mobile-binder-app/`. Either rename the
> branch to `002-mobile-binder-app` before merging or accept the deviation; nothing else in the
> plan depends on the branch name.

## Summary

Deliver a Google-signed-in personal binder mobile app on iOS and Android. Two user stories
ship: (US1) Sign in with Google as the only authentication path with a 7-day session and
allowlist-gated access; (US2) browse the user's collection in a 3×3 binder-page grid with
forward/back navigation. Built as `apps/mobile` in the existing pnpm + Turborepo monorepo,
TypeScript strict, **React Native + Expo SDK 52** (resolved from Phase 0 research; see
[research.md](./research.md)), Jest + jest-expo for tests (Principle III), and the four-layer
Screen → Container → Hook → View component architecture (Principle X) from day one.

## Technical Context

**Language/Version**: TypeScript 5.7 (`strict: true`), Node 22 (build/test toolchain only)
**Primary Dependencies**: React Native 0.76 + Expo SDK 52, **Expo Router 4** (file-based
routing built on React Navigation 7 — picked for its forward-scaling story as the screen
count grows beyond the initial three), Zustand 5 (state), `expo-auth-session` (Google
OAuth), `expo-secure-store` (session JWT), `expo-image` (caching + lazy loading),
`@expo/vector-icons` (tab-bar glyphs for Binder/Search/Scan/Profile per the v3 wireframe),
`ajv` (response validation per Principle VII), `@my-binder/core` (shared types and schemas)
**Storage**:
- **Persistent secrets**: `expo-secure-store` (iOS Keychain, Android EncryptedSharedPreferences)
  — holds the session JWT only.
- **Ephemeral cache**: in-memory Zustand store + `expo-image` disk cache (managed by Expo).
- No SQLite/MMKV/Realm in this feature; all card data is fetched from the server on demand.

**Testing**: Jest 30 + ts-jest + `jest-expo` preset + `@testing-library/react-native` 12.
Co-located `.test.ts(x)` files per Principle III. E2E (Detox/Maestro) deferred to a later
spec — out of scope here.
**Target Platform**: iOS 15.1+ and Android API 24+ (Expo SDK 52 minimums).
**Project Type**: Mobile app workspace inside an existing pnpm + Turborepo monorepo.
**Performance Goals**:
- Cold-start to login screen: <2s on a mid-range device (mapped to SC-002).
- Login flow (Google tap → binder home): <90s including Google's auth (SC-001).
- Page navigation: 60fps swipe with no perceptible stutter (SC-005).
- Binder render: 0–1000 cards without layout errors (SC-007).

**Constraints**:
- All UI state ownership MUST live in hooks per Principle X. No `useState`/`useEffect` in
  views, screens, or containers.
- API responses MUST be validated against shared schemas from `@my-binder/core` before
  reaching application logic (Principle VII, mobile boundary rule).
- Session JWT MUST live in `expo-secure-store`, never in `AsyncStorage` or
  `localStorage`-equivalents.
- Sign-out MUST clear the local session and call Google's token-revoke endpoint per FR-008.

**Scale/Scope**: Single user per device. Up to 1,000 cards per binder (SC-007).
Navigation shape (per the v3 wireframe):

- **Pre-auth** routes: `Login`, `AccessDenied` (terminal).
- **Authenticated** routes nest a **bottom tab bar with four tabs** — `Binder`,
  `Search`, `Scan`, `Profile` — matching the wireframe. Spec 002 fully implements only
  the **Binder tab** (US1 sign-in lands here, US2 binder browse lives here). The
  `Search`, `Scan`, and `Profile` tabs are **"Coming Soon" placeholder routes** in this
  spec — the tab navigator and the route files exist (so the layout matches the
  wireframe today and the structure is forward-compatible), but their content is a
  single shared placeholder view. Full Search, Scan, and Profile features are deferred
  to follow-up specs (003+) which will swap each placeholder file for its real
  container without touching the tab navigator.

### Outstanding NEEDS CLARIFICATION

None remaining. All gates cleared:

- **Mobile framework gate** — cleared by constitution v1.13.1 (React Native 0.76 + Expo
  SDK 52, jest-expo, @testing-library/react-native 12).
- **Layout gate** — cleared by constitution v1.13.2 (Principle X's Screen row now points
  to `apps/mobile/app/**/*.tsx`; the `apps/mobile` workspace layout in Technology Stack
  is now `{app,src/{components,hooks,services,stores,utils}}/`; a Layout row was added
  to the layer-rules table covering Expo Router `_layout.tsx` files).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|---|---|---|
| I | Simplicity First | ✅ PASS | Two screens, one shared hook layer, no SQLite, no offline mode, no extra abstractions beyond the constitution-mandated four-layer split. |
| II | Data Integrity | ✅ PASS | Card data is read-only from the server; no local writes that affect server state. Session JWT is the only persisted datum and lives in OS-secured storage. |
| III | Test-First Development | ✅ PASS | Unit Testing Phase below enumerates Jest test files. `jest-expo` preset declared (the framework-specific Jest preset called for in the constitution's `MOBILE_PLATFORM` TODO). Co-location rule enforced. |
| IV | Single Responsibility | ✅ PASS | Each feature owns container/hook/view; api client, auth client, secure storage are separate single-purpose modules. |
| V | Transparency & Legibility | ✅ PASS | No magic literals (Google client IDs and revoke URL pulled from env via `expo-constants`); identifiers describe intent. |
| VI | Layered Architecture | ✅ PASS | Mobile → API server only. Mobile MUST NOT call MTGJSON, the database, or AWS Secrets Manager. Auth and card requests both go through the existing server endpoints. |
| VII | Strong Typing & Schema Validation | ✅ PASS | TS strict + Ajv validation on every inbound API response. Shared schemas re-used from `@my-binder/core`. Path aliases `@root/*` and `@src/*` declared in `apps/mobile/tsconfig.json`. `type` over `interface` for all new types. |
| VIII | Error Transparency | ✅ PASS | Every caught error is either re-thrown or logged + surfaced to the user via the auth/api error boundary. No silent swallows in any of the new code paths. |
| IX | Public API Discipline | ✅ PASS | Services in `apps/mobile/src/services/` (`apiClient`, `authClient`, `secureStorage`) carry full JSDoc with `@example` blocks. `index.ts` files in each services subdirectory are pure barrels. |
| X | Component Architecture (Mobile) | ✅ PASS | Every UI feature uses Screen → Container → Hook → View per constitution v1.13.2. Route files in `apps/mobile/app/` are the Screen layer (one-line shells); `_layout.tsx` files are the Layout layer (route hierarchy + auth gates only). Containers destructure hook results and pass named props (no spread). `useEffect` is restricted to legitimate external-system cases (secure-storage hydration on app start, Google auth-session result events) with cleanup and exhaustive deps. |

**Pre-implementation gates**: All cleared.

- ✅ Mobile framework adoption — cleared by constitution v1.13.1.
- ✅ Expo Router layout alignment — cleared by constitution v1.13.2.

`/speckit.implement` is now unblocked.

## Project Structure

### Documentation (this feature)

```text
specs/002-mobile-binder-app/
├── plan.md              # This file
├── research.md          # Phase 0 output — framework, navigation, state, auth, storage
├── data-model.md        # Phase 1 output — User, Session, Binder, Page, CardSlot, Card
├── quickstart.md        # Phase 1 output — local run, simulator, device, test commands
├── contracts/
│   └── api-client.md    # Phase 1 output — server endpoints the mobile app calls
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
my-binder/
├── apps/
│   ├── server/                          # @my-binder/server — existing, unchanged
│   └── mobile/                          # @my-binder/mobile — NEW workspace (Expo Router)
│       ├── app/                         # Expo Router routes — file = route (file-based)
│       │   ├── _layout.tsx                      # Root Stack: providers, error boundary, theme
│       │   ├── index.tsx                        # Entry route: <Redirect /> based on session
│       │   ├── login.tsx                        # PUBLIC route — renders <LoginContainer />
│       │   ├── access-denied.tsx                # PUBLIC route — renders <AccessDeniedContainer />
│       │   └── (authenticated)/                 # Route group — auth gate via _layout
│       │       ├── _layout.tsx                  # Redirects to /login if no active session
│       │       └── (tabs)/                      # Bottom-tab navigator (matches v3 wireframe)
│       │           ├── _layout.tsx              # <Tabs /> — 4 tabs, Binder is initial route
│       │           ├── binder.tsx               # PRIVATE — renders <BinderHomeContainer /> (US1, US2)
│       │           ├── search.tsx               # STUB — renders <ComingSoonContainer feature="search" />
│       │           ├── scan.tsx                 # STUB — renders <ComingSoonContainer feature="scan" />
│       │           └── profile.tsx              # STUB — renders <ComingSoonContainer feature="profile" />
│       ├── app.json                     # Expo config (slug, scheme, icon, splash, scheme for deep links)
│       ├── babel.config.js              # babel-preset-expo (includes expo-router/babel)
│       ├── jest.config.ts               # preset: 'jest-expo', co-located testMatch
│       ├── tsconfig.json                # strict: true, paths @root/* and @src/*; extends expo/tsconfig.base
│       ├── package.json                 # name: @my-binder/mobile, "main": "expo-router/entry"
│       └── src/
│           ├── components/              # Feature components — four-layer split per Principle X
│           │   ├── login/
│           │   │   ├── LoginContainer.tsx       # destructures useLogin(), passes named props
│           │   │   ├── useLogin.ts              # state, effects, store calls — owns Google flow
│           │   │   ├── useLogin.test.ts         # Jest unit tests — REQUIRED (Principle III)
│           │   │   ├── LoginView.tsx            # pure JSX, props-only
│           │   │   └── LoginView.test.tsx       # Jest snapshot/render tests — REQUIRED
│           │   ├── binder-home/
│           │   │   ├── BinderHomeContainer.tsx
│           │   │   ├── useBinderHome.ts
│           │   │   ├── useBinderHome.test.ts
│           │   │   ├── BinderHomeView.tsx       # 3×3 grid + page indicator
│           │   │   └── BinderHomeView.test.tsx
│           │   ├── access-denied/
│           │   │   ├── AccessDeniedContainer.tsx
│           │   │   ├── useAccessDenied.ts
│           │   │   ├── useAccessDenied.test.ts
│           │   │   ├── AccessDeniedView.tsx
│           │   │   └── AccessDeniedView.test.tsx
│           │   └── coming-soon/                  # Shared "Coming Soon" stub (Search/Scan/Profile tabs)
│           │       ├── ComingSoonContainer.tsx   # Accepts a `feature` prop; passes named props to view
│           │       ├── useComingSoon.ts          # Resolves feature → title/message/icon name
│           │       ├── useComingSoon.test.ts
│           │       ├── ComingSoonView.tsx        # Pure JSX — title, message, icon, optional CTA
│           │       └── ComingSoonView.test.tsx
│           ├── hooks/                   # Cross-feature hooks (Principle X)
│           │   ├── useSession.ts                # subscribes to session store; one effect for hydration
│           │   ├── useSession.test.ts
│           │   ├── useApi.ts                    # typed wrapper around fetch + Ajv validation
│           │   └── useApi.test.ts
│           ├── services/                # Subject to Principle IX — JSDoc + index purity
│           │   ├── auth/
│           │   │   ├── index.ts                 # re-export only
│           │   │   ├── googleAuth.ts            # expo-auth-session wrapper + revoke
│           │   │   ├── googleAuth.test.ts
│           │   │   ├── sessionStorage.ts        # expo-secure-store wrapper
│           │   │   └── sessionStorage.test.ts
│           │   └── api/
│           │       ├── index.ts                 # re-export only
│           │       ├── apiClient.ts             # fetch + Ajv-validated responses
│           │       └── apiClient.test.ts
│           ├── stores/                  # Zustand stores (no JSX)
│           │   ├── sessionStore.ts              # auth state, JWT, expiry
│           │   ├── sessionStore.test.ts
│           │   ├── binderStore.ts               # current page, cards, total count
│           │   └── binderStore.test.ts
│           └── utils/                   # Pure functions only (Principle X)
│               ├── pageMath.ts                  # page count derivation, slot indexing
│               └── pageMath.test.ts
└── packages/
    └── core/                            # existing — mobile imports schemas/types from here
```

**Routing model (Expo Router 4)**:

- **File-based routing** — every file under `apps/mobile/app/` is a route. Adding a screen
  means creating a new file, no central navigator file to edit. This is the scaling
  property that motivated the choice over imperative React Navigation.
- **Route files are one-line shells per Principle X** — each route file exports a default
  component that renders exactly one container, e.g.:
  ```tsx
  // apps/mobile/app/login.tsx
  import { LoginContainer } from '@src/components/login/LoginContainer';
  export default function Login() { return <LoginContainer />; }
  ```
- **Three-level navigation hierarchy**:
  1. **Root Stack** (`app/_layout.tsx`) — top-level providers, theme, error boundary,
     and the Stack itself. Hosts public routes (`login`, `access-denied`) and the
     authenticated route group as siblings.
  2. **Auth gate** (`app/(authenticated)/_layout.tsx`) — reads `useSession()` and
     `<Redirect href="/login" />`s when no active session exists. The body is a `<Stack />`
     so that future authenticated stack routes (e.g., `card-detail/[id]`) can sit at this
     level above the tabs without needing a fresh route group.
  3. **Tab navigator** (`app/(authenticated)/(tabs)/_layout.tsx`) — `<Tabs />` containing
     the four wireframe tabs: `Binder` (initial route), `Search`, `Scan`, `Profile`.
     Each tab file is a one-line shell. Binder routes to the real `<BinderHomeContainer />`;
     the other three each render `<ComingSoonContainer feature="..." />` with a
     wireframe-aligned glyph from `@expo/vector-icons`.
- **Forward-compatibility guarantee**: when the Search / Scan / Profile features are
  specced (specs 003+), each one only needs to (a) add a feature directory under
  `src/components/<feature>/` with the four-layer split and (b) replace the corresponding
  `app/(authenticated)/(tabs)/<tab>.tsx` file's body with the real container. The tab
  navigator, route group, and auth gate are unchanged. No tab file moves, no central
  navigator file is edited.
- **`expo-router`'s `useRouter()` and `<Redirect />`** are consumed only by hooks
  (`useLogin`, `useAccessDenied`, `useComingSoon`) and route layouts — never by views —
  preserving Principle X's view purity rule.

**Structure Decision**: Add `apps/mobile` as a new pnpm workspace alongside `apps/server`,
following the existing monorepo conventions documented in CLAUDE.md and `pnpm-workspace.yaml`.
Internal layout follows **Expo Router conventions**: routes live in `apps/mobile/app/` at
the workspace root (file = route), and the four-layer feature code lives in
`apps/mobile/src/{components,hooks,services,stores,utils}/`. Navigation is a three-level
hierarchy — Root Stack → authenticated Stack (auth gate) → bottom Tab navigator with the
four wireframe tabs — built entirely from Expo Router `_layout.tsx` files. Principle X's
four-layer intent is preserved at every route file. Tests are co-located per Principle III
with no top-level `tests/` directory.

## Unit Testing Phase

*GATE: This section is REQUIRED in every plan per Constitution Principle III. A plan
without a completed Unit Testing Phase MUST NOT proceed to task generation
(`/speckit.tasks`).*

**Test framework**: Jest 30 with `ts-jest` for TypeScript and the `jest-expo` preset for
React Native runtime/asset handling. `@testing-library/react-native` 12 for view rendering
and `react-test-renderer` for snapshots. No Vitest, Mocha, or `node:test` (Principle III).

### Test files to create or update

| Test file | Status | Behaviours covered (mapped to FR-### where applicable) |
|---|---|---|
| `apps/mobile/src/components/login/useLogin.test.ts` | new | Tap-to-sign-in dispatches Google flow (FR-002, FR-003); successful auth stores JWT and navigates to BinderHome (US1.AS3); cancellation/outage surfaces retryable error and stays on Login (FR-004); allowlist 403 navigates to AccessDenied (FR-005, US1.AS5); already-authenticated launch skips login when session ≤ 7 days (FR-006, US1.AS6); sign-out path revokes Google grant and clears JWT (FR-008, US1.AS7). |
| `apps/mobile/src/components/login/LoginView.test.tsx` | new | Renders the binder-themed background; renders exactly one "Sign in with Google" CTA; no username/password fields exist (FR-002); error banner renders when `errorMessage` prop is set; disables CTA while `isSigningIn` prop is true. |
| `apps/mobile/src/components/binder-home/useBinderHome.test.ts` | new | Computes total page count from collection size (FR-013, SC-007); pages forward/backward within bounds (FR-012); empty-collection state shows page 1 of 1 with all slots empty (Edge Case + US2.AS3); current/total page indicator stays in sync (FR-014); never produces phantom cards on partial last page (Edge Case). |
| `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx` | new | Renders 3×3 grid (FR-009); occupied slots render `expo-image` with the front-face URL (FR-010); empty slots render the empty-pocket visual variant (FR-011); previous/next controls fire `onPrev`/`onNext` props; page indicator string matches `currentPage / totalPages` (FR-014). |
| `apps/mobile/src/components/access-denied/useAccessDenied.test.ts` | new | "Try a different account" handler invokes sign-out + navigates back to Login (FR-005); contact CTA opens the configured mailto/URL. |
| `apps/mobile/src/components/access-denied/AccessDeniedView.test.tsx` | new | Renders the "access not yet granted" copy; renders contact CTA with the configured target. |
| `apps/mobile/src/hooks/useSession.test.ts` | new | Hydrates from secure storage on first call; expires session after 7 days matching `SESSION_JWT_TTL_DAYS` from `@my-binder/core` (FR-006, FR-007); cleanup unsubscribes on unmount (Principle X cleanup rule). |
| `apps/mobile/src/hooks/useApi.test.ts` | new | Attaches `Authorization: Bearer <jwt>` when session is valid; validates every response against the `@my-binder/core` schema and rejects malformed payloads (Principle VII); maps server 401 to "session expired" + clears local state; maps server 403 to "allowlist rejection" without clearing the Google grant. |
| `apps/mobile/src/services/auth/googleAuth.test.ts` | new | Wraps `expo-auth-session/providers/google` correctly; calls Google's revoke endpoint on sign-out (FR-008, US1.AS7); surfaces user-cancellation as a typed error (FR-004). |
| `apps/mobile/src/services/auth/sessionStorage.test.ts` | new | Reads/writes the JWT via `expo-secure-store`; never falls back to `AsyncStorage`; clears storage on sign-out. |
| `apps/mobile/src/services/api/apiClient.test.ts` | new | Sends requests against the configured base URL; serialises JSON; routes errors through Principle VIII patterns (log original before wrapping). |
| `apps/mobile/src/stores/sessionStore.test.ts` | new | Setting/clearing the session triggers subscribers; selectors return stable references for the four-layer pattern (Zustand `subscribeWithSelector`). |
| `apps/mobile/src/stores/binderStore.test.ts` | new | Initial page is 1; advancing past last page is a no-op; collection swap resets to page 1. |
| `apps/mobile/src/utils/pageMath.test.ts` | new | `pageCount(0) === 1`, `pageCount(9) === 1`, `pageCount(10) === 2`, `pageCount(1000) === 112`; slot indexing for partial last pages (Edge Case). |
| `apps/mobile/app/index.test.tsx` | new | Redirects to `/login` when no session is hydrated (FR-001, SC-006); redirects to `/binder` (resolved through `(authenticated)/(tabs)/binder.tsx`) when a valid ≤7-day session is hydrated (FR-006, US1.AS6). Uses `expo-router/testing-library`. |
| `apps/mobile/app/(authenticated)/_layout.test.tsx` | new | Auth-gate layout: renders its child `<Stack />` for an authenticated user; renders `<Redirect href="/login" />` when `useSession()` returns `status !== "active"` (FR-001, SC-006). |
| `apps/mobile/app/(authenticated)/(tabs)/_layout.test.tsx` | new | Renders a `<Tabs />` with exactly four screens in the order shown by the v3 wireframe: Binder, Search, Scan, Profile. Binder is the initial route. Each tab declares the wireframe-matching `@expo/vector-icons` glyph and label. Active-tab styling matches the wireframe (highlighted icon + label). |
| `apps/mobile/app/login.test.tsx` | new | Route file is a one-line shell (Principle X compliance): renders exactly `<LoginContainer />` and nothing else; default export is a function component with no local state. The same one-line-shell test pattern applies to `app/access-denied.test.tsx`, `app/(authenticated)/(tabs)/binder.test.tsx`, `search.test.tsx`, `scan.test.tsx`, and `profile.test.tsx`. |
| `apps/mobile/src/components/coming-soon/useComingSoon.test.ts` | new | For each `feature` value (`"search"`, `"scan"`, `"profile"`), returns a wireframe-aligned title, message, and `@expo/vector-icons` glyph name. Throws on unrecognised features (defensive — should never happen given the typed `feature` union). |
| `apps/mobile/src/components/coming-soon/ComingSoonView.test.tsx` | new | Renders the title, message, and icon from props. Accessibility role is set so screen readers announce the feature name. No store/service imports (Principle X view purity). |

### Coverage target

Default project floor (80% lines, 80% branches, 80% functions, 80% statements) applies to
**all new code** under `apps/mobile/src/`. Higher targets for the load-bearing hooks
(`useLogin`, `useBinderHome`, `useSession`) — 95% lines / 90% branches — because they own
all auth and pagination logic.

```jsonc
// apps/mobile/jest.config.ts — coverageThreshold
{
  "coverageThreshold": {
    "global": { "branches": 80, "functions": 80, "lines": 80, "statements": 80 },
    "apps/mobile/src/components/login/useLogin.ts":           { "branches": 90, "lines": 95 },
    "apps/mobile/src/components/binder-home/useBinderHome.ts": { "branches": 90, "lines": 95 },
    "apps/mobile/src/hooks/useSession.ts":                     { "branches": 90, "lines": 95 }
  }
}
```

### Test execution

- **Local (workspace)**: `pnpm --filter @my-binder/mobile test`
- **Local (whole repo)**: `turbo test` — runs `@my-binder/mobile` test task in parallel with `@my-binder/server` and `@my-binder/core`.
- **Watch mode**: `pnpm --filter @my-binder/mobile test --watch`
- **Coverage**: `pnpm --filter @my-binder/mobile test --coverage`
- **CI**: `turbo test` runs as part of the existing root pipeline; no new GitHub Actions
  workflow is required for this feature beyond declaring `@my-binder/mobile` in the
  workspace (already done implicitly by `pnpm-workspace.yaml`'s `apps/*` glob).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Constitution v1.13.2 aligned Principle X with Expo Router conventions
(routes under `apps/mobile/app/`, `_layout.tsx` files as the new Layout layer), so the
prior layout deviation is now an explicitly permitted pattern, not a violation.
