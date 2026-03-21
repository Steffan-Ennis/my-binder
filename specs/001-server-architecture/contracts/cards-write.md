# Contract: Cards — Write Operations

**Updated**: 2026-03-21

---

## POST /cards

Create a new card in the collection.

### Request Body

```json
{ "name": "Lightning Bolt" }
```

| Field  | Type   | Required | Constraints                          |
|--------|--------|----------|--------------------------------------|
| `name` | string | Yes      | Non-empty; maximum 255 characters    |

Additional properties are rejected (`additionalProperties: false`).

### Response — Created (201)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Lightning Bolt",
  "createdAt": "2026-03-21T10:00:00.000Z",
  "updatedAt": "2026-03-21T10:00:00.000Z"
}
```

### Response — Validation Error (400)

```json
{
  "error": "VALIDATION_ERROR",
  "message": "body must have required property 'name'"
}
```

---

## PUT /cards/:id

Replace the mutable fields of an existing card.

### Request

| Parameter | Type | Location | Description              |
|-----------|------|----------|--------------------------|
| `id`      | UUID | path     | The card's unique identifier |

### Request Body

```json
{ "name": "Sol Ring" }
```

| Field  | Type   | Required | Constraints                          |
|--------|--------|----------|--------------------------------------|
| `name` | string | Yes      | Non-empty; maximum 255 characters    |

At least one updatable field MUST be present. Additional properties are rejected.

### Response — Updated (200)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Sol Ring",
  "createdAt": "2026-03-21T10:00:00.000Z",
  "updatedAt": "2026-03-21T10:05:00.000Z"
}
```

`updatedAt` is set by the server on every successful write.

### Response — Not Found (404)

```json
{
  "error": "NOT_FOUND",
  "message": "Card with id '550e8400-e29b-41d4-a716-446655440000' not found."
}
```

### Response — Validation Error (400)

```json
{
  "error": "VALIDATION_ERROR",
  "message": "body must have required property 'name'"
}
```

---

## DELETE /cards/:id

Permanently remove a card from the collection.

### Request

| Parameter | Type | Location | Description              |
|-----------|------|----------|--------------------------|
| `id`      | UUID | path     | The card's unique identifier |

### Response — Deleted (204)

No response body. HTTP 204 No Content.

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
| `POST /cards` | Inbound body | `CREATE_CARD_BODY_SCHEMA` | Fastify `schema.body` |
| `POST /cards` | Outbound 201 | `CARD_RESPONSE_SCHEMA` | Fastify `schema.response[201]` |
| `POST /cards` | Outbound 400 | `ERROR_RESPONSE_SCHEMA` | Fastify `schema.response[400]` |
| `PUT /cards/:id` | Inbound params | `CARD_ID_PARAMS_SCHEMA` | Fastify `schema.params` |
| `PUT /cards/:id` | Inbound body | `UPDATE_CARD_BODY_SCHEMA` | Fastify `schema.body` |
| `PUT /cards/:id` | Outbound 200 | `CARD_RESPONSE_SCHEMA` | Fastify `schema.response[200]` |
| `PUT /cards/:id` | Outbound 400/404 | `ERROR_RESPONSE_SCHEMA` | Fastify `schema.response[400/404]` |
| `DELETE /cards/:id` | Inbound params | `CARD_ID_PARAMS_SCHEMA` | Fastify `schema.params` |
| `DELETE /cards/:id` | Outbound 404 | `ERROR_RESPONSE_SCHEMA` | Fastify `schema.response[404]` |

## Notes

- `id`, `createdAt`, and `updatedAt` are server-managed and MUST NOT be supplied by the
  client. `additionalProperties: false` on the inbound schemas ensures they are rejected
  with 400 automatically if present.
- All responses are JSON (`Content-Type: application/json`) except 204.
- Delete is permanent — there is no soft-delete or recycle bin in this release.
