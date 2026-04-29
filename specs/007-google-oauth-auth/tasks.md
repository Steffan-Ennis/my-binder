# Tasks: Google OAuth Authentication with Guest Mode

**Input**: Design documents from `/specs/007-google-oauth-auth/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/auth.json ✅, quickstart.md ✅

**Tests**: Included per Constitution Principle III (Test-First Development). Test tasks are written first and must fail before implementation begins.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- Exact file paths are included in all task descriptions

---

## Phase 1: Setup (Dependencies & Configuration)

**Purpose**: Install packages and extend environment configuration. No user story work can start until T002 is complete.

- [x] T001 Add `google-auth-library` and `@fastify/jwt` to `apps/server/package.json` and run `pnpm install`
- [x] T002 Extend `Config` type and `loadConfig()` in `apps/server/src/config.ts` to read `GOOGLE_CLIENT_IDS` (comma-separated string) and `SESSION_JWT_SECRET` (string ≥ 32 chars) from environment

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure that ALL user stories depend on — DB migration, core types/schemas/constants, auth primitives, repository, and Fastify plugin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Create DuckDB migration `apps/server/src/db/migrations/002_create_users.sql` — users table with `id` (UUID PK), `google_sub` (TEXT UNIQUE NOT NULL), `email`, `display_name`, `avatar_url`, `created_at`, `updated_at` per data-model.md
- [x] T004 [P] Add shared auth types (`AuthUser`, `GuestIdentity`, `AuthenticatedIdentity`, `AuthState`, `GoogleSignInBody`, `GoogleSignInResponse`) to `packages/core/src/types/auth.ts`
- [x] T005 [P] Add Ajv-compatible JSON schemas for `POST /auth/google` request/response and `GET /auth/me` response to `packages/core/src/schemas/auth.ts` (follow `schemas/card.ts` pattern)
- [x] T006 [P] Add `AUTH_ERROR_CODES`, `SESSION_JWT_TTL_DAYS`, and `AUTH_IDENTITY_KIND` constants to `packages/core/src/constants/index.ts`
- [x] T007 Write failing tests for `apps/server/src/auth/googleVerifier.test.ts` — cover: valid token accepted, expired token rejected, wrong audience rejected, `email_verified: false` rejected, malformed token rejected
- [x] T008 Implement `apps/server/src/auth/googleVerifier.ts` — call `OAuth2Client.verifyIdToken()` with full `GOOGLE_CLIENT_IDS` list as `audience`; assert `email_verified: true`; throw on any failure (makes T007 pass)
- [x] T009 [P] Write failing tests for `apps/server/src/auth/sessionJwt.test.ts` — cover: issueToken returns valid HS256 JWT with 7-day `exp`; verifyToken accepts valid JWT; verifyToken rejects expired or tampered JWT
- [x] T010 [P] Implement `apps/server/src/auth/sessionJwt.ts` — `issueToken(userId: string)` signs HS256 JWT (TTL from `SESSION_JWT_TTL_DAYS`); `verifyToken(token: string)` verifies and returns `sub`; use `SESSION_JWT_SECRET` from config (makes T009 pass)
- [x] T011 Write failing tests for `apps/server/src/repositories/userRepository.test.ts` — cover: `upsertUser` creates new user, `upsertUser` updates existing user fields on re-sign-in (idempotent on `google_sub`), `findUserById` returns user or null
- [x] T012 Implement `apps/server/src/repositories/userRepository.ts` — `upsertUser` using `INSERT … ON CONFLICT (google_sub) DO UPDATE SET` (no read-then-write); `findUserById` by UUID (makes T011 pass)
- [x] T013 Implement `apps/server/src/auth/plugin.ts` — Fastify plugin that decorates `request.identity` with `AuthState`; reads `Authorization: Bearer <token>` header; calls `sessionJwt.verifyToken()` if present; sets `{ kind: 'guest' }` when header is absent OR token is invalid (must NOT throw)

**Checkpoint**: Foundation ready — auth primitives, DB migration, and Fastify plugin are complete. User story implementation can now begin.

---

## Phase 3: User Story 1 — Sign In with Google (Priority: P1) 🎯 MVP

**Goal**: User taps "Sign in with Google," completes the Google consent flow, and is returned to the app as an authenticated user with name and avatar visible. Returning users are auto-signed-in on restart.

**Independent Test**: `POST /auth/google` with a real Google ID token returns `{ token, user }`. `GET /auth/me` with the session JWT returns `{ kind: "authenticated", user: { ... } }`. Mobile starts, finds a stored token, calls `/auth/me`, and is recognized automatically.

### Tests for User Story 1

> **Write these FIRST — confirm they FAIL before implementing**

- [x] T014 Write failing tests for `apps/server/src/services/authService.test.ts` — cover: `signIn()` with valid Google token returns `{ token, user }`; `signIn()` with invalid token throws `InvalidGoogleTokenError`; second `signIn()` with same `google_sub` updates user fields
- [x] T015 [P] Write failing tests for `apps/server/src/routes/auth.test.ts` — cover: `POST /auth/google` happy path returns 200 with `token` + `user`; `POST /auth/google` with bad token returns 401 `INVALID_GOOGLE_TOKEN`; `GET /auth/me` with valid Bearer returns 200 `{ kind: "authenticated", user }`

### Implementation for User Story 1

- [x] T016 Implement `apps/server/src/services/authService.ts` — `signIn(idToken: string)` orchestrates: `googleVerifier.verify(idToken)` → `userRepository.upsertUser(payload)` → `sessionJwt.issueToken(user.id)`; throw `InvalidGoogleTokenError` on verifier failure (follows `cardService.ts` pattern; makes T014 pass)
- [x] T017 Implement `POST /auth/google` and `GET /auth/me` (authenticated path) in `apps/server/src/routes/auth.ts` — thin HTTP layer; validate request body against schema from `packages/core`; delegate to `authService.signIn()`; return 401 `INVALID_GOOGLE_TOKEN` on `InvalidGoogleTokenError` (makes T015 pass)
- [x] T018 Register auth plugin and auth routes in `apps/server/index.ts` — register `authPlugin` before route plugins; register `authRoutes`
- [ ] T019 [P] Implement `apps/mobile/src/auth/googleSignIn.ts` — platform-native Google Sign-In SDK wrapper; exports `signInWithGoogle(): Promise<string>` (returns ID token); framework TBD — implement when mobile framework is chosen
- [ ] T020 [P] Implement `apps/mobile/src/auth/sessionStore.ts` — exports `saveToken(token: string)`, `getToken(): Promise<string | null>`, `clearToken()`; backed by platform secure storage (Keychain on iOS, Keystore on Android)
- [ ] T021 Implement `apps/mobile/src/auth/authContext.ts` — app-wide auth state (`AuthState`); on app start, call `sessionStore.getToken()` → if present, call `GET /auth/me` → set authenticated or guest identity; expose `signIn()` that calls `googleSignIn.ts` → `POST /auth/google` → `sessionStore.saveToken()` (depends on T019, T020)

**Checkpoint**: User Story 1 complete — Google sign-in works end-to-end; returning users are auto-signed-in. Independently testable.

---

## Phase 4: User Story 2 — Guest Mode (Priority: P2)

**Goal**: User opens the app without signing in. All read-only routes are accessible with no credentials. Write actions prompt sign-in before proceeding.

**Independent Test**: `GET /auth/me` with no `Authorization` header returns `{ "kind": "guest" }`. `GET /cards` with no header returns cards list. Mobile: launching the app and skipping sign-in shows guest mode; tapping a write action shows sign-in prompt.

### Tests for User Story 2

> **Write these FIRST — confirm they FAIL before implementing**

- [x] T022 Add failing tests to `apps/server/src/routes/auth.test.ts` — cover: `GET /auth/me` with no `Authorization` header returns 200 `{ kind: "guest" }`; `GET /auth/me` with malformed Bearer returns 200 `{ kind: "guest" }` (not 401)

### Implementation for User Story 2

- [x] T023 [US2] Implement guest branch in `GET /auth/me` in `apps/server/src/routes/auth.ts` — when `request.identity.kind === 'guest'` return 200 `{ kind: "guest" }` (makes T022 pass)
- [x] T024 [P] [US2] Verify `GET /cards` and `GET /cards/:id` in `apps/server/src/routes/cards.test.ts` are accessible without `Authorization` header — add explicit test cases; no source code change expected, regression guard only
- [ ] T025 [US2] Implement mobile guest-mode write gating — add `requireAuth(action: () => void)` helper in `apps/mobile/src/auth/authContext.ts`; when identity is guest, shows sign-in prompt and suspends the action until authenticated or dismissed

**Checkpoint**: User Story 2 complete — guest mode works; read-only routes open; write actions gated. Independently testable alongside US1.

---

## Phase 5: User Story 3 — Sign Out (Priority: P3)

**Goal**: Authenticated user taps "Sign Out." Session is ended; personal data is cleared from the current session; user is returned to guest state.

**Independent Test**: `POST /auth/signout` returns 204. After sign-out, `GET /auth/me` (no header) returns `{ "kind": "guest" }`. Mobile: after sign-out, app shows guest mode with no personal data visible.

### Tests for User Story 3

> **Write these FIRST — confirm they FAIL before implementing**

- [x] T026 Add failing tests to `apps/server/src/routes/auth.test.ts` — cover: `POST /auth/signout` with valid Bearer returns 204 no body; `POST /auth/signout` with no `Authorization` header also returns 204 (server-side no-op)

### Implementation for User Story 3

- [x] T027 [US3] Implement `POST /auth/signout` in `apps/server/src/routes/auth.ts` — returns 204; server-side no-op (JWT is stateless; revocation is client-side only); add `// No server-side revocation: 7-day TTL is the sole safeguard` comment per contracts/auth.json (makes T026 pass)
- [ ] T028 [P] [US3] Add `clearToken()` export to `apps/mobile/src/auth/sessionStore.ts` (may already exist from T020 — implement or verify it deletes the stored JWT from platform secure storage)
- [ ] T029 [US3] Wire mobile sign-out in `apps/mobile/src/auth/authContext.ts` — expose `signOut()`: call `POST /auth/signout` (best-effort), call `sessionStore.clearToken()`, reset identity to `{ kind: 'guest' }` (depends on T028)

