import { mkdir } from 'node:fs/promises';
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
}
