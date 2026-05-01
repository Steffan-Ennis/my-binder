# Phase 0 Research: Mobile Binder App

**Feature**: 002-mobile-binder-app
**Date**: 2026-05-01

This document resolves every `NEEDS CLARIFICATION` from `plan.md` and records the rationale
behind the technology choices. Each section follows: **Decision** → **Rationale** →
**Alternatives considered**.

---

## 1. Mobile framework

**Decision**: **React Native 0.76 + Expo SDK 52** (managed workflow with EAS Build for store
artifacts).

**Rationale**:

- The constitution mandates TypeScript strict (Principle VII) and Jest (Principle III) across
  all workspaces. React Native + Expo is the only iOS+Android framework that satisfies both
  natively: Expo ships a first-party `jest-expo` preset, and TypeScript is the default for
  new Expo projects.
- The repo is already a pnpm + Turborepo TS monorepo. React Native composes cleanly into
  this layout — `apps/mobile` becomes another TS workspace consuming `@my-binder/core` via
  `workspace:*`, identical to how `apps/server` does today.
- Expo's modules cover every external dependency the spec implies:
  `expo-auth-session/providers/google` for the Google sign-in flow (FR-003, in-app browser
  via ASWebAuthenticationSession on iOS and Custom Tabs on Android), `expo-secure-store` for
  the 7-day session JWT (FR-006, OS-secured storage), `expo-image` for the card-grid lazy
  loading (SC-005, SC-007), `expo-constants` for env-config injection.
- Expo Router and React Navigation are both first-class; we pick React Navigation (see §3)
  because the navigation graph is small and the screens-as-thin-shells rule (Principle X)
  is easier to enforce with native stack than file-system routing.
- Constitution Principle X is framework-agnostic but written in React/JSX vocabulary
  (`useEffect`, hooks, JSX). React Native maps 1:1.

**Alternatives considered**:

- **Flutter (Dart)**: Excellent performance, but uses Dart — every monorepo principle
  (Principle VII strict TS, Principle III Jest, Principle IX JSDoc, `@my-binder/core`
  re-use) would either need a duplicate Dart package or a constitution carve-out. Rejected
  on Simplicity First (Principle I).
- **Bare React Native (no Expo)**: Loses the official `jest-expo` preset, the bundled
  `expo-auth-session` Google flow, and EAS Build. Would force us to wire Gradle and CocoaPods
  manually for every module; doubles the build-tooling surface for no tangible feature
  win. Rejected.
- **Native iOS (Swift) + native Android (Kotlin)**: Two codebases means two test stacks
  (XCTest, JUnit), two CI flows, and `@my-binder/core` cannot be shared without a code-gen
  step. Rejected on Simplicity First and Test-First Development (single Jest stack).
- **Capacitor / Ionic / Cordova**: WebView-based; the binder-page swipe interaction (SC-005,
  60fps) is not reliably achievable on low-end Android in a WebView. Rejected.

**Constitution amendment required**: Yes — pins `MOBILE_PLATFORM` to React Native + Expo and
declares the `jest-expo` preset, satisfying the open `TODO(MOBILE_PLATFORM)`. Suggested
amendment text is in `plan.md` Constitution Check.

---

## 2. State management

**Decision**: Split server state and UI state across two libraries.

- **UI / auth state** → **Zustand 5** with `subscribeWithSelector` middleware. Two
  top-level stores — `sessionStore` (auth state, JWT, expiry) and `binderStore`
  (`currentPage` only; was previously also `cards`/`totalPages`/`loadState` but those
  responsibilities moved to TanStack Query — see §11). Hooks subscribe to slices via
  selectors; views never touch stores (Principle X Forbidden column).
- **Server state** (cards from `GET /cards`, profile from `GET /auth/me`, mutation
  results from `POST /auth/google` and `POST /auth/signout`) → **TanStack Query 5**, see
  §11 for the full decision and configuration.

**Rationale**:

- Principle X requires hooks to own state and views to be store-free. Zustand's selector-based
  subscription model lines up perfectly: each hook (`useLogin`, `useBinderHome`,
  `useSession`) subscribes to exactly the slice it needs and the view receives the resulting
  values as named props. No provider tree is needed at the top of the React tree.
- Bundle cost is ~1KB gzipped. No middleware boilerplate to test or document.
- Selector references are stable when the slice is unchanged, so the 3×3 grid view doesn't
  re-render on unrelated session updates — important for SC-005 (60fps swipe).

