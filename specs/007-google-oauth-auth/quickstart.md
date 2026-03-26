# Quickstart: Google OAuth Authentication with Guest Mode

**Feature**: 007-google-oauth-auth
**Date**: 2026-03-26

This document describes the concrete end-to-end scenarios that must work for the feature to be considered complete. It is written from the perspective of the mobile app developer integrating with the server.

---

## Prerequisites

1. A Google Cloud project with an OAuth 2.0 client registered for iOS and Android (plus a Web client for server-side audience validation).
2. The server environment variable `GOOGLE_CLIENT_IDS` set to a comma-separated list of the OAuth client IDs (used to validate the `aud` claim in Google ID tokens). The implementation must pass this full list as the `audience` parameter to `OAuth2Client.verifyIdToken()` — this is the primary defence against token substitution attacks.
3. The server environment variable `SESSION_JWT_SECRET` set to a cryptographically random string (≥ 32 characters).
4. The server running locally: `pnpm turbo dev` (or `pnpm dev` inside `apps/server`).
5. **Production deployments must run behind TLS (HTTPS).** The Google ID token and session JWT are bearer credentials; transmitting them over plain HTTP allows trivial interception. A TLS-terminating reverse proxy (e.g. nginx, Caddy) must sit in front of the server container.

---

## Scenario 1 — Happy path: sign in with Google

**Goal**: Mobile user completes Google sign-in and receives a session token.

### Step 1 — Mobile triggers Google Sign-In

The mobile app calls the platform-native Google Sign-In SDK. The user selects their Google account and grants consent. The SDK returns a Google ID token string.

### Step 2 — Mobile exchanges the ID token

```http
POST /auth/google
Content-Type: application/json

{ "idToken": "<google-id-token>" }
```

### Step 3 — Server validates and responds

The server verifies the Google ID token against all values in `GOOGLE_CLIENT_IDS` (signature, expiry, audience, and `email_verified: true`). Tokens where `email_verified` is `false` are rejected with `401 INVALID_GOOGLE_TOKEN`. If valid, it upserts the user in DuckDB using `INSERT … ON CONFLICT` and returns:

```json
{
  "token": "<session-jwt>",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@gmail.com",
    "displayName": "Jane Doe",
    "avatarUrl": "https://lh3.googleusercontent.com/..."
  }
}
```

### Step 4 — Mobile stores the session token

The mobile writes the `token` value to platform secure storage (Keychain on iOS, Keystore-backed storage on Android).

### Step 5 — Verify authentication state

```http
GET /auth/me
Authorization: Bearer <session-jwt>
```

Expected response:

```json
{
  "kind": "authenticated",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@gmail.com",
    "displayName": "Jane Doe",
    "avatarUrl": "https://lh3.googleusercontent.com/..."
  }
}
```

---

## Scenario 2 — Guest mode (no sign-in)

**Goal**: Mobile user browses the app without signing in.

### Step 1 — Mobile makes unauthenticated request

```http
GET /auth/me
```
*(No Authorization header)*

### Step 2 — Server returns guest identity

```json
{ "kind": "guest" }
```

### Step 3 — Guest accesses a read-only route

```http
GET /cards?page=1&limit=20
```

Response: normal cards list (no change from current behaviour).

### Step 4 — Guest attempts a write action (future feature)

```http
POST /binders
Authorization: (absent)
```

Response:

```json
{ "code": "UNAUTHORIZED", "message": "Sign in to save binders." }
```

HTTP 401.

---

## Scenario 3 — Returning user (auto sign-in)

**Goal**: App restarts; mobile finds a stored token and the user is already signed in.

### Step 1 — App starts; mobile reads token from secure storage

Token is present and not expired (checked locally by decoding the JWT `exp` claim without signature verification — full verification happens server-side).

### Step 2 — Mobile calls `/auth/me` with the stored token

```http
GET /auth/me
Authorization: Bearer <stored-session-jwt>
```

Response: authenticated user (same as Scenario 1 Step 5).

No re-authentication needed.

---

## Scenario 4 — Expired token (silent re-authentication)

**Goal**: Session JWT has expired; mobile refreshes it silently.

### Step 1 — Mobile detects 401

Any authenticated request returns:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{ "code": "UNAUTHORIZED", "message": "Session expired." }
```

### Step 2 — Mobile triggers silent Google sign-in

The native Google Sign-In SDK's `signInSilently()` method is called. If the user is still signed into Google on the device, this returns a fresh ID token with no UI shown to the user.

### Step 3 — Mobile exchanges the fresh ID token

```http
POST /auth/google
Content-Type: application/json

{ "idToken": "<fresh-google-id-token>" }
```

Response: new session JWT. Mobile stores it, replacing the expired one.

### Step 4 — Mobile retries the original request

The original request is retried with the new token. The user sees no interruption.

---

## Scenario 5 — Sign out

**Goal**: User taps "Sign Out"; session is ended.

### Step 1 — Mobile calls sign-out endpoint (optional — for clean API boundary)

```http
POST /auth/signout
Authorization: Bearer <session-jwt>
```

Response: `HTTP 204 No Content`.

### Step 2 — Mobile deletes the stored session token

The token is removed from platform secure storage.

> **No server-side revocation**: Session JWTs are stateless. Calling `POST /auth/signout` does not invalidate the token on the server — the 7-day TTL is the only safeguard. If a device is compromised and the token is exfiltrated, it remains valid until it expires. This trade-off is acceptable for a personal application.

### Step 3 — Verify guest state

```http
GET /auth/me
```
*(No Authorization header)*

Response:

```json
{ "kind": "guest" }
```

---

## Scenario 6 — Invalid Google ID token

**Goal**: Malformed or tampered token is rejected.

```http
POST /auth/google
Content-Type: application/json

{ "idToken": "not-a-real-token" }
```

Response:

```http
HTTP/1.1 401 Unauthorized

{ "code": "INVALID_GOOGLE_TOKEN", "message": "Google ID token verification failed." }
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_IDS` | Yes | Comma-separated list of Google OAuth client IDs for which ID tokens are accepted. Include both iOS and Android client IDs. |
| `SESSION_JWT_SECRET` | Yes | Secret for signing/verifying server-issued session JWTs. Min 32 chars. Never commit to source control. |

Both MUST be supplied via environment (not baked into the container image — Constitution Principle, Containerisation rule).
