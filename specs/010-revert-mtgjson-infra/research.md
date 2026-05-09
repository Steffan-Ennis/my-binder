# Research: Revert MTGJSON Infrastructure Replication

**Branch**: `010-revert-mtgjson-infra` | **Date**: 2026-03-30

## SDK API Surface

### Decision
Use `MtgjsonSDK` directly as the card data provider rather than replicating its parquet files into DuckDB tables.

**Rationale**: The SDK exposes a fully-typed query API over its own internal DuckDB instance. Replicating data into a second DuckDB (the app's binder database) duplicates infrastructure and adds an import coordination layer that breaks with EFS access patterns.

**SDK instantiation**

```ts
const sdk = await MtgjsonSDK.create({ cacheDir: '/path/to/cache' });
// cacheDir → SDK stores downloaded parquet files here; persists across restarts when on EFS
```

The SDK holds its own DuckDB instance internally. It is **separate** from the app's DuckDB (`binder.duckdb`), which stores only user collection data.

---

## Mapping SDK Operations to CardProvider Methods

### `lookup(name, opts)`

| Scenario | SDK call |
|----------|----------|
| exact name, with set | `sdk.cards.getByName(name, { setCode })` |
| exact name, no set | `sdk.cards.getByName(name)` |
| fuzzy name | `sdk.cards.search({ fuzzyName: name, availability: 'paper' })` |
| exact name + set + number | `sdk.cards.getByName(name, { setCode })` then filter by `number` in-process |

**Decision**: `getByName` is the primary path for exact matches; `search({ fuzzyName })` for fuzzy. Number filtering (no native SDK number parameter) is applied in-process on the result array.

### `search(query)`

**Decision**: use `sdk.cards.search()` with all supported options mapped directly.

| `SearchQuery` field | SDK search option |
|---------------------|-------------------|
| `name` | `fuzzyName` (consistent with fuzzy lookup behaviour) |
| `set` | `setCode` |
| `cmcMin` | `manaValueGte` |
| `cmcMax` | `manaValueLte` |
| `colorIdentity` | Post-filter: SDK `colorIdentity` param is an exact-match array; our requirement is "card identity is a subset of allowed colors", which the SDK cannot express natively. Filter applied after the SDK returns results. |

Availability filter: pass `availability: 'paper'` to all search calls to exclude digital-only printings.

### `checkLegality(name, commanderColors?)`

**Decision**: `CardSet` includes `legalities: Legalities` (field `commander?: string`) directly on every card object — no separate enrichment query is needed.

Flow:
1. `sdk.cards.getByName(name)` — returns all printings; take first paper-available result
2. Read `card.legalities.commander` → `'Legal' | 'Banned' | 'Restricted' | undefined`
3. Apply commander color-identity subset check from `card.colorIdentity`

### `isReachable()`

**Decision**: `sdk.cards.getByName('Lightning Bolt')` — if returns results, the SDK is ready. Catch all errors and return `false`.

### Mapper enrichment

`CardSet` provides enrichment data directly on the card object — no separate DuckDB queries required:

| Enrichment field | Source on `CardSet` |
|-----------------|---------------------|
| `scryfallId` | `card.identifiers.scryfallId` |
| `commanderLegal` | `card.legalities.commander === 'Legal'` |

The existing `mapCardSetToCardRecord(card, enrichment)` signature is preserved unchanged.

---

## EFS Persistence

### Decision
Set the SDK `cacheDir` to a subdirectory on the EFS mount (e.g., `${EFS_MOUNT}/mtgjson-cache`). When no EFS mount is configured (local development), fall back to `MTGJSON_CACHE_DIR` env var (default: `./data/mtgjson-cache`).

**Rationale**: The SDK writes downloaded parquet files to `cacheDir`. EFS persists these files across Lambda cold starts, preventing re-downloads. No lock file or import coordination is needed because the SDK manages its own DuckDB instance — concurrent Lambdas each hold their own in-memory DuckDB connection reading from shared EFS parquet files (read-only after download; write is one-time per version).

**Config resolution order** (in `loadConfig`):
1. If `EFS_PATH` env var is set → `mtgjsonCacheDir = path.join(EFS_PATH, 'mtgjson-cache')`
2. Otherwise → `MTGJSON_CACHE_DIR` env var (default: `./data/mtgjson-cache`)

This replaces the current behaviour where `EFS_PATH` was used only for lock file coordination.

---

## SDK Lifecycle

### Decision
The `MtgjsonSDK` instance is created once during `buildApp()` and passed into `MtgjsonProvider`. It is **not** closed during normal operation. `MtgjsonProvider.close()` delegates to `sdk.close()`.

**Rationale**: The SDK holds an open DuckDB connection; closing and reopening on every request would be prohibitively expensive. The Lambda container keeps the Fastify app alive between invocations; a long-lived SDK instance is correct.

**Startup**:
- `MtgjsonSDK.create()` triggers `cacheManager.init()`, which downloads missing parquet files from the MTGJSON CDN if the local cache is absent or stale.
- This happens once per cold start. On a warm invocation the SDK is already initialised.
- If the SDK is not yet reachable (download in progress or failed), `isReachable()` returns `false` and the provider registry will not mark it active — callers receive a 503.

---

## Removed Components

| Component | Reason removed |
|-----------|---------------|
| `apps/server/src/db/cardImporter.ts` | Entire file — replaced by SDK direct access |
| `apps/server/src/db/migrations/003_card_import_metadata.sql` | No longer needed — import metadata table was only used by the importer |
| `apps/server/src/db/migrations/004_card_tables.sql` | No longer needed — card data lives in SDK's DuckDB, not the app's DuckDB |
| EFS lock file coordination (in `cardImporter.ts`) | The SDK manages its own concurrency; no lock files are written |

**Note on existing databases**: any `binder.duckdb` file that already has the tables from migrations 003/004 will retain those tables; they simply will not be queried. No drop migration is included in this spec.

---

## Alternatives Considered

| Alternative | Why rejected |
|-------------|-------------|
| Keep DuckDB replication, remove EFS lock | Still maintains unnecessary data duplication; two sources of truth |
| Query SDK parquet files directly via DuckDB (raw SQL) | Bypasses SDK abstraction; fragile against parquet schema changes; no benefit over SDK API |
| Keep SDK only for download, read parquet directly | Same problem as above — fragments the data access path |