**Checkpoint**: All three user stories complete and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, typecheck, and documentation.

- [ ] T030 [P] Run all six quickstart.md scenarios manually against the running server (`pnpm turbo dev`) — verify scenarios 1 (happy path sign-in), 2 (guest mode), 3 (returning user), 4 (expired token), 5 (sign out), and 6 (invalid token) each produce the documented responses
- [x] T031 [P] Run `pnpm turbo typecheck` and `pnpm turbo test` — all workspaces must pass with zero type errors and zero failing tests
- [x] T032 Update `apps/server/README.md` with required environment variables (`GOOGLE_CLIENT_IDS`, `SESSION_JWT_SECRET`) — description, format, and example values

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **User Stories (Phase 3–5)**: All depend on Phase 2 completion; can proceed in priority order or (if multi-developer) in parallel
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on US2 or US3
- **US2 (P2)**: Can start after Phase 2 — no dependency on US1; `GET /auth/me` guest branch in T023 touches the same route file as T017, coordinate if working in parallel
- **US3 (P3)**: Can start after Phase 2 — no dependency on US1 or US2; `POST /auth/signout` in T027 is an additive change to `routes/auth.ts`

### Within Each User Story

- Tests (T007, T009, T011, T014, T015, T022, T026) MUST be written and confirmed failing before implementation
- Data layer before service layer before route layer
- Server changes (T016–T018) before mobile integration (T019–T021)
- Story complete before moving to next priority

