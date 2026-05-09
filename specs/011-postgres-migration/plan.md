# Implementation Plan: Migrate User and Collection Storage to PostgreSQL

**Branch**: `011-postgres-migration` | **Date**: 2026-04-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-postgres-migration/spec.md`

## Summary

Migrate user identity and card collection persistence from DuckDB (embedded file) to Aurora Serverless V2 PostgreSQL via TypeORM. Replaces `src/db/client.ts` and both DuckDB repositories with TypeORM entities, a shared `DataSource` singleton, and TypeORM-backed repositories. Adds an `AllowedUser` entity that gates sign-in to a pre-approved email list. Infrastructure (RDS cluster, security group, Lambda env vars) is already provisioned in CDK; this plan delivers the application-layer migration only.

## Technical Context

**Language/Version**: TypeScript 5, Node 22
**Primary Dependencies**: Fastify v4, TypeORM 0.3.x, `pg` (PostgreSQL driver), `reflect-metadata`
**Storage**: AWS Aurora Serverless V2 PostgreSQL 17 — public subnet, developer-accessible
**Testing**: Node built-in test runner (`node --test`)
**Target Platform**: AWS Lambda (Docker container, Node 22 runtime)
**Project Type**: web-service (API)
**Performance Goals**: Lambda cold start + PG connect + migration run within existing 60 s timeout
**Constraints**: TypeORM required; migrations applied manually via CLI before each deploy (`migrationsRun: false`); connection pool `max: 2` per Lambda instance; `experimentalDecorators` + `emitDecoratorMetadata` + `useDefineForClassFields: false` required in server tsconfig

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | ✅ PASS | TypeORM + repository pattern explicitly required by spec; no speculative additions |
| II. Data Integrity | ✅ PASS | TypeORM migrations applied manually before deploy; upsert uses `ON CONFLICT` semantics; FK Card→User enforced at DB level |
| III. Test-First | ✅ PASS | Co-location rule applies: entity and repository tests live alongside source files; E2E in `tests/e2e/` |
| IV. Single Responsibility | ✅ PASS | DataSource: connection only; entities: data containers; repositories: persistence; service: orchestration |
| V. Transparency & Legibility | ✅ PASS | Named entities, descriptive methods; `!` assertions documented in code comments |
| VI. Layered Architecture | ✅ PASS | DB accessed only through repository layer; no direct DataSource calls in routes or services |
| VII. Strong Typing | ⚠️ VIOLATION (justified) | `experimentalDecorators`, `emitDecoratorMetadata`, `useDefineForClassFields: false` needed in server tsconfig — see Complexity Tracking |

## Project Structure

### Documentation (this feature)

```text
specs/011-postgres-migration/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output (/speckit.plan)
├── data-model.md        # Phase 1 output (/speckit.plan)
├── quickstart.md        # Phase 1 output (/speckit.plan)
├── contracts/           # Phase 1 output (/speckit.plan)
│   └── auth.md          # Updated auth contract — allowlist rejection behaviour
└── tasks.md             # Phase 2 output (/speckit.tasks — not created by /speckit.plan)
```

### Source Code

```text
apps/server/
├── src/
│   ├── db/
│   │   ├── dataSource.ts          # TypeORM DataSource singleton (lazy init, runtime)
│   │   ├── datasource-cli.ts      # DataSource config for TypeORM CLI (dev only — ts entities)
│   │   └── migrations/            # TypeORM-generated migrations (*.ts, compiled to dist/*.js)
│   │       └── [timestamp]_InitialSchema.ts
│   ├── entities/
│   │   ├── UserEntity.ts          # @Entity: users table
│   │   ├── CardEntity.ts          # @Entity: cards table (FK → users, CASCADE delete)
│   │   └── AllowedUserEntity.ts   # @Entity: allowed_users table
│   ├── repositories/
│   │   ├── userRepository.ts      # Replaces DuckDB impl — TypeORM upsert + findById
│   │   ├── cardRepository.ts      # Replaces DuckDB impl — CRUD scoped to userId
│   │   └── allowedUserRepository.ts  # New — findByEmail for allowlist check
│   ├── app.ts                     # Updated: register db Fastify plugin
│   ├── config.ts                  # Updated: PG connection vars; remove DB_PATH
│   └── services/
│       └── authService.ts         # Updated: allowlist check before upsertUser
├── lambda.ts                      # Updated: import 'reflect-metadata' as first import
├── index.ts                       # Updated: import 'reflect-metadata' as first import
└── docs/
    └── database.md                # TypeORM setup, migration workflow, local connection guide

