# Contract: Authentication (Updated for Allowlist)

**Branch**: `011-postgres-migration` | **Date**: 2026-04-03
**Affected routes**: `POST /auth/google`
**Prior contract**: `specs/007-google-oauth-auth/` (unchanged except as noted below)

---

## Change Summary

This migration introduces one behavioural change to the authentication contract: sign-in is now gated by an email allowlist. All other endpoints and response shapes are unchanged.

---

## POST /auth/google

Signs in a user with a Google ID token.

**Request** (unchanged):
```
Content-Type: application/json
{ "idToken": "<google-id-token>" }
```

**Response — success** (unchanged):
```
HTTP 200
Set-Cookie: session=<jwt>; HttpOnly; Path=/; SameSite=Strict
{ "user": { "id": "...", "email": "...", "displayName": "...", "avatarUrl": "..." | null } }
```

**Response — email not in allowed pool** (NEW):
```
HTTP 403
{ "error": "ACCESS_DENIED", "message": "This email address is not permitted to sign in." }
```

**Response — invalid or expired token** (unchanged):
```
HTTP 401
{ "error": "INVALID_TOKEN" }
```

---

## Allowlist Enforcement Rules

1. Google token is verified first (audience, expiry, `email_verified`). If verification fails → 401.
2. Verified email is checked against `allowed_users` table. If not found → 403. No user record is created. No session is issued.
3. If email is allowed → proceed with upsert + session JWT issuance (unchanged).

The 403 response MUST NOT reveal whether the email exists as a registered user.

---

## All Other Endpoints

No contract changes. Response shapes, status codes, and error formats for the following endpoints are identical before and after migration:

- `GET /auth/me`
- `POST /auth/signout`
- `GET /auth/login`
- `GET /cards`, `POST /cards`, `GET /cards/:id`, `PUT /cards/:id`, `DELETE /cards/:id`
- `GET /cards/lookup`, `GET /cards/search`, `GET /cards/legality`
- `GET /health`
- `GET /docs`
- `GET /provider`, `PUT /provider`
