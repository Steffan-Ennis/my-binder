import { DuckDBConnection } from '@duckdb/node-api';
import { stat, open, unlink, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { fetchRows } from './client';

const STALE_LOCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Import card data from MTGJSON parquet files into DuckDB tables if the
 * parquet files are newer than the last recorded import.
 *
 * @param db        Active DuckDB connection (DB already open + migrations run).
 * @param cacheDir  Path to the MTGJSON SDK cache directory (must contain a
 *                  `parquet/` subdirectory with cards.parquet, etc.).
 * @param efsPath   Optional EFS mount path used for lock file coordination.
 *                  Omit for local development (no lock file needed).
 */
export async function importCardDataIfStale(
  db: DuckDBConnection,
  cacheDir: string,
  efsPath?: string,
): Promise<void> {
  const parquetDir = join(cacheDir, 'parquet');
  const cardsParquet = join(parquetDir, 'cards.parquet');
  const identifiersParquet = join(parquetDir, 'cardIdentifiers.parquet');
  const legalitiesParquet = join(parquetDir, 'cardLegalities.parquet');

  // Bail early if parquet files aren't present yet (SDK may download later).
  let cardsStat: Awaited<ReturnType<typeof stat>>;
  try {
    cardsStat = await stat(cardsParquet);
  } catch {
    return;
  }

  const parquetMtime = cardsStat.mtime;

  // Compare against the mtime recorded from the last successful import.
  const metaResult = await db.run(
    'SELECT parquet_mtime FROM card_import_metadata WHERE id = 1',
  );
  const metaRows = await fetchRows(metaResult);

  if (metaRows.length > 0 && metaRows[0]!['parquet_mtime'] != null) {
    const lastMtime = new Date(String(metaRows[0]!['parquet_mtime']));
    if (lastMtime >= parquetMtime) {
      return; // Card data is current — nothing to do.
    }
  }

  // Parquet is newer (or no metadata yet) — we need to import.
  // On EFS, coordinate with a lock file to prevent concurrent rebuilds.
  const lockAcquired = efsPath !== undefined ? await acquireLock(efsPath) : true;
  if (!lockAcquired) {
    // Another Lambda invocation is already rebuilding. Skip.
    return;
  }

  try {
    await rebuildCardTables(db, cardsParquet, identifiersParquet, legalitiesParquet);

    const countResult = await db.run('SELECT COUNT(*) AS cnt FROM mtgjson_cards');
    const countRows = await fetchRows(countResult);
    const count = Number(countRows[0]?.['cnt'] ?? 0);

    // Record the new import metadata (upsert via delete + insert).
    await db.run('DELETE FROM card_import_metadata WHERE id = 1');
    await db.run(
      `INSERT INTO card_import_metadata (id, last_import_at, parquet_mtime, parquet_count)
       VALUES (1, current_timestamp, ?, ?)`,
      [parquetMtime.toISOString(), count],
    );
  } finally {
    if (efsPath !== undefined) {
      await releaseLock(efsPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function rebuildCardTables(
  db: DuckDBConnection,
  cardsParquet: string,
  identifiersParquet: string,
  legalitiesParquet: string,
): Promise<void> {
  // CREATE OR REPLACE TABLE replaces the existing stub created by migration 004.
  // The full parquet schema is inferred automatically.
  await db.run(
    `CREATE OR REPLACE TABLE mtgjson_cards AS
     SELECT * FROM read_parquet('${cardsParquet}')`,
  );
  await db.run(
    `CREATE OR REPLACE TABLE mtgjson_card_identifiers AS
     SELECT * FROM read_parquet('${identifiersParquet}')`,
  );
  await db.run(
    `CREATE OR REPLACE TABLE mtgjson_card_legalities AS
     SELECT * FROM read_parquet('${legalitiesParquet}')`,
  );
}

async function acquireLock(efsPath: string): Promise<boolean> {
  const locksDir = join(efsPath, 'locks');
  const lockPath = join(locksDir, 'card-import.lock');

  try {
    await mkdir(locksDir, { recursive: true });
    const fd = await open(
      lockPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    );
    await fd.write(JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
    await fd.close();
    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw err;
    }
    // Lock file exists — check if it's stale (crashed invocation).
    try {
      const lockStat = await stat(lockPath);
      if (Date.now() - lockStat.mtimeMs > STALE_LOCK_THRESHOLD_MS) {
        await unlink(lockPath);
        return acquireLock(efsPath); // Retry once after removing stale lock.
      }
    } catch {
      // Lock disappeared between our EEXIST check and the stat — that's fine.
    }
    return false;
  }
}

async function releaseLock(efsPath: string): Promise<void> {
  const lockPath = join(efsPath, 'locks', 'card-import.lock');
  try {
    await unlink(lockPath);
  } catch {
    // Already gone — nothing to do.
  }
}