# Removed files:
# apps/server/src/db/client.ts         (DuckDB binder.duckdb singleton — no longer needed)
# apps/server/src/db/migrations/*.sql  (DuckDB SQL migrations — replaced by TypeORM migrations)
```

**Structure Decision**: Server workspace only. No new workspaces or packages. Old DuckDB `client.ts` and `.sql` migrations are removed. DuckDB package retained as a transitive dependency of `mtgjson-sdk` but no longer used directly by server code.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| `experimentalDecorators: true` in server tsconfig | TypeORM entity decorators (`@Entity`, `@Column`, etc.) use Stage 2 decorator syntax | Decorator-free TypeORM (plain `getRepository()`) loses migration generation (FR-011 requires TypeORM CLI) |
| `emitDecoratorMetadata: true` in server tsconfig | TypeORM infers column types from TypeScript reflected metadata at runtime | Explicit `type` on every `@Column` is fragile; metadata emission is the official TypeORM approach |
| `useDefineForClassFields: false` in server tsconfig | TypeScript 5 with `target: ES2022` defaults this to `true`, which breaks Stage 2 decorator metadata emission | TypeORM 0.3.x has no Stage 3 decorator support; flag must be `false` until TypeORM ships Stage 3 support |

---

## Addendum: Repository DI + Cache Plugin

### Problem

Repositories are currently function modules that call `getDataSource()` on every invocation. While TypeORM's `DataSource` already manages the connection pool, the current pattern couples repositories to a global mutable singleton via direct import — no constructor injection, no clean seam for testing, and no way for Fastify routes to receive dependencies without importing module globals.

### Solution

**1. Repository classes with constructor-injected `DataSource`**

Convert all three repositories from plain function modules to classes. The `DataSource` (and the TypeORM `EntityManager` it exposes) is injected once at construction time, not fetched on every call:

```ts
// src/repositories/cardRepository.ts
export class CardRepository {
  private repo: Repository<CardEntity>;
  constructor(ds: DataSource) {
    this.repo = ds.getRepository(CardEntity);
  }
  async findAll(userId: string): Promise<Card[]> { ... }
  async findById(id: string, userId: string): Promise<Card | null> { ... }
  async create(body: CreateCardBody, userId: string): Promise<Card> { ... }
  async update(id: string, body: UpdateCardBody, userId: string): Promise<Card | null> { ... }
  async remove(id: string, userId: string): Promise<boolean> { ... }
}
```

Same pattern for `UserRepository` and `AllowedUserRepository`.

**2. Module-level singleton via Node module cache**

Create `src/db/repositories.ts` — a dedicated init/get module. Node caches the module on first `require`, so the repository instances are created exactly once per Lambda container lifetime:

```ts
// src/db/repositories.ts
let _card: CardRepository | undefined;
let _user: UserRepository | undefined;
let _allowedUser: AllowedUserRepository | undefined;

export function initRepositories(ds: DataSource): void {
  _card = new CardRepository(ds);
  _user = new UserRepository(ds);
  _allowedUser = new AllowedUserRepository(ds);
}

export function getRepositories(): { card: CardRepository; user: UserRepository; allowedUser: AllowedUserRepository } {
  if (!_card || !_user || !_allowedUser) throw new Error('Repositories not initialised. Call initRepositories() first.');
  return { card: _card, user: _user, allowedUser: _allowedUser };
}
```

Called once in `buildApp` after `initDataSource()`. Services import `getRepositories()` instead of calling `getDataSource()` directly.

**3. Fastify repos decorator plugin**

Create `src/plugins/reposPlugin.ts` — a Fastify plugin that decorates the instance with repository references so route handlers can access them without importing module globals:

```ts
// src/plugins/reposPlugin.ts
import fp from 'fastify-plugin';
import { getRepositories } from '@src/db/repositories';

