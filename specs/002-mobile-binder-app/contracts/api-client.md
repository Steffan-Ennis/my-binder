# Contract: Mobile API Client

**Feature**: 002-mobile-binder-app
**Date**: 2026-05-01
**Owner**: `apps/mobile/src/services/api/apiClient.ts`

The mobile app is a read-only consumer of the server API at `apps/server`. This document
captures the **client-side contract** — every endpoint the mobile app calls, the request it
sends, and the response shape it expects. The server is the source of truth; if a server
schema changes, the entry below MUST be updated and the matching `@my-binder/core` schema
re-imported.

All endpoints share the following:

- **Base URL**: read from `expo-constants` `extra.apiBaseUrl` at app start. Local dev points
  at `http://localhost:3000`; production points at the API Gateway URL emitted by the CDK
  stack (`packages/infrastructure`).
- **Content-Type**: `application/json` on requests with bodies; responses are always JSON.
- **Authorization**: `Authorization: Bearer <jwt>` for every endpoint except `POST
  /auth/google`. The JWT comes from `useSession()`; if absent or expired, `apiClient` does
  not attach the header and the server replies with 401 (mapped to `AUTH_INVALID_TOKEN`,
  see Error Mapping below).
- **Schema validation**: every response body is validated against the corresponding Ajv
  schema from `@my-binder/core/schemas/` before returning to the caller (Principle VII).
  Validation failure is a `SchemaValidationError`, logged per Principle VIII.

---

## Endpoints consumed

### POST /auth/google — Sign in with Google

**Used by**: `useLogin` (FR-002 → FR-005).

**Request**:

```http
POST /auth/google
Content-Type: application/json

{
  "idToken": "<google-id-token>"
}
```

**Request schema**: `GOOGLE_SIGN_IN_BODY_SCHEMA` from `@my-binder/core/schemas/auth.json`.

**200 OK response**:

```json
{
  "user": {
    "id": "user_01HABC...",
    "email": "user@example.com",
    "displayName": "User Name"
  },
  "session": {
    "jwt": "<server-issued-hs256-jwt>",
    "expiresAt": "2026-05-08T00:00:00.000Z"
  }
}
```

**Response schema**: `GoogleSignInResponse` (`@my-binder/core/types/auth.ts` +
`@my-binder/core/schemas/auth.json#/definitions/GoogleSignInResponse`).

**Mobile handling**:

- Persist `session.jwt` and the `iat` derived from the server response into
  `expo-secure-store` (see `data-model.md`).
- Update `sessionStore` to `status: "active"`.
- Navigate to `BinderHome`.

**Error responses**:

| Status | Body `error.code` | Mobile handling |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Treat as a malformed request — log + show generic retryable error (defensive; should not happen if mobile builds the body correctly). |
| 401 | `AUTH_INVALID_GOOGLE_TOKEN` | Show the retryable error per FR-004 (Q2: clear error + retry). Stay on Login. |
| 403 | `AUTH_NOT_ALLOWLISTED` | Navigate to `AccessDeniedScreen` per FR-005. **Do not** clear the Google grant — the user may try a different Google account. |
| 5xx / network | (any) | Show retryable error per FR-004; remain on Login. |

---

### GET /auth/me — Hydrate current user

**Used by**: `useSession` on app start, after a session is rehydrated from secure storage,
to verify the JWT is still valid server-side before navigating away from `Login`.

**Request**:

```http
GET /auth/me
Authorization: Bearer <jwt>
```

**200 OK response**:

```json
{
  "user": {
    "id": "user_01HABC...",
    "email": "user@example.com",
    "displayName": "User Name"
  }
}
```

**Response schema**: `AuthMeResponse` (`@my-binder/core/types/auth.ts`).

**Mobile handling**:

- 200 → keep session active, navigate to `BinderHome`.
- 401 (`AUTH_INVALID_TOKEN`) → clear local session, navigate to `Login`.
- 403 (`AUTH_NOT_ALLOWLISTED`) → user was removed from the allowlist between sessions;
  clear local session and navigate to `AccessDeniedScreen`.
