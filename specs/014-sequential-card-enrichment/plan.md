# Implementation Plan: Sequential Card Enrichment

**Branch**: `014-sequential-card-enrichment` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-sequential-card-enrichment/spec.md`

## Summary

Replace `Promise.all` in `MtgjsonProvider.search()` with a sequential async generator that enriches one card at a time. This prevents the race condition caused by concurrent MTGJSON SDK parquet file downloads. Re-enable the commented-out `sdk.legalities.isLegal()` call now that sequential processing eliminates file contention.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 22
**Primary Dependencies**: `mtgjson-sdk@0.1.1`
**Target File**: `apps/server/src/providers/mtgjson/index.ts` (single file change)
**Constraints**: Must not change the `CardProvider` interface or `search()` return type
**Scale/Scope**: 3 small changes in 1 file — new private generator method, new private collector method, updated `search()` body + uncommented legality call

## Design

### Root Cause

`search()` calls `Promise.all(cards.map(card => this.enrichCard(card)))`. Each `enrichCard` call hits `sdk.identifiers.getIdentifiers()` (and eventually `sdk.legalities.isLegal()`). The SDK lazily downloads parquet files on first access. When N cards fan out simultaneously, N concurrent downloads race on the same file — the SDK is not designed for parallel first-access of the same parquet file.

### Solution: Sequential Async Generator

Process cards one at a time via an async generator. The first card triggers the parquet download and caches the file. All subsequent cards read from cache with no contention.

```
Before:  cards ──┬── enrichCard(1) ──┐
                 ├── enrichCard(2) ──┤── Promise.all ── results
                 ├── enrichCard(3) ──┤     (race condition)
                 └── enrichCard(N) ──┘

After:   cards ── for each ── enrichCard(1) → yield
                            ── enrichCard(2) → yield
                            ── enrichCard(3) → yield    (sequential, no race)
                            ── enrichCard(N) → yield
```

### Why Not Other Approaches

| Approach | Why Rejected |
|----------|-------------|
| Mutex / semaphore | Adds complexity for a problem solved by sequential iteration |
| Retry with backoff | Masks the root cause instead of preventing contention |
| Pre-warming parquet at startup | Couples app initialization to SDK internals; fragile |
| Limiting concurrency (e.g., p-limit) | Extra dependency; still allows some concurrent first-access if limit > 1 |

## Project Structure

### Documentation (this feature)

```text
specs/014-sequential-card-enrichment/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Root cause analysis + async generator patterns
├── quickstart.md        # How to test the fix
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
apps/server/src/providers/mtgjson/
└── index.ts             # MODIFIED — enrichCards generator, collectCards helper, updated search()
```

**Structure Decision**: No new files. All changes are within the existing `MtgjsonProvider` class. No interface changes.

## Implementation Steps

### Step 1 — Add private async generator: `enrichCards`

```ts
private async *enrichCards(cards: CardSet[]): AsyncGenerator<CardRecord> {
  for (const card of cards) {
    yield await this.enrichCard(card);
  }
}
```

- Iterates cards sequentially — only one SDK call in flight at a time
- Yields each `CardRecord` as soon as it resolves
- Zero external dependencies; uses native async iteration

### Step 2 — Add private collector: `collectCards`

```ts
private async collectCards(cards: CardSet[]): Promise<CardRecord[]> {
  const results: CardRecord[] = [];
  for await (const record of this.enrichCards(cards)) {
    results.push(record);
  }
  return results;
}
```

Consumes the generator and returns `CardRecord[]` to match the existing `search()` return type.

### Step 3 — Update `search()` to use sequential path

```ts
async search(query: SearchQuery): Promise<CardRecord[]> {
  const cards = await this.sdk.cards.search({
    ...(query.name !== undefined && { fuzzyName: query.name }),
    ...(query.set !== undefined && { setCode: query.set }),
    ...(query.cmcMin !== undefined && { manaValueGte: query.cmcMin }),
    ...(query.cmcMax !== undefined && { manaValueLte: query.cmcMax }),
    ...(query.colorIdentity !== undefined) && { colorIdentity: query.colorIdentity },
    availability: 'paper',
  });

  return this.collectCards(cards);
}
```

Replaces the `Promise.all` call. No change to method signature or return type. Removes the TODO comment.

### Step 4 — Re-enable legalities in `enrichCard`

```ts
private async enrichCard(card: CardSet): Promise<CardRecord> {
  const [ids, commanderLegal] = await Promise.all([
    this.sdk.identifiers.getIdentifiers(card.uuid),
    this.sdk.legalities.isLegal(card.uuid, 'commander'),
  ]);
  const scryfallId = typeof ids?.scryfallId === 'string' ? ids.scryfallId : null;
  return mapCardSetToCardRecord(card, { commanderLegal, scryfallId });
}
```

Within a single card, `identifiers` and `legalities` are different parquet files — parallel is safe here. It's the per-card fan-out across the full result set that caused the race.

## Performance Analysis

| Concern | Assessment |
|---------|-----------|
| **Cold cache** | First card pays the parquet download cost (~1-2s); subsequent cards are fast reads. Total time ≈ download + (N × read), vs parallel where all N cards contend and fail |
| **Warm cache** | All cards are fast parquet reads. Sequential overhead is negligible — each read is <10ms |
| **Worst case** | A search returning 100 cards on warm cache: ~100 × 10ms = 1s. Acceptable for a search endpoint |
| **Net effect** | Slower than successful parallel (which currently fails), faster than failed parallel + retry |

## Complexity Tracking

> No violations to justify. Table is empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
