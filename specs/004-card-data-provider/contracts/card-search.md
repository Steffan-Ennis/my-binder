# Contract: Card Catalogue Search

**Layer**: API Server → Client (mobile app or internal caller)
**Updated**: 2026-03-21

---

## GET /cards/search

Search the full card catalogue with one or more filters. Results are paginated.
At least one filter parameter MUST be provided.

### Request

| Parameter       | Type    | Required | Description |
|----------------|---------|----------|-------------|
| `name`          | string  | No       | Full, partial, or fuzzy card name |
| `set`           | string  | No       | Set code (e.g., `"M11"`, `"LEA"`) |
| `colors`        | string  | No       | Comma-separated colour codes: `W,U,B,R,G,C` |
| `cmc_min`       | integer | No       | Minimum converted mana cost (inclusive) |
| `cmc_max`       | integer | No       | Maximum converted mana cost (inclusive) |
| `page`          | integer | No       | Page number, 1-based (default: `1`) |
| `limit`         | integer | No       | Results per page (default: `20`, max: `100`) |

**Example**:
```
GET /cards/search?colors=R&cmc_max=2&page=1&limit=20
GET /cards/search?name=bolt&set=M11
GET /cards/search?colors=W,U&cmc_min=3&cmc_max=5
```

### Response — Results Found (200)

```json
{
  "cards": [
    {
      "name": "Lightning Bolt",
      "set": "M11",
      "cardNumber": "149",
      "manaCost": "{R}",
      "colorIdentity": ["R"],
      "commanderLegal": true,
      "imageRef": "e3285fd6-example"
    }
  ],
  "total": 84,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### Response — No Results (200)

```json
{
  "cards": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 0
}
```

### Response — No Filter Provided (400)

```json
{
  "error": "MISSING_FILTER",
  "message": "At least one search filter must be provided."
}
```

### Response — Invalid Parameter (400)

```json
{
  "error": "INVALID_PARAMETER",
  "message": "cmc_min must be a non-negative integer."
}
```

### Response — Provider Unavailable (503)

```json
{
  "error": "PROVIDER_UNAVAILABLE",
  "message": "The card data provider is currently unavailable. Please try again."
}
```

---

## Notes

- `colors` filter matches on colour identity (not card colour). A card is included if its
  colour identity is a subset of the requested colours.
- Pagination is server-side; the full result set is never sent to the client in one response.
- When `name` is provided alongside other filters, fuzzy matching is applied to the name and
  the other filters narrow the fuzzy result set.
