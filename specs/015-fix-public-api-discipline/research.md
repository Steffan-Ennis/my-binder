# Phase 0 Research: Public API Discipline Remediation

**Feature**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Date**: 2026-04-28

## R1 — Are the inline types in `packages/core/src/types/index.ts` duplicates of `types/card.ts`?

**Decision**: NOT duplicates. They are net-new CRUD types that must be preserved verbatim, just relocated to a peer file.

**Rationale**: Direct file inspection shows the two files declare disjoint type sets:

- `types/card.ts` declares `CardRecord`, `Printing`, `LegalityResult`, `SearchQuery`, `SearchResult`, `ProviderInfo`, `CardNotFoundResult`, `ProviderNotFoundError`, `ProviderUnavailableError` — these are **provider-layer domain types** (spec 004).
- `types/index.ts` inline declares `Card`, `CardList`, `CreateCardBody`, `UpdateCardBody`, `CardIdParams`, `HealthResponse`, `ErrorBody` — these are **API request/response types** with `id`, `createdAt`, `updatedAt` shapes typical of CRUD endpoints.

The names overlap (`Card` vs `CardRecord`) but the shapes differ entirely. The inline types are real and used:

- `apps/server/src/repositories/cardRepository.ts:2` imports `Card`, `CreateCardBody`, `UpdateCardBody`.
- `apps/server/src/routes/cards.ts:18` imports `CreateCardBody`, `UpdateCardBody`, `CardIdParams`.

**Alternatives considered**:

- *Delete the inline types as merge artifacts.* Rejected — they have active consumers, deletion would break `cardRepository.ts` and `routes/cards.ts`.
- *Merge `Card` from `index.ts` into `card.ts` alongside `CardRecord`.* Rejected — the two types serve different layers (HTTP CRUD vs provider domain) and grouping them would muddy the layer boundary called out in Principle VI. Keep them in separate peer files.

**Implication for the plan**: spec edge case "Duplicate type declarations between `types/index.ts` and `types/card.ts`" is now closed — there are no duplicates. The inline types relocate to a new peer file `packages/core/src/types/crud.ts`, with `HealthResponse` and `ErrorBody` getting their own files (`health.ts`, `errorBody.ts`) since they describe orthogonal concerns. Updates the data-model in Phase 1 accordingly.

## R2 — Where is `MtgjsonProvider` currently imported, and will the barrel survive the move?

**Decision**: Two import sites, both via the barrel path `@src/providers/mtgjson/index`. The barrel re-export pattern preserves both call sites without modification.

**Rationale**: Repository search confirms only two consumers:

- `apps/server/src/app.ts:17` — runtime registration of the provider into the registry.
- `apps/server/src/providers/mtgjson/index.test.ts:50` — Jest unit tests against the class.

After US1, `apps/server/src/providers/mtgjson/index.ts` will read:

```ts
export { MtgjsonProvider } from './MtgjsonProvider';
export { mapCardSetToCardRecord } from './mapper';
```

Both consumer imports continue to resolve through this barrel. The path
`@src/providers/mtgjson/index` is the path-aliased canonical form; TypeScript's
`moduleResolution` will find `index.ts` either via explicit `/index` or via the directory
shorthand `@src/providers/mtgjson`. Both forms remain valid post-refactor.

**Alternatives considered**:

- *Update both consumers to deep-import `@src/providers/mtgjson/MtgjsonProvider`.* Rejected
  per FR-011 / SC-006 — caller-side import edits are explicitly out of scope and treated as
  a regression signal. Tests should also continue to consume the public surface (the
  barrel) the way real callers do.
- *Drop the barrel entirely and require deep imports.* Rejected — deeper imports defeat the
  point of the directory-as-module pattern; the barrel is the public surface.

**Implication for the plan**: zero caller-side import edits are needed. The test file in
particular stays untouched (FR-009).

## R3 — How should the inline constants be grouped into peer files?

**Decision**: Group by concern, not by shape. Four peer files:

| Peer file | Declarations |
|---|---|
| `authIdentity.ts` | `AUTH_ERROR_CODES`, `AuthErrorCode`, `AUTH_IDENTITY_KIND` |
| `sessionJwt.ts` | `SESSION_JWT_TTL_DAYS` |
| `errorCodes.ts` | `ERROR_CODES`, `ErrorCode` |
| `httpStatus.ts` | `HTTP_STATUS` |

**Rationale**: The current `constants/index.ts` interleaves four orthogonal concerns:

1. **Auth identity & errors** (`AUTH_ERROR_CODES`, `AUTH_IDENTITY_KIND`) — used by the auth
   plugin and Google verifier.
2. **Session JWT TTL** (`SESSION_JWT_TTL_DAYS`) — used only when minting/verifying session
   tokens. Auth-adjacent but a separate concept (a duration, not an identity or error code).
3. **Domain error codes** (`ERROR_CODES`) — application-wide error taxonomy used across
   routes, services, and providers (e.g., `CARD_NOT_FOUND`, `PROVIDER_UNAVAILABLE`).
4. **HTTP status codes** (`HTTP_STATUS`) — pure protocol constants reused across all routes.

Splitting them into four peer files matches the "single concern per file" guidance in
Principle IV (Single Responsibility) and lets a reader navigate by topic. Co-locating
`AUTH_ERROR_CODES` and `AUTH_IDENTITY_KIND` in one file is a judgement call: both describe
the auth subsystem's vocabulary; splitting them further would be churn for no
reader-experience gain.

