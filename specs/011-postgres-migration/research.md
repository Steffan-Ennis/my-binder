# Research: Migrate User and Collection Storage to PostgreSQL

**Branch**: `011-postgres-migration` | **Date**: 2026-04-03

## Decision Log

### 1. TypeORM DataSource Lifecycle in Lambda

**Decision**: Module-level singleton `DataSource` with `isInitialized` guard; `migrationsRun: false`.

**Rationale**: Lambda warm invocations reuse module state. A singleton initialized once per container avoids the 200–500 ms TCP+SSL handshake on every request. The `isInitialized` guard prevents re-initialization on subsequent warm invocations.

**Alternatives considered**: Per-invocation connection — rejected; adds latency and connection churn. RDS Proxy — not needed at current scale (~1 user, single Lambda instance); can be added if concurrent Lambda count grows beyond ~10.

---

### 2. Connection Pool Sizing

**Decision**: `extra: { max: 2, min: 0, idleTimeoutMillis: 10000 }` passed via TypeORM `extra` field (forwarded to `pg` pool).

**Rationale**: Each Lambda instance holds its own pool. At scale, many Lambda instances × pool size = total DB connections. Aurora Serverless V2 at minimum ACU supports ~90 connections. A pool of 2 per instance leaves comfortable headroom at low concurrency.

**Alternatives considered**: Pool of 1 — serializes concurrent requests within a warm Lambda. Pool of 5+ — risks connection exhaustion at modest Lambda concurrency.

---

### 3. TypeScript Decorator Configuration

**Decision**: Add `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `useDefineForClassFields: false` to `apps/server/tsconfig.json`. Do **not** add to `tsconfig.base.json`.

**Rationale**: TypeORM 0.3.x uses Stage 2 decorators. `emitDecoratorMetadata` enables TypeScript-to-runtime type inference for columns. `useDefineForClassFields: false` prevents ES2022 class field semantics from overriding decorator metadata (TypeScript 5 defaults this to `true` for `target: ES2022`). These are server-specific concerns that must not leak to `apps/mobile` or `packages/core`.

**Alternatives considered**: Explicit `type` on every `@Column` — avoids `emitDecoratorMetadata` but creates ongoing maintenance overhead. Await TypeORM Stage 3 support — not available in 0.3.x.

---

### 4. Entity Property Initialization (Strict Mode Compatibility)

**Decision**: Definite assignment assertions (`!`) on all TypeORM entity column properties.

**Rationale**: TypeORM populates entity properties via `Object.assign` at runtime after instantiation. TypeScript's `strictPropertyInitialization` cannot detect this statically. The `!` assertion is the officially recommended TypeORM pattern and does not weaken `strict: true` globally.

**Alternatives considered**: `prop: string | undefined` on all columns — leaks nullability throughout the codebase. Disable `strictPropertyInitialization` in tsconfig — violates Principle VII (strict mode must remain enabled).

---

### 5. Repository Pattern in TypeORM 0.3+

**Decision**: Custom repository objects using `DataSource.getRepository(Entity).extend({ ...methods })`. Each repository module exports a getter function (e.g., `getUserRepository()`) that calls `.extend()` on the initialized DataSource.

**Rationale**: `@EntityRepository` was removed in TypeORM 0.3+. The `.extend()` method is the official replacement for custom repository logic. It retains all built-in TypeORM methods (save, find, upsert, etc.) while adding domain-specific operations. Direct instantiation via `new ClassName extends Repository` breaks TypeORM's internal metadata wiring.

**Alternatives considered**: Plain functions wrapping `DataSource.getRepository()` — simpler, but does not fulfil the TypeORM repository pattern required by FR-010. `class extends Repository<Entity>` with `new` — breaks internal wiring.

---

### 6. TypeORM CLI Migration Generation Workflow

**Decision**: Dedicated `src/db/datasource-cli.ts` (default-exports a `DataSource` with `.ts` entity paths and `tsx` driver). Migration generation command uses `tsx` (already in devDependencies).

```
npx typeorm migration:generate src/db/migrations/<Name> -d src/db/datasource-cli.ts
```

**Rationale**: The CLI datasource references `.ts` entity source files (suitable for `tsx` execution). The runtime datasource references `.js` compiled output. Separating these prevents dev-only tooling concerns from appearing in the production DataSource config.

**Alternatives considered**: Single shared datasource file with environment conditionals — conditional path logic creates complexity. Using `ts-node` — `tsx` is already installed, avoids adding another dev tool.

---

### 7. `reflect-metadata` Import Location

**Decision**: Import `reflect-metadata` as the **first** import in both `lambda.ts` and `index.ts`.

**Rationale**: `reflect-metadata` installs global `Reflect.metadata` hooks as a side effect. It must be evaluated before any module that references TypeORM decorators is loaded. Both Lambda and local dev use separate entry points, so both must carry the import.

**Alternatives considered**: Import in a shared bootstrap module — import order guarantees are weaker and intent is less obvious to future maintainers.

---

### 8. Upsert Semantics for User Records

**Decision**: `repository.upsert(entityData, { conflictPaths: ['email'] })` targeting the `UNIQUE (email)` constraint.

**Rationale**: Atomic at the database statement level via `INSERT ... ON CONFLICT DO UPDATE`. No read-then-write race condition. Google verifies email ownership before issuing an ID token, making email a reliable unique identifier. The Google subject ID (`sub`) is not stored — it adds no value beyond what email already provides for this personal app.

**Alternatives considered**: `findOne` + conditional `save` — introduces a race condition on concurrent sign-ins (violates FR-003).

---

### 9. AllowedUser Check Placement

**Decision**: Check `allowedUserRepository.findByEmail(email)` in `authService.signIn()` immediately after Google token verification, before any `upsertUser` call.

**Rationale**: FR-012 requires that no user record is created for a rejected email. The service layer is the single sign-in orchestration point; enforcing the check here guarantees it cannot be bypassed by any route.

**Alternatives considered**: Check in route handler — duplicates logic if additional sign-in routes are added. Check inside `upsertUser` — couples persistence layer to business policy (violates Principle IV).

---

### 10. Migration Execution Strategy

**Decision**: `migrationsRun: false`. Migrations are run manually via the TypeORM CLI before each deploy. The deploy workflow is: `typeorm migration:run -d src/db/datasource-cli.ts` → build → push image → update Lambda.

**Rationale**: Manual migration execution gives the developer explicit control and visibility over schema changes. It avoids the risk of a Lambda cold start failing mid-migration, and removes the need to configure the runtime DataSource with migration file paths. The `datasource-cli.ts` file used for generation is also used for running migrations.

**Alternatives considered**: `migrationsRun: true` on cold start — rejected; a failed migration would crash all Lambda invocations and is hard to recover from in a serverless context. CI/CD migration step — over-engineered for a personal app without a formal pipeline.

---

### 11. `AllowedUser` Primary Key

**Decision**: `email` as the primary key on `allowed_users` (no separate UUID column).

**Rationale**: Email is already unique per spec (FR-013), used as the only lookup key, and adding a surrogate key provides no benefit for this use case. Simpler schema with one fewer column.

**Alternatives considered**: UUID primary key — provides no benefit since `email` is already the unique identifier and lookups are always by email.
