# Implementation Plan: Google OAuth Authentication with Guest Mode

**Branch**: `007-google-oauth-auth` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-google-oauth-auth/spec.md`

## Summary

Add Google Sign-In to the my-binder mobile app with a paired guest (incognito) mode. The mobile app exchanges a Google ID token for a short-lived server-issued JWT. Subsequent requests carry that JWT as a Bearer token; the Fastify server validates it and injects the user context. Requests with no token are served as guest (read-only). User records are stored in DuckDB. No managed auth service (AWS Cognito, Firebase) is introduced; see `research.md` for the evaluation.

## Technical Context

**Language/Version**: TypeScript 5, strict mode — Node 22 (server); TypeScript (mobile, framework TBD per constitution TODO)
**Primary Dependencies**: `google-auth-library` (server — ID token verification); native platform Google Sign-In SDK (mobile — iOS/Android, chosen when mobile framework is decided); `@fastify/jwt` (server — session JWT issuance and verification)
**Storage**: DuckDB (existing embedded file-based database in `apps/server`); platform secure storage on mobile (Keychain / Keystore)
**Testing**: Node built-in test runner with `tsx` (server); mobile tests via mobile framework's test runner (TBD)
**Target Platform**: Node 22 Linux container (server); iOS + Android (mobile)
**Project Type**: Mobile app + API server (monorepo, Turborepo + pnpm)
**Performance Goals**: Google sign-in round-trip (mobile → Google → server) ≤ 30 s; token validation middleware ≤ 10 ms p99
**Constraints**: No managed auth service (Simplicity First); stateless server-side session JWTs (no session table); mobile must store tokens in platform secure storage; guest mode requires zero server changes — unauthenticated requests are already handled as guest

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | ✅ PASS | Direct Google SDK chosen over managed services (AWS Cognito, Firebase Auth). No auth service added. Server-side token validation is ~10 lines. Stateless JWTs avoid a session table. |
| II. Data Integrity | ✅ PASS | User upsert is idempotent (Google `sub` is the stable key). No destructive ops on user records. |
| III. Test-First Development | ✅ PASS | Auth middleware, token service, and route handler will each have co-located `.test.ts` files written first. |
| IV. Single Responsibility | ✅ PASS | Auth split into: token verification (`src/auth/googleVerifier.ts`), session JWT (`src/auth/sessionJwt.ts`), Fastify plugin (`src/auth/plugin.ts`), service orchestration (`src/services/authService.ts`), route (`src/routes/auth.ts`), repository (`src/repositories/userRepository.ts`). |
| V. Transparency & Legibility | ✅ PASS | Named constants for token TTL, claim names. No magic literals. |
| VI. Layered Architecture | ✅ PASS | Mobile → Server → DuckDB. Mobile never touches DuckDB. Google identity verified server-side only. |
| VII. Strong Typing & Schema Validation | ✅ PASS | All request bodies validated via Fastify Ajv JSON Schema. Responses typed and schema-validated. Shared types in `packages/core`. `type` aliases used throughout (no `interface`). |

**Complexity Tracking**: No violations — no table needed.

## Project Structure

### Documentation (this feature)

```text
specs/007-google-oauth-auth/
├── plan.md              # This file
├── research.md          # Phase 0: auth solution evaluation
├── data-model.md        # Phase 1: User entity
├── quickstart.md        # Phase 1: integration scenarios
├── contracts/           # Phase 1: API contracts
│   └── auth.json
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code

```text
# Server — apps/server/
src/
├── auth/
│   ├── googleVerifier.ts       # Verify Google ID token: signature, expiry, audience (all GOOGLE_CLIENT_IDS), email_verified: true
│   ├── googleVerifier.test.ts
│   ├── sessionJwt.ts           # Issue + verify server-side session JWT
│   ├── sessionJwt.test.ts
│   └── plugin.ts               # Fastify plugin: decorate request with user/guest; must NOT throw on absent Authorization header
├── services/
│   ├── authService.ts          # Orchestrates sign-in flow: verify ID token → upsert user → issue session JWT
│   └── authService.test.ts
├── routes/
│   ├── auth.ts                 # Thin HTTP layer: POST /auth/google, POST /auth/signout, GET /auth/me — delegates to authService
│   └── auth.test.ts
├── repositories/
│   ├── userRepository.ts       # upsertUser (INSERT … ON CONFLICT — no read-then-write), findUserById
│   └── userRepository.test.ts
└── db/
    └── migrations/
        └── 002_create_users.sql  # users table

# Core — packages/core/
src/
├── types/
│   └── auth.ts                  # AuthUser, GuestIdentity, AuthenticatedIdentity, AuthState, GoogleSignInBody, GoogleSignInResponse
├── schemas/
│   └── auth.ts                  # Ajv-compatible JSON schemas for auth endpoints (follows schemas/card.ts pattern)
└── constants/
    └── index.ts                 # (existing) — add AUTH_ERROR_CODES, SESSION_JWT_TTL_DAYS, AUTH_IDENTITY_KIND

# Mobile — apps/mobile/ (framework TBD)
src/
└── auth/
    ├── googleSignIn.ts          # Platform-native Google Sign-In wrapper
    ├── sessionStore.ts          # Secure storage read/write for session token
    └── authContext.ts           # App-wide auth state (guest vs authenticated)
```

**Structure Decision**: Follows the existing server layered pattern (`routes/` → `services/` → `repositories/`). `authService.ts` orchestrates the sign-in flow (verify → upsert → issue JWT), keeping route handlers as thin HTTP glue — the same pattern as `cardService.ts`. Low-level auth primitives (`googleVerifier.ts`, `sessionJwt.ts`, `plugin.ts`) live in `src/auth/` to isolate token concerns. Shared contracts (types, JSON schemas, constants) live in `packages/core`; auth logic with Node.js-only dependencies (`google-auth-library`, `@fastify/jwt`) stays in `apps/server` to avoid breaking mobile bundlers.

## Implementation Notes

### Security requirements (from architectural review)

| # | Requirement | Where enforced |
|---|-------------|----------------|
| 1 | Check `email_verified: true` in Google ID token payload — reject tokens where it is `false` | `googleVerifier.ts` |
| 2 | Pass the full `GOOGLE_CLIENT_IDS` list as the `audience` parameter to `OAuth2Client.verifyIdToken()` — primary defence against token substitution attacks | `googleVerifier.ts` |
| 4 | No server-side JWT revocation mechanism; 7-day TTL is the only safeguard. Document this trade-off; revisit if scope grows beyond personal use. | `sessionJwt.ts` (comment), `contracts/auth.json` |
| 5 | User upsert must use `INSERT … ON CONFLICT` (DuckDB-native) — never a read-then-write pattern, which risks write conflicts under concurrent sign-in | `userRepository.ts` |
| 6 | Auth plugin must decorate `request.identity` and complete without throwing when the `Authorization` header is absent or malformed; route handlers delegate to `authService` which decides whether to reject | `plugin.ts`, `authService.ts` |
