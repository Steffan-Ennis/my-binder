# Tasks: Migrate User and Collection Storage to PostgreSQL

**Input**: Design documents from `/specs/011-postgres-migration/`
**Branch**: `011-postgres-migration`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md) | **Data Model**: [data-model.md](./data-model.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Dependencies & TypeScript Config)

**Purpose**: Install new packages and configure TypeScript for TypeORM decorators and the cache plugin. No behaviour changes — pure project preparation.

- [ ] T001 Add `typeorm`, `pg`, `reflect-metadata`, `@fastify/caching`, `abstract-cache` to dependencies and `@types/pg` to devDependencies in `apps/server/package.json`; run `pnpm install` from repo root
- [ ] T002 Add `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `useDefineForClassFields: false` to `apps/server/tsconfig.json` (server-only; do NOT touch `tsconfig.base.json`)
- [ ] T003 [P] Add `import 'reflect-metadata'` as the first import in `apps/server/lambda.ts`
- [ ] T004 [P] Add `import 'reflect-metadata'` as the first import in `apps/server/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core TypeORM infrastructure plus the connection and cache singletons that all user story phases depend on. MUST be complete before any user story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 [P] Create `apps/server/src/entities/UserEntity.ts` — `@Entity('users')` class with columns: `id` (uuid PK, `@PrimaryGeneratedColumn('uuid')`), `email` (varchar 255, unique, `@Column({ unique: true })`), `displayName` (varchar 255, `@Column({ name: 'display_name' })`), `avatarUrl` (varchar 2048, nullable, `@Column({ name: 'avatar_url', nullable: true })`), `createdAt` (`@CreateDateColumn({ name: 'created_at' })`), `updatedAt` (`@UpdateDateColumn({ name: 'updated_at' })`); use `!` definite assignment assertions on all properties
- [ ] T006 [P] Create `apps/server/src/entities/CardEntity.ts` — `@Entity('cards')` class with columns: `id` (uuid PK), `name` (varchar 500, `@Column({ length: 500 })`), `userId` (uuid, `@Column({ name: 'user_id' })`), `createdAt` (`@CreateDateColumn`), `updatedAt` (`@UpdateDateColumn`); include `@ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })` and `@JoinColumn({ name: 'user_id' })` decorators on the `user` relation property; use `!` definite assignment assertions
- [ ] T007 [P] Create `apps/server/src/entities/AllowedUserEntity.ts` — `@Entity('allowed_users')` class with `email` as `@PrimaryColumn({ type: 'varchar', length: 255 })` and `createdAt` as `@CreateDateColumn({ name: 'created_at' })`; use `!` definite assignment assertions
- [ ] T008 Create `apps/server/src/db/dataSource.ts` — module-level `DataSource` singleton using `pg` driver; entities: `[UserEntity, CardEntity, AllowedUserEntity]`; `migrationsRun: false`; `synchronize: false`; pool `extra: { max: 2, min: 0, idleTimeoutMillis: 10000 }`; export `initDataSource(config: Config): Promise<void>` guarding on `dataSource.isInitialized`; export `getDataSource(): DataSource` throwing if not initialized
- [ ] T009 Create `apps/server/src/db/datasource-cli.ts` — separate `DataSource` default export for TypeORM CLI; reads connection config from `process.env` directly (no Secrets Manager); entities reference `.ts` source files; includes `migrations: ['src/db/migrations/*.ts']` and `migrationsRun: false`; add comment marking this as dev-only (not compiled to `dist/`)
- [ ] T010 Update `apps/server/src/config.ts` — add `pgHost: string`, `pgPort: number`, `pgUser: string`, `pgPassword: string`, `pgDatabase: string` to `Config` type; resolve `pgPassword` from `DATABASE_SECRET_NAME`/`DATABASE_PASSWORD` using the existing `resolveSecret` helper; populate remaining PG fields from `DATABASE_URL`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_NAME` env vars; remove `dbPath` from `Config` type and all references in `buildConfigFromEnv()` and `loadConfig()`
- [ ] T011 Create `apps/server/src/db/cache.ts` — module-level `abstract-cache` singleton: `import abstractCache from 'abstract-cache'`; export `const appCache = abstractCache({ useAwait: true })`; add comment noting this is the in-memory backend and can be swapped for abstract-cache-redis if multi-instance caching is needed
- [ ] T012 Create `apps/server/src/db/repositories.ts` — module-level singleton registry; declare `let _card: CardRepository | undefined`, `let _user: UserRepository | undefined`, `let _allowedUser: AllowedUserRepository | undefined`; export `function initRepositories(ds: DataSource): void` that sets all three; export `function getRepositories()` returning `{ card, user, allowedUser }` or throwing `'Repositories not initialised. Call initRepositories() first.'` if any is undefined
- [ ] T013 Create `apps/server/src/plugins/reposPlugin.ts` — Fastify plugin using `fp` from `fastify-plugin`; calls `getRepositories()` and decorates the Fastify instance: `fastify.decorate('repos', getRepositories())`; add TypeScript module augmentation extending `FastifyInstance` with `repos: { card: CardRepository; user: UserRepository; allowedUser: AllowedUserRepository }`
- [ ] T014 Update `apps/server/src/app.ts` — (1) replace `initDb`/DuckDB import with `initDataSource` from `@src/db/dataSource`; (2) add `initRepositories(getDataSource())` from `@src/db/repositories` immediately after `await initDataSource(config)`; (3) import `appCache` from `@src/db/cache` and register `@fastify/caching` with `{ privacy: fastifyCaching.privacy.PRIVATE, expiresIn: 300, cache: appCache }`; (4) register `reposPlugin` from `@src/plugins/reposPlugin` — both before `authPlugin`; remove `config.dbPath` reference
- [ ] T015 Add TypeORM migration scripts to `apps/server/package.json` — `"migration:generate"`, `"migration:run"`, `"migration:revert"` all using `tsx ./node_modules/typeorm/cli.js ... -d src/db/datasource-cli.ts`; update `"build"` script to remove any DuckDB migration copy step
- [ ] T016 Generate initial TypeORM migration — with env vars pointing to the dev Aurora database, run `pnpm migration:generate InitialSchema` from `apps/server/`; after generation, manually add seed data to the `up()` method: `await queryRunner.query("INSERT INTO allowed_users (email, created_at) VALUES ('steffanennis87@gmail.com', NOW()) ON CONFLICT DO NOTHING")`; commit the generated `apps/server/src/db/migrations/[timestamp]-InitialSchema.ts`
- [ ] T017 Run the initial migration against the dev database — run `pnpm migration:run` from `apps/server/`; verify via psql: `\dt` shows `users`, `cards`, `allowed_users`, `migrations` tables; `SELECT * FROM allowed_users;` returns one row
- [ ] T018 [P] Delete `apps/server/src/db/client.ts` — remove file entirely; verify nothing outside `app.ts` imports from `@src/db/client`
- [ ] T019 [P] Delete `apps/server/src/db/migrations/001_create_cards.sql` and `apps/server/src/db/migrations/002_create_users.sql`; add `apps/server/src/db/migrations/.gitkeep` to preserve the directory in git

**Checkpoint**: Foundation ready — DataSource initializes, `initRepositories` wires classes, `appCache` exported, `reposPlugin` compiles, schema exists in dev database. Run `pnpm typecheck` from `apps/server/` — zero errors before proceeding.

---

## Phase 3: User Story 1 — Sign In Persists Correctly (Priority: P1) 🎯 MVP

**Goal**: Users can sign in with Google; their profile is stored in PostgreSQL; only allowed emails are accepted.

**Independent Test**: Sign in with `steffanennis87@gmail.com` Google account → `GET /auth/me` returns correct profile. Attempt sign-in with an unlisted email → HTTP 403. Verify user row in PostgreSQL via psql.

- [ ] T020 [US1] Create `AllowedUserRepository` class in `apps/server/src/repositories/allowedUserRepository.ts` — class with `constructor(private ds: DataSource)`; store `this.repo = ds.getRepository(AllowedUserEntity)` in constructor; export single method `findByEmail(email: string): Promise<AllowedUserEntity | null>` calling `this.repo.findOneBy({ email })`; replace any previous file content entirely
- [ ] T021 [US1] Create `UserRepository` class in `apps/server/src/repositories/userRepository.ts` — class with `constructor(private ds: DataSource)`; store `this.repo = ds.getRepository(UserEntity)` in constructor; implement `upsertUser(input: UpsertUserInput): Promise<AuthUser>` using `this.repo.upsert({ email, displayName, avatarUrl }, { conflictPaths: ['email'], skipUpdateIfNoValuesChanged: false })` then `findOneByOrFail({ email: input.email })`; implement `findUserById(id: string): Promise<AuthUser | null>` using `this.repo.findOneBy({ id })`; map entity → `AuthUser` via private `toAuthUser` helper; update `UpsertUserInput` type to remove `googleSub` field
- [ ] T022 [US1] Update `apps/server/src/services/authService.ts` — replace module-level `findAllowedByEmail` and `upsertUser` imports with `import { getRepositories } from '@src/db/repositories'`; update `SignInDeps` type to accept `allowedUserRepo?: AllowedUserRepository` and `userRepo?: UserRepository`; set defaults from `getRepositories()`; add `export class AccessDeniedError extends Error` (name: `'AccessDeniedError'`); add allowlist check immediately after `verifyGoogleToken` — call `deps.allowedUserRepo.findByEmail(payload.email)`, throw `AccessDeniedError` if null; remove `googleSub` from `upsertUser` call; update JSDoc comment
- [ ] T023 [US1] Update `apps/server/src/routes/auth.ts` — import `AccessDeniedError` from `@src/services/authService`; add catch block in `POST /auth/google` handler: if `err instanceof AccessDeniedError` return HTTP 403 `{ error: 'ACCESS_DENIED', message: 'This email address is not permitted to sign in.' }`
- [ ] T024 [US1] Update `apps/server/src/repositories/userRepository.test.ts` — remove DuckDB setup/teardown; mock `DataSource` and `Repository<UserEntity>` (pass a mock DataSource into `new UserRepository(mockDs)`); retain existing test cases for `upsertUser` and `findUserById`; add test case: two concurrent `upsertUser` calls with the same email must not throw
- [ ] T025 [US1] Update `apps/server/src/services/authService.test.ts` — inject mock `AllowedUserRepository` and `UserRepository` instances via `SignInDeps`; add test: email not in allowlist → `AccessDeniedError` thrown, `upsertUser` NOT called; add test: email in allowlist → `upsertUser` called; retain existing Google token verification tests

**Checkpoint**: `pnpm test` passes for `userRepository.test.ts` and `authService.test.ts`. End-to-end: sign in with allowed account succeeds; sign in with blocked account returns 403.

---

## Phase 4: User Story 2 — Collection Cards Are Preserved (Priority: P2)

**Goal**: Authenticated users can perform full CRUD on their card collection stored in PostgreSQL, scoped to their own identity.

**Independent Test**: Sign in, then POST/GET/PUT/DELETE cards; verify each operation returns the correct response shape and only the authenticated user's cards are visible.

- [ ] T026 [US2] Create `CardRepository` class in `apps/server/src/repositories/cardRepository.ts` — class with `constructor(private ds: DataSource)`; store `this.repo = ds.getRepository(CardEntity)` in constructor; implement `findAll(userId: string): Promise<Card[]>`, `findById(id: string, userId: string): Promise<Card | null>`, `create(body: CreateCardBody, userId: string): Promise<Card>`, `update(id: string, body: UpdateCardBody, userId: string): Promise<Card | null>`, `remove(id: string, userId: string): Promise<boolean>`; map `CardEntity` → `Card` via private `toCard` helper returning `{ id, name, createdAt: entity.createdAt.toISOString(), updatedAt: entity.updatedAt.toISOString() }`; all find/update/remove must filter by `userId`; replace any previous file content entirely
- [ ] T027 [US2] Update `apps/server/src/services/cardService.ts` — replace module-level `repo` import with `import { getRepositories } from '@src/db/repositories'`; replace all `repo.*` calls with `getRepositories().card.*`; keep all existing error classes (`NotFoundError`, `CardNotFoundError`, `ProviderUnavailableError`) unchanged; do NOT change `lookupCard`, `checkCommanderLegality`, `searchCards`
- [ ] T028 [US2] Update `apps/server/src/routes/cards.ts` — for the five collection endpoints (`GET /cards`, `GET /cards/:id`, `POST /cards`, `PUT /cards/:id`, `DELETE /cards/:id`): add `preHandler: [fastify.authenticate]`; extract `const { id: userId } = (request.identity as { kind: 'authenticated'; user: { id: string } }).user`; pass `userId` to all `cardService` calls; the five provider-backed endpoints (`/cards/lookup`, `/cards/legality`, `/cards/search`) remain unchanged
- [ ] T029 [US2] Update `apps/server/src/repositories/cardRepository.test.ts` — remove DuckDB setup/teardown; mock `DataSource` and `Repository<CardEntity>` (pass mock into `new CardRepository(mockDs)`); retain existing test cases adding `userId` to all calls; add test: `findAll` for userA does not return userB's cards
- [ ] T030 [US2] Update `apps/server/src/services/cardService.test.ts` — mock `getRepositories` to return a `CardRepository` stub; add `userId` to all test calls for collection functions; add test: `getCards` returns only the calling user's cards

**Checkpoint**: `pnpm test` passes for `cardRepository.test.ts` and `cardService.test.ts`. End-to-end: authenticated user can create, read, update, and delete cards; card list is scoped to their identity.

---

## Phase 5: User Story 3 — No Degradation in API Response Behaviour (Priority: P3)

**Goal**: All existing passing tests continue to pass; no route response shape or status code changes.

**Independent Test**: Run the full test suite — zero failures. Existing route tests (`routes/auth.test.ts`, `routes/cards.test.ts`) pass with no changes to assertions.

- [ ] T031 [US3] Run full test suite — `pnpm turbo test`; investigate and fix any remaining failures not already addressed in Phase 3/4; all tests in `apps/server/src/routes/` must pass without changes to the route test assertion logic
- [ ] T032 [US3] Run `pnpm turbo typecheck` — fix any remaining TypeScript errors introduced by removing `dbPath` from `Config`, the repository class conversions, the `FastifyInstance` augmentation in `reposPlugin.ts`, or changes to `app.ts`

**Checkpoint**: `pnpm turbo test` green. `pnpm turbo typecheck` zero errors. No existing route test assertions changed.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and removing the last DuckDB references.

- [ ] T033 Create `apps/server/docs/database.md` — document: (1) TypeORM DataSource + `initRepositories` lifecycle, (2) cache singleton via `abstract-cache` and `@fastify/caching` registration, (3) migration workflow CLI commands (`migration:generate`, `migration:run`, `migration:revert`), (4) deploy workflow order (migrate → build → push → update Lambda), (5) local psql connection guide (retrieve RDS endpoint, Secrets Manager password, connect command), (6) how to add emails to the allowlist
- [ ] T034 Update `CLAUDE.md` — in Active Technologies section: replace DuckDB user-data entries with TypeORM + PostgreSQL + `@fastify/caching`; add note on repository class DI pattern (`initRepositories` → `getRepositories`); remove reference to `DB_PATH` env var; update Folder Structure to reflect `src/entities/`, `src/plugins/`, updated `src/db/`
- [ ] T035 [P] Update `.env.example` (create if not present) in `apps/server/` — add `DATABASE_URL`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` with placeholder values; remove `DB_PATH`
- [ ] T036 [P] Remove `@duckdb/node-api` from `apps/server/package.json` dependencies if `mtgjson-sdk` does not require it as a peer dependency — check `node_modules/mtgjson-sdk/package.json` peerDependencies first; if not required, remove and run `pnpm install`; if required, add an inline comment explaining the retention

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on T017 (migration run) and T012 (repositories.ts singleton) — Phase 2 must be fully complete
- **Phase 4 (US2)**: Depends on Phase 2 AND T021 (UserRepository, for the userId FK) — can start after T021 is done
- **Phase 5 (US3)**: Depends on Phase 3 AND Phase 4 completion
- **Phase 6 (Polish)**: Depends on Phase 5

