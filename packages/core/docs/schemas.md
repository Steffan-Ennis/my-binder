# Schemas

All JSON Schema constants used for Fastify runtime validation and serialisation. These are the
authoritative definitions — imported directly into route files, never redefined inline.

The schemas serve two distinct roles in Fastify:

- **Inbound** (`schema.body`, `schema.params`): Fastify runs Ajv validation before the handler
  executes. A request that fails validation is rejected with HTTP 400 before it reaches any
  service or repository code.
- **Outbound** (`schema.response`): Fastify serialises the response through the schema,
  stripping undeclared properties and fast-serialising known ones.

## Card schemas

### `CARD_RESPONSE_SCHEMA`

Shape of a single card in any response body.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "name", "createdAt", "updatedAt"],
  "properties": {
    "id":        { "type": "string", "format": "uuid" },
    "name":      { "type": "string", "minLength": 1, "maxLength": 255 },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}
```

### `CARD_LIST_RESPONSE_SCHEMA`

Shape of the card collection response (`GET /cards`).

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["cards", "total"],
  "properties": {
    "cards": { "type": "array", "items": "<CARD_RESPONSE_SCHEMA>" },
    "total": { "type": "integer", "minimum": 0 }
  }
}
```

### `CREATE_CARD_BODY_SCHEMA`

Validates `POST /cards` request bodies.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["name"],
  "properties": {
    "name": { "type": "string", "minLength": 1, "maxLength": 255 }
  }
}
```

### `UPDATE_CARD_BODY_SCHEMA`

Validates `PUT /cards/:id` request bodies. Same shape as create.

### `CARD_ID_PARAMS_SCHEMA`

Validates the `:id` path parameter as a UUID string.

```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": { "type": "string", "format": "uuid" }
  }
}
```

## Health schemas

### `HEALTH_RESPONSE_SCHEMA`

Shape of the `GET /health` response.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["status", "database"],
  "properties": {
    "status":   { "type": "string", "enum": ["ok", "degraded"] },
    "database": { "type": "string", "enum": ["connected", "unavailable"] }
  }
}
```

## Error schema

### `ERROR_RESPONSE_SCHEMA`

Uniform shape for all error responses.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["error", "message"],
  "properties": {
    "error":   { "type": "string" },
    "message": { "type": "string" }
  }
}
```

## Rules

- Schemas are `as const` — TypeScript infers the narrowest possible type, preventing
  accidental mutation.
- `additionalProperties: false` is set on all response schemas to prevent undeclared fields
  leaking to clients.
- Any change to a schema MUST be reflected in the corresponding `data-model.md` in the
  feature spec directory.