export const reposPlugin = fp(async (fastify) => {
  fastify.decorate('repos', getRepositories());
});
```

Registered in `buildApp` after `initRepositories`. TypeScript augmentation extends `FastifyInstance` with `repos`.

**4. Cache via `@fastify/caching`**

Use the official `@fastify/caching` plugin. It handles `Cache-Control` header injection as middleware — no manual `reply.header(...)` calls needed in routes. It also decorates `fastify.cache` with an `abstract-cache`-compatible storage backend, which is the singleton we create once at startup.

Create `src/db/cache.ts` — module-level singleton for the `abstract-cache` instance:

```ts
// src/db/cache.ts
import abstractCache from 'abstract-cache';

// abstract-cache in-memory backend — created once, shared across all requests.
// Swap for abstract-cache-redis in future if multi-instance caching is needed.
export const appCache = abstractCache({ useAwait: true });
```

Register in `buildApp` by passing `appCache` as the `cache` option to `@fastify/caching`. The plugin handles the middleware injection automatically:

```ts
// in buildApp:
await fastify.register(fastifyCaching, {
  privacy: fastifyCaching.privacy.PRIVATE,
  expiresIn: 300, // 5-minute default TTL
  cache: appCache,
});
```

Routes use `fastify.cache` (the decorated storage) for programmatic cache reads/writes, and `reply.etag()` / `reply.expires()` for HTTP cache semantics. `Cache-Control` headers are set automatically by the plugin based on `privacy` and `expiresIn`.

**5. Service layer — injected repo params**

Services accept repository instances as function parameters instead of importing global state. This makes unit tests trivial (pass a mock class instance):

```ts
// authService.ts
export async function signIn(
  idToken: string,
  deps: {
    allowedUserRepo?: AllowedUserRepository;
    userRepo?: UserRepository;
    googleClient?: OAuth2Client;
  } = {},
): Promise<GoogleSignInResponse> {
  const repos = getRepositories();
  const _allowedUserRepo = deps.allowedUserRepo ?? repos.allowedUser;
  const _userRepo = deps.userRepo ?? repos.user;
  ...
}
```

Same pattern in `cardService.ts`: default to `getRepositories().card`, allow injection in tests.

**6. Updated `buildApp` registration order**

```
1. loadConfig()
2. initDataSource(config)
3. initRepositories(getDataSource())      ← new
4. MtgjsonSDK.create(...)
5. registry.setActive(...)
6. Fastify instance
7. fastify.register(@fastify/caching, { cache: appCache, ... })  ← new (replaces manual plugin)
8. fastify.register(reposPlugin)           ← new
9. fastify.register(authPlugin)
10. ...routes
```

### Source Changes

| File | Change |
|------|--------|
| `src/repositories/cardRepository.ts` | Convert to `CardRepository` class |
| `src/repositories/userRepository.ts` | Convert to `UserRepository` class |
| `src/repositories/allowedUserRepository.ts` | Convert to `AllowedUserRepository` class |
| `src/db/repositories.ts` | New — `initRepositories` / `getRepositories` singleton |
| `src/db/cache.ts` | New — `abstract-cache` singleton (`appCache`) |
| `src/plugins/reposPlugin.ts` | New — Fastify repos decorator plugin |
| `src/services/authService.ts` | Accept repo instances via deps param |
| `src/services/cardService.ts` | Accept repo instance via deps param |
| `src/app.ts` | Register `@fastify/caching` with `appCache`; register `reposPlugin`; call `initRepositories` |
| `apps/server/package.json` | Add `@fastify/caching`, `abstract-cache` |

### What Does NOT Change

- `src/db/dataSource.ts` — `initDataSource` / `getDataSource` remain unchanged; `DataSource` is still the TypeORM connection singleton
- Entity files — no changes
- Migration files — no changes
- Route files — routes access `fastify.repos.*` and `fastify.cache` but do not change route logic
- Auth plugin — no changes