**Alternatives considered**:

- **Redux Toolkit + RTK Query**: Powerful, but the action/reducer/selector ceremony adds
  significant code volume for two screens with three persisted fields. Rejected on
  Simplicity First.
- **React Context + `useReducer`**: Re-renders every consumer on any update; with up to 1000
  cards in `binderStore`, this would be unacceptable for the 3×3 grid swipe. Rejected.
- **Jotai / Recoil**: Atom-based stores work, but Zustand is more widely documented for
  React Native and has a smaller surface to test. Rejected on familiarity / docs.

---

## 3. Navigation

**Decision**: **Expo Router 4** (file-based routing built on top of React Navigation 7),
arranged as a three-level hierarchy — Root Stack → authenticated Stack (auth gate) → bottom
Tab navigator. The Tab navigator's four tabs match the v3 wireframe (Binder, Search, Scan,
Profile); spec 002 ships only the Binder tab as a real feature, with Search/Scan/Profile
mounted as one-line shells that render a shared `<ComingSoonContainer />`. Layout:

```
apps/mobile/app/
├── _layout.tsx                          # Root Stack — providers, error boundary, theme
├── index.tsx                            # <Redirect /> based on useSession() status
├── login.tsx                            # PUBLIC — renders <LoginContainer />
├── access-denied.tsx                    # PUBLIC — renders <AccessDeniedContainer />
└── (authenticated)/
    ├── _layout.tsx                      # Auth gate — <Redirect href="/login" /> if no session
    └── (tabs)/                          # Bottom-tab navigator (4 tabs per v3 wireframe)
        ├── _layout.tsx                  # <Tabs /> — Binder is initial route
        ├── binder.tsx                   # PRIVATE — <BinderHomeContainer /> (real, US1+US2)
        ├── search.tsx                   # STUB — <ComingSoonContainer feature="search" />
        ├── scan.tsx                     # STUB — <ComingSoonContainer feature="scan" />
        └── profile.tsx                  # STUB — <ComingSoonContainer feature="profile" />
```

**Rationale**:

- **Scaling**: the user flagged that the screen count will grow. With Expo Router, adding
  a screen is "create a file" — there is no central navigator file to edit and no manual
  type registration of route names. Adding `app/cards/[id].tsx` later just works, including
  a typed `<Link href={{ pathname: '/cards/[id]', params: { id } }} />`.
- **Tab shell now, feature content later** (Option C from the wireframe-vs-plan
  comparison): the v3 wireframe shows a 4-tab bar on every authenticated screen, but only
  the Binder tab is in scope for spec 002. Mounting the tab navigator now with three stub
  tabs achieves three goals at once:
  1. The visible UX matches the wireframe from day one.
  2. Specs 003+ (Search / Scan / Profile) only need to swap a single tab file's body —
     no navigator restructuring, no route-group refactor.
  3. Principle X compliance is straightforward: each stub tab file is a one-line shell
     rendering `<ComingSoonContainer feature="..." />`, and `ComingSoonContainer` itself
     follows the four-layer split.
- **Auth gate via route group**: `app/(authenticated)/_layout.tsx` reads `useSession()` and
  renders `<Redirect href="/login" />` when no active session exists. This is the
  canonical Expo Router pattern for protected routes — concentrated in one layout file
  rather than scattered across imperative `useEffect` redirects in each screen. Placing
  the gate above the `(tabs)` group means the entire tab UI is only ever mounted for
  authenticated sessions; the tab files do not need their own gates.
- **Tab navigator inside an authenticated Stack**: the `(authenticated)/_layout.tsx`
  body is `<Stack />` so future routes that should sit *above* the tabs (e.g., a modal
  card-detail at `(authenticated)/card/[id].tsx`) can be added without restructuring. The
  `(tabs)/_layout.tsx` lives one level down as `<Tabs />`.
- **Underlying navigator is still React Navigation 7**: Expo Router uses
  `@react-navigation/native-stack` and `@react-navigation/bottom-tabs` underneath, so
  SC-005's platform-native transition story (UINavigationController / FragmentActivity)
  is preserved unchanged.
- **Principle X compatibility**: route files are one-line shells (`export default () =>
  <LoginContainer />`), exactly equivalent to the role of `src/screens/*.tsx` files in the
  constitution's pinned layout. The four-layer Container → Hook → View split below the
  route file is unchanged. `useRouter()` and `<Redirect />` are consumed only by hooks and
  layouts — never by views — preserving the view-purity rule.
