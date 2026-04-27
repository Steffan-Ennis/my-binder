import { mkdir } from 'node:fs/promises';
import { rmSync } from "node:fs";
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Ensure required EFS subdirectories exist before other services try to write to them.
 * No-op when EFS_PATH is not set (local dev, tests).
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
    console.error(error)
  }

}
