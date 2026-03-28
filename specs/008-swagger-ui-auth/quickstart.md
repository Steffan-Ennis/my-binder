# Quickstart: Swagger UI with Authentication

**Feature**: 008-swagger-ui-auth
**Date**: 2026-03-28 (revised)

## Prerequisites

- Server running locally (`pnpm turbo dev` or `pnpm --filter @my-binder/server dev`)
- `SESSION_JWT_SECRET`, `GOOGLE_CLIENT_IDS`, and `GOOGLE_WEB_CLIENT_ID` env vars set (see `apps/server/.env.example`)
- `PORT=3000` — **this must not be changed** (fixed for Google OAuth)
- `http://localhost:3000` registered as an authorized JavaScript origin in Google Cloud Console for your web client ID

---

## Scenario 1: Browser-based sign-in (primary flow)

**Goal**: Sign in via Google in the browser and land on Swagger UI.

1. Start the server:
   ```bash
   pnpm --filter @my-binder/server dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/auth/login
   ```

3. Click **Sign in with Google** and complete the Google OAuth consent.

4. **Expected result**: Browser is redirected to `http://localhost:3000/docs` and Swagger UI loads, listing all API endpoints (health, cards, provider, auth).

---

## Scenario 2: Unauthenticated browser access is redirected

**Goal**: Verify that an unauthenticated browser navigation to `/docs` is redirected to sign-in.

1. Clear your browser cookies for `localhost`.
2. Navigate directly to `http://localhost:3000/docs`.

**Expected result**: Browser is redirected to `http://localhost:3000/auth/login`.

---

## Scenario 3: Unauthenticated API client access is blocked

**Goal**: Verify the docs are not accessible to API clients without credentials.

```bash
curl -i http://localhost:3000/docs/json
```

**Expected result**: HTTP 401 with body `{"code":"UNAUTHORIZED","message":"Authentication required to access API documentation."}`.

---

## Scenario 4: Authorize Swagger UI and call a protected endpoint

**Goal**: Use "Try it out" to call a protected endpoint from the browser.

1. Complete Scenario 1 to land on `/docs`.
2. Obtain your session JWT for the Authorize dialog. You can copy it from the `session` cookie in browser DevTools (Application → Cookies → `session`).
3. Click the **Authorize** button (lock icon, top-right).
4. Paste your session JWT into the **bearerAuth** field and click **Authorize**.
5. Find `GET /auth/me` in the endpoint list, expand it, click **Try it out**, then **Execute**.

**Expected result**: Response body shows `{"kind":"authenticated","user":{...}}` with HTTP 200.

---

## Scenario 5: Inspect the raw OpenAPI schema (API client)

**Goal**: Retrieve the machine-readable OpenAPI document.

```bash
# First obtain a JWT via POST /auth/google (mobile/server-side flow) or copy from cookie
curl -s http://localhost:3000/docs/json \
  -H 'Authorization: Bearer <your-session-jwt>' | jq .info
```

**Expected result**: JSON object containing `{ "title": "my-binder API", "version": "..." }`.

---

## Success Criteria Verification

| Criterion | How to verify |
|-----------|--------------|
| SC-001: Docs load < 2s | Open `/docs` with browser DevTools Network tab — Time to First Byte < 2000ms |
| SC-002: 100% of endpoints visible | Count endpoints in Swagger UI vs routes registered in `index.ts` |
| SC-003: 100% unauthenticated blocked | `curl http://localhost:3000/docs` without auth → 401; browser navigation without cookie → redirect to `/auth/login` |
| SC-004: Sign in and call protected endpoint in < 60s | Follow Scenarios 1 + 4; measure total time from opening `/auth/login` to seeing `200 OK` on `/auth/me` |
| SC-005: Works in major browsers | Open `/auth/login` and `/docs` in Chrome, Firefox, Safari, Edge |
