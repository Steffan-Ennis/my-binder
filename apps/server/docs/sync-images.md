# sync-images

Bulk-downloads card images from the Scryfall CDN and stores them locally in
`apps/server/assets/images/{format}/{scryfallId}.{ext}`. Designed for both an initial
one-time setup (~93,000 images) and a weekly incremental sync that picks up new set releases.

## Command

```bash
cd apps/server
pnpm sync-images
```

## Prerequisites

1. **MTGJSON SDK cache must be populated.** Run the server at least once (`pnpm dev`) and
   wait for the log line `MTGJSON SDK ready`. The sync script reads scryfallIds directly from
   the local DuckDB Parquet cache — it does not make any Scryfall API calls for card data.
2. **Disk space.** Allow at least 1.5 GB free for the default `small` format (~1.2 GB).
3. **Dependencies installed.** Run `pnpm install` from the repo root if not already done.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `IMAGE_ASSETS_DIR` | `./assets/images` | Root directory for images and the manifest file |
| `IMAGE_FORMAT` | `small` | Scryfall image format: `small`, `normal`, `large`, `art_crop`, `border_crop`, `png` |
| `IMAGE_SYNC_CONCURRENCY` | `20` | Parallel CDN connections — reduce if you see 429 responses |
| `MTGJSON_CACHE_DIR` | `./data/mtgjson-cache` | Path to the MTGJSON SDK local cache |

All variables are optional; defaults are used if not set.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Completed successfully (including when all images are already present) |
| `1` | Fatal error before any downloads (invalid format, SDK not initialised, cannot create directory) |

Individual image download failures do **not** cause a non-zero exit — they are logged to
stderr and the script continues with the remaining queue.

## Initial Run (~93,000 images)

With the default 20 concurrent connections the initial download takes approximately
**30–45 minutes** depending on network speed.

```
[sync-images] Starting image sync...
[sync-images] Format: small | Concurrency: 20
[sync-images] Loaded 0 cached IDs from manifest.
[sync-images] Found 93144 physical paper scryfallIds from MTGJSON.
[sync-images] 93144 images to download.
[sync-images]  100/93144 — downloaded: 98, skipped: 0, failed: 2
...
[sync-images] Done.
  Total:               93144
  Downloaded:          93082
  Skipped (cached):        0
  Skipped (no ID):         0
  Failed:                 62
  Duration:            38m 4s
```

## Incremental Sync (Resumability)

The script maintains `assets/images/manifest.json` which records every successfully
downloaded scryfallId per format. On each run:

1. The manifest is loaded and the active format's Set is read.
2. Only IDs **not** in the Set are added to the download queue.
3. If the queue is empty the script exits immediately (under 10 seconds, zero network requests).

This means the script is **safe to interrupt and re-run** at any time. A Ctrl+C will print the
current summary and save progress before exiting.

## Image File Paths

Images are stored at:
```
assets/images/{format}/{scryfallId}.jpg   # for all formats except png
assets/images/{format}/{scryfallId}.png   # for the png format
```

For example:
```
assets/images/small/77c6fa74-5543-42ac-9ead-0e890b188e99.jpg
assets/images/normal/77c6fa74-5543-42ac-9ead-0e890b188e99.jpg
```

Each format is tracked independently in the manifest under `formats.{format}`. Downloading
a second format (`IMAGE_FORMAT=normal`) does not affect the `small` entry.

## Weekly Cron

```cron
# Weekly Sunday 02:00 — incremental sync for new set releases
0 2 * * 0 cd /app && pnpm sync-images >> /var/log/sync-images.log 2>&1
```

A typical weekly run (after a new set release with ~250 new printings) completes in
under 5 minutes. When nothing is new it completes in under 10 seconds.

## Downloading a Larger Format

```bash
IMAGE_FORMAT=normal pnpm sync-images
```

This creates a parallel `formats.normal` entry in the manifest and stores images under
`assets/images/normal/`. The `small` images are untouched.

## Reducing Concurrency (if CDN throttles)

```bash
IMAGE_SYNC_CONCURRENCY=5 pnpm sync-images
```

Reduces parallel connections to 5. Useful if the CDN begins returning HTTP 429 responses.
On a 429 the script already waits 10 seconds and retries once before marking the image failed;
reducing concurrency prevents 429s from occurring in the first place.
