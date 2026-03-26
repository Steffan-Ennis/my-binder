# Data Model: Google OAuth Authentication with Guest Mode

**Feature**: 007-google-oauth-auth
**Date**: 2026-03-26
**Synced with**: `contracts/auth.json`, `packages/core/src/types/auth.ts`

## Entities

### User

Represents a person who has authenticated at least once via Google Sign-In. Guest users have no `User` record; their identity is purely the absence of a Bearer token.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Stable internal identifier. Never exposed directly to the mobile app in URLs. |
| `google_sub` | TEXT | UNIQUE NOT NULL | Google `sub` claim. Stable across email changes. Used to identify returning users on sign-in. |
| `email` | TEXT | NOT NULL | From Google ID token. Stored for display; NOT used as a lookup key (can change). |
| `display_name` | TEXT | NOT NULL | From Google `name` claim. Displayed in the app UI. |
| `avatar_url` | TEXT | NULLABLE | From Google `picture` claim. May be absent for accounts without a profile photo. |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | First sign-in time. |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Updated on each sign-in (refreshes display_name and avatar_url from latest token). |

**State transitions**: A `User` row is created on first successful Google sign-in (upsert on `google_sub`). `display_name`, `email`, and `avatar_url` are refreshed on every subsequent sign-in. There is no "deleted" state — the personal nature of the app means user deletion is out of scope.

**Validation rules**:
- `google_sub` MUST match the `sub` claim in a valid, non-expired Google ID token.
- `email` MUST be present in the ID token.
- `display_name` MUST be a non-empty string.

### Session JWT (stateless — not stored in DB)

Sessions are represented as short-lived JWTs signed with a server secret. No session table exists in DuckDB.

| Claim | Type | Notes |
|-------|------|-------|
| `sub` | string (UUID) | The `User.id` of the authenticated user. |
| `iat` | number | Issued-at timestamp (Unix epoch). |
| `exp` | number | Expiry timestamp. TTL = 7 days from issuance. |

The JWT is opaque to the mobile app — it is stored in platform secure storage and sent as a `Authorization: Bearer <token>` header. The server validates the signature and expiry on every authenticated request.

**Sign-out**: Handled by the mobile deleting the stored JWT. No server-side invalidation table is needed for a personal app.

## DuckDB Migration

```sql
-- apps/server/src/db/migrations/002_create_users.sql
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub  TEXT        UNIQUE NOT NULL,
  email       TEXT        NOT NULL,
  display_name TEXT       NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Shared TypeScript Types (packages/core)

```typescript
// packages/core/src/types/auth.ts

export type AuthUser = {
  id: string;           // UUID
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export type GuestIdentity = {
  kind: 'guest';
};

export type AuthenticatedIdentity = {
  kind: 'authenticated';
  user: AuthUser;
};

export type AuthState = GuestIdentity | AuthenticatedIdentity;
```

## Relationship Diagram

```
User (DuckDB)
  id ─────────────── referenced by JWT `sub` claim
  google_sub ─────── verified against Google ID token `sub`
  email
  display_name
  avatar_url

Session JWT (mobile secure storage)
  sub → User.id
  iat, exp
```

No foreign keys to other tables in the initial implementation. Binder/collection features will reference `users.id` when they are built.
