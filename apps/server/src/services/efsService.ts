import { mkdir } from 'node:fs/promises';
import { rmSync } from "node:fs";
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Prepare the EFS mount for use by the rest of the server. Two side effects:
 *
 *   1. `mkdir -p` both `<efsPath>/db` and `<efsPath>/mtgjson-cache` so
 *      downstream services (DuckDB, MTGJSON SDK) can write to them on first
 *      access without crashing on a missing parent.
 *   2. Best-effort wipe of any pre-existing files under
 *      `<efsPath>/mtgjson-cache/parquet/` to prevent a stale SDK cache from
 *      blocking a fresh download on Lambda cold-start. The parquet directory
 *      is owned by the SDK; we only delete its contents on startup.
 *
 * The cleanup step intentionally swallows errors with a `console.error` (per
 * Principle VIII) — the directory may not exist on the very first cold start,
 * and a startup failure here would brick the Lambda. The `MtgjsonProvider.isReachable`
 * probe is the authoritative health check; if cleanup failed and the cache is
 * unreadable, that probe will report it.
 *
 * Caller is responsible for skipping this when `EFS_PATH` is unset (local dev
 * and tests run without EFS).
 *
 * @param efsPath - Root of the EFS mount (e.g. `/mnt/efs`). Subdirectories `db/` and `mtgjson-cache/` are created relative to this path.
 * @returns Resolves once both directories exist; cleanup completion is not awaited as a hard precondition.
 *
 * @example
 * ```ts
 * // apps/server/src/lambda.ts — Lambda startup
 * if (process.env.EFS_PATH) {
 *   await initEfs(process.env.EFS_PATH);
 * }
 * ```
 */
export async function initEfs(efsPath: string): Promise<void> {
  await Promise.all([
    mkdir(join(efsPath, 'db'), { recursive: true }),
    mkdir(join(efsPath, 'mtgjson-cache'), { recursive: true }),
  ]);

  try {
    const mtgJSONCache = join(efsPath, 'mtgjson-cache', 'parquet')
    const files = await readdir(
      mtgJSONCache
    );
    files.forEach(f => rmSync(join(mtgJSONCache, f)))
  }
  catch (error) {
    // Intentional swallow — see function-level JSDoc note (Principle VIII rationale).
    console.error(error)
  }

}