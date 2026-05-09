# Research: Sequential Card Enrichment

**Date**: 2026-04-27
**Feature**: 014-sequential-card-enrichment

## R1: Root Cause — Concurrent Parquet File Downloads

### Finding

The MTGJSON SDK stores card identifiers and legalities in separate parquet files that are lazily downloaded on first access. When `MtgjsonProvider.search()` calls `Promise.all(cards.map(card => this.enrichCard(card)))`, all cards attempt to access these parquet files simultaneously. If the files haven't been downloaded yet, multiple concurrent download attempts race on the same file path — the SDK does not guard against this.

### Evidence

- `enrichCard()` calls `sdk.identifiers.getIdentifiers(card.uuid)` and (when uncommented) `sdk.legalities.isLegal(card.uuid, 'commander')`
- Both SDK methods access parquet files that are downloaded on demand
- The legality call was commented out with `// TODO: re-enable enrichment after debugging` — the race condition was the debugging issue
- The `enrichCard` return type was changed to hardcode `commanderLegal: false` as a workaround

### Impact

- Search endpoint fails intermittently on cold cache
- Commander legality data is missing from search results (hardcoded `false`)

---

## R2: Async Generators in TypeScript — Pattern Suitability

### Decision: Use native async generators

### Rationale

TypeScript 5 with `target: ES2022` (or later) has full support for `async function*` generators and `for await...of` consumption. No polyfills or additional configuration needed.

The pattern fits because:
1. We have an ordered collection (array of cards) that needs sequential async processing
2. Each item produces exactly one result
3. We need to collect all results into an array at the end
4. No branching, filtering, or early termination logic is required

### Pattern

```ts
// Producer: yields results one at a time
private async *enrichCards(cards: CardSet[]): AsyncGenerator<CardRecord> {
  for (const card of cards) {
    yield await this.enrichCard(card);
  }
}

// Consumer: collects into array
private async collectCards(cards: CardSet[]): Promise<CardRecord[]> {
  const results: CardRecord[] = [];
  for await (const record of this.enrichCards(cards)) {
    results.push(record);
  }
  return results;
}
```

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Async generator + collector | Native, no deps, clear intent, composable | Slightly more code than a simple for loop |
| Plain `for...of` loop with `await` | Simplest possible — fewest lines | Less composable; mixes iteration with collection |
| `p-limit(1)` (concurrency limiter) | Familiar pattern | External dependency; overkill for concurrency=1 (i.e., sequential) |
| `Array.reduce` with async accumulator | No generator | Harder to read; accumulator pattern obscures the sequential intent |

The async generator was chosen over a plain for loop because it cleanly separates the iteration concern (one card at a time) from the collection concern (gather into array), making each piece independently testable and the intent explicit.

---

## R3: Safety of Parallel Calls Within a Single enrichCard

### Finding: Safe

Within a single `enrichCard(card)` call, two SDK methods are invoked:

1. `sdk.identifiers.getIdentifiers(card.uuid)` — reads from `identifiers.parquet`
2. `sdk.legalities.isLegal(card.uuid, 'commander')` — reads from `legalities.parquet`

These are **different parquet files**. The race condition occurs when multiple cards trigger the **same** parquet file download concurrently. Within one card:

- If both files are uncached: two different files download in parallel — no contention
- If one is cached: only one download, no contention
- If both are cached: two fast reads, no contention

`Promise.all` within `enrichCard` is safe. The fix is sequential iteration **across cards**, not within a single card's enrichment.

---

## R4: Current State of enrichCard

### Finding: Legalities call is commented out

Current code (`apps/server/src/providers/mtgjson/index.ts:124-131`):

```ts
private async enrichCard(card: CardSet): Promise<CardRecord> {
  const [ids, commanderLegal = false] = await Promise.all([
    this.sdk.identifiers.getIdentifiers(card.uuid),
    // this.sdk.legalities.isLegal(card.uuid, 'commander'),
  ]);
  const scryfallId = typeof ids?.scryfallId === 'string' ? ids.scryfallId : null;
  return mapCardSetToCardRecord(card, { commanderLegal, scryfallId });
}
```

The `commanderLegal = false` default destructuring was added when the legalities call was commented out, ensuring the code still compiles. When the call is re-enabled, the default is no longer needed — `isLegal()` returns a boolean directly.
