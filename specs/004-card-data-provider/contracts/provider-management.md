# Contract: Provider Management

**Layer**: API Server → Admin/Config caller
**Updated**: 2026-03-21

---

## GET /provider

Return information about the currently active card data provider.

### Response (200)

```json
{
  "name": "mtgjson",
  "active": true,
  "reachable": true
}
```

---

## PUT /provider

Switch the active card data provider. The new provider is validated for reachability before
being activated. If validation fails, the current provider remains active.

### Request Body

```json
{
  "name": "mtgjson"
}
```

| Field  | Type   | Required | Description |
|--------|--------|----------|-------------|
| `name` | string | Yes      | Identifier of the provider to activate |

### Response — Switched Successfully (200)

```json
{
  "name": "mtgjson",
  "active": true,
  "reachable": true
}
```

### Response — Provider Not Registered (404)

```json
{
  "error": "PROVIDER_NOT_FOUND",
  "message": "No provider registered with name \"unknown-provider\"."
}
```

### Response — Provider Unreachable (422)

```json
{
  "error": "PROVIDER_UNAVAILABLE",
  "message": "Provider \"mtgjson\" failed reachability check. Active provider unchanged."
}
```

---

## Notes

- Provider switching is a server-side configuration operation — it affects all users.
- The active provider name is also settable via the `CARD_PROVIDER` environment variable
  at startup. The `PUT /provider` endpoint allows runtime switching without a restart.
- In this release, only `"mtgjson"` is a valid registered provider name.
