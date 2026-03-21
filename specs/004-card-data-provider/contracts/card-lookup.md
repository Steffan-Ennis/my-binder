# Contract: Card Lookup

**Layer**: API Server → Client (mobile app or internal caller)
**Updated**: 2026-03-21

---

## GET /cards/lookup

Look up a card by name. Supports exact and fuzzy matching. Returns all printings when
multiple exist.

### Request

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `name`    | string | Yes      | Full, partial, or approximate card name |
| `fuzzy`   | boolean | No      | If `true`, applies fuzzy/Jaro-Winkler matching (default: `true`) |

**Example**:
```
GET /cards/lookup?name=Lightning+Bolt
GET /cards/lookup?name=Ligtnin+Bolt&fuzzy=true
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
- The `imageRef` field contains a Scryfall UUID. The client fetches the image from the
  Scryfall image CDN using this reference. The server does not proxy card images.
- `manaCost` is `null` for lands and other cards with no mana cost — this is not an error.
