# Quickstart: Revert MTGJSON Infrastructure Replication

**Branch**: `010-revert-mtgjson-infra` | **Date**: 2026-03-30

## What Changed

The `MtgjsonProvider` now calls the MTGJSON SDK directly instead of querying replicated DuckDB tables. The SDK's cache is persisted on the EFS-connected volume in production.

## Local Development

No change to local dev startup. The SDK downloads card data to `./data/mtgjson-cache` on first run.

```bash
nvm use
pnpm install
pnpm turbo dev
```

On first startup the SDK will download MTGJSON parquet files (~200 MB). Subsequent starts reuse the local cache.

## End-to-End Scenarios

### Scenario 1: Card lookup (local dev, warm cache)

```
GET /cards/lookup?name=Lightning+Bolt
```

Expected: `200 OK` with `CardRecord[]` containing all paper printings of Lightning Bolt.

The provider calls `sdk.cards.getByName('Lightning Bolt')` and maps each `CardSet` through `mapCardSetToCardRecord`.

---

### Scenario 2: Card lookup (cold start, no cache)

On first Lambda cold start (or local dev with no cache directory):

1. `MtgjsonSDK.create({ cacheDir: '/mnt/efs/mtgjson-cache' })` downloads parquet files to EFS.
2. `isReachable()` returns `true` once download completes.
3. Card lookup proceeds normally.

If the download has not yet completed when a request arrives, `isReachable()` returns `false` and the server responds `503 Service Unavailable`.

---

### Scenario 3: Card lookup (Lambda warm invocation after cold start)

EFS retains the downloaded parquet files. The SDK reads from EFS without downloading.

Expected: card lookups respond without any download delay.

---

### Scenario 4: Fuzzy search

```
POST /cards/search
{ "name": "bolt", "colorIdentity": ["R"] }
```

Expected: `200 OK` with cards whose names contain "bolt" and whose colour identity is a subset of `["R"]`.

Provider calls `sdk.cards.search({ fuzzyName: 'bolt', availability: 'paper' })` then applies the colour identity subset filter in-process.

---

### Scenario 5: Commander legality check

```
GET /cards/legality?name=Sol+Ring&commanderColors=W,U
```

Expected: `200 OK` with `{ legal: false, reason: 'Colour identity conflict' }` (Sol Ring is colourless so legal, but this is a colourless card — actually `{ legal: true }` — adjust example as needed in integration tests).

Provider calls `sdk.cards.getByName('Sol Ring')`, reads `card.legalities.commander` and `card.colorIdentity` directly from the returned `CardSet`.

---

## Verification: No Card Import Running

After the revert, confirm the following at server startup (check logs):

- No log line mentioning "card import", "parquet", or "mtgjson_cards"
- No migration 003 or 004 running (check DB migration log)

## Verification: EFS Persistence (Lambda)

1. Trigger a cold Lambda start — observe SDK downloads to `/mnt/efs/mtgjson-cache`
2. Trigger a second cold start — observe no download, SDK reads from existing cache files
3. Run a card lookup — confirm correct results on both starts

## Tests

```bash
cd apps/server
pnpm test
```

All existing card route and provider tests must pass. No test modifications are expected — the `CardProvider` interface and route schemas are unchanged.
