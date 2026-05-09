# Data Model: Migrate User and Collection Storage to PostgreSQL

**Branch**: `011-postgres-migration` | **Date**: 2026-04-03

## Entities

### User

**Table**: `users`
**File**: `apps/server/src/entities/UserEntity.ts`
**Purpose**: Stores authenticated person identity, keyed on email address.

| Column | TypeScript Property | DB Column | DB Type | Constraints |
|--------|--------------------|-----------|---------|--------------------|
| Internal ID | `id` | `id` | `uuid` | PK, DEFAULT gen_random_uuid() |
| Email | `email` | `email` | `varchar(255)` | UNIQUE NOT NULL |
| Display Name | `displayName` | `display_name` | `varchar(255)` | NOT NULL |
| Avatar URL | `avatarUrl` | `avatar_url` | `varchar(2048)` | NULLABLE |
| Created At | `createdAt` | `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| Updated At | `updatedAt` | `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() |

**Indexes**:
- `UNIQUE (email)` — conflict target for upsert (FR-003)

**Relationships**: One-to-many with `cards` (a user owns many card entries)

---

### Card

**Table**: `cards`
**File**: `apps/server/src/entities/CardEntity.ts`
**Purpose**: Represents a single card entry in a user's binder collection.

| Column | TypeScript Property | DB Column | DB Type | Constraints |
|--------|--------------------|-----------|---------|--------------------|
| Internal ID | `id` | `id` | `uuid` | PK, DEFAULT gen_random_uuid() |
| Card Name | `name` | `name` | `varchar(500)` | NOT NULL |
| Owner FK | `userId` | `user_id` | `uuid` | NOT NULL, FK → users(id) ON DELETE CASCADE |
| Created At | `createdAt` | `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| Updated At | `updatedAt` | `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() |

**Indexes**:
- `INDEX (user_id)` — supports collection queries scoped to a user

**Relationships**: Many-to-one with `users`; `ON DELETE CASCADE` removes all cards when the user is deleted.

**Scope enforcement**: All repository operations (`findAll`, `findById`, `update`, `remove`) accept a `userId` parameter and filter by it. Routes may not query cards across user boundaries.

---

### AllowedUser

**Table**: `allowed_users`
**File**: `apps/server/src/entities/AllowedUserEntity.ts`
**Purpose**: Pre-approved email addresses permitted to authenticate. Checked at sign-in before any user record is created or session issued.

| Column | TypeScript Property | DB Column | DB Type | Constraints |
|--------|--------------------|-----------|---------|--------------------|
| Email | `email` | `email` | `varchar(255)` | PK |
| Created At | `createdAt` | `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |

**Seed data**: Migration inserts `steffanennis87@gmail.com` as the initial entry (FR-013).
**No FK relationships** — intentionally decoupled; allowlist exists before any `users` record is created.
**Adding entries**: Direct SQL insert to `allowed_users`; no redeployment needed (FR-013).

---

## Domain Transfer Types (packages/core — unchanged)

The existing `AuthUser` and `Card` types in `packages/core` remain unchanged. Repositories map entity objects to these types before returning to service/route layers. Entity objects are never exposed outside the repository.

```
// Existing — no changes needed
type AuthUser = { id: string; email: string; displayName: string; avatarUrl: string | null }
type Card     = { id: string; name: string; createdAt: string; updatedAt: string }
```

---

## TypeORM Entity Class Pattern

Entity classes follow this pattern (definite assignment assertions to satisfy `strictPropertyInitialization`):

```text
@Entity('table_name')
class SomeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'column_name' })
  columnName!: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
```

`type` aliases are used for all non-entity TypeScript definitions. Entity `class` declarations are the only exception (required for TypeORM decorator metadata).

---

## Migration Strategy

| Concern | Approach |
|---------|----------|
| Tool | TypeORM CLI: `typeorm migration:generate` |
| Trigger | Manual — `typeorm migration:run -d src/db/datasource-cli.ts` run by developer before each deploy |
| Initial migration | Creates `users`, `cards`, `allowed_users`; seeds `steffanennis87@gmail.com` |
| Subsequent migrations | Generated via CLI from entity diff; committed and deployed with code |
| Data migration from DuckDB | Not required — fresh start acceptable (development environment) |
| Hand-written SQL for entity changes | Prohibited — all entity schema changes go through `migration:generate` |

---

## Removed DuckDB Artifacts

| Removed | Replacement |
|---------|-------------|
| `src/db/client.ts` (DuckDB binder.duckdb singleton) | `src/db/dataSource.ts` (TypeORM DataSource) |
| `src/db/migrations/001_create_cards.sql` | TypeORM-generated initial migration |
| `src/db/migrations/002_create_users.sql` | TypeORM-generated initial migration |
| `DB_PATH` environment variable | No longer needed |

---

## Configuration Changes

### `apps/server/tsconfig.json` additions

```jsonc
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false
  }
}
```

These flags are server-specific (TypeORM decorators). They must not be added to `tsconfig.base.json`.

### New environment variables (Lambda + local dev)

| Variable | Source | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | CDK env (already set) | RDS cluster endpoint hostname |
| `DATABASE_PORT` | CDK env (already set) | RDS port (5432) |
| `DATABASE_USER` | CDK env (already set) | DB username |
| `DATABASE_SECRET_NAME` | CDK env (already set) | Secrets Manager secret name for DB password |
| `DATABASE_NAME` | New (default: `my_binder`) | Database name |

### Removed environment variables

| Variable | Reason |
|----------|--------|
| `DB_PATH` | DuckDB file path no longer needed |
