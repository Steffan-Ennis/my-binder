# Migrations

Schema migrations are plain SQL files that are applied once, in order, at server startup.
There is no CLI tool — the migration runner is built into the server itself.

## How it works

When `initDb()` is called (in `index.ts`, before the server starts accepting requests), the
migration runner in `src/db/client.ts` does the following:

1. Creates the `schema_migrations` tracking table if it does not already exist.
2. Reads every `*.sql` file from `src/db/migrations/` and sorts them alphabetically.
   Numeric prefixes (`001_`, `002_`) ensure the sort order matches the intended execution order.
3. Queries `schema_migrations` to build a set of already-applied versions.
4. For each unapplied file:
   - Splits the file content on `;` to get individual statements (DuckDB executes one
     statement per `conn.run()` call).
   - Opens a transaction with `BEGIN`.
   - Executes every statement in order.
   - Inserts the migration version into `schema_migrations`.
   - Commits. If any statement throws, the transaction is rolled back and the server exits.
5. Applied migrations are never re-executed. They are permanent.

The version string recorded in `schema_migrations` is the filename without the `.sql`
extension — e.g. `001_create_cards`.

## Creating a migration

### 1. Name the file

Files MUST follow the naming convention:

```
NNN_<description>.sql
```

- `NNN` is a zero-padded three-digit number, incrementing from the last migration.
- `<description>` is snake_case, describing what the migration does.
- No gaps in numbering are allowed.

Examples:

```
001_create_cards.sql          ← existing
002_add_set_to_cards.sql      ← next
003_create_binders.sql
```

### 2. Write the SQL

Create the file at `src/db/migrations/NNN_<description>.sql`. You can include multiple
statements — separate them with `;`.

```sql
-- 002_add_set_to_cards.sql

ALTER TABLE cards ADD COLUMN set_code VARCHAR(10);

ALTER TABLE cards ADD COLUMN collector_number VARCHAR(20);
```

**Rules:**

- Use `IF NOT EXISTS` / `IF EXISTS` guards on DDL where possible so the migration is
  idempotent if re-run against a partially-migrated database (e.g. after a failed transaction).
- Do not modify previously applied migration files. Once a migration has been committed to
  `main` and applied to any database, it is immutable. Write a new migration instead.
- Destructive operations (`DROP TABLE`, `DROP COLUMN`) MUST include a comment explaining why
  the data is safe to remove.
- Data migrations (backfilling values into a new column) belong in the same migration file as
  the schema change that requires them.

### 3. Apply it

In development, restart the server. `initDb()` runs on startup and applies any pending
migrations automatically:

```bash
DB_PATH=./local.duckdb pnpm --filter=@my-binder/server dev
```

The server logs will confirm which migrations were applied.

### 4. Build step

For production builds, the `build` script copies the migrations directory into `dist/`:

```bash
pnpm --filter=@my-binder/server build
# runs: tsc && cp -r src/db/migrations dist/db/
```

The compiled server reads migrations from `dist/db/migrations/` at runtime via `__dirname`.
If you add a migration and forget to rebuild, the new file will not be present in `dist/` and
will not be applied in production.

## Inspecting applied migrations

Connect to the DuckDB file directly and query the tracking table:

```bash
# requires the duckdb CLI: https://duckdb.org/docs/installation
duckdb /path/to/binder.duckdb "SELECT * FROM schema_migrations ORDER BY applied_at"
```

Example output:

```
┌──────────────────┬─────────────────────────────┐
│     version      │         applied_at          │
│     varchar      │        timestamptz          │
├──────────────────┼─────────────────────────────┤
│ 001_create_cards │ 2026-03-21 20:00:00.000+00  │
└──────────────────┴─────────────────────────────┘
```

## Rollbacks

There is no automated rollback mechanism. Migrations are intentionally forward-only.

If a migration needs to be undone:

1. Write a new migration that reverses the change (e.g. `DROP COLUMN` to undo `ADD COLUMN`).
2. Never delete or edit an already-applied migration file.

This approach ensures every environment can reach the same schema by replaying the same
sequence of files, with no hidden state.

## Testing

The test runner sets `NODE_ENV=test`, which forces `DB_PATH=:memory:`. Every test process
starts with a fresh in-memory database and runs all migrations from scratch. This means:

- Migrations are exercised on every `pnpm test` run.
- No test pollution from a leftover development database.
- No cleanup required between test runs.
