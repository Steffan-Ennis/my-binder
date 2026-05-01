# Data Model: Mobile Binder App

**Feature**: 002-mobile-binder-app
**Date**: 2026-05-01

This document defines the entities the mobile app holds in memory, the persisted records,
and the validation rules each entity is subject to. The mobile app is a **read-only client**
of the server-authoritative collection — no server-side write operations are introduced by
this feature.

Entities below are TypeScript `type` aliases (Principle VII: prefer `type` over `interface`).
Validation columns reference Ajv schemas in `@my-binder/core/schemas/` where the data
crosses a boundary (Principle VII).

---

## Persisted Entities (mobile-only)

### Session

The 7-day authenticated session, stored under `expo-secure-store`. Hydrated once on app
start by `useSession`.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `jwt` | `string` | non-empty; must validate against the server's HS256 signature on each API call (server-side only — mobile treats it as an opaque bearer token) | Stored under `expo-secure-store` key `session.jwt` |
| `iat` | `number` (epoch seconds) | required; immutable for the lifetime of the session | Stored under `expo-secure-store` key `session.iat`. The 7-day window is computed as `iat + 7 * 86400` against the device's `Date.now() / 1000`. |
| `userId` | `string` | non-empty; sourced from the JWT's `sub` claim, decoded once at hydration time | In-memory only (recomputable from `jwt`) |
| `email` | `string` | RFC 5322 email; sourced from the JWT's `email` claim | In-memory only |

**State transitions**:

```
[no session]
   │ Google sign-in succeeds + server allowlist passes (FR-005)
   ▼
[active session]  ──── time advances ──── (iat + 7d) ────► [expired]
   │                                                          │
   │ user signs out (FR-008)                                  │ next launch
   ▼                                                          ▼
[revoked]  ───────────────────────────────────────────► [no session]
```

**Invariants**:

- `iat` is never modified after creation; refresh = a new sign-in flow, not a token rotation.
- An expired session MUST NOT be sent on outbound requests; `useSession` returns
  `status: "expired"` and `useApi` refuses to attach the bearer.
- On sign-out, both `expo-secure-store` keys MUST be deleted **before** the Google revoke
  call so a process kill mid-revocation still leaves the local session cleared.

---

## Ephemeral Entities (in-memory, hydrated from server)

### Binder

The user's logical collection, paginated for display. Held in `binderStore`. Refetched on
sign-in; not persisted to disk.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `cards` | `Card[]` | server-ordered list; mobile preserves order | Source: `GET /cards` (paginated server-side; mobile concatenates pages until done) |
| `currentPage` | `number` | `1 ≤ currentPage ≤ totalPages`; default 1 | UI state; resets to 1 when `cards` is replaced |
| `totalPages` | `number` (derived) | `Math.max(1, ceil(cards.length / 9))` | Derived; never persisted |
| `loadState` | `"idle" \| "loading" \| "ready" \| "error"` | finite state | Drives the empty-state vs. cards-rendered branching |

**Invariants**:

- `totalPages` is derived from `cards.length` per FR-013. The store does NOT expose a setter
  for it — it's a computed selector.
- An empty collection (`cards.length === 0`) yields `totalPages === 1` so the empty-binder
  view always has a page to render (Edge Case in spec).
- `currentPage > totalPages` after a card removal MUST clamp to `totalPages` rather than
  produce a phantom page (Edge Case).

### Page (logical, not stored)

A 9-slot view onto `binder.cards[(currentPage-1)*9 .. currentPage*9 - 1]`. Computed on
render from `currentPage` and `cards`.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `pageNumber` | `number` | `1 ≤ pageNumber ≤ totalPages` | |
| `slots` | `CardSlot[]` (length 9) | exactly 9 entries; trailing slots are empty for partial pages | Derived from `cards` |

### CardSlot

A single position within a page.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `slotIndex` | `number` (0–8) | always a 0-indexed position within its page | |
| `card` | `Card \| null` | `null` ⇒ empty pocket per FR-011 | |

### Card

A collectible card displayed in a slot. **Mirrors** the server-authoritative `CardRecord`
type already defined in `packages/core/src/types/card.ts`. The mobile mirror is
intentionally narrow — only the fields the UI renders are imported; full provider metadata
stays server-side.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `string` | non-empty UUID or provider-stable ID | Identity for React `key` props |
| `name` | `string` | non-empty | Used for accessibility labels |
| `frontFaceImageUrl` | `string` | non-empty HTTPS URL; validated by Ajv against `@my-binder/core/schemas/card.json` | FR-010 — required for any occupied slot |

**Validation**: Every inbound `Card` MUST validate against the shared
`@my-binder/core/schemas/card.json` schema before reaching `binderStore` (Principle VII).
A response with even one invalid card is rejected wholesale by `apiClient` — no partial
rendering.

---

## Identity & Uniqueness

- `Card.id` is unique within a `Binder.cards` array. The server enforces this; the mobile
  app trusts the contract but `apiClient` still rejects responses where `cards.length !==
  new Set(cards.map(c => c.id)).size` (defensive validation per Principle II).
- Sessions are singular per device — there is only ever zero or one `Session` in
  `expo-secure-store`. Multi-account switching is out of scope for this spec.

---

## Volume & Scale Assumptions

- **Sessions**: exactly 0 or 1 per device.
- **Cards**: up to 1,000 per user per SC-007. Memory budget for `binder.cards` at 1KB per
  card metadata = ~1MB; well within mobile RAM constraints. Image bytes are managed by
  `expo-image`'s disk cache, not by `binderStore`.
- **Pages**: derived; with 1000 cards = 112 pages. `react-native-pager-view` recycles off-
  screen pages so memory stays bounded.

---

## Cross-references

- Server-side schemas the mobile app re-uses: `@my-binder/core/schemas/card.json`,
  `@my-binder/core/schemas/auth.json` (covers `GoogleSignInResponse` and `AuthUser`).
- Server-authoritative entities: `apps/server/src/repositories/cardRepository.ts`,
  `apps/server/src/repositories/userRepository.ts` (mobile does NOT mirror these fully —
  it only consumes the projected shapes returned by the routes).
- Constants pulled from core: `SESSION_JWT_TTL_DAYS` (FR-006), `AUTH_ERROR_CODES`
  (allowlist rejection mapping for FR-005), `HTTP_STATUS`.
