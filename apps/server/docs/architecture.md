# Architecture

The server follows a strict three-layer architecture. Each layer has one responsibility and
communicates only with the layer directly below it.

```
HTTP request
     │
     ▼
┌─────────────┐
│   Routes    │  Validates input/output schemas via Fastify + Ajv (Principle VII)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Services   │  Business logic. Throws typed errors (NotFoundError). No SQL here.
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Repositories │  Raw SQL via DuckDB connection. Returns typed domain objects.
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   DuckDB    │  Embedded database — single file, single connection, single process.
└─────────────┘
```

## Layers

### Routes (`src/routes/`)

Each route file registers a group of endpoints on the Fastify instance. Responsibilities:

- Declare request and response schemas (imported from `@my-binder/core` — never inline).
- Delegate to the service layer.
- Map typed service errors to HTTP status codes via `setErrorHandler`.
- Never contain SQL or business logic.

### Services (`src/services/`)

Thin orchestration layer between routes and repositories. Responsibilities:

- Enforce business rules (e.g. "a card must exist before it can be updated").
- Throw typed errors (`NotFoundError`) that routes translate into HTTP responses.
- Never interact with the database directly.

### Repositories (`src/repositories/`)

The only layer permitted to execute SQL. Responsibilities:

- Accept and return types from `@my-binder/core` — no ad-hoc objects.
- Use parameterised queries exclusively — never string-interpolated SQL.
- Wrap write operations in transactions.
- Return `null` (not throw) when a record is not found; the service layer decides what that means.

## Path aliases

All cross-directory imports use the `@src/` alias rather than relative `../` traversal:

```ts
// correct
import { getDb } from '@src/db/client';

// prohibited
import { getDb } from '../../db/client';
```

See the project constitution (Principle VII, path alias rule) for the full requirement.

## Error handling

All errors flow through Fastify's `setErrorHandler` in `src/routes/cards.ts`:

| Condition | HTTP status | `error` field |
|---|---|---|
| Ajv schema validation failure | 400 | `VALIDATION_ERROR` |
| `NotFoundError` from service | 404 | `NOT_FOUND` |
| Unhandled exception | 500 | `INTERNAL_ERROR` |

All error responses conform to `ERROR_RESPONSE_SCHEMA` from `@my-binder/core`.
