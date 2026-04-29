# Feature Specification: Swagger Web App with Authentication

**Feature Branch**: `008-swagger-ui-auth`
**Created**: 2026-03-27
**Status**: Draft
**Input**: User description: "swagger-web-app-with-auth"

## Overview

Add a web-based API documentation interface (Swagger UI) to the server, protected by authentication so that only authenticated users can access and interact with the API documentation. This enables developers and authorized stakeholders to explore, understand, and manually test the API endpoints in a secure environment.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authenticated Access to API Docs (Priority: P1)

A logged-in user visits the API documentation page and is able to browse all available API endpoints, view request/response schemas, and manually trigger test calls against the live server.

**Why this priority**: Core value of the feature — without protected access to API docs, the feature has no purpose.

**Independent Test**: Can be tested by signing in, navigating to `/docs`, and verifying that API endpoints are listed and interactive.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** they navigate to the API documentation URL, **Then** they see a fully rendered, interactive API documentation page.
2. **Given** a user is authenticated, **When** they expand an endpoint and click "Try it out", **Then** they can submit a request and see the live response.
3. **Given** a user is authenticated and viewing the docs, **When** they interact with a protected API endpoint through the docs UI, **Then** their session credentials are automatically included in the request.

---

### User Story 2 - Unauthenticated Redirect (Priority: P2)

A visitor who is not signed in attempts to access the API documentation page and is redirected to sign in before being allowed through.

**Why this priority**: Security gate — prevents unauthorized exposure of API surface area.

**Independent Test**: Can be tested by clearing session and visiting `/docs` — the browser should be redirected to `/auth/login`. API clients (curl) should receive a 401.

**Acceptance Scenarios**:

1. **Given** a browser user is not authenticated, **When** they navigate to the API documentation URL, **Then** they are redirected to `/auth/login`.
2. **Given** an API client (e.g. curl) has no auth header, **When** it requests any `/docs/*` path, **Then** it receives HTTP 401 with `{ "code": "UNAUTHORIZED" }`.
3. **Given** a user completes sign-in at `/auth/login`, **When** they are redirected back to `/docs`, **Then** they see the fully rendered Swagger UI without re-entering credentials.

---

### User Story 4 - Browser-Based Google Sign-In (Priority: P2)

A developer opens `/auth/login` in their browser and signs in with their Google account. After a successful sign-in, they are redirected to the API documentation page without any manual token handling.

**Why this priority**: Without this, there is no way for a browser user to authenticate — the previous spec assumed JWT acquisition via curl, which is not a browser-based workflow.

**Independent Test**: Open `http://localhost:3000/auth/login` in a browser → Google "Sign in with Google" button renders → sign in → redirected to `/docs` → Swagger UI loads.

**Acceptance Scenarios**:

1. **Given** a user visits `/auth/login`, **When** the page loads, **Then** a Google "Sign in with Google" button is displayed.
2. **Given** a user clicks "Sign in with Google" and completes the Google OAuth consent, **When** the sign-in succeeds, **Then** the server issues a session JWT, sets it as an `HttpOnly` cookie, and redirects the browser to `/docs`.
3. **Given** the server rejects the Google ID token (expired, wrong audience), **When** this occurs, **Then** the login page displays an error message without crashing.

---

### User Story 3 - API Explorer with Auth Token (Priority: P3)

A developer using the Swagger UI can authorize the interactive explorer with their session token so that "Try it out" requests to protected endpoints succeed.

**Why this priority**: Improves usability significantly — without this, developers cannot test protected endpoints from the docs page.

**Independent Test**: Can be tested by clicking "Authorize" in Swagger UI, entering a valid session token, and confirming that a protected endpoint call returns data rather than a 401.

**Acceptance Scenarios**:

1. **Given** a user is on the docs page, **When** they click the Authorize button and provide a valid token, **Then** subsequent "Try it out" requests include the token in the Authorization header.
2. **Given** a user has authorized the explorer and their session expires, **When** they make a "Try it out" request, **Then** they receive a clear error indicating re-authentication is required.

---

### Edge Cases

