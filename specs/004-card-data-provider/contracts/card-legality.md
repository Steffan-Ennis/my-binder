# Contract: Commander Legality Check

**Layer**: API Server → Client (mobile app or internal caller)
**Updated**: 2026-03-21

---

## GET /cards/legality

Check whether a card is legal in Commander format, optionally scoped to a specific
Commander's colour identity.

### Request

| Parameter          | Type   | Required | Description |
|-------------------|--------|----------|-------------|
| `name`             | string | Yes      | Exact card name to check |
| `commander_colors` | string | No       | Comma-separated colour codes of the deck's Commander (e.g., `"W,U,B"`) |

**Example**:
```
GET /cards/legality?name=Sol+Ring
GET /cards/legality?name=Counterspell&commander_colors=R,G
GET /cards/legality?name=Black+Lotus
```

### Response — Legal (200)

```json
{
  "cardName": "Sol Ring",
  "legal": true,
  "reason": null,
  "colorIdentity": []
}
```

### Response — Banned (200)

```json
{
  "cardName": "Black Lotus",
  "legal": false,
  "reason": "Banned in Commander",
  "colorIdentity": []
}
```

### Response — Colour Identity Conflict (200)

```json
{
  "cardName": "Counterspell",
  "legal": false,
  "reason": "Colour identity conflict",
  "colorIdentity": ["U"]
}
```

The `colorIdentity` field always reflects the **card's** colour identity. The client may use
this to display a clear explanation alongside the `reason`.

### Response — Card Not Found (404)

```json
{
  "error": "CARD_NOT_FOUND",
  "message": "No card found with name \"Nonexistent Card\"."
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

## Legality Logic

1. Fetch the card's atomic data (name-level, not printing-specific).
2. Check `legalities.commander`:
   - If `"Banned"` → `legal: false, reason: "Banned in Commander"`
3. If `commander_colors` is provided, check colour identity:
   - If the card's `colorIdentity` contains any colour NOT in `commander_colors`
     → `legal: false, reason: "Colour identity conflict"`
4. Otherwise → `legal: true, reason: null`

## Notes

- Legality is evaluated at the card-name level (atomic), not per-printing. All printings of
  the same card share the same legality status.
- Colourless cards (`colorIdentity: []`) are always legal in any Commander colour identity.
- `commander_colors` is optional. Omitting it checks only the Commander banned list, not
  colour identity.
