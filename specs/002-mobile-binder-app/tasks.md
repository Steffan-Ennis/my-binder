# Tasks: Mobile Binder App

**Input**: Design documents from `/specs/002-mobile-binder-app/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-client.md ✅, quickstart.md ✅

**Tests**: Per Constitution Principle III, **Jest unit tests are REQUIRED** for every new
module. Tests are written FIRST and MUST FAIL before implementation lands. Co-location rule:
`<filename>.test.ts(x)` sits next to the file under test. Contract / integration tests are
NOT generated for this feature (none requested in spec, none required by plan).

**Organization**: Tasks are grouped by user story so each story can be implemented and
tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to a user story (US1 = Sign in with Google P1; US2 = Browse the binder home P2)
- Setup, Foundational, and Polish phases carry NO story label

## Path Conventions

- New workspace at `apps/mobile/` (pnpm + Turborepo workspace `@my-binder/mobile`)
- Routes: `apps/mobile/app/...` (Expo Router 4 file-based routing)
- Feature code: `apps/mobile/src/{components,hooks,services,stores,utils}/`
- All paths below are absolute from repo root unless otherwise noted

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new `@my-binder/mobile` workspace, declare its dependencies, wire
it into the existing pnpm + Turborepo monorepo, and prepare local config so subsequent
phases can run `pnpm --filter @my-binder/mobile test` without surprises.

- [ ] T001 Create the `apps/mobile/` workspace directory tree (`app/`, `app/(authenticated)/`, `app/(authenticated)/(tabs)/`, `src/components/{login,binder-home,access-denied,coming-soon}/`, `src/hooks/`, `src/services/{api,auth}/`, `src/stores/`, `src/utils/`)
- [ ] T002 Create `apps/mobile/package.json` declaring `name: "@my-binder/mobile"`, `"main": "expo-router/entry"`, scripts (`dev`, `test`, `typecheck`, `lint`), and runtime deps from plan.md (React Native 0.76, Expo SDK 52, expo-router 4, @tanstack/react-query 5, zustand 5, expo-auth-session, expo-secure-store, expo-image, react-native-pager-view, @expo/vector-icons, ajv 8, `@my-binder/core: workspace:*`) plus dev deps (jest 30, ts-jest, jest-expo, @testing-library/react-native 12, react-test-renderer, @tanstack/react-query-devtools, typescript 5)
- [ ] T003 [P] Create `apps/mobile/tsconfig.json` extending `expo/tsconfig.base`, `strict: true`, `baseUrl: "."`, `paths: { "@root/*": ["*"], "@src/*": ["src/*"] }`
- [ ] T004 [P] Create `apps/mobile/babel.config.js` using `babel-preset-expo` (includes the `expo-router/babel` plugin)
- [ ] T005 [P] Create `apps/mobile/jest.config.ts` with `preset: 'jest-expo'`, co-located `testMatch` (`**/?(*.)+(spec|test).ts?(x)`), and `coverageThreshold` matching plan.md §Unit Testing (80% global; 95% lines / 90% branches on `useLogin`, `useBinderHome`, `useSession`, `useCardsInfiniteQuery`, `apiClient`, `queryClient`)
- [ ] T006 [P] Create `apps/mobile/jest.setup.ts` with module mocks for `expo-secure-store` and `expo-auth-session/providers/google`
- [ ] T007 [P] Create `apps/mobile/app.json` (slug `my-binder-mobile`, scheme `mybinder`, `ios.bundleIdentifier`, `android.package`, splash + icon stubs, `extra.apiBaseUrl` placeholder)
- [ ] T008 [P] Create `apps/mobile/app.config.ts` that loads `apps/mobile/.env.local` via Node `--env-file` (matches the `apps/server` convention) and injects `API_BASE_URL`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID` into `expo.extra`
- [ ] T009 [P] Create `apps/mobile/.env.example` documenting `API_BASE_URL`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID` (per quickstart.md §1)
- [ ] T010 [P] Create `apps/mobile/.gitignore` covering `.env.local`, `.expo/`, `node_modules/`, `coverage/`, `*.tsbuildinfo`
- [ ] T011 Run `pnpm install` from repo root so the new workspace is registered (root `pnpm-workspace.yaml` already globs `apps/*`); confirm `pnpm --filter @my-binder/mobile exec tsc --noEmit` exits cleanly on the empty source tree

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the cross-cutting layer that BOTH user stories depend on — schema-validating
API client, TanStack `QueryClient` singleton with retry/onError routing, secure session
storage, session store + hook, page math util, the routing skeleton (Root Stack, auth gate,
4-tab navigator), and the shared `<ComingSoonContainer />` that mounts on the Search/Scan/Profile
tabs.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

### Tests for Foundational (Jest, REQUIRED — write FIRST, ensure they FAIL) ⚠️

- [ ] T012 [P] Create `apps/mobile/src/services/api/ApiError.test.ts` covering construction, `status`, `code`, and Principle VIII logging behaviour
- [ ] T013 [P] Create `apps/mobile/src/services/api/apiClient.test.ts` covering bearer-header attachment from `sessionStore`, JSON serialisation, Ajv validation success + failure (`SchemaValidationError`), and error mapping for 400 / 401 (`AUTH_INVALID_TOKEN` & `AUTH_INVALID_GOOGLE_TOKEN`) / 403 (`AUTH_NOT_ALLOWLISTED`) / 5xx / network rejection (synthetic `NETWORK_OFFLINE`)
- [ ] T014 [P] Create `apps/mobile/src/services/api/queryClient.test.ts` covering `defaultOptions.queries.retry` skipping 4xx, `retryDelay` schedule (1s → 2s → 4s, capped 30s), `defaultOptions.mutations.retry === 0`, `refetchOnWindowFocus: false`, `retryOnMount: false`, `queryCache.onError` routing 401 → clear session + navigate Login, `mutationCache.onError` routing 403 → navigate AccessDenied
- [ ] T015 [P] Create `apps/mobile/src/services/auth/sessionStorage.test.ts` covering read/write/clear of `session.jwt` and `session.iat` via `expo-secure-store`; never falls back to `AsyncStorage`
- [ ] T016 [P] Create `apps/mobile/src/stores/sessionStore.test.ts` covering set/clear, selector stability under `subscribeWithSelector`, and `status` transitions
- [ ] T017 [P] Create `apps/mobile/src/hooks/useSession.test.ts` covering hydration from secure storage on first call, expiry computed against `SESSION_JWT_TTL_DAYS` from `@my-binder/core` (FR-006, FR-007), and cleanup on unmount
- [ ] T018 [P] Create `apps/mobile/src/utils/pageMath.test.ts` asserting `pageCount(0) === 1`, `pageCount(9) === 1`, `pageCount(10) === 2`, `pageCount(1000) === 112`, plus partial-last-page slot indexing
- [ ] T019 [P] Create `apps/mobile/src/components/coming-soon/useComingSoon.test.ts` covering `feature` union (`"search" | "scan" | "profile"`) → wireframe-aligned title/message/Ionicons glyph; throws on unrecognised value
- [ ] T020 [P] Create `apps/mobile/src/components/coming-soon/ComingSoonView.test.tsx` (renders title/message/icon from props; accessibility role announces feature; no store/service imports — Principle X view purity)
- [ ] T021 [P] Create `apps/mobile/app/index.test.tsx` covering redirect to `/login` when no session and to `/binder` when a hydrated session is `≤ 7d` old (FR-001, FR-006, SC-006); uses `expo-router/testing-library`
- [ ] T022 [P] Create `apps/mobile/app/(authenticated)/_layout.test.tsx` covering `<Redirect href="/login" />` when `useSession().status !== "active"`, else renders the child `<Stack />`
- [ ] T023 [P] Create `apps/mobile/app/(authenticated)/(tabs)/_layout.test.tsx` covering exactly 4 tabs in wireframe order (Binder, Search, Scan, Profile), Binder is the initial route, each tab declares its `@expo/vector-icons` glyph, active-state styling matches the wireframe
- [ ] T024 [P] Create `apps/mobile/app/(authenticated)/(tabs)/search.test.tsx`, `scan.test.tsx`, and `profile.test.tsx` — each asserts the route file is a one-line shell rendering exactly `<ComingSoonContainer feature="…" />` with no local state (Principle X)

### Implementation for Foundational

- [ ] T025 Create `apps/mobile/src/services/api/ApiError.ts` (typed error class with `status`, `code: ErrorCode`, original-cause preservation per Principle VIII)
- [ ] T026 Create `apps/mobile/src/services/api/apiClient.ts` exposing typed methods `getCards`, `getMe`, `signInWithGoogle`, `signOut`; `fetch` + bearer attachment from `sessionStore`; reads `extra.apiBaseUrl` from `expo-constants`; runs Ajv validation against `@my-binder/core/schemas/{auth,card}.json` BEFORE returning; maps server `error.code` values to `ApiError` instances per `contracts/api-client.md` Error Mapping table; logs original error before throwing (Principle VIII)
- [ ] T027 Create `apps/mobile/src/services/api/queryClient.ts` exporting a singleton `QueryClient` configured per research.md §11: `retry` predicate skipping 4xx, `retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30_000)`, `refetchOnWindowFocus: false`, `retryOnMount: false`, `defaultOptions.mutations.retry: 0`; registers `queryCache.onError` and `mutationCache.onError` to route `AUTH_INVALID_TOKEN` → clear session + navigate `/login` and `AUTH_NOT_ALLOWLISTED` → navigate `/access-denied`
- [ ] T028 [P] Create `apps/mobile/src/services/api/index.ts` as a pure barrel re-export (Principle IX)
- [ ] T029 [P] Create `apps/mobile/src/services/auth/sessionStorage.ts` wrapping `expo-secure-store` for `session.jwt` and `session.iat`; on clear, deletes both keys; never touches `AsyncStorage`
- [ ] T030 [P] Create `apps/mobile/src/services/auth/index.ts` as a pure barrel re-export (Principle IX) — populated incrementally as US1 lands `googleAuth.ts`
- [ ] T031 Create `apps/mobile/src/stores/sessionStore.ts` (Zustand 5 with `subscribeWithSelector`; fields per data-model.md §Session: `jwt`, `iat`, `userId`, `email`, `status`; selectors `selectStatus`, `selectJwt`, `selectIdentity` returning stable references)
- [ ] T032 Create `apps/mobile/src/hooks/useSession.ts` (subscribes to `sessionStore`; hydrates from `sessionStorage` once via a mount-time `useEffect` with empty cleanup — the legitimate Principle X external-system case; computes `status` from `iat + SESSION_JWT_TTL_DAYS * 86400` against `Date.now() / 1000`)
- [ ] T033 [P] Create `apps/mobile/src/utils/pageMath.ts` (pure functions: `pageCount(n)`, `slotIndex(absoluteIndex)`, `pageSlice(cards, currentPage)`)
- [ ] T034 Create `apps/mobile/src/components/coming-soon/useComingSoon.ts` (typed `feature: "search" | "scan" | "profile"` → `{ title, message, iconName }` from a const map; throws on unrecognised values)
- [ ] T035 Create `apps/mobile/src/components/coming-soon/ComingSoonView.tsx` (props-only: `title`, `message`, `iconName`; renders an `<Ionicons />` glyph + `<Text />` block; accessibility role `header`)
- [ ] T036 Create `apps/mobile/src/components/coming-soon/ComingSoonContainer.tsx` (accepts `feature` prop; destructures `useComingSoon(feature)`; passes named props to `<ComingSoonView />`)
- [ ] T037 Create `apps/mobile/app/_layout.tsx` (Root Stack: providers, error boundary, theme; mounts `<QueryClientProvider client={queryClient}>` from `@src/services/api/queryClient`; body is `<Stack />` exposing `login`, `access-denied`, `(authenticated)` as siblings)
- [ ] T038 Create `apps/mobile/app/index.tsx` (reads `useSession()`; `<Redirect href="/login" />` when not active, else `<Redirect href="/(authenticated)/(tabs)/binder" />`)
- [ ] T039 Create `apps/mobile/app/(authenticated)/_layout.tsx` (auth gate: `<Redirect href="/login" />` when `useSession().status !== "active"`; else body is `<Stack />` so future authenticated stack routes can sit above the tabs)
- [ ] T040 Create `apps/mobile/app/(authenticated)/(tabs)/_layout.tsx` (`<Tabs />` with 4 `<Tabs.Screen />` entries — Binder, Search, Scan, Profile — Binder is the initial route, each declares an Ionicons glyph: `book(-outline)`, `search(-outline)`, `scan(-outline)`, `person(-outline)`; active state uses the filled variant per research.md §10)
- [ ] T041 [P] Create `apps/mobile/app/(authenticated)/(tabs)/search.tsx` as a one-line shell `<ComingSoonContainer feature="search" />`
- [ ] T042 [P] Create `apps/mobile/app/(authenticated)/(tabs)/scan.tsx` as a one-line shell `<ComingSoonContainer feature="scan" />`
- [ ] T043 [P] Create `apps/mobile/app/(authenticated)/(tabs)/profile.tsx` as a one-line shell `<ComingSoonContainer feature="profile" />`
- [ ] T044 Create `apps/mobile/app/(authenticated)/(tabs)/binder.tsx` as a TEMPORARY one-line shell rendering a minimal placeholder view (e.g., `<Text>Binder coming online…</Text>`); **US2 (T079) replaces the body to render `<BinderHomeContainer />`** — the placeholder exists only so the tab navigator compiles during US1

**Checkpoint**: Foundation ready. The four-tab shell renders, Search/Scan/Profile show the
"Coming Soon" placeholder, all infrastructure tests pass, and US1 + US2 can now begin —
in parallel if desired.

---

## Phase 3: User Story 1 — Sign In with Google (Priority: P1) 🎯 MVP

**Goal**: Deliver Google-only sign-in with a 7-day session, allowlist-gated access, and
sign-out that revokes the Google grant. After this phase, an allowlisted user can launch
the app, complete Google's flow in the in-app browser, and land on the placeholder Binder
tab. A non-allowlisted user lands on AccessDenied. Sign-out clears state and forces full
re-consent on next sign-in.

**Independent Test**: Launch the app, tap "Sign in with Google", complete Google's flow
in a test account that's on the server allowlist, and confirm the user lands on the Binder
tab with their identity reflected (`useMeQuery` hydrated). Repeat with a non-allowlisted
account → AccessDenied. Sign out and reopen → Google's full consent flow appears.

### Tests for User Story 1 (Jest, REQUIRED — write FIRST) ⚠️

- [ ] T045 [P] [US1] Create `apps/mobile/src/services/auth/googleAuth.test.ts` covering `expo-auth-session/providers/google` wrapping (PKCE, in-app browser per FR-003), Google revoke endpoint POST on sign-out (FR-008, US1.AS7), and user-cancellation surfaced as a typed error (FR-004)
- [ ] T046 [P] [US1] Create `apps/mobile/src/hooks/useGoogleSignInMutation.test.ts` covering wraps TanStack `useMutation` against `apiClient.signInWithGoogle`, default `retry: 0`, on success persists JWT via `sessionStorage` and updates `sessionStore`, on `AUTH_INVALID_GOOGLE_TOKEN` (401) surfaces retryable error per FR-004, on `AUTH_NOT_ALLOWLISTED` (403) routes to `/access-denied` per FR-005
- [ ] T047 [P] [US1] Create `apps/mobile/src/hooks/useMeQuery.test.ts` covering wraps TanStack `useQuery` against `apiClient.getMe`, gated on `useSession().status === "active"` via `enabled`, `staleTime: 60_000`, on 401 the global `queryCache.onError` clears local session + routes to Login, on 403 routes to AccessDenied without clearing the Google grant
- [ ] T048 [P] [US1] Create `apps/mobile/src/hooks/useSignOutMutation.test.ts` covering wraps TanStack `useMutation` against `apiClient.signOut`, `retry: 0`, runs the documented sign-out chain even when the server call fails (delete secure-store entries → revoke Google grant → reset Zustand stores → call `queryClient.clear()` → navigate `/login`)
- [ ] T049 [P] [US1] Create `apps/mobile/src/components/login/useLogin.test.ts` covering `handleSignIn` dispatches the Google flow + sign-in mutation (FR-002, FR-003), success navigates to `/binder` (US1.AS3), cancellation/outage surfaces a retryable error and stays on Login (FR-004), allowlist 403 navigates to AccessDenied (FR-005, US1.AS5), already-authenticated launch with `≤ 7d` session skips Login (FR-006, US1.AS6), `handleSignOut` revokes Google grant + clears JWT + clears the TanStack cache (FR-008, US1.AS7)
- [ ] T050 [P] [US1] Create `apps/mobile/src/components/login/LoginView.test.tsx` covering binder-themed background renders, exactly one "Sign in with Google" CTA exists, no username/password fields are present (FR-002), error banner renders when `errorMessage` prop is set, CTA disabled while `isSigningIn` prop is `true`
- [ ] T051 [P] [US1] Create `apps/mobile/app/login.test.tsx` (one-line-shell test: default export renders exactly `<LoginContainer />` with no local state — Principle X)
- [ ] T052 [P] [US1] Create `apps/mobile/src/components/access-denied/useAccessDenied.test.ts` covering "Try a different account" handler invokes sign-out + navigates to `/login` (FR-005), contact CTA opens the configured mailto / URL
- [ ] T053 [P] [US1] Create `apps/mobile/src/components/access-denied/AccessDeniedView.test.tsx` covering renders the "access not yet granted" copy, renders the contact CTA with the configured target (no store/service imports — Principle X)
- [ ] T054 [P] [US1] Create `apps/mobile/app/access-denied.test.tsx` (one-line-shell test: default export renders exactly `<AccessDeniedContainer />`)

### Implementation for User Story 1

- [ ] T055 [P] [US1] Create `apps/mobile/src/services/auth/googleAuth.ts` wrapping `expo-auth-session/providers/google` (PKCE flow, ASWebAuthenticationSession on iOS / Custom Tabs on Android per FR-003); exposes `signInWithGoogle()` returning `{ idToken, accessToken }` and `revokeGoogleGrant(accessToken)` POSTing to `https://oauth2.googleapis.com/revoke?token=<token>` per FR-008; surfaces user-cancellation as a typed `GoogleAuthError`
- [ ] T056 [P] [US1] Create `apps/mobile/src/hooks/useGoogleSignInMutation.ts` (TanStack `useMutation`; `mutationFn: apiClient.signInWithGoogle`; `retry: 0`; on success persist `{ jwt, iat }` via `sessionStorage`, set `sessionStore` to `status: "active"`, navigate to `/(authenticated)/(tabs)/binder`)
- [ ] T057 [P] [US1] Create `apps/mobile/src/hooks/useMeQuery.ts` (TanStack `useQuery`; `queryKey: ["auth", "me"]`; `queryFn: apiClient.getMe`; `staleTime: 60_000`; `gcTime: 5 * 60_000`; `enabled: useSession().status === "active"`)
- [ ] T058 [P] [US1] Create `apps/mobile/src/hooks/useSignOutMutation.ts` (TanStack `useMutation`; `mutationFn: apiClient.signOut`; `retry: 0`; an `onSettled` handler runs the side-effect chain regardless of server-call outcome — `sessionStorage.clear()` → `googleAuth.revokeGoogleGrant()` → `sessionStore.reset()` → `binderStore.reset()` → `queryClient.clear()` → `router.replace("/login")` per `contracts/api-client.md` POST /auth/signout)
- [ ] T059 [US1] Create `apps/mobile/src/components/login/useLogin.ts` (composes `useSession`, `useGoogleSignInMutation`, `useSignOutMutation`; exposes `handleSignIn`, `handleSignOut`, `errorMessage`, `isSigningIn` for the view; maps mutation `error` codes to FR-004 / FR-005 user copy)
- [ ] T060 [US1] Create `apps/mobile/src/components/login/LoginView.tsx` (props-only: binder-themed background asset, single "Sign in with Google" CTA per FR-002, optional error banner from `errorMessage`, CTA disabled when `isSigningIn`)
- [ ] T061 [US1] Create `apps/mobile/src/components/login/LoginContainer.tsx` (destructures `useLogin()` and passes named props — no spread — to `<LoginView />`)
- [ ] T062 [US1] Create `apps/mobile/app/login.tsx` as a one-line shell rendering `<LoginContainer />`
- [ ] T063 [P] [US1] Create `apps/mobile/src/components/access-denied/useAccessDenied.ts` (composes `useSignOutMutation`; exposes `handleTryDifferentAccount`, `handleContact`, `contactTarget`)
- [ ] T064 [P] [US1] Create `apps/mobile/src/components/access-denied/AccessDeniedView.tsx` (props-only: "access not yet granted" copy per FR-005, contact CTA, "try a different account" CTA)
- [ ] T065 [US1] Create `apps/mobile/src/components/access-denied/AccessDeniedContainer.tsx` (destructures `useAccessDenied()` and passes named props to `<AccessDeniedView />`)
- [ ] T066 [US1] Create `apps/mobile/app/access-denied.tsx` as a one-line shell rendering `<AccessDeniedContainer />`

**Checkpoint**: User Story 1 is fully functional and testable independently — sign-in
flow, allowlist rejection, 7-day session, and sign-out all work end-to-end. The Binder tab
still shows its placeholder body (T044); US2 lands the real grid next.

---

## Phase 4: User Story 2 — Browse the Binder Home Screen (Priority: P2)

**Goal**: Render the user's collection in a 3×3 grid that visually mirrors a physical
9-pocket binder page, with native paging (`react-native-pager-view`), occupied/empty slot
variants, and a current/total page indicator. After this phase, an authenticated user with
cards in their collection sees all of them paginated 9 to a page; an empty collection
shows page 1 of 1 with all empty slots; partial last pages do not render phantom cards.

**Independent Test**: Sign in with an account that has 0, 9, 11, and 1000 cards (in
turn — see quickstart.md SC-007); confirm the 3×3 grid renders, occupied slots show the
front-face image, empty slots use the empty-pocket variant, and pages 1, 1, 2, and 112
respectively are reachable via swipe + previous/next controls.

### Tests for User Story 2 (Jest, REQUIRED — write FIRST) ⚠️

- [ ] T067 [P] [US2] Create `apps/mobile/src/hooks/useCardsInfiniteQuery.test.ts` covering wraps TanStack `useInfiniteQuery` against `apiClient.getCards`, concatenates pages until `nextCursor === null` (matches `contracts/api-client.md` GET /cards), `staleTime: 5 * 60_000` keeps a tab-switch back to Binder from refetching within the window, gated on `useSession().status === "active"` via `enabled`, surfaces the union of all-page errors as a single `error`, respects the global retry policy (3 on 5xx/network, 0 on 4xx)
- [ ] T068 [P] [US2] Create `apps/mobile/src/stores/binderStore.test.ts` covering Zustand store holds **only** `currentPage`, initial value 1, `nextPage`/`prevPage` clamp at the bounds derived from a TanStack-supplied total, `reset()` returns to page 1 (called from `useSignOutMutation`)
- [ ] T069 [P] [US2] Create `apps/mobile/src/components/binder-home/useBinderHome.test.ts` covering composes `useCardsInfiniteQuery` and `binderStore.currentPage`, computes `totalPages = max(1, ceil(cards.length / 9))` per FR-013, pages forward/backward within bounds (FR-012), empty-collection state shows page 1 of 1 with all slots empty (Edge Case + US2.AS3), partial last page never produces phantom cards (Edge Case), maps TanStack `isPending`/`isError`/`isFetching` flags into a `loadState: "idle" | "loading" | "ready" | "error"` view-prop
- [ ] T070 [P] [US2] Create `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx` covering renders 3×3 grid (FR-009), occupied slots render `expo-image` with `frontFaceImageUrl` (FR-010), empty slots render the empty-pocket visual variant (FR-011), previous/next controls fire `onPrev`/`onNext` named props, page indicator string matches `currentPage / totalPages` (FR-014), `react-native-pager-view` is the paging primitive, no store/service imports (Principle X view purity)
- [ ] T071 [P] [US2] Create `apps/mobile/app/(authenticated)/(tabs)/binder.test.tsx` (one-line-shell test: default export renders exactly `<BinderHomeContainer />` with no local state — Principle X)

### Implementation for User Story 2

- [ ] T072 [P] [US2] Create `apps/mobile/src/hooks/useCardsInfiniteQuery.ts` (TanStack `useInfiniteQuery`; `queryKey: ["cards"]`; `queryFn: apiClient.getCards`; `getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined`; `staleTime: 5 * 60_000`; `gcTime: 30 * 60_000`; `enabled: useSession().status === "active"`)
- [ ] T073 [P] [US2] Create `apps/mobile/src/stores/binderStore.ts` (Zustand 5; field `currentPage: number`; actions `nextPage(totalPages)`, `prevPage()`, `reset()`; clamps at `[1, totalPages]`)
- [ ] T074 [US2] Create `apps/mobile/src/components/binder-home/useBinderHome.ts` (composes `useCardsInfiniteQuery` + `binderStore.currentPage`; flattens `data.pages.flatMap(p => p.cards)` into a `Card[]`; computes `totalPages` via `pageMath.pageCount`; derives the visible page slice via `pageMath.pageSlice`; maps TanStack flags into `loadState`; clamps `currentPage` if it exceeds `totalPages` after a refresh)
- [ ] T075 [US2] Create `apps/mobile/src/components/binder-home/BinderHomeView.tsx` (props-only: 3×3 grid laid out via `FlatList` with `numColumns: 3` and `getItemLayout`, `removeClippedSubviews` enabled per research.md §6; occupied slots render `<Image source={{ uri }} />` from `expo-image` with `cachePolicy="memory-disk"`; empty slots render an empty-pocket variant; page navigation via `react-native-pager-view`; current/total page indicator string at the bottom)
- [ ] T076 [US2] Create `apps/mobile/src/components/binder-home/BinderHomeContainer.tsx` (destructures `useBinderHome()` and passes named props to `<BinderHomeView />`)
- [ ] T077 [US2] Replace the body of `apps/mobile/app/(authenticated)/(tabs)/binder.tsx` (created at T044) with a one-line shell rendering `<BinderHomeContainer />`

**Checkpoint**: Both user stories work independently. US1 sign-in lands on a real Binder
grid; US2's grid is testable on its own with a stubbed `useCardsInfiniteQuery` per its
test plan.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Wire the mobile workspace into the existing Turborepo pipeline, audit for
constitution-discipline drift, run quickstart's manual checks, and update the project's
top-level documentation so future contributors know `apps/mobile` exists.

- [ ] T078 Verify `apps/mobile` is registered with Turborepo end-to-end: run `turbo dev --filter=@my-binder/mobile`, `turbo test --filter=@my-binder/mobile`, and `turbo typecheck --filter=@my-binder/mobile`, confirming each task discovers and runs the workspace
- [ ] T079 [P] Backfill JSDoc with `@example` blocks on the public-facing services (`apps/mobile/src/services/api/{apiClient,queryClient,ApiError}.ts`, `apps/mobile/src/services/auth/{googleAuth,sessionStorage}.ts`) and on the cross-feature TanStack hooks (`apps/mobile/src/hooks/{useCardsInfiniteQuery,useMeQuery,useGoogleSignInMutation,useSignOutMutation,useSession}.ts`) per Principle IX
- [ ] T080 [P] Run `pnpm --filter @my-binder/mobile test --coverage` and confirm the floors declared in `apps/mobile/jest.config.ts` are met (80 % global; 95 % lines / 90 % branches on `useLogin`, `useBinderHome`, `useSession`, `useCardsInfiniteQuery`, `apiClient`, `queryClient`)
- [ ] T081 [P] Run the quickstart.md "End-to-end success criteria (manual)" checks SC-001 → SC-008 plus the "Tab shell verification" table on at least one iOS Simulator and one Android emulator; record results in the PR description
- [ ] T082 [P] Audit every new `useEffect` in `apps/mobile/src/` against plan.md's Principle X allow-list (secure-storage hydration in `useSession`, Google auth-session result events in `useLogin`); remove or refactor any incidental ones; ensure each remaining one returns a cleanup function and has exhaustive deps
- [ ] T083 [P] Add `apps/mobile/README.md` pointing to `specs/002-mobile-binder-app/quickstart.md` and documenting the three nvm/pnpm/Expo commands needed to run locally (matches the `apps/server/README.md` pattern)
- [ ] T084 [P] Update root `CLAUDE.md` "Project Structure" to mention `apps/mobile/` and "Active Technologies" to confirm React Native 0.76 + Expo SDK 52, Expo Router 4, TanStack Query 5, Zustand 5, expo-auth-session, expo-secure-store, expo-image, react-native-pager-view, @expo/vector-icons, ajv 8, jest-expo, @testing-library/react-native 12 are now in use

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — BLOCKS all user stories.
- **Phase 3 (US1) and Phase 4 (US2)**: Both depend only on Phase 2; can proceed in parallel
  by separate developers. US2 requires the placeholder `binder.tsx` from T044 only as a
  starting point — its real body is landed in T077 (one-line shell). US2 does NOT depend
  on US1.
- **Phase 5 (Polish)**: Depends on US1 + US2 being complete.

### Within a User Story

- Tests (Principle III) — written FIRST and MUST FAIL before implementation lands.
- Services / stores / utils — built before the hooks that consume them.
- Hooks — built before containers that destructure them.
- Containers — built before route files (one-line shells).
- View files have no internal dependencies on hooks/stores (Principle X view purity), so
  view tests + view files can be parallel with hook work.

### Parallel Opportunities

- All `[P]` tasks within a phase touch different files and have no incomplete dependencies.
- All Phase 1 config-file tasks (T003 – T010) are independent of each other.
- All Foundational test files (T012 – T024) are independent of each other and of any
  implementation file in their phase — they can be authored in one parallel sweep.
- All US1 test files (T045 – T054) are independent of each other.
- All US2 test files (T067 – T071) are independent of each other.
- US1 implementation tasks T055 – T058 (each in its own file under `services/auth/` or
  `hooks/`) and US1 implementation tasks T063 – T064 (`access-denied` view + hook in
  separate files) are independent of each other.
- US2 implementation tasks T072 – T073 (separate files under `hooks/` and `stores/`) are
  independent of each other.

---

## Parallel Example: Foundational Phase Test Burst

```bash
# Launch all 13 Foundational test files in one parallel sweep — different files,
# no incomplete dependencies, all expected to fail until the matching implementation
# file lands. Each invocation creates a single co-located *.test.ts(x) file.

# Services tier
Task: "Create apps/mobile/src/services/api/ApiError.test.ts"
Task: "Create apps/mobile/src/services/api/apiClient.test.ts"
Task: "Create apps/mobile/src/services/api/queryClient.test.ts"
Task: "Create apps/mobile/src/services/auth/sessionStorage.test.ts"

# State tier
Task: "Create apps/mobile/src/stores/sessionStore.test.ts"
Task: "Create apps/mobile/src/hooks/useSession.test.ts"

# Util + ComingSoon tier
Task: "Create apps/mobile/src/utils/pageMath.test.ts"
Task: "Create apps/mobile/src/components/coming-soon/useComingSoon.test.ts"
Task: "Create apps/mobile/src/components/coming-soon/ComingSoonView.test.tsx"

# Routing tier
Task: "Create apps/mobile/app/index.test.tsx"
Task: "Create apps/mobile/app/(authenticated)/_layout.test.tsx"
Task: "Create apps/mobile/app/(authenticated)/(tabs)/_layout.test.tsx"
Task: "Create apps/mobile/app/(authenticated)/(tabs)/{search,scan,profile}.test.tsx"
```

## Parallel Example: US1 Service + Hook Implementation Burst

```bash
# Once Foundational is green, launch US1's service + hook implementations in parallel.
Task: "Implement apps/mobile/src/services/auth/googleAuth.ts"
Task: "Implement apps/mobile/src/hooks/useGoogleSignInMutation.ts"
Task: "Implement apps/mobile/src/hooks/useMeQuery.ts"
Task: "Implement apps/mobile/src/hooks/useSignOutMutation.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks both stories).
3. Complete Phase 3: US1 Sign in with Google.
4. **STOP and VALIDATE**: run quickstart.md SC-001, SC-002, SC-004, SC-006, SC-008 plus
   the "Allowlist rejection" edge case. The placeholder Binder tab from T044 is acceptable
   at this checkpoint — US1's independent test does not require the 3×3 grid.

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready.
2. Add US1 → MVP demo.
3. Add US2 → Full feature demo against quickstart.md SC-003, SC-005, SC-007.
4. Phase 5 polish → ship.

### Parallel Team Strategy

With multiple developers:

1. One developer completes Phase 1 (Setup) — single-threaded by nature (workspace bootstrap).
2. The team shares Phase 2 (Foundational) — split the test burst (T012 – T024) and the
   implementation files (T025 – T044) across people; the auth gate / tab navigator can be
   one workstream and the API/storage layer another.
3. Once Foundational is green:
   - Developer A: US1 (Phase 3) — auth flow + AccessDenied screen.
   - Developer B: US2 (Phase 4) — cards infinite query + binder grid.
4. The two stories integrate at T077 (binder route swap) and T084 (CLAUDE.md update).

---

## Notes

- `[P]` tasks have no dependencies on incomplete tasks within the phase and write to
  different files.
- `[Story]` labels (US1, US2) appear ONLY on user-story phase tasks (Phases 3 and 4).
  Setup, Foundational, and Polish phases carry NO story label.
- Tests must FAIL before implementation lands (Principle III). Run
  `pnpm --filter @my-binder/mobile test -- <test-file>` after each test creation to
  confirm the expected failure.
- Commit after each task or logical group. Each phase ends at a natural checkpoint where
  `turbo test --filter=@my-binder/mobile` should pass.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break the
  US1-vs-US2 independence guarantee.
- `apps/mobile/app/(authenticated)/(tabs)/binder.tsx` is intentionally created twice —
  once in T044 (placeholder so the tab navigator compiles during US1) and once in T077
  (real shell rendering `<BinderHomeContainer />`). The two tasks edit the SAME file in
  sequence — they are NOT parallelizable across phases.