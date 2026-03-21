import { DuckDBInstance, DuckDBConnection, DuckDBResult } from '@duckdb/node-api';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Singleton connection — initialised once at startup via initDb().
let _connection: DuckDBConnection | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open the DuckDB file (or :memory:) with exponential-backoff retry,
 * then run any pending SQL migrations. Must be called before getDb().
 *
 * Retry schedule: 500ms → 1s → 2s → 4s → 8s (5 attempts total).
 * Handles the case where a Docker volume mount is not yet ready.
 */
export async function initDb(dbPath: string): Promise<void> {
  const delays = [500, 1000, 2000, 4000, 8000];
  let lastError: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const instance = await DuckDBInstance.create(dbPath);
      const conn = await instance.connect();
      await runMigrations(conn);
      _connection = conn;
      return;
    } catch (err) {
      lastError = err;
      const delay = delays[attempt];
      if (delay === undefined) break;
      await sleep(delay);
    }
  }

  throw new Error(
    `Failed to open DuckDB at "${dbPath}" after ${delays.length + 1} attempts. ` +
      `Last error: ${String(lastError)}`,
  );
}

/**
 * Return the active DuckDB connection.
 * Throws if initDb() has not been called successfully.
 */
export function getDb(): DuckDBConnection {
  if (_connection === null) {
    throw new Error('Database not initialised. Call initDb() first.');
  }
  return _connection;
}

// ---------------------------------------------------------------------------
// Result helper
// ---------------------------------------------------------------------------

/**
 * Drain all rows from a DuckDBResult into an array of plain objects,
 * keyed by column name.
 */
export async function fetchRows(result: DuckDBResult): Promise<Record<string, unknown>[]> {
  return result.getRowObjects() as Promise<Record<string, unknown>[]>;
}

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

async function runMigrations(conn: DuckDBConnection): Promise<void> {
  // Bootstrap: ensure the tracking table exists before we query it.
  await conn.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Load already-applied versions.
  const appliedResult = await conn.run('SELECT version FROM schema_migrations');
  const appliedRows = await fetchRows(appliedResult);
  const applied = new Set(appliedRows.map((r) => String(r['version'])));

  // Read SQL files from the migrations directory (next to this compiled file at runtime,
  // or next to this source file in dev via tsx).
  const migrationsDir = join(__dirname, 'migrations');
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort(); // numeric sort works because files are prefixed 001_, 002_, etc.

  for (const file of files) {
    const version = file.replace('.sql', '');
    if (applied.has(version)) continue;

    const sql = await readFile(join(migrationsDir, file), 'utf-8');

    // Split on semicolons so each statement is executed individually.
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    await conn.run('BEGIN');
    try {
      for (const statement of statements) {
        await conn.run(statement);
      }
      await conn.run('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
      await conn.run('COMMIT');
    } catch (err) {
      await conn.run('ROLLBACK');
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