**Alternatives considered**:

- *Keep everything in one `constants/index.ts` and accept the violation.* Rejected — Principle
  IX is the reason this spec exists.
- *One file per constant identifier (`authErrorCodes.ts`, `authIdentity.ts`, `sessionJwt.ts`,
  `errorCodes.ts`, `errorCode.ts`, `httpStatus.ts`).* Rejected — fragments related concepts.
  `AUTH_ERROR_CODES` and `AuthErrorCode` (its derived type) belong in the same file by
  TypeScript convention; splitting them adds a re-export hop with no benefit.
- *Group all auth-related constants (including TTL) into a single `auth.ts`.* Rejected —
  `SESSION_JWT_TTL_DAYS` is a JWT-mechanism concern that survives without the broader auth
  vocabulary; a future change to JWT TTL should not require touching auth-identity files.

**Implication for the plan**: data-model.md Phase 1 enumerates these four files. No
consumer changes — every constant remains exported from `@my-binder/core` via the barrel.

## R4 — Is `efsService.ts` in scope for the JSDoc backfill, or is it a thin file-IO helper exempt under FR-007?

**Decision**: In scope. `efsService.ts` exports `initEfs(efsPath: string): Promise<void>` —
a function with side effects (creates directories, deletes parquet cache files), worth a
JSDoc block describing the side effects and the `efsPath` contract.

**Rationale**: FR-007's exemption covers "type-only files" and "pure data-mapper files
containing only deterministic input→output transformations". `efsService.ts` does not match
either criterion — it performs filesystem mutation and contains a try/catch that swallows
read errors (Principle VIII rationale: the JSDoc note is the place to document the
intentional swallow). Leaving it bare would also undermine the precedent set by the
`MtgjsonProvider` reference style.

The existing one-line description on `initEfs` is helpful but not compliant: it lacks
`@param`, `@returns`, and `@example`.

**Alternatives considered**:

- *Exempt `efsService.ts` because it is "infrastructure-adjacent".* Rejected — Principle IX
  names "services and providers" without a sub-category exemption. The file lives in
  `apps/server/src/services/`, which is squarely in scope.
- *Defer JSDoc backfill on `efsService.ts` to a follow-up.* Rejected — combining all
  service JSDoc work into US3 keeps the audit single-pass and avoids "we'll do the rest
  later" drift.

**Implication for the plan**: US3's task list includes `efsService.ts:initEfs`. The
`@example` block will show a typical Lambda-startup invocation pattern. The error-swallow
behaviour gets a JSDoc note matching the Principle VIII pattern used on `isReachable`.

## R5 — Does `apps/server/src/providers/registry.ts` need JSDoc backfill, and what is its current shape?

**Decision**: In scope for JSDoc backfill. Provider registry is the layer-boundary entry
point for the provider abstraction (Principle VI) and exposes register/setActive/getActive
operations whose semantics are not obvious from signatures alone.

**Rationale**: `registry.ts` is the canonical example of the provider-abstraction layer
called out in Principle VI; its public functions describe the "switch providers via
configuration" semantics. JSDoc with examples here is high-leverage — it documents the
extension point future providers (besides MTGJSON) will plug into.

**Alternatives considered**:

- *Skip — the registry is only used internally by `app.ts`.* Rejected — internal-only is
  not an exemption under FR-007. The functions are exported, the file is under
  `apps/server/src/providers/`, the JSDoc rule applies.

**Implication for the plan**: US3 task list covers `registry.ts`. The `@example` blocks
show a register-then-getActive flow.

## R6 — Should `apps/server/src/providers/interface.ts` and `apps/server/src/providers/mtgjson/mapper.ts` be excluded?

**Decision**: Yes — both are exempt under FR-007.

**Rationale**:

- `interface.ts` declares the `CardProvider` type and `LookupOptions` type. Type-only file,
  no runtime values, no function bodies. Exempt.
- `mapper.ts` exports `mapCardSetToCardRecord`, a deterministic input→output transformation
  with no side effects (no IO, no hidden state). Pure data-mapper file. Exempt.

Both files MAY still receive light comments where a non-obvious mapping rule exists (e.g.,
the `Card` vs `CardRecord` shape decision in mapper), but full JSDoc with `@example` is not
required.

**Alternatives considered**:

- *Apply JSDoc anyway for completeness.* Rejected — adds churn for no reader-experience
  gain. The constitution carve-out exists precisely so that pure value-transformations and
  type declarations do not bloat with examples that restate the type signature.

**Implication for the plan**: US3 task list explicitly enumerates the exempt set
(`interface.ts`, `mapper.ts`) so reviewers can verify nothing was missed.

## Summary of resolved unknowns

| Spec edge case / open question | Status after Phase 0 |
|---|---|
| Inline types vs `card.ts` duplication | Resolved (R1) — no duplicates; relocate to new peer files. |
| Test file deep-import vs barrel | Resolved (R2) — barrel preserves all consumers; zero edits. |
| Constants peer-file naming | Resolved (R3) — four files grouped by concern. |
| `efsService.ts` exemption | Resolved (R4) — in scope, has runtime side effects. |
| `registry.ts` exemption | Resolved (R5) — in scope. |
| `interface.ts` / `mapper.ts` exemption | Resolved (R6) — both exempt. |

No `[NEEDS CLARIFICATION]` markers remain. Plan proceeds to Phase 1.
