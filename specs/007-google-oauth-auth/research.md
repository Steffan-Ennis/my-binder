# Research: Authentication Solution Evaluation

**Feature**: 007-google-oauth-auth
**Date**: 2026-03-26
**Resolved by**: /speckit.plan (with user-provided direction to explore AWS Cognito vs direct Google SDKs)

## Options Evaluated

Three approaches were evaluated against the project constitution (Principle I: Simplicity First — personal project, minimum complexity governs all decisions).

---

### Option A — AWS Cognito

**What it is**: Amazon's managed identity service. Cognito User Pools act as a user directory; Google is configured as a federated identity provider. The mobile SDK (AWS Amplify or `amazon-cognito-identity-js`) handles the OAuth flow and exchanges credentials for Cognito-issued tokens. The server validates Cognito JWTs using Cognito's `.well-known` JWKS endpoint.

**Pros**:
- Managed: token refresh, session management, user directory handled by AWS.
- Multi-provider federation baked in (add Apple, Facebook without code changes).
- Built-in user blocking, MFA, password policies.

**Cons**:
- Substantial setup cost: AWS account, IAM roles, Cognito User Pool configuration, App Client, hosted UI or custom OAuth flow, mobile SDK integration.
- Cost at scale: free up to 50,000 MAU, then $0.0055 per MAU — not relevant for a personal app, but adds a billable dependency.
- Lock-in: Cognito JWTs and API shapes are AWS-specific; migrating away requires rewriting both server middleware and mobile SDK calls.
- Violates Principle I: introduces an external managed service, IAM complexity, and SDK overhead for a problem that can be solved with ~50 lines of code.

**Decision: Rejected.** Over-engineered for a personal project. Constitution Principle I requires the simplest sufficient approach.

---

### Option B — Firebase Authentication

**What it is**: Google's own managed auth service. Mobile uses the Firebase Auth SDK, which handles the Google OAuth flow natively on iOS and Android. The server uses the Firebase Admin SDK to verify Firebase ID tokens.

**Pros**:
- Google's infrastructure — natural fit with Google Sign-In.
- Generous free tier (Spark plan: unlimited MAU for Google sign-in).
- Excellent mobile SDK quality; handles token refresh transparently.
- Built-in user management console.

**Cons**:
- Adds Firebase as a project-wide dependency — `apps/mobile` and `apps/server` both require Firebase SDKs.
- Firebase Admin SDK (`firebase-admin`) is a large dependency for `apps/server` (>30 MB installed, pulls in gRPC and protobuf) — disproportionate for a server whose existing footprint is intentionally lean.
- Requires a Firebase project (separate from Google Cloud Console) and service account credentials on the server.
- Still an external managed service, albeit a free one. If Firebase Auth changes pricing or APIs, both client and server must be updated.
- Violates Principle I mildly: introduces two additional SDKs and a managed service where neither is strictly necessary.

**Decision: Rejected.** Simpler than Cognito, but still adds managed-service overhead. The direct SDK approach (Option C) achieves the same outcome with a fraction of the dependencies.

---

### Option C — Direct Google Sign-In + Server-Side ID Token Verification ✅ CHOSEN

**What it is**: The mobile app uses the native platform Google Sign-In SDK directly (iOS: `GoogleSignIn-iOS`, Android: `play-services-auth`; or the React Native / Expo equivalent when the mobile framework is chosen). After successful sign-in, the SDK returns a Google ID token. The mobile sends this token to `POST /auth/google`. The server verifies it using `google-auth-library` (which fetches Google's public keys from their well-known endpoint and validates the JWT signature). On success, the server looks up or creates the user in DuckDB and returns a short-lived server-issued JWT (session token). Subsequent requests carry the session JWT as a Bearer token. Requests with no Bearer token are treated as guest.

**Pros**:
- Minimal footprint: one new server dependency (`google-auth-library`, ~2 MB), one new server dependency (`@fastify/jwt`), and the platform-native Google Sign-In SDK on mobile.
- No external managed service — no additional Google Cloud products beyond the OAuth client credentials already required.
- Token validation is fully server-side, using Google's published public keys (fetched and cached by `google-auth-library`).
- User records stored in the existing DuckDB instance — no new storage layer.
- Stateless server-side session JWTs — no session table, no server-side revocation needed (personal app; sign-out deletes the token on device).
- Straightforward to test: mock the Google verifier in unit tests; use a real Google account in E2E.

**Cons**:
- Token refresh is manual: the mobile must detect a 401 and silently re-trigger Google Sign-In to get a fresh ID token, then exchange it for a new session JWT. This is handled by the native Google Sign-In SDK's `signInSilently()` method.
- Session revocation (if the user's Google account is de-authorized) is lazy: the expired session JWT will be rejected at its TTL, or the next silent sign-in attempt will fail and force re-authentication. For a personal app this is acceptable.
- No hosted user management UI — user records must be queried directly from DuckDB if needed.

**Decision: Chosen.** Best fit for Principle I. Delivers all spec requirements with minimal dependencies and no external managed service.

---

## Decision Summary

| | AWS Cognito | Firebase Auth | Direct Google SDK |
|---|---|---|---|
| External managed service | Yes | Yes | No |
| New server dependencies | SDK + IAM | `firebase-admin` (large) | `google-auth-library` + `@fastify/jwt` (small) |
| New mobile dependencies | Amplify or Cognito SDK | Firebase Auth SDK | Native Google Sign-In SDK |
| Setup complexity | High | Medium | Low |
| Cost | Free tier, then pay | Free (Spark plan) | Free |
| Constitution Principle I fit | ❌ | ⚠️ | ✅ |

---

## Key Implementation Decisions

### Session JWT TTL
- **Decision**: 7-day expiry.
- **Rationale**: Long enough that a personal-app user does not need to re-authenticate daily. Short enough that a de-authorized Google account will be locked out within a week without any server-side revocation mechanism.
- **Alternatives considered**: 1-hour (too short, forces frequent silent re-auth); 30-day (too long for security comfort on a mobile device).

### User Identifier
- **Decision**: Google `sub` claim (subject) as the stable user identifier in DuckDB. The internal user row also gets a UUID primary key.
- **Rationale**: Google's `sub` is stable across email changes, app reinstalls, and device switches. Email is stored for display but not used as a key.

### Guest Mode Server Handling
- **Decision**: Unauthenticated requests receive no special server treatment beyond missing the user context. Routes that require authentication return HTTP 401; read-only routes succeed without a token.
- **Rationale**: No guest session token needed — guest state is purely the absence of a Bearer token. Zero server complexity added for guest mode.

### Google OAuth Client Type
- **Decision**: Web Application client for the server callback; iOS + Android OAuth clients for the mobile apps (all registered in the same Google Cloud project).
- **Rationale**: Google Sign-In on mobile uses platform OAuth clients; the server only needs to verify the resulting ID token (no server-side OAuth redirect flow required).
