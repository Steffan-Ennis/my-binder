// One-off seed script: manually download the MTGJSON price-history parquet
// (`AllPrices.parquet`, ~1 GiB) into the same cache directory the server reads,
// then stamp `version.txt` so the running SDK treats the cache as fresh and does
// NOT re-download it on the next `prices.history()` call.
//
// Why this exists:
//   The MTGJSON SDK lazily downloads `AllPrices.parquet` on first price-history
//   access, inside a hard-coded 120 s timeout. A ~1 GiB download routinely blows
//   past that, so the time-series endpoint fails. MTGJSON also publishes a new
//   version daily, which marks the cached file stale and forces a re-download.
//   This script does the heavy download out-of-band, with no timeout, HTTP-range
//   resume, retries and a progress readout — and writes a matching `version.txt`.
//
// Run from apps/server/:
//   pnpm seed:prices          # skips if the cache is already up to date
//   pnpm seed:prices --force  # re-download even if up to date
//
// Re-run whenever MTGJSON publishes a new daily version.

import { createWriteStream, existsSync, statSync } from 'node:fs';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const CDN_BASE = 'https://mtgjson.com/api/v5';
const META_URL = `${CDN_BASE}/Meta.json`;
const PARQUET_URL = `${CDN_BASE}/parquet/AllPrices.parquet`;
const MAX_ATTEMPTS = 5;

// Mirror of the cache-dir expression in apps/server/src/config.ts:62. Inlined on
// purpose — importing loadConfig() would pull in Secrets Manager / DB resolution
// this download script must not require.
function resolveCacheDir(): string {
  const efsPath = process.env['EFS_PATH'];
  if (efsPath) return join(efsPath, 'mtgjson-cache');
  return process.env['MTGJSON_CACHE_DIR'] ?? './data/mtgjson-cache';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

/** Fetch the current remote dataset version from Meta.json. */
async function fetchRemoteVersion(): Promise<string> {
  const res = await fetch(META_URL);
  if (!res.ok) throw new Error(`Meta.json fetch failed: HTTP ${res.status}`);
  const meta = (await res.json()) as {
    data?: { version?: string };
    meta?: { version?: string };
  };
  const version = meta.data?.version ?? meta.meta?.version;
  if (!version) throw new Error('Could not read version from Meta.json');
  return version;
}

/**
 * Probe the total size of the parquet via a 1-byte ranged request.
 * Returns `{ total, supportsResume }` — when the server ignores the Range header
 * (responds 200), resume is unavailable and each attempt restarts from zero.
 */
async function probeSize(): Promise<{ total: number; supportsResume: boolean }> {
  const res = await fetch(PARQUET_URL, { headers: { Range: 'bytes=0-0' } });
  if (res.status === 206) {
    const contentRange = res.headers.get('content-range'); // "bytes 0-0/12345"
    const total = Number(contentRange?.split('/')[1]);
    if (Number.isFinite(total) && total > 0) return { total, supportsResume: true };
  }
  if (!res.ok && res.status !== 206) {
    throw new Error(`Size probe failed: HTTP ${res.status}`);
  }
  const len = Number(res.headers.get('content-length'));
  if (!Number.isFinite(len) || len <= 0) {
    throw new Error('Could not determine AllPrices.parquet size from the CDN');
  }
  return { total: len, supportsResume: false };
}

async function readLocalVersion(versionFile: string): Promise<string | null> {
  try {
    return (await readFile(versionFile, 'utf-8')).trim();
  } catch {
    return null;
  }
}

/** Stream one download attempt to `tmp`, resuming from its current size if possible. */
async function downloadAttempt(
  tmp: string,
  total: number,
  supportsResume: boolean,
  responseStream?: awslambda.HttpResponseStream
): Promise<void> {
  const existing = supportsResume && existsSync(tmp) ? statSync(tmp).size : 0;
  const headers = existing > 0 ? { Range: `bytes=${existing}-` } : undefined;
  const res = await fetch(PARQUET_URL, headers ? { headers } : undefined);

  let base: number;
  // This is typed as string but expects the following
  // https://nodejs.org/api/fs.html#file-system-flags
  let flags:  'a' | 'w';
  if (res.status === 206) {
    base = existing; // server honoured the range — append
    flags = 'a';
  } else if (res.status === 200) {
    base = 0; // full body (range ignored or fresh start) — overwrite
    flags = 'w';
  } else {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }
  if (!res.body) throw new Error('Download response had no body');

  const ws = createWriteStream(tmp, { flags });
  const startedAt = Date.now();
  let lastBytes = 0;
  let lastAt = startedAt;

  const timer = setInterval(() => {
    const downloaded = base + ws.bytesWritten;
    const now = Date.now();
    const instSpeed = ((downloaded - lastBytes) / (now - lastAt)) * 1000; // B/s
    lastBytes = downloaded;
    lastAt = now;
    const pct = ((downloaded / total) * 100).toFixed(1);
    const eta = instSpeed > 0 ? (total - downloaded) / instSpeed : Infinity;
    process.stdout.write(
      `\r  ${formatBytes(downloaded)} / ${formatBytes(total)} (${pct}%)  ` +
        `${formatBytes(instSpeed)}/s  ETA ${formatDuration(eta)}      `,
    );
    responseStream?.write(
      `\r  ${formatBytes(downloaded)} / ${formatBytes(total)} (${pct}%)  ` +
      `${formatBytes(instSpeed)}/s  ETA ${formatDuration(eta)}      `,
    )
  }, 1000);

  try {
    await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), ws);
  } finally {
    clearInterval(timer);
    process.stdout.write('\n');
  }
}

