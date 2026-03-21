# Database

The server uses [DuckDB](https://duckdb.org) as an embedded database. There is no separate
database process — DuckDB runs in-process and persists to a single file at `DB_PATH`.

## Connection lifecycle

The connection is opened once at startup via `initDb(dbPath)` in `src/db/client.ts` and held
as a module-level singleton for the lifetime of the process. All repositories call `getDb()`
to obtain the shared connection. `getDb()` throws if called before `initDb()` completes.

### Retry behaviour

`initDb` retries with exponential backoff to handle cases where a Docker volume mount is not
immediately available:

| Attempt | Delay before retry |
|---|---|
| 1 | 500 ms |
| 2 | 1 s |
| 3 | 2 s |
| 4 | 4 s |
| 5 | 8 s |

After 5 failed attempts the process throws and exits with code 1.

## Migrations

SQL migrations live in `src/db/migrations/` and are named with a numeric prefix:

```
src/db/migrations/
└── 001_create_cards.sql
```

On startup, `initDb` runs the migration runner, which:

1. Creates `schema_migrations` if it does not exist.
2. Reads all `*.sql` files from the migrations directory in numeric sort order.
3. Skips files whose version is already recorded in `schema_migrations`.
4. Executes unapplied files statement-by-statement inside a transaction, then records the
   version on commit.

### Adding a migration

Create a new file with the next numeric prefix: `002_<description>.sql`. The migration runner
picks it up automatically on the next startup. Each `.sql` file may contain multiple
statements separated by `;`.

## Schema

### `schema_migrations`

Tracks which migrations have been applied.

| Column | Type | Notes |
|---|---|---|
| `version` | `VARCHAR` | Primary key. Matches the filename without `.sql` |
| `applied_at` | `TIMESTAMPTZ` | Set to `NOW()` on insert |

### `cards`

Stores the card collection.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key. Auto-generated via `gen_random_uuid()` |
| `name` | `VARCHAR(255)` | Not null. Must be non-empty and ≤ 255 characters |
| `created_at` | `TIMESTAMPTZ` | Set to `NOW()` on insert |
| `updated_at` | `TIMESTAMPTZ` | Set to `NOW()` on insert; updated on every write |

## In-memory mode

The default path in development is `./binder.duckdb` (relative to the `apps/server/`
directory). Set `DB_PATH=:memory:` (or `NODE_ENV=test`) to use an in-memory DuckDB instance. The database
is destroyed when the process exits. This is the default for the test runner.