- **Typed routes**: `expo-router`'s `typedRoutes` mode generates a `Href` union type from
  the `app/` tree, giving compile-time safety on every `router.push(...)` and `<Link>`.
  This satisfies Principle VII's strong-typing intent at the navigation boundary.

**Constitution implication**: constitution v1.13.1 pins
`apps/mobile/src/{screens,components,hooks,services,stores,utils}/`. Expo Router's
convention places `app/` at the workspace root and removes the need for `src/screens/`. A
PATCH constitution amendment is required to update Principle X's Screen-row location and
the Technology Stack workspace declaration — flagged as a pre-implementation gate in
`plan.md`.

**Alternatives considered**:

- **React Navigation 7 imperative (was the v1 plan choice)**: Single
  `RootNavigator.tsx` file, fully visible navigation graph. Rejected on the user's
  explicit scaling preference: the third or fourth screen would push the navigator file
  toward the awkward "central registry" pattern that file-based routing was designed to
  avoid. Expo Router pays a small upfront amendment cost in exchange for that ceiling.
- **react-native-screens directly + custom router**: Reinvents what Expo Router and React
  Navigation already provide. Rejected.

---

## 4. Google sign-in & token revocation

**Decision**: **`expo-auth-session/providers/google`** for the OAuth 2.0 flow. Use
ASWebAuthenticationSession (iOS) and Custom Tabs (Android) automatically — both keep the
auth flow inside the app's process per FR-003. On sign-out, POST the access token to
`https://oauth2.googleapis.com/revoke?token=<token>` to satisfy FR-008's "revoke the Google
grant" requirement.

**Rationale**:

- `expo-auth-session` is the Expo-blessed wrapper around AppAuth. It handles the PKCE flow,
  redirect URI registration, and the in-app browser plumbing — all of which would otherwise
  require ~200 lines of native bridging.
- The Google ID token returned by the flow is what `apps/server` already verifies via
  `google-auth-library` (server's `googleVerifier.ts`), so the client/server contract is
  fully reused — no new server work for this feature.
- Token revocation is a single HTTPS call; no SDK is needed. The mobile app holds the access
  token in memory only (never persisted) and discards it after revocation.

**Alternatives considered**:

- **`react-native-google-signin`**: Full-featured, but pulls in Google's native SDKs
  (`GoogleSignIn` pod and AAR). Heavier binary, requires `eas build` config that
  `expo-auth-session` does not. The PKCE flow is sufficient for our needs. Rejected.
- **Firebase Auth**: Requires a Firebase project and ties auth to a Google-managed identity
  stack we don't otherwise use. Rejected.

---

## 5. Secure session storage

**Decision**: **`expo-secure-store`** for the session JWT. Stored under a single key,
`session.jwt`, alongside its issued-at timestamp under `session.iat`. The 7-day TTL
(`SESSION_JWT_TTL_DAYS` from `@my-binder/core`, FR-006) is computed from `iat`, not from a
device-local "expires_at" — this avoids clock-skew bugs.

**Rationale**:

- `expo-secure-store` writes to iOS Keychain (`kSecClassGenericPassword`) and Android
  EncryptedSharedPreferences (Tink-based), both backed by the OS keystore. Tokens survive
  backgrounding and OS reboots but are wiped on app uninstall. This is the storage
  equivalent that the constitution's data-integrity principle (II) effectively demands.
- Reading at app start happens once in `useSession`'s mount-time effect (Principle X's
  legitimate `useEffect` use case — synchronising with an external system). Cleanup is a
  no-op (read is idempotent and finite), but the effect still returns an empty cleanup to
  satisfy the discipline rule pattern.

**Alternatives considered**:

- **`AsyncStorage`**: Plain-text on disk. JWT theft on a rooted/jailbroken device would be
  trivial. Rejected outright per Principle II.
- **`react-native-keychain`**: Equivalent functionality, but requires bare-workflow native
  setup. `expo-secure-store` ships out of the box with the managed workflow we're using.
  Rejected on Simplicity First.

---

## 6. Image handling for the 3×3 grid

