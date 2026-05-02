---
description: "Task list for spec 002-mobile-binder-app — regenerated 2026-05-02 (SDK 54)"
---

# Tasks: Mobile Binder App

**Input**: Design documents from `/specs/002-mobile-binder-app/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api-client.md, research.md, quickstart.md
**Constitution**: v1.16.0 — Hook return-value memoisation rule (functions in `useCallback`, non-primitives in `useMemo`); v1.15.0 Expo SDK ~54.0 / RN 0.81.5 / React 19.1 / Expo Router ~6.0 / TS ~5.9 (Principle X tech-stack pin); v1.14.0 Component declaration rule (FC / PropsWithChildren); v1.13.2 Layout-rules table (Expo Router `_layout.tsx`); v1.13.1 four-layer split.

**Context (2026-05-02)**: The first implementation attempt was abandoned and the workspace
was re-bootstrapped via `npx create-expo-app` against Expo SDK 54.0.33. The bootstrap
already populated:

- `apps/mobile/package.json` (with `@my-binder/mobile`, `"main": "expo-router/entry"`, RN 0.81.5, React 19.1, Expo Router 6.0.23, TypeScript 5.9.2)
- `apps/mobile/app.json`
- `apps/mobile/app/_layout.tsx` (root)
- `apps/mobile/app/modal.tsx` (template demo — TO DELETE)
- `apps/mobile/app/(tabs)/` (empty directory — demo files deleted 2026-05-02)
- `apps/mobile/assets/` (empty `images/` subdir — bootstrap PNGs deleted 2026-05-02; preserved for fonts and future custom assets)
- `apps/mobile/components/` and `apps/mobile/components/ui/` (empty directories — demo files deleted 2026-05-02)
- `apps/mobile/constants/theme.ts` (rewritten 2026-05-02 with the wireframe v3 design tokens — Colors, Type, Spacing, Radius, Elevation, Motion, Touch — and verified `tsc --strict`)
- `apps/mobile/hooks/{use-color-scheme.ts,use-color-scheme.web.ts,use-theme-color.ts}` (template hooks — TO DELETE; theme is consumed directly from `constants/theme.ts`)
- `apps/mobile/scripts/reset-project.js` (template helper — TO DELETE)
- `apps/mobile/expo-env.d.ts`, `apps/mobile/eslint.config.js` (flat config), `apps/mobile/tsconfig.json` (declares `"@/*"` paths — TO REWRITE)
- `apps/mobile/package-lock.json` (npm lockfile — TO DELETE; the monorepo uses pnpm exclusively per CLAUDE.md and constitution v1.15.0)
- `node_modules/` resolved by npm during bootstrap — will be re-resolved by pnpm in T002

This task list rebuilds against the bootstrap baseline (it does NOT assume an empty
workspace). Phase 1 reshapes around the bootstrap state: cleanup tasks supersede the
"create from scratch" tasks of the prior tasks.md revision.

**Tests**: Per Principle III, **Jest unit tests are REQUIRED** for every behaviour-bearing
file. The test files listed below match the Unit Testing Phase in `plan.md` exactly. Tests
MUST be written first and MUST FAIL before the matching implementation task is started
(Red → Green → Refactor).

**Organization**: Tasks are grouped by user story so each story can be implemented and
tested independently. Setup and Foundational phases are shared prerequisites.

## Format

`- [ ] TID [P?] [Story?] Description with file path`

- `[P]` — task is parallelizable with other `[P]` tasks in the same phase (different files,
  no dependency on incomplete tasks within the phase).
- `[Story]` — `[US1]` or `[US2]`, applied only to user-story phases (Phase 3 / Phase 4).

---

## Conventions enforced by every task in this list

These constitution rules apply uniformly to every file produced by every task below.
They are listed once here instead of being repeated in every task description.

- **Principle VII (strong typing)**: TypeScript `strict: true`; no `any`; `type` over
  `interface`; path aliases `@root/*` and `@src/*` instead of `../` traversals; Ajv
  validation on every inbound API response (runs **inside** the TanStack `queryFn`).
- **Principle IX (public API discipline)**: every public function under `apps/mobile/src/services/`
  and every cross-feature hook under `apps/mobile/src/hooks/` carries a JSDoc block with
  `@param`, `@returns`, `@throws`, and `@example`. `index.ts` files are pure barrels.
- **Principle X (component architecture)**:
  - Screen → Container → Hook → View. Containers destructure hook results and pass
    individual named props (no spread).
  - **Component declaration rule (v1.14.0)**: every functional React component MUST be
    declared as `const Foo: FC<FooProps> = (...) => { ... }`. Components that render
    `children` use `FC<PropsWithChildren<FooProps>>`. The `FooProps` type lives in the
    same file as the component, named with the literal `Props` suffix.
  - **Hook return-value memoisation rule (v1.16.0)**: every non-primitive value
    produced inside a hook in `apps/mobile/src/components/<feature>/use<Feature>.ts`
    or `apps/mobile/src/hooks/` MUST be memoised before being returned, passed to a
    child, or used as a dependency. Functions via `useCallback`, objects/arrays/
    instances via `useMemo`, both with exhaustive deps. Primitives are exempt.
    Values read directly from a Zustand selector or a TanStack Query result are
    already reference-stable; values *derived* from them
    (`data.map(transform)`, `() => mutation.mutate(arg)`, `{ ...query.data, foo }`)
    MUST be memoised at the hook boundary. Every hook task in this list inherits
    this rule.
  - `useEffect` is restricted to legitimate external-system synchronisation (secure-store
    hydration, auth-session result events). Cleanup mandatory; exhaustive deps mandatory.
  - Views never import stores or services. Hooks own all state and effects. Views
    consume design tokens via `apps/mobile/constants/theme.ts` (`Colors.dark.*`,
    `Type.display`, `Spacing.md`, etc.) — never hard-coded hex or pixel values.
- **Principle III (test-first)**: every test file is co-located with the file under test
  as `<filename>.test.ts(x)`. No top-level `tests/` directory.
- **Tech-stack pin (constitution v1.15.0)**: every install/upgrade in this feature MUST
  resolve compatible versions of Expo SDK ~54.0, RN 0.81.5, React 19.1, Expo Router
  ~6.0, TypeScript ~5.9. Adding a dependency that forces a version skew requires a
  constitution amendment.

---

## Phase 1: Setup (Bootstrap Cleanup + Wiring)

**Purpose**: Bring the create-expo-app SDK 54 bootstrap into compliance with the
constitution and the spec — delete leftover template files, switch from npm to pnpm,
rewrite the path aliases, install missing dependencies, and add the Jest + env config
the bootstrap omits.

- [X] T001 Delete `apps/mobile/app/modal.tsx` (template demo screen — not in scope for spec 002)
- [X] T002 [P] Delete `apps/mobile/hooks/use-color-scheme.ts`, `apps/mobile/hooks/use-color-scheme.web.ts`, `apps/mobile/hooks/use-theme-color.ts` (template theme hooks — superseded by direct imports from `apps/mobile/constants/theme.ts`)
- [X] T003 [P] Delete `apps/mobile/scripts/reset-project.js` and the empty `apps/mobile/scripts/` directory (template helper not used by this monorepo)
- [X] T004 [P] Delete `apps/mobile/package-lock.json` (npm lockfile from `npx create-expo-app`; the workspace re-resolves through pnpm in T006)
- [X] T005 [P] Rewrite `apps/mobile/tsconfig.json` so `compilerOptions.paths` declares `"@root/*": ["./*"]` and `"@src/*": ["./src/*"]` (replacing the bootstrap's `"@/*": ["./*"]` per Principle VII), keep `extends: "expo/tsconfig.base"` and `strict: true`, and update `include` to `["app/**/*", "src/**/*", "constants/**/*", "*.ts", "*.tsx", "expo-env.d.ts"]`
- [X] T006 Run `rm -rf apps/mobile/node_modules` then `pnpm install` from the repo root to re-resolve `@my-binder/mobile` through pnpm and update the root `pnpm-lock.yaml`. Confirm `pnpm-workspace.yaml`'s `apps/*` glob already covers the new workspace (no edit required)
- [X] T007 Update `apps/mobile/package.json` scripts to `dev` (`expo start`), `test` (`jest`), `typecheck` (`tsc --noEmit`), `build` (`expo export` placeholder), `lint` (`expo lint`); remove the `reset-project` script line (helper deleted in T003); add the `@my-binder/core` workspace dependency (currently absent from the bootstrap)
- [X] T008 [P] Install runtime dependencies into `apps/mobile/`: `@tanstack/react-query@^5`, `zustand@^5`, `expo-auth-session@~7`, `expo-crypto@~15`, `expo-secure-store@~15`, `react-native-pager-view@~7`, `ajv@^8`, plus the workspace `@my-binder/core`. Use `pnpm --filter @my-binder/mobile add <pkg>` so the root lockfile updates (`expo-image`, `@expo/vector-icons`, `expo-constants`, `react-native-reanimated`, `react-native-worklets` are already pinned by the bootstrap and do NOT need re-installing)
- [X] T009 [P] Install dev dependencies into `apps/mobile/`: `jest@^30`, `jest-expo@~54` (SDK 54-compatible preset), `ts-jest@^29`, `@types/jest@^30`, `@testing-library/react-native@^13`, `react-test-renderer@^19.1`, `eslint-plugin-react-hooks@^5`, `@tanstack/react-query-devtools@^5`. Use `pnpm --filter @my-binder/mobile add -D <pkg>`
- [X] T010 [P] Create `apps/mobile/jest.config.ts` with `preset: 'jest-expo'`, `setupFilesAfterEach: ['./jest.setup.ts']`, `testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)']`, the `coverageThreshold` block from `plan.md`'s Unit Testing Phase (80% global; 90/95% on the load-bearing hooks), `transform` overrides for `.ts`/`.tsx` via `ts-jest`, and `moduleNameMapper` aligning with the new `@root/*` + `@src/*` aliases
- [X] T011 [P] Create `apps/mobile/jest.setup.ts` registering `@testing-library/react-native/extend-expect`, mocking `expo-secure-store`, `expo-auth-session`, `expo-router`, and `expo-constants` per `jest-expo` SDK 54 guidance, plus a Reanimated mock (`require('react-native-reanimated/mock')`) so component tests don't load the worklet runtime
- [X] T012 [P] Create `apps/mobile/app.config.ts` (TypeScript config function) that imports `apps/mobile/app.json`, then layers `process.env.API_BASE_URL`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID` into `expo.extra` so `expo-constants` reads them at runtime. Delete `apps/mobile/app.json` only if `app.config.ts` fully replaces it; otherwise import-and-extend pattern is acceptable (Expo SDK 54 supports both files cooperating)
- [X] T013 [P] Create `apps/mobile/.env.example` documenting `API_BASE_URL`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID` (matches `quickstart.md` §1)
- [X] T014 [P] Update `apps/mobile/.gitignore` (currently bootstrap-default) to additionally cover `.env.local`, `.env`, `coverage/`, `*.tsbuildinfo`, `dist/`. Keep the bootstrap-supplied entries (`node_modules/`, `.expo/`)
- [X] T015 [P] Update `apps/mobile/eslint.config.js` to extend the bootstrap's `eslint-config-expo` flat config with `eslint-plugin-react-hooks`'s `recommended-latest` rules, with `react-hooks/exhaustive-deps` set to `error` per Principle X
- [X] T016 [P] Replace `apps/mobile/README.md` with a brief workspace summary linking to `specs/002-mobile-binder-app/quickstart.md` for run/test commands and `specs/002-mobile-binder-app/plan.md` for architecture
- [X] T017 Verify `pnpm --filter @my-binder/mobile typecheck` passes against the now-empty source tree (`constants/theme.ts` already typechecked clean; expect zero errors), `pnpm --filter @my-binder/mobile test --listTests` enumerates zero tests successfully, and `turbo typecheck` from the repo root recognises `@my-binder/mobile`

