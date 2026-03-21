# Contract: Health Check

**Updated**: 2026-03-21

---

## GET /health

Returns the operational status of the server and its database connection. Used by container
orchestration tools to determine readiness.

### Response — Healthy (200)

```json
{
  "status": "ok",
  "database": "connected"
}
```

### Response — Database Unavailable (503)

```json
{
  "status": "degraded",
  "database": "unavailable"
}
```

HTTP 503 signals to orchestration tools (Docker Compose healthcheck, Kubernetes liveness
probe) that the server is not ready to serve requests.

---

## Schema Validation (Principle VII)

| Direction | Schema constant | Mechanism |
|-----------|-----------------|-----------|
| Inbound params | none — no parameters | — |
| Outbound 200 | `HEALTH_RESPONSE_SCHEMA` | Fastify `schema.response[200]` |
| Outbound 503 | `HEALTH_RESPONSE_SCHEMA` | Fastify `schema.response[503]` |

## Notes

- The health check actively pings the database on every request — it does not cache the
  result. This ensures the orchestration tool always sees live status.
- The health check endpoint is unauthenticated and publicly reachable. It MUST NOT expose
  sensitive information (no connection strings, no stack traces).
- `additionalProperties: false` on the response schema ensures internal fields (e.g., stack
  traces, db paths) can never leak into the response body.