### Parallel Opportunities

- T004, T005, T006 — core types/schemas/constants (different files)
- T007/T008 and T009/T010 — googleVerifier and sessionJwt (different files)
- T014 and T015 — authService tests and route tests (different files)
- T019 and T020 — mobile googleSignIn.ts and sessionStore.ts (different files)
- T024 — regression check on cards routes (read-only, no conflict)
- T028 — sessionStore clearToken (may be complete from T020)
- T030 and T031 — manual scenario validation and automated test run

---

## Parallel Example: Phase 2 Foundation

```bash
# After T001–T002 complete, launch in parallel:
Task: T003 — DB migration 002_create_users.sql
Task: T004 — packages/core/src/types/auth.ts
Task: T005 — packages/core/src/schemas/auth.ts
Task: T006 — packages/core/src/constants/index.ts

# After T004–T006 complete, launch in parallel:
Task: T007/T008 — googleVerifier (test then implement)
Task: T009/T010 — sessionJwt (test then implement)

# After T008 and T010 complete:
Task: T011/T012 — userRepository (test then implement)
Task: T013 — auth plugin (depends on sessionJwt)
```

## Parallel Example: User Story 1

```bash
# After Phase 2 complete, launch in parallel:
Task: T014 — authService.test.ts (write failing tests)
Task: T015 — routes/auth.test.ts (write failing tests)

# After T014 passes → T015 passes:
Task: T016 — authService.ts
Task: T017 — routes/auth.ts

# After T017 complete:
Task: T018 — register in index.ts

# In parallel with server tasks:
Task: T019 — mobile googleSignIn.ts
Task: T020 — mobile sessionStore.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T013) — critical path
3. Complete Phase 3: User Story 1 (T014–T021)
4. **STOP and VALIDATE**: Run quickstart.md scenarios 1, 3, 4, 6
5. Deploy or demo if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → auth primitives ready
2. Phase 3 (US1) → Google sign-in end-to-end → **MVP**
3. Phase 4 (US2) → guest mode explicit → all read paths covered
4. Phase 5 (US3) → sign-out complete → full auth lifecycle
5. Phase 6 → polish, typecheck, documentation

---

## Notes

- [P] tasks operate on different files with no blocking inter-dependencies
- [USn] label maps each task to a specific user story for traceability
- Mobile tasks (T019–T021, T025, T028–T029) are framework-agnostic until mobile framework is chosen; implement when `apps/mobile` is initialized
- Each user story phase is independently completable and testable
- `POST /auth/signout` is a server-side no-op by design — document the trade-off (7-day TTL, no revocation table) in the route file comment per `contracts/auth.json`
- Commit after each task or logical group; checkpoint after each story phase
