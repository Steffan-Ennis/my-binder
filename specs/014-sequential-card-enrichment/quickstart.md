# Quickstart: Sequential Card Enrichment

**Date**: 2026-04-27
**Feature**: 014-sequential-card-enrichment

## Testing the Fix

### Cold Cache Test (Primary Validation)

Delete the SDK's parquet cache to simulate first-time access, then run a search:

```bash
# 1. Clear parquet cache (EFS path locally, or mtgjson-cache dir)
rm -rf apps/server/data/mtgjson-cache/parquet/*.parquet

# 2. Start the server
cd apps/server
pnpm dev

# 3. Search for cards — should trigger parquet downloads
curl "http://localhost:3000/cards/search?name=bolt"
```

**Expected**: All cards in the response include `imageRef` (non-null scryfallId) and `commanderLegal` (boolean, not hardcoded `false`).

### Warm Cache Test

Run the same search again without clearing cache:

```bash
curl "http://localhost:3000/cards/search?name=bolt"
```

**Expected**: Same results, faster response (no downloads).

### Commander Legality Validation

Search for a card known to be banned in Commander:

```bash
curl "http://localhost:3000/cards/search?name=channel"
```

**Expected**: `commanderLegal` is `false` for Channel (banned in Commander).

```bash
curl "http://localhost:3000/cards/search?name=lightning+bolt"
```

**Expected**: `commanderLegal` is `true` for Lightning Bolt (legal in Commander).

## What Changed

| Before | After |
|--------|-------|
| `Promise.all(cards.map(enrichCard))` | Sequential async generator: one card at a time |
| `sdk.legalities.isLegal()` commented out | Re-enabled — legalities fetched for every card |
| `commanderLegal` hardcoded to `false` | `commanderLegal` reflects actual Commander legality |
| Cold cache causes race condition failures | Cold cache works — first card downloads, rest read from cache |
