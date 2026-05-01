# Contract: Mobile API Client

**Feature**: 002-mobile-binder-app
**Date**: 2026-05-01
**Owner**: `apps/mobile/src/services/api/apiClient.ts`

The mobile app is a read-only consumer of the server API at `apps/server`. This document
captures the **client-side contract** — every endpoint the mobile app calls, the request it
sends, and the response shape it expects. The server is the source of truth; if a server
schema changes, the entry below MUST be updated and the matching `@my-binder/core` schema
re-imported.

**Layering**: `apiClient.ts` exposes a small set of typed methods (`getCards`, `getMe`,
`signInWithGoogle`, `signOut`) that perform `fetch` + auth-header attachment + Ajv
validation. These methods are the **`queryFn` / `mutationFn` bodies** for TanStack Query 5;
all caching, request deduplication, and retry-with-back-off are handled by TanStack Query
on top of them (see [research.md §11](../research.md#11-server-state-management-tanstack-query)).
The hook consumer column below names the TanStack hook for each operation.

All endpoints share the following:

- **Base URL**: read from `expo-constants` `extra.apiBaseUrl` at app start. Local dev points
  at `http://localhost:3000`; production points at the API Gateway URL emitted by the CDK
  stack (`packages/infrastructure`).
- **Content-Type**: `application/json` on requests with bodies; responses are always JSON.
- **Authorization**: `Authorization: Bearer <jwt>` for every endpoint except `POST
  /auth/google`. The JWT comes from `sessionStore`; if absent or expired, `apiClient` does
  not attach the header and the server replies with 401 (mapped to `AUTH_INVALID_TOKEN`,
  see Error Mapping below). TanStack hooks additionally gate execution via
  `enabled: useSession().status === "active"` so a query never fires for an unauthenticated
  user.
- **Schema validation**: every response body is validated against the corresponding Ajv
  schema from `@my-binder/core/schemas/` **inside** the `queryFn` before resolving (Principle
  VII). A schema mismatch throws `SchemaValidationError`, which TanStack treats as a query
  error; the cache therefore only ever stores schema-validated payloads. Errors are logged
  per Principle VIII.
- **Retry & caching defaults** (set on the QueryClient in
  `apps/mobile/src/services/api/queryClient.ts`):
  - Queries: `retry: 3` with exponential back-off (`1s → 2s → 4s`, ceiling 30s),
    **predicate skips 4xx** so auth errors fail fast.
  - Mutations: `retry: 0` — never auto-retry sign-in or sign-out.
  - `refetchOnWindowFocus: false`, `retryOnMount: false`.
  - Per-endpoint `staleTime` / `gcTime` listed below.

---

## Endpoints consumed

### POST /auth/google — Sign in with Google

**Used by**: `useGoogleSignInMutation` (TanStack `useMutation`), composed by `useLogin`
(FR-002 → FR-005).
**TanStack config**: `mutationFn: apiClient.signInWithGoogle`; `retry: 0`.

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

**Used by**: `useMeQuery` (TanStack `useQuery`), composed by `useSession` on app start
after a session is rehydrated from secure storage, to verify the JWT is still valid
server-side before navigating away from `Login`.
**TanStack config**: `queryKey: ["auth", "me"]`; `queryFn: apiClient.getMe`;
`staleTime: 60_000` (1 min); `gcTime: 5 * 60_000` (5 min);
`enabled: useSession().status === "active"`.

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

**Used by**: `useSignOutMutation` (TanStack `useMutation`), composed by
`useLogin.handleSignOut` (FR-008).
**TanStack config**: `mutationFn: apiClient.signOut`; `retry: 0`.

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
5. **Call `queryClient.clear()`** so `["cards"]`, `["auth", "me"]`, and any future
   per-user query keys are wiped from the cache before another user can sign in.
6. Navigate to `Login`.

Steps 2–5 MUST execute even if step 1 returns an error — local cleanup must be best-effort
to satisfy "user wants to sign out" intent. The error from step 1 is logged per Principle
VIII but not surfaced to the user.

---

### GET /cards — List the user's cards

**Used by**: `useCardsInfiniteQuery` (TanStack `useInfiniteQuery`), composed by
`useBinderHome` after sign-in to populate the cache (FR-009 → FR-014).
**TanStack config**: `queryKey: ["cards"]`; `queryFn: apiClient.getCards`;
`getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined`;
`staleTime: 5 * 60_000` (5 min); `gcTime: 30 * 60_000` (30 min);
`enabled: useSession().status === "active"`.

**Request**:

```http
GET /cards?limit=200&cursor=<opaque>
Authorization: Bearer <jwt>
```

The mobile client uses page size 200 (server max). `useCardsInfiniteQuery` calls
`fetchNextPage()` until `nextCursor` is null; pages live in TanStack's cache as a single
infinite-query result and are flattened in `useBinderHome` via
`pages.flatMap(p => p.cards)` for the `Card[]` consumed by the view.

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

- Each batch is validated inside the queryFn; on validation failure, the `useInfiniteQuery`
  resolves to `isError`, `useBinderHome` maps that to `loadState === "error"`, and the
  binder view shows an error banner.
- The infinite-query loop continues until `nextCursor === null`. The user sees a loading
  state on page 1 of the binder until at least the first batch lands; subsequent batches
  stream into the cache and pages 2+ become navigable via `isFetchingNextPage` once their
  cards arrive.
- Manual refresh (pull-to-refresh on a future iteration) calls
  `queryClient.invalidateQueries({ queryKey: ["cards"] })`, which restarts the infinite
  query from the first cursor without unmounting the view.

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