### Within Phase 2

T005, T006, T007 (entities) → parallel. T008 (DataSource) depends on T005–T007. T009 (CLI datasource) depends on T005–T007 — runs in parallel with T008. T010 (config) is independent of entities. T011 (cache.ts) is independent. T012 (repositories.ts) depends on T020, T021, T026 class definitions — but the module structure (init/get pattern) can be scaffolded before classes exist, leaving class imports as forward references. T013 (reposPlugin) depends on T012. T014 (app.ts) depends on T008, T010, T011, T012, T013. T015 (migration scripts) is independent. T016 (generate migration) depends on T005–T009. T017 (run migration) depends on T016. T018, T019 (deletions) depend on T014.

### Within Phase 3

T020, T021 can run in parallel (different files). T022 (authService) depends on T020 and T021. T023 (routes/auth.ts) depends on T022. T024, T025 (tests) depend on T021 and T022 respectively.

### Within Phase 4

T026 (CardRepository) is independent of Phase 3. T027 (cardService) depends on T026. T028 (routes/cards.ts) depends on T027. T029, T030 (tests) depend on T026 and T027 respectively.

---

## Parallel Opportunities

### Phase 2 — entities and config can start simultaneously

```
Parallel: T005 (UserEntity), T006 (CardEntity), T007 (AllowedUserEntity), T010 (config), T011 (cache.ts), T015 (migration scripts)
Then: T008 (DataSource), T009 (CLI datasource) — depend on entities
Then: T012 (repositories.ts), T013 (reposPlugin) — depend on T008
Then: T014 (app.ts), T016 (generate migration)
Then: T017 (run migration), T018 (delete client.ts), T019 (delete SQL migrations)
```