- 5xx / network → show offline banner; keep current screen.

---

### POST /auth/signout — Sign out

**Used by**: `useLogin.handleSignOut` (FR-008).

**Request**:

```http
POST /auth/signout
Authorization: Bearer <jwt>
```

**204 No Content** on success.

**Mobile handling**:

1. POST `/auth/signout` (server invalidates its session record, if any).
2. Delete `session.jwt` and `session.iat` from `expo-secure-store`.
3. POST `https://oauth2.googleapis.com/revoke?token=<google-access-token>` to revoke the
   Google grant per FR-008 (Q5: full re-consent on next sign-in).
4. Reset `sessionStore` and `binderStore`.
5. Navigate to `Login`.

Steps 2–4 MUST execute even if step 1 returns an error — local cleanup must be best-effort
to satisfy "user wants to sign out" intent. The error from step 1 is logged per Principle
VIII but not surfaced to the user.

---

### GET /cards — List the user's cards

**Used by**: `useBinderHome` after sign-in to populate `binderStore.cards` (FR-009 →
FR-014).

**Request**:

```http
GET /cards?limit=200&cursor=<opaque>
Authorization: Bearer <jwt>
```

The mobile client uses page size 200 (server max). Repeats with the returned cursor until
`nextCursor` is null. All fetched pages are concatenated into `binderStore.cards`.

**200 OK response**:

```json
{
  "cards": [
    { "id": "...", "name": "...", "frontFaceImageUrl": "https://..." }
  ],
  "nextCursor": "<opaque-or-null>"
}
```

**Response schema**: `CardListResponse` (`@my-binder/core/schemas/card.json#/definitions/CardListResponse`).

**Mobile handling**:

- Each batch is validated; on validation failure, `binderStore.loadState` becomes
  `"error"` and the binder view shows an error banner.
- Pagination loop continues until `nextCursor === null`. The user sees a loading state on
  page 1 of the binder until at least the first batch lands; subsequent batches stream into
  the store and pages 2+ become navigable as their cards arrive.

**Error responses**:

| Status | Body `error.code` | Mobile handling |
|---|---|---|
| 401 | `AUTH_INVALID_TOKEN` | Clear local session, navigate to `Login`. |
| 5xx / network | (any) | `binderStore.loadState = "error"`, retry via pull-to-refresh. |

---

## Endpoints NOT consumed by mobile in this feature

The mobile app does **not** call these in spec 002. Listed for completeness so the contract
is unambiguous about what is and isn't in scope.

- `GET /cards/:id`, `POST /cards`, `PUT /cards/:id`, `DELETE /cards/:id` — write/CRUD operations are out of scope (the mobile binder is read-only in this feature).
- `GET /cards/lookup`, `GET /cards/search`, `GET /cards/legality` — discovery/legality features are out of scope.
- `GET /provider`, `PUT /provider` — server-administrator surface; not a mobile concern.
- `GET /docs`, `GET /health` — operator surfaces; not consumed by the mobile UI.
- `GET /auth/login` — server-rendered Google sign-in page; the mobile app uses
  `expo-auth-session` directly and never navigates to this URL.

---

## Error Mapping

The mobile app maps server error codes to UI behaviour through a single mapping table in
`apiClient.ts`. The table is derived from `@my-binder/core/constants/errorCodes.ts` and
augmented with a synthetic `NETWORK_OFFLINE` for `fetch` rejections.

| Server `error.code` | HTTP | Mobile behaviour |
|---|---|---|
| `AUTH_INVALID_TOKEN` | 401 | Clear session, route to Login |
| `AUTH_INVALID_GOOGLE_TOKEN` | 401 | Stay on Login, surface retry banner (FR-004) |
| `AUTH_NOT_ALLOWLISTED` | 403 | Route to AccessDenied (FR-005); preserve Google grant |
| `VALIDATION_ERROR` | 400 | Defensive log; should not occur in well-formed clients |
| `NETWORK_OFFLINE` (synthetic) | n/a | Retry banner (FR-004) |
| any other | any | Log original (Principle VIII), generic banner |
