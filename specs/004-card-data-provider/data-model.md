# Data Model: Card Data Provider

**Feature**: 004-card-data-provider
**Date**: 2026-03-21

---

## Entities

### CardRecord

The normalised representation of a card returned by any provider. All provider
implementations MUST map their raw response to this structure before returning it to the
service layer.

```
CardRecord {
  name:          string        -- Card name (e.g., "Lightning Bolt")
  set:           string        -- Set code (e.g., "M11")
  cardNumber:    string        -- Collector number within the set (e.g., "149")
  manaCost:      string|null   -- Mana cost string (e.g., "{R}"); null for lands
  colorIdentity: string[]      -- Subset of ["W","U","B","R","G","C"]
  commanderLegal: boolean      -- True if legal in Commander format
  imageRef:      string|null   -- External image identifier (Scryfall ID); null if unavailable
}
```

**Validation rules**:
- `name` MUST be non-empty.
- `set` MUST be a non-empty string (set code).
- `cardNumber` MUST be a non-empty string.
- `manaCost` MAY be null (lands and some special cards have no mana cost).
- `colorIdentity` MUST be an array; empty array is valid (colourless cards).
- `commanderLegal` MUST be a boolean — never null or undefined.

---

### Printing

Represents a single physical release of a card. One card (by name) may have many printings.

```
Printing {
  name:       string   -- Card name
  set:        string   -- Set code
  cardNumber: string   -- Collector number within the set
  imageRef:   string|null
}
```

---

### LegalityResult

The response from a Commander legality check.

```
LegalityResult {
  cardName:      string     -- The card queried
  legal:         boolean    -- True if legal in Commander with the given Commander
  reason:        string|null -- Human-readable reason if not legal (null if legal)
                            -- Possible reasons: "Banned in Commander",
                            --                   "Colour identity conflict"
  colorIdentity: string[]   -- The card's own colour identity
}
```

**State transitions**:
- `legal = true` → `reason = null`
- `legal = false, banned` → `reason = "Banned in Commander"`
- `legal = false, colour mismatch` → `reason = "Colour identity conflict"`

---

### SearchQuery

The input structure for a catalogue search. All fields are optional; at least one MUST be
provided.

```
SearchQuery {
  name?:         string   -- Full, partial, or fuzzy name
  set?:          string   -- Set code filter
  colorIdentity?: string[] -- Colour identity filter (exact match on identity set)
  cmcMin?:       number   -- Minimum converted mana cost (inclusive)
  cmcMax?:       number   -- Maximum converted mana cost (inclusive)
  page?:         number   -- 1-based page number (default: 1)
  limit?:        number   -- Results per page (default: 20, max: 100)
}
```

---

### SearchResult

The paginated response from a catalogue search.

```
SearchResult {
  cards:      CardRecord[]  -- Cards on this page
  total:      number        -- Total matching cards across all pages
  page:       number        -- Current page (1-based)
  limit:      number        -- Page size used
  totalPages: number        -- ceil(total / limit)
}
```

---

### ProviderInfo

Metadata about a registered card data provider.

```
ProviderInfo {
  name:      string   -- Provider identifier (e.g., "mtgjson")
  active:    boolean  -- Whether this is the currently active provider
  reachable: boolean  -- Whether the provider passed its reachability check
}
```

---

### ProviderNotFoundError

```
ProviderNotFoundError {
  type:    "PROVIDER_NOT_FOUND"
  message: string   -- Human-readable explanation
}
```

### ProviderUnavailableError

```
ProviderUnavailableError {
  type:    "PROVIDER_UNAVAILABLE"
  message: string
}
```

### CardNotFoundResult

A clean "not found" value — not an error. Returned when a lookup finds no match.

```
CardNotFoundResult {
  found: false
  name:  string   -- The name that was queried
}
```

---

## Relationships

```
ProviderRegistry
  └── has one active → Provider (interface)
        └── implemented by → MtgjsonProvider
              └── uses → mtgjson-sdk (DuckDB local)
              └── maps responses to → CardRecord | Printing | LegalityResult

CardService
  └── calls → ProviderRegistry.getActive()
  └── returns → CardRecord | CardNotFoundResult | LegalityResult | SearchResult
```
