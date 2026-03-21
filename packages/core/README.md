# @my-binder/core

Shared TypeScript code consumed by every workspace in the monorepo. This package owns the
single source of truth for data shapes, validation schemas, and named constants. Nothing in
this package is application-specific — it contains no business logic, no I/O, and no
framework dependencies.

## What lives here

### Types (`src/types/`)

TypeScript interfaces that describe every entity and API boundary in the system.

| Interface | Description |
|---|---|
| `Card` | A single card in the binder: `id`, `name`, `createdAt`, `updatedAt` |
| `CardList` | A paginated collection: `cards: Card[]`, `total: number` |
| `CreateCardBody` | Request body for creating a card |
| `UpdateCardBody` | Request body for updating a card |
| `CardIdParams` | URL params for routes that target a single card by `id` |
| `HealthResponse` | Server liveness response: `status`, `database` |
| `ErrorBody` | Uniform error shape returned by all API error responses |

### Schemas (`src/schemas/`)

JSON Schema constants used by Fastify for **runtime** validation and serialisation. Every
schema is exported as a named `const` and imported directly into route definitions — schemas
are never defined inline in route files.

| Constant | Used for |
|---|---|
| `CARD_RESPONSE_SCHEMA` | Serialising a single card in responses |
| `CARD_LIST_RESPONSE_SCHEMA` | Serialising the card collection |
| `CREATE_CARD_BODY_SCHEMA` | Validating `POST /cards` request bodies |
| `UPDATE_CARD_BODY_SCHEMA` | Validating `PUT /cards/:id` request bodies |
| `CARD_ID_PARAMS_SCHEMA` | Validating `:id` path params as a UUID |
| `HEALTH_RESPONSE_SCHEMA` | Serialising `GET /health` responses |
| `ERROR_RESPONSE_SCHEMA` | Serialising all error responses |

### Constants (`src/constants/`)

Named constants that replace magic strings and numbers across the codebase.

```ts
ERROR_CODES.NOT_FOUND        // 'NOT_FOUND'
ERROR_CODES.VALIDATION_ERROR // 'VALIDATION_ERROR'
ERROR_CODES.INTERNAL_ERROR   // 'INTERNAL_ERROR'

HTTP_STATUS.OK               // 200
HTTP_STATUS.CREATED          // 201
HTTP_STATUS.NO_CONTENT       // 204
HTTP_STATUS.BAD_REQUEST      // 400
HTTP_STATUS.NOT_FOUND        // 404
HTTP_STATUS.INTERNAL_ERROR   // 500
HTTP_STATUS.SERVICE_UNAVAILABLE // 503
```

## Rules

- MUST NOT contain application logic, I/O, or framework imports.
- MUST NOT depend on `apps/*` workspaces.
- Schemas and types MUST be kept in sync with `specs/*/data-model.md`.
- Never duplicate a schema or type in another workspace — import from here instead.

## Scripts

```bash
pnpm build       # Compile TypeScript → dist/
pnpm typecheck   # Type-check without emitting
```