- What happens when an authenticated user's session expires while they are browsing the docs?
- What happens if the docs page is accessed directly via a bookmarked URL after signing out?
- How does the system handle a user who provides an expired or malformed token in the Swagger UI "Authorize" dialog?
- What happens if a request carries both a valid cookie and an invalid Bearer token (or vice versa)?
- What happens if the Google Identity Services JS fails to load (network offline, ad-blocker)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST serve an interactive API documentation page accessible via a dedicated URL path (e.g., `/docs`).
- **FR-002**: System MUST require authentication before granting access to the API documentation page.
- **FR-003**: Browser requests to `/docs` without a valid session cookie MUST be redirected to `/auth/login`. API client requests (no `Accept: text/html`) without a valid `Authorization` header MUST receive HTTP 401.
- **FR-004**: The documentation page MUST display all available API endpoints, including their request parameters, request bodies, and response schemas.
- **FR-005**: The documentation page MUST provide an interactive "Try it out" capability allowing users to submit real requests to the server.
- **FR-006**: The documentation interface MUST provide a way for users to supply their session token so that requests to protected endpoints succeed (via the Swagger UI "Authorize" dialog pre-wired for `bearerAuth`).
- **FR-007**: System MUST generate the API schema automatically from the server's existing route definitions, keeping documentation in sync with the actual API.
- **FR-008**: System MUST serve a browser-accessible login page at `/auth/login` that is NOT behind the documentation auth gate. This page uses the Google Identity Services JS SDK to perform a client-side Google Sign-In.
- **FR-009**: Upon successful Google Sign-In at `/auth/login`, the server MUST issue a session JWT, set it as an `HttpOnly; Secure; SameSite=Strict` cookie named `session`, and redirect the browser to `/docs`.
- **FR-010**: The documentation auth gate MUST accept a valid `session` cookie as equivalent to a valid `Authorization: Bearer` header, so that browser navigation to `/docs` succeeds after sign-in.
- **FR-011**: The server port MUST be fixed at `3000` for local development. The `PORT` env var MUST default to `3000` and must not be changed without updating the authorized redirect URI in Google Cloud Console.
- **FR-012**: A `GOOGLE_WEB_CLIENT_ID` env var MUST be added to server config and included in the `GOOGLE_CLIENT_IDS` audience list so the server accepts Google ID tokens issued to the web client.

### Key Entities

- **API Documentation Page**: The web interface that lists and describes all API endpoints; gated by authentication.
- **Session Token**: The credential issued upon sign-in that proves identity; used to authorize both the docs page and interactive test calls.
- **API Schema**: The machine-readable description of all endpoints, their inputs, outputs, and error responses; auto-derived from route definitions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authenticated user can reach the API documentation page within 2 seconds of navigating to it.
- **SC-002**: 100% of API endpoints defined on the server are visible in the documentation page with no manual maintenance required.
- **SC-003**: An unauthenticated request to the docs page is rejected or redirected 100% of the time — no anonymous access is possible.
- **SC-004**: A developer can authorize the interactive explorer and successfully call a protected endpoint in under 60 seconds from first opening the docs page.
- **SC-005**: The documentation page is fully functional across all major modern browsers (Chrome, Firefox, Safari, Edge) without any browser-specific workarounds.

## Assumptions

- The server already has a working authentication system (Google OAuth + session JWTs from spec 007).
- All existing API endpoints are defined with enough metadata for documentation to be auto-generated.
- The docs page is intended for internal developer/operator use, not end-user consumption.
- Only authenticated users need access — no public/guest tier for docs is required.
- A single authorization method (Bearer token via session JWT) is sufficient for the interactive "Try it out" explorer.
- **The server port is fixed at `3000`** — this is a hard requirement because `http://localhost:3000/auth/login` must be registered as an authorized redirect URI in Google Cloud Console. Changing the port breaks the OAuth flow.
- A dedicated **web OAuth client ID** (`GOOGLE_WEB_CLIENT_ID`) is required in addition to the existing iOS/Android client IDs — it must be added to `GOOGLE_CLIENT_IDS` so the server accepts tokens issued for the web client.

## Out of Scope

- Role-based access control within the docs (all authenticated users see the same docs).
- Exporting or downloading the API schema as a file from the UI.
- Versioned API documentation.
- Custom branding or theming of the documentation interface beyond basic configuration.
