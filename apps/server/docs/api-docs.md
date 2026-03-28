# API Documentation — Swagger UI

The server exposes interactive API documentation at `/docs` via Swagger UI, protected by the session JWT auth system.

## Prerequisites

- `PORT=3000` — **must not be changed**; `http://localhost:3000` must be registered as an authorized JavaScript origin for your Google OAuth web client in Google Cloud Console.
- `GOOGLE_WEB_CLIENT_ID` — your web OAuth client ID (used by the `/auth/login` page).
- `GOOGLE_CLIENT_IDS` — comma-separated list including the web client ID above plus iOS/Android client IDs.
- `SESSION_JWT_SECRET` — min 32-character secret for signing session JWTs.

## Browser sign-in flow

1. Navigate to `http://localhost:3000/auth/login`.
2. Click **Sign in with Google** and complete the consent screen.
3. The browser is redirected to `http://localhost:3000/docs` with a `session` cookie set.
4. Swagger UI loads, listing all API endpoints.

If you navigate to `/docs` without a session cookie, the browser is automatically redirected to `/auth/login`.

## Cookie mechanism

`POST /auth/google` sets an `HttpOnly; Secure; SameSite=Strict` cookie named `session` whose value is the session JWT. This cookie is sent automatically by the browser on every subsequent request to `/docs/*`, so no manual token handling is required for browser navigation.

## Using the Authorize dialog (Try it out)

Swagger UI's "Try it out" feature sends XHR requests — these require an explicit `Authorization: Bearer` header, not a cookie. To authorize:

1. Complete the browser sign-in flow above.
2. Copy the `session` cookie value from browser DevTools (Application → Cookies → `session`).
3. Click the **Authorize** button (lock icon, top-right of Swagger UI).
4. Paste the JWT into the **bearerAuth** field and click **Authorize**.
5. All "Try it out" calls to protected endpoints will now include `Authorization: Bearer <jwt>`.

## API client access

To access `/docs/json` or `/docs/yaml` from a script:

```bash
# Obtain a JWT first via POST /auth/google (mobile/server flow)
curl -s http://localhost:3000/docs/json \
  -H 'Authorization: Bearer <your-session-jwt>' | jq .info
```

## Response shapes

### Unauthenticated API client (no Bearer token, no cookie)

**401 Unauthorized**
```json
{ "code": "UNAUTHORIZED", "message": "Authentication required to access API documentation." }
```

### Unauthenticated browser request (Accept: text/html, no cookie)

**302 Found** → redirects to `/auth/login`

## Endpoints

| Route | Auth | Description |
|-------|------|-------------|
| `GET /auth/login` | none | Browser Google Sign-In page (GIS SDK) |
| `GET /docs` | required | Redirects to Swagger UI index |
| `GET /docs/json` | required | OpenAPI 3.0 JSON document |
| `GET /docs/yaml` | required | OpenAPI 3.0 YAML document |