### Phase 3 — repositories in parallel

```
Parallel: T020 (AllowedUserRepository), T021 (UserRepository)
Then: T022 (authService)
Then: T023 (routes/auth.ts)
Then parallel: T024 (userRepository.test.ts), T025 (authService.test.ts)
```

### Phase 4 — linear (each step depends on prior)

```
T026 (CardRepository) → T027 (cardService) → T028 (routes/cards.ts)
Then parallel: T029 (cardRepository.test.ts), T030 (cardService.test.ts)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T019)
3. Complete Phase 3: US1 Sign In (T020–T025)
4. **STOP and VALIDATE**: Sign in works end-to-end; allowlist blocks unlisted emails; psql shows user row; `fastify.cache` and `fastify.repos` are accessible in route handlers
5. Deploy if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → Infrastructure ready (no behaviour change yet)
2. Phase 3 → Sign-in and allowlist working (MVP)
3. Phase 4 → Collection CRUD working (core feature complete)
4. Phase 5 → Regression validated (safe to deploy)
5. Phase 6 → Documentation and cleanup

---

## Notes

- All `@Entity` classes use `!` definite assignment assertions — do not disable `strictPropertyInitialization`
- `src/db/repositories.ts` is the single init/get point; nothing else calls `new CardRepository(...)` etc. directly
- `reposPlugin.ts` exposes `fastify.repos.*` for routes; services access repos via `getRepositories()` with optional dep injection for tests
- `appCache` (abstract-cache in-memory) is the singleton passed to `@fastify/caching`; `fastify.cache` is the decorated accessor in route handlers
- Runtime `dataSource.ts` never references migration files (`migrationsRun: false`)
- CLI `datasource-cli.ts` references `.ts` source entities and is run via `tsx` — NOT compiled to `dist/`
- Commit migration files alongside the entity code that generated them
- After Phase 2 completes, `pnpm typecheck` must pass before proceeding — this is the hard gate
