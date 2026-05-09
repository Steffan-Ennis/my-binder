# Phase 1 Data Model: Target File Layout

**Feature**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Research**: [research.md](./research.md)
**Date**: 2026-04-28

This refactor introduces no entities, no schemas, and no persistence changes. The "data
model" for this spec is the target source-tree layout — the post-refactor state of every
file in scope. Each section below records the precise pre- and post-refactor contents so
that task generation and review can verify them line-by-line.

## A. `apps/server/src/providers/mtgjson/`

### A.1 `index.ts` — barrel only (post-US1)

**Pre-refactor**: declares the `MtgjsonProvider` class inline (≈155 lines).

**Post-refactor**:

```ts
export { MtgjsonProvider } from './MtgjsonProvider';
export { mapCardSetToCardRecord } from './mapper';
```

**Validation**: every line matches `^export\s+\{` or `^export\s+\*`. SC-001 verifiable.

### A.2 `MtgjsonProvider.ts` — extracted class (post-US1, NEW file)

**Pre-refactor**: does not exist.

**Post-refactor**: contains the entire `MtgjsonProvider` class verbatim from the current
`index.ts`, including:

- All imports currently at the top of `index.ts`.
- All eight JSDoc blocks (constructor, `close`, `lookup`, `checkLegality`, `search`,
  `isReachable`, `enrichCards`, `enrichCard`).
- All method bodies unchanged (sequential awaits in `enrichCard`, log+try/catch in
  `enrichCards`, `for await...of` in `collectCards`).

**Validation**: a diff of the moved class body against the original `index.ts` produces
zero substantive changes — only the surrounding boilerplate (imports, file boundary).

### A.3 `mapper.ts` — unchanged

**Pre- and post-refactor**: identical. Exempt from JSDoc rule (FR-007, R6).

### A.4 `interface.ts` (in parent dir `apps/server/src/providers/`) — unchanged

**Pre- and post-refactor**: identical. Type-only, exempt (R6).

### A.5 `registry.ts` (in parent dir) — JSDoc backfill (post-US3)

**Pre-refactor**: bare exports without JSDoc.

**Post-refactor**: every exported function carries a JSDoc block with description,
`@param`, `@returns`, and at least one `@example`.

## B. `packages/core/src/types/`

### B.1 `index.ts` — barrel only (post-US2)

**Pre-refactor**: re-exports `card.ts` and `auth.ts`, **plus** declares `Card`, `CardList`,
`CreateCardBody`, `UpdateCardBody`, `CardIdParams`, `HealthResponse`, `ErrorBody` inline.

**Post-refactor**:

```ts
export * from './card';
export * from './auth';
export * from './crud';
export * from './health';
export * from './errorBody';
```

**Validation**: every line matches `^export\s+\*\s+from`. SC-001 verifiable.

### B.2 `card.ts` — unchanged

**Pre- and post-refactor**: identical. Owns `CardRecord`, `Printing`, `LegalityResult`,
`SearchQuery`, `SearchResult`, `ProviderInfo`, `CardNotFoundResult`, `ProviderNotFoundError`,
`ProviderUnavailableError`. R1 confirmed no overlap with the inline `Card` type.

### B.3 `auth.ts` — unchanged

**Pre- and post-refactor**: identical.

### B.4 `crud.ts` — NEW peer file (post-US2)

**Post-refactor**: declares the relocated CRUD types verbatim:

```ts
export interface Card {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardList {
  cards: Card[];
  total: number;
}

export interface CreateCardBody {
  name: string;
}

export interface UpdateCardBody {
  name: string;
}

export interface CardIdParams {
  id: string;
}
```

**Note on the constitution's `type` over `interface` rule (Principle VII)**: existing
declarations are kept as `interface` to satisfy FR-002's "preserve verbatim" requirement
and avoid behavioural-equivalent-but-textually-different changes during a structural
refactor. A separate spec MAY follow up to migrate these to `type` aliases.

### B.5 `health.ts` — NEW peer file (post-US2)

**Post-refactor**:

```ts
export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'connected' | 'unavailable';
}
```

