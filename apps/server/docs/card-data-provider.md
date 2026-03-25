# Card Data Provider

The card data provider layer sits between the HTTP routes and external card data sources. It normalises all card data into a single `CardRecord` shape before it reaches the service layer, keeping the rest of the codebase decoupled from any particular data source.

## Architecture

```
HTTP Route → cardService → ProviderRegistry → CardProvider (interface)
                                                    └── MtgjsonProvider (impl)
                                                          └── MtgjsonSDK (DuckDB local)
```

- **`CardProvider`** (`src/providers/interface.ts`) — the TypeScript type every provider must satisfy.
- **`ProviderRegistry`** (`src/providers/registry.ts`) — holds all registered providers; exposes the active one.
- **`MtgjsonProvider`** (`src/providers/mtgjson/index.ts`) — MTGJSON implementation backed by a local DuckDB file managed by `mtgjson-sdk`.
- **`mapper.ts`** (`src/providers/mtgjson/mapper.ts`) — maps SDK `CardSet` → `CardRecord`.

## Startup Flow

1. `index.ts` calls `MtgjsonProvider.create({ cacheDir })`.
   - `mtgjson-sdk` downloads Parquet files from the MTGJSON CDN on first run and caches them locally.
   - Subsequent starts load from the local cache — no network required.
2. The provider is registered under the name `"mtgjson"` in `ProviderRegistry`.
3. `registry.setActive(config.cardProvider)` runs an `isReachable()` check before making the provider active.
4. On graceful shutdown, `fastify.addHook('onClose', ...)` calls `provider.close()` to release DuckDB resources.

## Configuration

| Env Var | Default | Purpose |
|---|---|---|
| `CARD_PROVIDER` | `mtgjson` | Name of the provider to activate at startup |
| `MTGJSON_CACHE_DIR` | `./data/mtgjson-cache` | Path for the SDK's Parquet/DuckDB cache |

For Docker, mount `MTGJSON_CACHE_DIR` as a persistent volume to avoid re-downloading on container restart.

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/cards/lookup?name=` | Exact or fuzzy card lookup; returns all printings |
| `GET` | `/cards/legality?name=` | Commander format legality check |
| `GET` | `/cards/search?...` | Filtered catalogue search with pagination |
| `GET` | `/provider` | Current provider status |
| `PUT` | `/provider` | Switch the active provider at runtime |

See `specs/004-card-data-provider/contracts/` for full request/response shapes.

## Adding a New Provider

1. Create `src/providers/<name>/index.ts` and export a class that satisfies the `CardProvider` type from `src/providers/interface.ts`.
2. In `apps/server/index.ts`, import the class and call `registry.register('<name>', await YourProvider.create())` before `registry.setActive(...)`.
3. Set `CARD_PROVIDER=<name>` in the environment to activate it.

No other code changes are needed — the routes and service layer are provider-agnostic.