**Decision**: **`expo-image`** for the card front-face slots. Configure with
`cachePolicy="memory-disk"`, fixed `contentFit="cover"`, and a low-resolution placeholder.
Render the page via `FlatList` with `numColumns=3`, `getItemLayout` (slot dimensions are
known and equal), and `removeClippedSubviews` for off-screen pages. Page navigation uses a
`PagerView` (via `react-native-pager-view`, an Expo SDK 52 module).

**Rationale**:

- `expo-image` is built on SDWebImage (iOS) / Glide (Android) and is materially faster than
  the legacy `<Image>` for cached network images. SC-005's 60fps requirement on a 3×3 grid
  spanning up to 112 pages (1000 cards / 9 = 112 pages) is achievable with disk caching.
- `getItemLayout` removes per-item measurement work — essential when the user swipes through
  many pages quickly.
- `react-native-pager-view` provides native paging (UIPageViewController on iOS, ViewPager2
  on Android) — the Edge Case behaviour ("swipe or tap to turn the page") gets platform-
  appropriate physics for free.

**Alternatives considered**:

- **`<Image>` + manual `Animated` swipe**: 30–40fps on mid-range Android with 50+ pages.
  Rejected.
- **`react-native-fast-image`**: Predates `expo-image`; no longer maintained as actively, and
  doesn't ship with Expo SDK 52. Rejected.

---

## 7. API response validation