**Checkpoint**: Bootstrap is constitution-compliant. `expo start` boots a blank
authenticated-redirect-empty app; `turbo typecheck` and `pnpm test` succeed against
zero source files. Foundational phase can now begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting utilities, stores, services, cross-feature hooks, and the entire
Expo Router 6 layout/navigation skeleton. None of these are story-specific — they are
prerequisites for both US1 and US2.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Foundational tests (write FIRST; they MUST FAIL before implementation)

- [X] T018 [P] Author Jest tests in `apps/mobile/src/utils/pageMath.test.ts` covering `pageCount(0) === 1`, `pageCount(9) === 1`, `pageCount(10) === 2`, `pageCount(1000) === 112`, and slot-indexing for partial last pages (Edge Case in spec)
- [X] T019 [P] Author Jest tests in `apps/mobile/src/stores/sessionStore.test.ts` for set/clear, subscriber notification via `subscribeWithSelector`, and stable selector references (per `plan.md`'s Unit Testing Phase)
- [X] T020 [P] Author Jest tests in `apps/mobile/src/stores/binderStore.test.ts` proving the store holds **only** `currentPage` (no card list), initial value `1`, `nextPage`/`prevPage` clamps at the `totalPages` derived from `useCardsInfiniteQuery`, and resets to `1` on sign-out
- [X] T021 [P] Author Jest tests in `apps/mobile/src/services/auth/sessionStorage.test.ts` for read/write through `expo-secure-store`, no `AsyncStorage` fallback, and full clear-on-sign-out
- [X] T022 [P] Author Jest tests in `apps/mobile/src/services/auth/googleAuth.test.ts` covering `expo-auth-session/providers/google` wrapping (FR-002, FR-003), Google revoke endpoint call on sign-out (FR-008), and a typed `UserCancelledError` surfaced when the user cancels (FR-004)
- [X] T023 [P] Author Jest tests in `apps/mobile/src/services/api/apiClient.test.ts` for typed methods `getCards`, `getMe`, `signInWithGoogle`, `signOut`; `Authorization: Bearer <jwt>` attachment from `sessionStore` when active (and absence when inactive); Ajv validation against `@my-binder/core` schemas inside the queryFn before resolve; original-error logging before throwing the typed `ApiError` per Principle VIII
- [X] T024 [P] Author Jest tests in `apps/mobile/src/services/api/queryClient.test.ts` proving `defaultOptions.queries.retry = 3` with exponential `retryDelay` (1s → 2s → 4s, ceiling 30s); 4xx skipped by the retry predicate; `defaultOptions.mutations.retry = 0`; `refetchOnWindowFocus: false`; `retryOnMount: false`; `queryCache.onError` handles 401 (clear session + route Login) and 403 (route AccessDenied); `mutationCache.onError` does the same
- [X] T025 [P] Author Jest tests in `apps/mobile/src/hooks/useSession.test.ts` covering hydrate-once-on-mount from `sessionStorage`, expiry exactly at `iat + SESSION_JWT_TTL_DAYS * 86400` (FR-006, FR-007), unsubscribe on unmount (Principle X cleanup rule), and reference-stability of any returned non-primitive (`renderHook` re-renders return the same object/function references when inputs are unchanged — v1.16.0 memoisation rule)
- [X] T026 [P] Author Jest tests in `apps/mobile/src/hooks/useMeQuery.test.ts` wrapping TanStack `useQuery` against `apiClient.getMe`; gated on `useSession().status === "active"`; on 401 the global `queryCache.onError` clears session and routes Login; on 403 routes AccessDenied; `staleTime: 60_000`, `gcTime: 300_000` per `contracts/api-client.md`
- [X] T027 [P] Author Jest tests in `apps/mobile/src/components/coming-soon/useComingSoon.test.ts` returning a wireframe-aligned title/message/Ionicons name for each `feature` value (`"search"`, `"scan"`, `"profile"`) and throwing on unrecognised values
- [X] T028 [P] Author Jest tests in `apps/mobile/src/components/coming-soon/ComingSoonView.test.tsx` proving title/message/icon render from props, accessibility role announces the feature, and no store/service imports exist (Principle X view purity)
- [X] T029 [P] Author Jest tests in `apps/mobile/app/index.test.tsx` using `expo-router/testing-library` proving redirect to `/login` when no hydrated session (FR-001, SC-006) and redirect to `/binder` when a valid ≤7-day session is hydrated (FR-006, US1.AS6)
- [X] T030 [P] Author Jest tests in `apps/mobile/app/(authenticated)/_layout.test.tsx` proving the auth gate renders `<Redirect href="/login" />` when `useSession().status !== "active"` and renders the child `<Stack />` otherwise
- [X] T031 [P] Author Jest tests in `apps/mobile/app/(authenticated)/(tabs)/_layout.test.tsx` proving exactly four tabs (Binder, Search, Scan, Profile) in the wireframe order with Binder as the initial route, and that each tab declares its `@expo/vector-icons` (Ionicons) glyph and label per the v3 wireframe
- [X] T032 [P] Author Jest tests in `apps/mobile/app/(authenticated)/(tabs)/search.test.tsx` proving the route is a one-line shell rendering exactly `<ComingSoonContainer feature="search" />`
- [X] T033 [P] Author Jest tests in `apps/mobile/app/(authenticated)/(tabs)/scan.test.tsx` proving the route is a one-line shell rendering exactly `<ComingSoonContainer feature="scan" />`
- [X] T034 [P] Author Jest tests in `apps/mobile/app/(authenticated)/(tabs)/profile.test.tsx` proving the route is a one-line shell rendering exactly `<ComingSoonContainer feature="profile" />`

### Foundational implementation

- [X] T035 [P] Implement `apps/mobile/src/utils/pageMath.ts` exporting pure `pageCount(cardCount: number): number` and `slotIndex(cardIndex: number): { pageNumber: number; slot: number }` per data-model.md
- [X] T036 [P] Implement `apps/mobile/src/stores/sessionStore.ts` as a Zustand 5 store with `subscribeWithSelector`, holding `{ jwt, iat, userId, email, status: "idle" | "active" | "expired" }` and exposing `setSession`, `clearSession`, `markExpired` per `data-model.md` Session entity
- [X] T037 [P] Implement `apps/mobile/src/stores/binderStore.ts` as a Zustand 5 store holding **only** `currentPage` plus `nextPage`/`prevPage`/`reset` per `data-model.md` Binder entity (server data lives in TanStack cache, never here)
- [X] T038 [P] Implement `apps/mobile/src/services/auth/sessionStorage.ts` wrapping `expo-secure-store` with `readSession()`, `writeSession({ jwt, iat })`, `clearSession()`. Include JSDoc with `@example` per Principle IX
- [X] T039 [P] Implement `apps/mobile/src/services/auth/googleAuth.ts` wrapping `expo-auth-session/providers/google`. Export `useGoogleAuthRequest()` (hook) and `revokeGoogleGrant(token)` (function). Include JSDoc with `@example` per Principle IX
- [X] T040 Implement `apps/mobile/src/services/api/apiClient.ts` with typed methods `getCards(cursor?)`, `getMe()`, `signInWithGoogle({ idToken })`, `signOut()`. Read `apiBaseUrl` from `expo-constants`. Attach `Authorization: Bearer <jwt>` from `sessionStore` when active. Validate every response with Ajv against `@my-binder/core/schemas/{auth,card}.json` before resolving. Throw typed `ApiError` (with original `cause`); log original before throwing per Principle VIII. Full JSDoc per Principle IX
- [X] T041 Implement `apps/mobile/src/services/api/queryClient.ts` exporting a singleton `QueryClient` with `defaultOptions.queries.retry = 3`, exponential `retryDelay` (1s → 2s → 4s, ceiling 30s), retry-predicate skipping 4xx, `defaultOptions.mutations.retry = 0`, `refetchOnWindowFocus: false`, `retryOnMount: false`. Wire `queryCache.onError` and `mutationCache.onError` to route 401 → clear session + Login and 403 → AccessDenied. Full JSDoc per Principle IX
- [X] T042 [P] Implement `apps/mobile/src/services/auth/index.ts` as a pure barrel re-exporting `googleAuth` and `sessionStorage` (Principle IX index purity)
- [X] T043 [P] Implement `apps/mobile/src/services/api/index.ts` as a pure barrel re-exporting `apiClient`, `queryClient`, `ApiError`, and the response/error types (Principle IX index purity)
- [X] T044 Implement `apps/mobile/src/hooks/useSession.ts` consuming `sessionStore` + `sessionStorage`. Single `useEffect` for one-shot hydration on first mount with cleanup. Returns `{ status, userId, email, jwt }` typed object. Full JSDoc per Principle IX
- [X] T045 Implement `apps/mobile/src/hooks/useMeQuery.ts` wrapping TanStack `useQuery` over `apiClient.getMe`, gated `enabled: useSession().status === "active"`, `staleTime: 60_000`, `gcTime: 300_000`. Full JSDoc per Principle IX
- [X] T046 [P] Implement `apps/mobile/src/components/coming-soon/useComingSoon.ts` resolving the `feature` union (`"search" | "scan" | "profile"`) to `{ title, message, iconName }`. Co-located `type ComingSoonResult = ...` returned from the hook
- [X] T047 [P] Implement `apps/mobile/src/components/coming-soon/ComingSoonView.tsx` as a pure view component declared `const ComingSoonView: FC<ComingSoonViewProps> = ({ title, message, iconName }) => ...` per the v1.14.0 Component declaration rule. Renders title (`Type.title`), message (`Type.body`), and Ionicons glyph using design tokens from `apps/mobile/constants/theme.ts`; no store or service imports
- [X] T048 Implement `apps/mobile/src/components/coming-soon/ComingSoonContainer.tsx` as `const ComingSoonContainer: FC<ComingSoonContainerProps> = ({ feature }) => { const { title, message, iconName } = useComingSoon({ feature }); return <ComingSoonView title={title} message={message} iconName={iconName} />; }`. Depends on T046 + T047
- [X] T049 Update `apps/mobile/app/_layout.tsx` (Root Stack — Layout layer; bootstrap-supplied stub) to `const RootLayout: FC = () => (<QueryClientProvider client={queryClient}><Stack screenOptions={...} /></QueryClientProvider>)`. Hosts the global error boundary. Default-export the component. Apply `Colors.dark` background by default. Depends on T041
- [X] T050 Implement `apps/mobile/app/index.tsx` (entry route) as `const Index: FC = () => { const { status } = useSession(); return status === 'active' ? <Redirect href="/binder" /> : <Redirect href="/login" />; }`. Default-export the component. Depends on T044
- [X] T051 Implement `apps/mobile/app/(authenticated)/_layout.tsx` (auth gate — Layout layer) as `const AuthenticatedLayout: FC = () => { const { status } = useSession(); if (status !== 'active') return <Redirect href="/login" />; return <Stack />; }`. Default-export. Depends on T044
- [X] T052 Implement `apps/mobile/app/(authenticated)/(tabs)/_layout.tsx` (Tabs — Layout layer) declaring exactly four `<Tabs.Screen />` entries (Binder, Search, Scan, Profile) in the v3-wireframe order with Binder as `initialRouteName`. Each screen sets its `tabBarLabel` and Ionicons `tabBarIcon`. Apply `Colors.dark.tabBarBackground` and `Colors.dark.tabIconSelected` (gold) / `Colors.dark.tabIconDefault` (rose) from theme tokens. Default export `const TabsLayout: FC = () => <Tabs ...>...</Tabs>`
- [X] T053 [P] Implement `apps/mobile/app/(authenticated)/(tabs)/search.tsx` as `const Search: FC = () => <ComingSoonContainer feature="search" />; export default Search;`. Depends on T048
- [X] T054 [P] Implement `apps/mobile/app/(authenticated)/(tabs)/scan.tsx` as `const Scan: FC = () => <ComingSoonContainer feature="scan" />; export default Scan;`. Depends on T048
- [X] T055 [P] Implement `apps/mobile/app/(authenticated)/(tabs)/profile.tsx` as `const Profile: FC = () => <ComingSoonContainer feature="profile" />; export default Profile;`. Depends on T048

**Checkpoint**: Workspace boots in `expo start`; an unauthenticated user sees the (empty) Login route via `app/index.tsx` redirect; the authenticated tab navigator renders Search/Scan/Profile placeholders styled with the wireframe v3 design tokens. US1 and US2 implementation phases can now run in parallel.

---

## Phase 3: User Story 1 — Sign In with Google (Priority: P1) 🎯 MVP

**Goal**: Deliver Google-only sign-in with the 7-day session, the allowlist-rejection
"access not yet granted" screen, and the sign-out flow that revokes the Google grant
(FR-001 through FR-008).

**Independent Test**: Launch the app on a simulator, tap "Sign in with Google", complete
Google's auth in a test account on the server allowlist, and confirm the app lands inside
the authenticated tab navigator (the Binder tab will be empty until US2 lands; an empty
state is acceptable for this independent test). Repeat with a non-allowlisted account and
confirm the AccessDenied screen renders. Sign out and confirm the next sign-in re-presents
the full Google consent flow.

### Tests for User Story 1 (Jest unit tests REQUIRED — write FIRST and confirm RED)

- [X] T056 [P] [US1] Author Jest tests in `apps/mobile/src/hooks/useGoogleSignInMutation.test.ts` wrapping TanStack `useMutation` over `apiClient.signInWithGoogle`; `retry: 0`; on success persists session via `sessionStorage` and updates `sessionStore`; on 401 (`AUTH_INVALID_GOOGLE_TOKEN`) surfaces a retryable error per FR-004; on 403 (`AUTH_NOT_ALLOWLISTED`) routes to AccessDenied per FR-005
- [X] T057 [P] [US1] Author Jest tests in `apps/mobile/src/hooks/useSignOutMutation.test.ts` wrapping TanStack `useMutation` over `apiClient.signOut`; runs the full side-effect chain even when the server call fails (delete secure-store keys, revoke Google grant, reset Zustand stores, call `queryClient.clear()`, navigate to Login per `contracts/api-client.md`); `retry: 0`
- [X] T058 [P] [US1] Author Jest tests in `apps/mobile/src/components/login/useLogin.test.ts` covering: tap-to-sign-in dispatches the Google flow (FR-002, FR-003); successful auth + active session navigates to `/binder` (US1.AS3); cancellation/outage surfaces a retryable error and stays on Login (FR-004); 403 navigates to AccessDenied (FR-005, US1.AS5); already-active session on launch skips Login (FR-006, US1.AS6); sign-out path revokes Google + clears JWT (FR-008, US1.AS7); and `onSignInPress`/`onSignOutPress` references remain identity-stable across re-renders when their dependencies are unchanged (v1.16.0 memoisation rule)
- [X] T059 [P] [US1] Author Jest tests in `apps/mobile/src/components/login/LoginView.test.tsx` rendering the Collectors Album masthead via `Type.display` + `Colors.dark.accent` (gold), `Type.overline` for "ULTRA · ESTABLISHED · 1972", a single white-surface "Sign in with Google" CTA at `Touch.buttonHeight`, no username/password fields (FR-002), error banner when `errorMessage` prop is set, and disabled CTA when `isSigningIn` is `true`
- [X] T060 [P] [US1] Author Jest tests in `apps/mobile/src/components/access-denied/useAccessDenied.test.ts` covering "try a different account" → sign-out + navigate to Login (FR-005), and contact CTA opens the configured mailto/URL
- [X] T061 [P] [US1] Author Jest tests in `apps/mobile/src/components/access-denied/AccessDeniedView.test.tsx` rendering the "access not yet granted" copy via `Type.title` + `Type.body` and the contact CTA on the crimson background
- [X] T062 [P] [US1] Author Jest tests in `apps/mobile/app/login.test.tsx` proving the route is a one-line shell rendering exactly `<LoginContainer />`
- [X] T063 [P] [US1] Author Jest tests in `apps/mobile/app/access-denied.test.tsx` proving the route is a one-line shell rendering exactly `<AccessDeniedContainer />`

### Implementation for User Story 1

- [X] T064 [P] [US1] Implement `apps/mobile/src/hooks/useGoogleSignInMutation.ts` as a TanStack `useMutation` wrapper over `apiClient.signInWithGoogle` with the side effects above. Full JSDoc per Principle IX
- [X] T065 [P] [US1] Implement `apps/mobile/src/hooks/useSignOutMutation.ts` as a TanStack `useMutation` wrapper over `apiClient.signOut` running the documented sign-out chain even on server failure. Full JSDoc per Principle IX
- [X] T066 [P] [US1] Implement `apps/mobile/src/components/login/useLogin.ts` composing `useGoogleAuthRequest`, `useGoogleSignInMutation`, `useSignOutMutation`, `useSession`, and `useRouter` (from `expo-router`). Returns `{ isSigningIn, errorMessage, onSignInPress }`. Full JSDoc per Principle IX
- [X] T067 [P] [US1] Implement `apps/mobile/src/components/login/LoginView.tsx` as `const LoginView: FC<LoginViewProps> = ({ isSigningIn, errorMessage, onSignInPress }) => ...` per the v1.14.0 Component declaration rule. Renders the wireframe v3 front page: `Colors.dark.background` crimson gradient, `Type.overline` masthead "ULTRA · ESTABLISHED · 1972", binder glyph in `Colors.dark.accent`, `Type.display` "Collectors Album" title (italic serif), `Type.subtitleItalic` "digital edition", and a `Colors.light.background`-surfaced "Sign in with Google" CTA at `Touch.buttonHeight` / `Radius.pill` with `Type.bodyStrong`. Optional error banner uses `Colors.dark.error`. No store/service imports
- [X] T068 [US1] Implement `apps/mobile/src/components/login/LoginContainer.tsx` as `const LoginContainer: FC = () => { const { isSigningIn, errorMessage, onSignInPress } = useLogin(); return <LoginView isSigningIn={isSigningIn} errorMessage={errorMessage} onSignInPress={onSignInPress} />; }`. Depends on T066 + T067
- [X] T069 [P] [US1] Implement `apps/mobile/src/components/access-denied/useAccessDenied.ts` exposing `{ contactHref, onTryDifferentAccount }`. Full JSDoc per Principle IX
- [X] T070 [P] [US1] Implement `apps/mobile/src/components/access-denied/AccessDeniedView.tsx` as `const AccessDeniedView: FC<AccessDeniedViewProps> = ({ contactHref, onTryDifferentAccount }) => ...` per the v1.14.0 Component declaration rule. Uses `Colors.dark.background` + `Type.title` headline + `Type.body` for the explanatory copy, `Colors.dark.accent` for the contact CTA
- [X] T071 [US1] Implement `apps/mobile/src/components/access-denied/AccessDeniedContainer.tsx` as `const AccessDeniedContainer: FC = () => { const { contactHref, onTryDifferentAccount } = useAccessDenied(); return <AccessDeniedView contactHref={contactHref} onTryDifferentAccount={onTryDifferentAccount} />; }`. Depends on T069 + T070
- [X] T072 [US1] Implement `apps/mobile/app/login.tsx` as `const Login: FC = () => <LoginContainer />; export default Login;`. Depends on T068
- [X] T073 [US1] Implement `apps/mobile/app/access-denied.tsx` as `const AccessDenied: FC = () => <AccessDeniedContainer />; export default AccessDenied;`. Depends on T071

**Checkpoint**: User Story 1 is independently testable — sign-in (allowlisted), allowlist rejection, and sign-out + re-consent all work end-to-end against the running server, and the front-page screen visually matches `front-page.png` from the spec.

---

## Phase 4: User Story 2 — Browse the Binder (Priority: P2)

**Goal**: Render the user's collection in a 3×3 grid that visually mirrors a physical
9-pocket binder page, with forward/back page navigation across the full collection
(FR-009 through FR-014).

**Independent Test**: With an active session (seeded via test harness or by completing
US1 sign-in), render the `Binder` tab and confirm the 3×3 grid appears, occupied slots
show the front-face image, empty slots show the empty-pocket variant, the page indicator
reads `1 / N`, and forward/back navigation moves through pages without phantom cards on
partial last pages (Edge Case in spec). Repeat for collection sizes 0, 9, 11, and 1000
to cover SC-007.

### Tests for User Story 2 (Jest unit tests REQUIRED — write FIRST and confirm RED)

- [ ] T074 [P] [US2] Author Jest tests in `apps/mobile/src/hooks/useCardsInfiniteQuery.test.ts` wrapping TanStack `useInfiniteQuery` against `apiClient.getCards` per `contracts/api-client.md`: page concatenation until `nextCursor === null`, `staleTime: 5 * 60_000`, `gcTime: 30 * 60_000`, `enabled: useSession().status === "active"`, and the global retry policy (3 on 5xx/network, 0 on 4xx)
- [ ] T075 [P] [US2] Author Jest tests in `apps/mobile/src/components/binder-home/useBinderHome.test.ts` covering composition with `useCardsInfiniteQuery` + `binderStore.currentPage`; total page count from `cards.length` (FR-013, SC-007); forward/backward bounds (FR-012); empty-collection state (page 1 of 1, all slots empty — Edge Case + US2.AS3); never produces phantom cards on partial last pages; maps TanStack `isPending`/`isError`/`isFetching` flags into the view-prop shape; and the `slots` array, `onPrev`/`onNext` handlers, and any other returned non-primitives keep referentially stable across re-renders when their input deps are unchanged (v1.16.0 memoisation rule — `slots` is `useMemo` over `(cards, currentPage)`; handlers are `useCallback`)
- [ ] T076 [P] [US2] Author Jest tests in `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx` rendering the 3×3 grid (FR-009) inside `react-native-pager-view`, occupied slots use `expo-image` with the `frontFaceImageUrl` (FR-010) on a `Colors.dark.pocketEmpty` pocket background, empty slots render the `Colors.dark.pocketEmpty` empty-pocket variant (FR-011), `previous`/`next` controls fire `onPrev`/`onNext` props, the page indicator string matches `currentPage / totalPages` (FR-014) using `Type.caption`, and the page-turn animation duration matches `Motion.pageTurn`
- [ ] T077 [P] [US2] Author Jest tests in `apps/mobile/app/(authenticated)/(tabs)/binder.test.tsx` proving the route is a one-line shell rendering exactly `<BinderHomeContainer />`

### Implementation for User Story 2

- [ ] T078 [P] [US2] Implement `apps/mobile/src/hooks/useCardsInfiniteQuery.ts` as a TanStack `useInfiniteQuery` wrapper over `apiClient.getCards` with `getNextPageParam: (last) => last.nextCursor ?? undefined`. Full JSDoc per Principle IX
- [ ] T079 [P] [US2] Implement `apps/mobile/src/components/binder-home/useBinderHome.ts` composing `useCardsInfiniteQuery` and `binderStore`. Returns `{ pageNumber, totalPages, slots, loadState, errorMessage, onPrev, onNext }`. Full JSDoc per Principle IX
- [ ] T080 [P] [US2] Implement `apps/mobile/src/components/binder-home/BinderHomeView.tsx` as `const BinderHomeView: FC<BinderHomeViewProps> = ({ pageNumber, totalPages, slots, loadState, errorMessage, onPrev, onNext }) => ...` per the v1.14.0 Component declaration rule. Renders the 3×3 grid via `react-native-pager-view` and `expo-image`; pocket background `Colors.dark.pocketEmpty`, page indicator `Type.caption` + `Colors.dark.textMuted`, page-turn duration `Motion.pageTurn`. No store/service imports
- [ ] T081 [US2] Implement `apps/mobile/src/components/binder-home/BinderHomeContainer.tsx` as `const BinderHomeContainer: FC = () => { const { pageNumber, totalPages, slots, loadState, errorMessage, onPrev, onNext } = useBinderHome(); return <BinderHomeView pageNumber={pageNumber} totalPages={totalPages} slots={slots} loadState={loadState} errorMessage={errorMessage} onPrev={onPrev} onNext={onNext} />; }`. Depends on T079 + T080
- [ ] T082 [US2] Implement `apps/mobile/app/(authenticated)/(tabs)/binder.tsx` as `const Binder: FC = () => <BinderHomeContainer />; export default Binder;`. Depends on T081

**Checkpoint**: Both User Stories operate end-to-end. The Binder tab renders the user's collection across pages on the wireframe-v3 crimson background; the other three tabs still show "Coming Soon" placeholders.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T083 [P] Create `apps/mobile/docs/architecture.md` documenting the four-layer Principle X split for this workspace, the v1.14.0 `FC` / `PropsWithChildren` component-declaration rule, the v1.15.0 SDK 54 / RN 0.81.5 / React 19.1 / Expo Router 6 / TS 5.9 tech-stack pin, the v1.16.0 Hook return-value memoisation rule (with the canonical `useCallback`/`useMemo` patterns from `useLogin` and `useBinderHome`), the `useEffect` discipline rules, and how view components consume design tokens from `apps/mobile/constants/theme.ts`. Include concrete examples from the implemented features
- [ ] T084 [P] Create `apps/mobile/docs/auth.md` documenting the Google OAuth flow (`expo-auth-session`), the 7-day session policy, the allowlist rejection path, and the sign-out side-effect chain (revoke → clear secure-store → reset stores → `queryClient.clear()` → navigate Login)
- [ ] T085 Run `turbo typecheck` from the repo root and confirm zero errors across `@my-binder/core`, `@my-binder/server`, and `@my-binder/mobile`
- [ ] T086 Run `pnpm --filter @my-binder/mobile test --coverage` from the repo root and confirm every threshold in `apps/mobile/jest.config.ts` passes (80% global, 90/95% on the load-bearing hooks)
- [ ] T087 Run `pnpm --filter @my-binder/mobile lint` and confirm `react-hooks/exhaustive-deps` reports zero violations. Manually review every hook in `apps/mobile/src/hooks/` and `apps/mobile/src/components/<feature>/use<Feature>.ts` for v1.16.0 memoisation compliance: every returned function MUST be wrapped in `useCallback`, every returned object/array/instance MUST be wrapped in `useMemo`, and every dependency array MUST be exhaustive. Suppressions of `exhaustive-deps` are only permitted with an adjacent comment naming the invariant that makes the missing dep safe
- [ ] T088 Run `turbo build --filter=@my-binder/mobile` from the repo root and confirm the workspace builds cleanly under SDK 54
- [ ] T089 Execute the manual checks in `specs/002-mobile-binder-app/quickstart.md` §"End-to-end success criteria" (SC-001 through SC-008) plus the "Tab shell verification" table on at least one iOS Simulator and one Android emulator
- [ ] T090 Update the root `CLAUDE.md` "Recent Changes" section with the spec 002 completion note (workspace re-bootstrapped on SDK 54, US1 + US2 shipped, constitution v1.15.0 enforced)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. **Blocks both user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational completion. Independent of US2.
- **User Story 2 (Phase 4)**: Depends on Foundational completion. Independent of US1.
- **Polish (Phase 5)**: Depends on US1 + US2 completion (and at minimum, on whichever stories are being shipped).

### Within Phase 1 (Setup) — bootstrap cleanup

- **T001, T002, T003, T004, T005** are independent file-level operations and can run in parallel.
- **T006 `pnpm install`** depends on T004 (delete `package-lock.json`) and T007 (package.json scripts/deps cleanup) — schedule T007 just before T006.
- **T008 + T009** run after T006 (need a clean pnpm install before adding more deps).
- **T010, T011, T012, T013, T014, T015, T016** can run in parallel after T006.
- **T017** is the verification gate at the end.

### Within Phase 2 (Foundational)

- **All test tasks (T018–T034)** can run in parallel — different files, no cross-dependencies.
- **Stores, utils, services that don't import each other** (T035, T036, T037, T038, T039, T042, T043, T046, T047) can run in parallel.
- **T040 `apiClient.ts`** depends on `@my-binder/core` schemas and `sessionStore.ts` (T036).
- **T041 `queryClient.ts`** depends on `apiClient.ts` (T040) for `ApiError` and on `sessionStore` for routing.
- **T044 `useSession.ts`** depends on T036 + T038.
- **T045 `useMeQuery.ts`** depends on T040 + T041 + T044.
- **T048 `ComingSoonContainer.tsx`** depends on T046 + T047.
- **T049 `app/_layout.tsx`** depends on T041 (`queryClient`).
- **T050 `app/index.tsx`** depends on T044 (`useSession`).
- **T051 `app/(authenticated)/_layout.tsx`** depends on T044.
- **T052 `app/(authenticated)/(tabs)/_layout.tsx`** depends on `theme.ts` (already in place) for tab-bar tokens.
- **T053, T054, T055** (search/scan/profile tab files) depend on T048 (`ComingSoonContainer`).

### Within Phase 3 (US1)

- **All test tasks (T056–T063)** can run in parallel.
- **T064, T065, T066, T067, T069, T070** can run in parallel (different files).
- **T068 `LoginContainer.tsx`** depends on T066 + T067.
- **T071 `AccessDeniedContainer.tsx`** depends on T069 + T070.
- **T072 `app/login.tsx`** depends on T068.
- **T073 `app/access-denied.tsx`** depends on T071.

### Within Phase 4 (US2)

- **All test tasks (T074–T077)** can run in parallel.
- **T078, T079, T080** can run in parallel.
- **T081 `BinderHomeContainer.tsx`** depends on T079 + T080.
- **T082 `app/(authenticated)/(tabs)/binder.tsx`** depends on T081.

### Within Phase 5 (Polish)

- **T083 + T084** can run in parallel (different docs).
- **T085, T086, T087, T088** are verification gates and can run in parallel; each must pass before the feature is declared shipped.
- **T089** is manual and depends on T085–T088 having passed.
- **T090** depends on the full feature being verified.

---

## Parallel Example: Phase 1 — bootstrap cleanup

```bash
# All file-level cleanup tasks target distinct paths and have no dependencies:
T001  app/modal.tsx (delete)
T002  hooks/use-color-scheme.ts, use-color-scheme.web.ts, use-theme-color.ts (delete)
T003  scripts/reset-project.js + scripts/ (delete)
T004  package-lock.json (delete)
T005  tsconfig.json (rewrite paths)
# After all of the above land, run T007 (package.json edits) → T006 (pnpm install) sequentially.
# Then T008–T016 in parallel, then T017 verification.
```

## Parallel Example: Phase 2 Test Authoring

```bash
# All foundational test files target distinct paths and have no source dependencies
# (the source files don't exist yet — that's the point of writing tests first).
T018  src/utils/pageMath.test.ts
T019  src/stores/sessionStore.test.ts
T020  src/stores/binderStore.test.ts
T021  src/services/auth/sessionStorage.test.ts
T022  src/services/auth/googleAuth.test.ts
T023  src/services/api/apiClient.test.ts
T024  src/services/api/queryClient.test.ts
T025  src/hooks/useSession.test.ts
T026  src/hooks/useMeQuery.test.ts
T027  src/components/coming-soon/useComingSoon.test.ts
T028  src/components/coming-soon/ComingSoonView.test.tsx
T029  app/index.test.tsx
T030  app/(authenticated)/_layout.test.tsx
T031  app/(authenticated)/(tabs)/_layout.test.tsx
T032  app/(authenticated)/(tabs)/search.test.tsx
T033  app/(authenticated)/(tabs)/scan.test.tsx
T034  app/(authenticated)/(tabs)/profile.test.tsx
```

## Parallel Example: Phase 3 (US1) — Hooks + Views

```bash
# After T056–T063 land RED, the hooks and views can be authored in parallel:
T064  src/hooks/useGoogleSignInMutation.ts
T065  src/hooks/useSignOutMutation.ts
T066  src/components/login/useLogin.ts
T067  src/components/login/LoginView.tsx
T069  src/components/access-denied/useAccessDenied.ts
T070  src/components/access-denied/AccessDeniedView.tsx
# T068 and T071 (Containers) join after their hook + view land.
```

## Parallel Example: Phase 4 (US2) — Hooks + Views

```bash
T078  src/hooks/useCardsInfiniteQuery.ts
T079  src/components/binder-home/useBinderHome.ts
T080  src/components/binder-home/BinderHomeView.tsx
# T081 (Container) joins after T079 + T080.
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (Setup / bootstrap cleanup).
2. Complete Phase 2 (Foundational) — including the `(tabs)` layout and the three Coming
   Soon stub tabs so the auth-success landing surface looks correct even with US2 deferred.
3. Complete Phase 3 (US1).
4. **Stop and validate**: sign-in, allowlist rejection, sign-out + re-consent all work
   end-to-end. The Binder tab is empty (a placeholder is acceptable for MVP).
5. Optionally ship a TestFlight / internal Android build at this point.

### Incremental Delivery

1. MVP (above) ships US1.
2. Phase 4 ships US2 — the Binder tab becomes live without changes to any other route.
3. Phase 5 polishes documentation, verifies coverage and typecheck, and runs the manual
   quickstart matrix on iOS + Android.

### Parallel Team Strategy

Once Phase 2 (Foundational) lands:

- Developer A picks up Phase 3 (US1).
- Developer B picks up Phase 4 (US2).
- The two phases share no source files, so the work is genuinely parallel — only the
  Polish phase needs both streams green.

---

## Notes

- **Constitution v1.16.0**: every non-primitive value returned from any hook in
  `apps/mobile/src/components/<feature>/use<Feature>.ts` or `apps/mobile/src/hooks/`
  MUST be memoised — functions via `useCallback`, objects/arrays/instances via
  `useMemo`. Primitives are exempt. Values read straight from a Zustand selector or a
  TanStack Query result are already reference-stable; values *derived* from them
  must be memoised at the hook boundary. ESLint's `react-hooks/exhaustive-deps`
  catches missing dependencies but does not catch missing memoisation; reviewers must.
- **Constitution v1.15.0**: every install/upgrade in this feature MUST resolve compatible
  versions of Expo SDK ~54.0, RN 0.81.5, React 19.1, Expo Router ~6.0, TypeScript ~5.9.
  Adding a dependency that forces a version skew (e.g., one that pins React 18 or RN
  ≤0.80) requires a constitution amendment.
- **Constitution v1.14.0**: every functional component declared in this feature MUST be
  `const Foo: FC<FooProps> = (...) => { ... }` (or `FC<PropsWithChildren<FooProps>>` when
  the component renders `children`). The `<Component>Props` type lives in the same file.
  This is enforced by code review; ESLint flags `react-hooks/exhaustive-deps` violations
  but does not (yet) enforce the FC-declaration rule, so reviewers must catch it.
- **Design tokens**: views import colour, type, spacing, radius, elevation, motion, and
  touch-target tokens from `apps/mobile/constants/theme.ts`. Hard-coded hex values or
  pixel literals in views are a Principle V (transparency / no magic literals) violation.
- **Tests fail before implementation**: every test task in Phase 2/3/4 MUST land RED
  before the matching implementation task is started. Commit the RED tests separately
  from the implementation that turns them GREEN so the Red→Green transition is visible
  in `git log`.
- **No Container.test.tsx files**: Containers are one-line glue per Principle X; their
  behaviour is covered by the Hook test (logic) and the View test (render). Adding a
  Container test would duplicate coverage.
- **Bootstrap pre-state acknowledged**: tasks assume the SDK 54 bootstrap layout
  (already on disk: `app/_layout.tsx`, `app.json`, `eslint.config.js`, `expo-env.d.ts`,
  `assets/`, `constants/theme.ts`, `tsconfig.json` with `@/*` alias). Phase 1 cleanup
  brings it into compliance; Phases 2–5 build on top. Do NOT delete `apps/mobile/`
  wholesale and start over — the bootstrap is the agreed baseline per spec.md
  Clarifications §2026-05-02.
- **Branch name caveat**: the current branch is `feat/002-scaffold-mobile-app`, which
  does not match speckit's `NNN-name` convention. Either rename to `002-mobile-binder-app`
  before merging or accept the deviation (matches `plan.md`'s branch note).