async function main(responseStream?: awslambda.HttpResponseStream ): Promise<void> {
  const force = process.argv.includes('--force');
  const cacheDir = resolve(resolveCacheDir());
  const parquetDir = join(cacheDir, 'parquet');
  const dest = join(parquetDir, 'AllPrices.parquet');
  const tmp = `${dest}.tmp`;
  const versionFile = join(cacheDir, 'version.txt');

  responseStream?.write(`Cache dir:   ${cacheDir}`);
  responseStream?.write(`Target file: ${dest}`);

  const remoteVersion = await fetchRemoteVersion();
  responseStream?.write(`Remote MTGJSON version: ${remoteVersion}`);

  const { total, supportsResume } = await probeSize();
  responseStream?.write(
    `AllPrices.parquet size: ${formatBytes(total)}` +
      (supportsResume ? '' : ' (server does not support resume — restarts on retry)'),
  );

  // Skip-if-fresh: file present, size matches, and version.txt already current.
  const localVersion = await readLocalVersion(versionFile);
  if (
    !force &&
    existsSync(dest) &&
    statSync(dest).size === total &&
    localVersion === remoteVersion
  ) {
    // responseStream?.write('✓ Cache already up to date — nothing to download. (use --force to override)');
    return;
  }

  await mkdir(parquetDir, { recursive: true });

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      responseStream?.write(`Downloading (attempt ${attempt}/${MAX_ATTEMPTS})…`);
      await downloadAttempt(tmp, total, supportsResume, responseStream);
      const got = existsSync(tmp) ? statSync(tmp).size : 0;
      if (got !== total) {
        throw new Error(`Size mismatch after download: got ${got}, expected ${total}`);
      }
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      responseStream?.write(`  Attempt ${attempt} failed: ${(err as Error).message}`);
      if (!supportsResume) {
        // Can't resume — drop the partial so the next attempt starts clean.
        await rm(tmp, { force: true });
      }
      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = Math.min(30_000, 2 ** attempt * 1000);
        console.warn(`  Retrying in ${backoffMs / 1000}s…`);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  if (lastErr) {
    await rm(tmp, { force: true });
    throw new Error(
      `Failed to download AllPrices.parquet after ${MAX_ATTEMPTS} attempts: ${(lastErr as Error).message}`,
    );
  }

  await rename(tmp, dest);
  await writeFile(versionFile, remoteVersion, 'utf-8');

  // The version may have advanced while the ~1 GiB file was downloading.
  const versionNow = await fetchRemoteVersion();
  if (versionNow !== remoteVersion) {
    console.warn(
      `⚠ MTGJSON published ${versionNow} while downloading ${remoteVersion}. ` +
        'Re-run `pnpm seed:prices` to pick up the newer file.',
    );
  }

  responseStream?.write(`✓ Saved ${formatBytes(statSync(dest).size)} → ${dest}`);
  responseStream?.write(`✓ Stamped version.txt = ${remoteVersion}`);
  responseStream?.write('Re-run `pnpm seed:prices` whenever MTGJSON publishes a new daily version.');
}

export default main