**Decision**: **Ajv 8** at the mobile boundary, re-using JSON Schemas from `@my-binder/core`
(already used by the server's Fastify route validation). The typed methods on `apiClient.ts`
(`getCards`, `getMe`, `signInWithGoogle`, `signOut`) each wrap `fetch`; on every response,
parse JSON and run the schema validator before returning to the caller. Reject with a typed
`SchemaValidationError` on mismatch (logged per Principle VIII).

Since these typed methods serve as the **`queryFn`** bodies for TanStack Query (see §11),
validation runs **inside** the queryFn and throws **before** TanStack writes the result to
its cache. The cache therefore holds only schema-validated payloads — an invalid cache
entry is structurally impossible.

**Rationale**:

- Principle VII explicitly mandates runtime validation at the mobile inbound boundary.
- Re-using `@my-binder/core` schemas means a server-side schema change is a single source of
  truth — both client and server enforce it. No drift.
- Ajv compiles schemas once at module load; per-call cost is negligible (~50µs for the card
  list response).

**Alternatives considered**:

- **Zod**: Excellent ergonomics, but the schemas in `@my-binder/core` are already JSON
  Schema (Fastify ecosystem). Translating them to Zod would create the duplication
  Principle VII forbids. Rejected.
- **Trust the server, no client validation**: Violates Principle VII. Rejected.

---

## 8. Error & failure semantics

**Decision**: A single `ApiError` class with a `code` field that maps server error codes
(from `@my-binder/core/constants/errorCodes.ts`) to UI behaviour:

- `AUTH_INVALID_TOKEN` → clear local session, navigate to Login.
- `AUTH_NOT_ALLOWLISTED` → navigate to AccessDenied; **do not** clear the Google grant
  (user may try again with a different account).
- `NETWORK_OFFLINE` (synthetic, raised by `apiClient` on `fetch` rejection) → render the
  retryable error banner per FR-004.
- All others → log full original error per Principle VIII, render generic banner.

**Routing of the mapping** is split between two layers (see §11 for context):

1. **Centralised auth handling** — `queryClient.ts` registers `queryCache.onError` and
   `mutationCache.onError` callbacks that match on `AUTH_INVALID_TOKEN` and
   `AUTH_NOT_ALLOWLISTED` and dispatch the session-clear / navigate side effects. This
   single registration point covers every query and mutation in the app.
2. **Per-feature handling** — feature hooks (`useLogin`, `useBinderHome`) consume
   `error` / `isError` flags from their TanStack hook results and surface
   feature-specific messages to their views (e.g., the Login retry banner).

**TanStack retry policy** (configured on the QueryClient default options):

- `retry: 3` for queries, **gated by a predicate** that returns `false` for any
  `ApiError` whose status is in the 4xx range. Auth errors fail fast.
- `retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000)` — exponential back-off
  with a 30-second ceiling.
- `retry: 0` for mutations — never auto-retry a sign-in or sign-out (would risk
  duplicate side effects).
- `refetchOnWindowFocus: false` (mobile: no `window` semantic, but the equivalent
  AppState-driven refetch is also disabled to keep behaviour predictable on a flaky
  cellular network).

**Rationale**: Centralising the mapping in one place keeps every UI feature's error
handling consistent and avoids the "where do we render this error?" sprawl that ad-hoc
`try/catch` in views would produce. Gating retry by HTTP status range prevents the
retry-storm that would otherwise happen if a 401 (e.g., from an expired session) bounced
through three back-off attempts before TanStack surfaced it to the global handler.

---

## 9. Testing tooling specifics

**Decision**:

- **Runner**: Jest 30 + `ts-jest` + `jest-expo` preset (Principle III).
- **View tests**: `@testing-library/react-native` 12.x — uses real React Native renderer
  via `react-test-renderer`, supports `fireEvent`, `waitFor`, accessibility queries.
- **Hook tests**: `renderHook` from `@testing-library/react-native` (added in v12).
- **Mocks**: `expo-secure-store` and `expo-auth-session` get hand-rolled module mocks
  (Jest `jest.mock` calls in `setup.ts`); the real implementations require a native bridge
  not present in the Jest jsdom-equivalent environment.
- **Snapshot strategy**: Snapshots only for `*View.tsx` files; never for hooks. Snapshots
  document the rendered tree shape; behavioural assertions cover everything else.

**Rationale**: Each tool is the canonical Expo + React Native choice for 2026, and they
compose cleanly. The constitution's coverage-threshold mechanism is supported natively by
Jest 30.

**Alternatives considered**:

- **Vitest**: Prohibited by Principle III. Mentioned for completeness only.
- **Detox / Maestro (E2E)**: Out of scope for this feature; deferred to a later spec.

---

## 10. Tab-bar icons

**Decision**: **`@expo/vector-icons`** (the Expo-bundled re-export of `react-native-vector-icons`).
Specifically, use the `Ionicons` set for the four tab glyphs to align with the v3
wireframe's iOS-style icon language: `book-outline` (Binder), `search-outline` (Search),
`scan-outline` (Scan), `person-outline` (Profile). Active state uses the filled variant
(`book`, `search`, `scan`, `person`).

**Rationale**:

- Ships with Expo SDK 52 — no extra native build configuration required.
- Sets are tree-shaken at build time so unused icons do not bloat the bundle.
- The wireframe icons are unambiguously Ionicons (book, magnifying glass, scan brackets,
  person silhouette).
- `<Tabs.Screen options={{ tabBarIcon: ({ color, focused }) => ... }} />` accepts any
  React component, so picking a different set later is a one-file change in
  `(tabs)/_layout.tsx`.

**Alternatives considered**:

- **`lucide-react-native`**: Cleaner aesthetic but requires `react-native-svg` setup and
  the wireframe glyphs already match Ionicons. Rejected to keep the dependency surface
  smaller.
- **Custom SVGs imported from the v3 wireframe export**: Reasonable for the long term but
  a lot of upfront design work for stub tabs that will be polished alongside their real
  feature in specs 003+. Deferred.

---

## 11. Server-state management (TanStack Query)

**Decision**: **TanStack Query 5** (`@tanstack/react-query@5`) as the data-fetching,
caching, and retry layer. The previously-planned `useApi` hook (a hand-rolled `fetch`
wrapper) is **removed**; `apiClient.ts` shrinks to a small set of typed methods that act
as `queryFn`/`mutationFn` bodies, and TanStack Query owns everything that surrounds them.
Dev-only: `@tanstack/react-query-devtools` for cache inspection in development.

**Per-endpoint configuration** (single source of truth lives in
`apps/mobile/src/services/api/queryClient.ts` defaults plus per-hook overrides):

| Operation | Hook | Type | `staleTime` | `gcTime` | Retry | Notes |
|---|---|---|---|---|---|---|
| `GET /cards` | `useCardsInfiniteQuery` | `useInfiniteQuery` | 5 min | 30 min | 3 attempts on 5xx/network, 0 on 4xx | Cursor pagination per `contracts/api-client.md`; `enabled: useSession().status === "active"` |
| `GET /auth/me` | `useMeQuery` | `useQuery` | 1 min | 5 min | same | Validates a hydrated session at app start |
| `POST /auth/google` | `useGoogleSignInMutation` | `useMutation` | n/a | n/a | 0 (no auto-retry on sign-in) | On success: persist JWT, update `sessionStore`, navigate Binder |
| `POST /auth/signout` | `useSignOutMutation` | `useMutation` | n/a | n/a | 0 | Always runs the local cleanup chain (delete secure-store, revoke Google, reset stores, **`queryClient.clear()`**, navigate Login) — even when the server call fails |

**QueryClient defaults** (set once in `queryClient.ts`):

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,
      retryOnMount: false,
    },
    mutations: { retry: 0 },
  },
});
```

**Provider placement**: `<QueryClientProvider client={queryClient}>` is mounted at the
Root Stack in `app/_layout.tsx`, above the `(authenticated)` auth gate, so the same
QueryClient instance serves both pre-auth and authenticated routes. Auth-error routing is
attached via `queryCache.onError` and `mutationCache.onError` registered on the same
QueryClient (see §8).

**Rationale**:

- The user explicitly chose TanStack Query for **caching, back-off, and retry** —
  TanStack ships all three out of the box and handles edge cases (request deduplication,
  in-flight cancellation, refetch-on-reconnect) that the hand-rolled fetch wrapper would
  have re-implemented one bug at a time.
- `useInfiniteQuery` cleanly maps the server's cursor pagination from
  `contracts/api-client.md` GET /cards. The 1000-card / 112-page scale (SC-007) means
  the user might re-enter the Binder tab repeatedly — TanStack's `staleTime` keeps that
  navigation snappy without staleness drift, exactly the property a hand-rolled wrapper
  would fight to provide.
- TanStack Query fits Principle X without modification: hooks own state, views receive
  named props, no `useEffect` is required for data fetching. The pre-existing
  `useEffect` discipline rule is therefore strengthened, not weakened.
- Schema validation (Principle VII) keeps its boundary because Ajv runs inside the
  `queryFn` (see §7) — TanStack treats validation failures as query errors and never
  caches malformed payloads.
- Bundle cost (~13KB gzipped for `@tanstack/react-query` v5) is well within mobile
  constraints; cold-start budget is dominated by JS engine init, not this dependency.

**Alternatives considered**:

- **Hand-rolled fetch wrapper (the previous plan)** — would require writing and testing
  retry-with-back-off, request deduplication, in-flight cancellation, and a per-screen
  cache layer from scratch. The user's explicit reason for switching ("caching,
  back-off, retry") is precisely the surface TanStack codifies. Rejected.
- **SWR** — comparable feature set, but no first-party React Native infinite-query
  ergonomics match `useInfiniteQuery`'s API; smaller community footprint for the
  caching-tunable scenarios we anticipate post-spec-002. Rejected.
- **Apollo Client** — REST mode exists but the project's API is plain JSON, not GraphQL;
  Apollo's normalised cache would be heavyweight overkill. Rejected.
- **Persisting the cache to disk** (`@tanstack/react-query-persist-client` +
  `expo-async-storage`) — deferred. Cold-start always re-fetches in this spec; offline
  card browsing is not a US1/US2 requirement. Logged as a future consideration so the
  cache surface is intentional, not accidental.

**Testing notes**:

- Wrap hook tests with a `<QueryClientProvider>` whose QueryClient is a per-test
  instance configured with `retry: false` to keep tests deterministic.
- Mock `apiClient` methods (not `fetch`) so query/mutation tests assert hook behaviour,
  not transport details. `apiClient.test.ts` covers transport + Ajv validation
  separately.

---

## 12. Open follow-ups (none block /speckit.tasks)

- **Server `GOOGLE_CLIENT_IDS` and `GOOGLE_WEB_CLIENT_ID` secrets** are already defined per
  CLAUDE.md but ship with `REPLACE_ME` placeholders. The mobile app needs its **own**
  iOS and Android client IDs registered in the Google Cloud console (separate from the
  server's web client ID). This is a configuration task, not a planning blocker.
- **EAS Build configuration** (`eas.json`) is needed for store builds but not for local
  development on simulators — added as a task in Phase 5 of `tasks.md`.
- **Wireframe-aligned visual polish for stub tabs** — the `<ComingSoonView />` in this
  spec is intentionally minimal (title + message + icon). The Search / Scan / Profile
  specs (003+) will replace each stub with a feature-specific view that implements the
  wireframe's full visual language for that tab.
- **Persisting the TanStack cache to disk** — see §11. Adding
  `@tanstack/react-query-persist-client` would let an offline cold start show the last
  known cards before the network resolves. Out of scope for spec 002 (no offline
  requirement) but a low-friction add when the offline story lands.
