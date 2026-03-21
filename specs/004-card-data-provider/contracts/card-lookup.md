# Contract: Card Lookup

**Layer**: API Server → Client (mobile app or internal caller)
**Updated**: 2026-03-21 (amended 2026-03-21 — set and number filters added)

---

## GET /cards/lookup

Look up a card by name. Supports exact and fuzzy matching. Returns all printings when
multiple exist.

### Request

| Parameter | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `name`    | string  | Yes      | Full, partial, or approximate card name |
| `fuzzy`   | boolean | No       | If `true`, applies fuzzy/Jaro-Winkler matching (default: `true`). Ignored when `set` is provided — set-scoped lookups always use exact name matching. |
| `set`     | string  | No       | Set code filter (e.g. `"M11"`, `"LEA"`). When provided, only printings from this set are returned. |
| `number`  | string  | No       | Collector number filter (e.g. `"149"`). Only meaningful when `set` is also provided; ignored otherwise. |

**Example**:
```
GET /cards/lookup?name=Lightning+Bolt
GET /cards/lookup?name=Ligtnin+Bolt&fuzzy=true
GET /cards/lookup?name=Lightning+Bolt&set=M11
GET /cards/lookup?name=Lightning+Bolt&set=M11&number=149
```

### Response — Found (200)

```json
{
  "found": true,
  "cards": [
    {
      "name": "Lightning Bolt",
      "set": "M11",
      "cardNumber": "149",
      "manaCost": "{R}",
      "colorIdentity": ["R"],
      "commanderLegal": true,
      "imageRef": "e3285fd6-conf-4b9c-8c77-example"
    },
    {
      "name": "Lightning Bolt",
      "set": "LEA",
      "cardNumber": "161",
      "manaCost": "{R}",
      "colorIdentity": ["R"],
      "commanderLegal": true,
      "imageRef": "a1b2c3d4-example"
    }
  ]
}
```

### Response — Not Found (200)

A clean "not found" is a successful response, not an error.

```json
{
  "found": false,
  "name": "Nonexistent Card Name"
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

- When `fuzzy=true` (default), results are ranked by similarity score (best match first).
- When `set` is provided, the lookup switches to exact name matching regardless of the `fuzzy` flag — set-scoped queries are too narrow for fuzzy matching to be useful.
- When `set` + `number` are both provided, the response contains at most one card. If no card matches that set + number combination, `found: false` is returned.
- `number` without `set` is silently ignored — collector numbers are not unique across sets.
- The `imageRef` field contains a Scryfall UUID. The client fetches the image from the
  Scryfall image CDN using this reference. The server does not proxy card images.
- `manaCost` is `null` for lands and other cards with no mana cost — this is not an error.
