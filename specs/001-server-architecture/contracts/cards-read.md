# Contract: Cards — Read Operations

**Updated**: 2026-03-21

---

## GET /cards

Return the full card collection as an ordered list.

### Response (200)

```json
{
  "cards": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Lightning Bolt",
      "createdAt": "2026-03-21T10:00:00.000Z",
      "updatedAt": "2026-03-21T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

Empty collection:

```json
{ "cards": [], "total": 0 }
```

Cards are returned ordered by `createdAt` ascending (oldest first).

---

## GET /cards/:id

Return a single card by its unique identifier.

### Request

| Parameter | Type   | Location | Description |
|-----------|--------|----------|-------------|
| `id`      | UUID   | path     | The card's unique identifier |

### Response — Found (200)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Lightning Bolt",
  "createdAt": "2026-03-21T10:00:00.000Z",
  "updatedAt": "2026-03-21T10:00:00.000Z"
}
```

### Response — Not Found (404)

```json
{
  "error": "NOT_FOUND",
  "message": "Card with id '550e8400-e29b-41d4-a716-446655440000' not found."
}
```

---

## Schema Validation (Principle VII)

| Endpoint | Direction | Schema constant | Mechanism |
|----------|-----------|-----------------|-----------|
| `GET /cards` | Inbound | none — no body or params | — |
| `GET /cards` | Outbound 200 | `CARD_LIST_RESPONSE_SCHEMA` | Fastify `schema.response[200]` |
| `GET /cards/:id` | Inbound params | `CARD_ID_PARAMS_SCHEMA` | Fastify `schema.params` |
| `GET /cards/:id` | Outbound 200 | `CARD_RESPONSE_SCHEMA` | Fastify `schema.response[200]` |
| `GET /cards/:id` | Outbound 404 | `ERROR_RESPONSE_SCHEMA` | Fastify `schema.response[404]` |

## Notes

- All responses are JSON (`Content-Type: application/json`). No HTML is ever returned.
- `GET /cards` returns all cards with no pagination in this release (collection is bounded
  to a personal binder — typically hundreds to low thousands of cards).
- `additionalProperties: false` on all response schemas ensures no internal fields leak.
