# Contract: CardProvider Interface

**Branch**: `010-revert-mtgjson-infra` | **Date**: 2026-03-30

## Status: UNCHANGED

The `CardProvider` interface (defined in `apps/server/src/providers/interface.ts`) is **not modified** by this feature. All existing HTTP routes, request/response schemas, and API behaviour are preserved.

This document confirms the contract is stable and records which methods the reverted `MtgjsonProvider` satisfies.

---

## Interface

```ts
// apps/server/src/providers/interface.ts (unchanged)
type LookupOptions = {
  fuzzy?: boolean;
  set?: string;
  number?: string;
};

type CardProvider = {
  lookup(name: string, opts?: LookupOptions): Promise<CardRecord[] | CardNotFoundResult>;
  checkLegality(name: string, commanderColors?: string[]): Promise<LegalityResult>;
  search(query: SearchQuery): Promise<CardRecord[]>;
  isReachable(): Promise<boolean>;
};
```

---

## Method Contracts

### `lookup(name, opts?)`

| Behaviour | Specification |
|-----------|--------------|
| Default (no opts) | Fuzzy match on name, paper availability only |
| `fuzzy: false` | Exact case-insensitive name match |
| `set` provided | Filter to specific set code |
| `number` provided (requires `set`) | Filter to specific collector number within set |
| No results | Returns `{ found: false, name }` |
| Results found | Returns `CardRecord[]` |

**Implementation path**: `sdk.cards.getByName()` for exact; `sdk.cards.search({ fuzzyName })` for fuzzy.

---

### `checkLegality(name, commanderColors?)`

| Behaviour | Specification |
|-----------|--------------|
| Card not found | Throws error with `code: 'CARD_NOT_FOUND'` |
| Commander banned | Returns `{ legal: false, reason: 'Banned in Commander', ... }` |
| Color identity conflict | Returns `{ legal: false, reason: 'Colour identity conflict', ... }` |
| Not legal (other) | Returns `{ legal: false, reason: 'Not legal in Commander', ... }` |
| Legal | Returns `{ legal: true, reason: null, ... }` |

**Implementation path**: `sdk.cards.getByName(name)` → use `card.legalities.commander` and `card.colorIdentity` directly from the returned `CardSet`.

---

### `search(query)`

| `SearchQuery` field | Behaviour |
|--------------------|-----------|
| `name` | Fuzzy match |
| `set` | Exact set code filter |
| `cmcMin` | Mana value ≥ N |
| `cmcMax` | Mana value ≤ N |
| `colorIdentity` | Card's identity must be a subset of the provided colors |

All results filtered to paper availability.

**Implementation path**: `sdk.cards.search()` with available options; color identity subset applied in-process post-query.

---

### `isReachable()`

Returns `true` if the SDK has card data available (Lightning Bolt lookup succeeds). Returns `false` on any error (SDK not yet initialised, download in progress, etc.).

---

## HTTP API Contracts (unchanged)

The following routes are unaffected by this change. No request or response schemas change.

| Route | Purpose |
|-------|---------|
| `GET /cards/lookup` | Calls `provider.lookup()` |
| `GET /cards/legality` | Calls `provider.checkLegality()` |
| `POST /cards/search` | Calls `provider.search()` |
| `GET /provider` | Calls `registry.getProviderInfo()` |