### B.6 `errorBody.ts` — NEW peer file (post-US2)

**Post-refactor**:

```ts
export interface ErrorBody {
  error: string;
  message: string;
}
```

## C. `packages/core/src/constants/`

### C.1 `index.ts` — barrel only (post-US2)

**Pre-refactor**: declares all five constant groups inline (≈40 lines).

**Post-refactor**:

```ts
export * from './authIdentity';
export * from './sessionJwt';
export * from './errorCodes';
export * from './httpStatus';
```

**Validation**: every line matches `^export\s+\*\s+from`. SC-001 verifiable.

### C.2 `authIdentity.ts` — NEW peer file (post-US2)

**Post-refactor**:

```ts
export const AUTH_ERROR_CODES = {
  INVALID_GOOGLE_TOKEN: 'INVALID_GOOGLE_TOKEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export const AUTH_IDENTITY_KIND = {
  GUEST: 'guest',
  AUTHENTICATED: 'authenticated',
} as const;
```

### C.3 `sessionJwt.ts` — NEW peer file (post-US2)

**Post-refactor**:

```ts
export const SESSION_JWT_TTL_DAYS = 7 as const;
```

### C.4 `errorCodes.ts` — NEW peer file (post-US2)

**Post-refactor**:

```ts
export const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CARD_NOT_FOUND: 'CARD_NOT_FOUND',
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  MISSING_FILTER: 'MISSING_FILTER',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

### C.5 `httpStatus.ts` — NEW peer file (post-US2)

**Post-refactor**:

```ts
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  UNPROCESSABLE: 422,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
```

## D. `apps/server/src/services/` — JSDoc backfill scope (post-US3)

| File | Status post-US3 |
|---|---|
| `authService.ts` | All exported functions carry compliant JSDoc (description, `@param`, `@returns`, `@throws` if applicable, ≥1 `@example`). |
| `cardService.ts` | Same. |
| `efsService.ts` | `initEfs` carries compliant JSDoc including a note explaining the intentional `console.error` swallow on parquet-cache cleanup (Principle VIII). |
| `*.test.ts` | Unchanged. Tests are not in scope for the JSDoc rule. |

Audit task at task-generation time: enumerate every `export function` and every public
method on every `export class` in these three files; produce a checkbox list.

## E. Out-of-scope confirmations

| Path | Reason |
|---|---|
| `apps/server/index.ts` | Package entry-point; carve-out under Principle IX. |
| `apps/server/src/repositories/` | Repositories not named in Principle IX; out of scope per spec Assumptions. |
| `apps/server/src/routes/` | Routes are HTTP handlers, not "services" or "providers"; out of scope. |
| `apps/server/src/auth/` (plugin, sessionJwt, googleVerifier) | Auth helpers, not services-or-providers per the principle's narrow naming. Re-evaluate if a future amendment broadens the rule. |
| `apps/server/src/db/` | Database layer; not named in Principle IX. |
| `apps/mobile/*` | Workspace not yet implemented. |
| `packages/infrastructure/` | CDK stack; outside `src/` barrel pattern. |

## F. Caller-side import sites (must remain stable, FR-011)

Identified in research:

| File | Current import | Post-refactor (unchanged) |
|---|---|---|
| `apps/server/src/app.ts:17` | `import { MtgjsonProvider } from '@src/providers/mtgjson/index';` | identical (resolves through new barrel) |
| `apps/server/src/providers/mtgjson/index.test.ts:50` | `import { MtgjsonProvider } from '@src/providers/mtgjson/index';` | identical |
| `apps/server/src/repositories/cardRepository.ts:2` | `import type { Card, CreateCardBody, UpdateCardBody } from '@my-binder/core';` | identical (resolves through `@my-binder/core` barrel → `types/index.ts` barrel → `crud.ts`) |
| `apps/server/src/routes/cards.ts:18` | `import type { CreateCardBody, UpdateCardBody, CardIdParams } from '@my-binder/core';` | identical |

SC-006 validation: a `git diff` of the four files above should show no changes to import
statements after the refactor lands.
