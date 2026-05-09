# Quickstart: Migrate User and Collection Storage to PostgreSQL

**Branch**: `011-postgres-migration` | **Date**: 2026-04-03

---

## Prerequisites

- AWS CDK stack deployed (RDS cluster already provisioned by spec 010)
- `psql` client installed locally
- `pnpm install` run at repo root
- `.env` file in `apps/server/` with local dev or test PG connection details

---

## Local Development Setup

### 1. Get the RDS endpoint

After CDK deploy, retrieve the cluster endpoint:

```bash
aws cloudformation describe-stacks --stack-name MyBinderStack \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" \
  --output text
```

### 2. Get the database password

```bash
aws secretsmanager get-secret-value \
  --secret-id my-binder/rds-credentials \
  --query SecretString --output text | jq -r '.password'
```

### 3. Connect from local machine

```bash
psql "host=<cluster-endpoint> port=5432 dbname=my_binder user=my_binder_rds sslmode=require"
```

The RDS is placed in a public subnet with port 5432 open to `0.0.0.0/0` (FR-009). Connect directly — no bastion or tunnel needed.

---

## Running Migrations

### Deploy workflow

Migrations must be applied **before** deploying a new Lambda image. The sequence is:

1. Run migrations against the live database (see CLI commands below)
2. Build and push the new container image
3. Update the Lambda function

### CLI commands

```bash
cd apps/server

# Generate a migration after changing entity files:
npx typeorm migration:generate src/db/migrations/<MigrationName> \
  -d src/db/datasource-cli.ts

# Apply pending migrations against local/dev database:
npx typeorm migration:run -d src/db/datasource-cli.ts

# Revert the last migration:
npx typeorm migration:revert -d src/db/datasource-cli.ts
```

The CLI datasource (`src/db/datasource-cli.ts`) reads connection details from environment variables (same as the runtime config). Set these in `.env` before running CLI commands.

---

## End-to-End Scenarios

### Scenario 1 — Allowed user signs in

1. Send `POST /auth/google` with a valid Google ID token for `steffanennis87@gmail.com`.
2. Expect `HTTP 200` with `Set-Cookie: session=...` and a user object.
3. Send `GET /auth/me` with the session cookie.
4. Expect `HTTP 200` with `{ "user": { "email": "steffanennis87@gmail.com", ... } }`.
5. Verify via psql: `SELECT * FROM users WHERE email = 'steffanennis87@gmail.com';`

**Success criteria**: User record exists in PostgreSQL; session JWT valid; `/auth/me` returns correct profile.

---

### Scenario 2 — Blocked email rejected

1. Send `POST /auth/google` with a valid Google ID token for an email NOT in `allowed_users`.
2. Expect `HTTP 403` with `{ "error": "ACCESS_DENIED", ... }`.
3. Verify via psql: `SELECT * FROM users WHERE email = '<blocked-email>';` → zero rows.

**Success criteria**: No user record created; no session issued; 403 returned.

---

### Scenario 3 — Card collection CRUD

Prerequisites: authenticated session for `steffanennis87@gmail.com`.

1. `POST /cards` with `{ "name": "Black Lotus" }` → expect `HTTP 201` with card object.
2. `GET /cards` → expect array containing the new card.
3. `PUT /cards/:id` with `{ "name": "Mox Ruby" }` → expect `HTTP 200` with updated card.
4. `DELETE /cards/:id` → expect `HTTP 204`.
5. `GET /cards` → expect empty array.

**Success criteria**: All CRUD operations succeed; response shapes match pre-migration contract.

---

### Scenario 4 — Concurrent sign-in deduplication

1. Send two simultaneous `POST /auth/google` requests for the same Google account.
2. Expect both return `HTTP 200`.
3. Verify via psql: `SELECT COUNT(*) FROM users WHERE email = '...';` → exactly 1 row.

**Success criteria**: No duplicate user record; no 500 error from unique constraint violation.

---

### Scenario 5 — Returning user profile update

1. Sign in — verify initial profile stored.
2. Modify the test Google account's display name (requires Google test account control).
3. Sign in again with fresh token.
4. Verify via psql that `display_name` was updated.

**Success criteria**: Upsert updates existing record; `updated_at` timestamp advances.

---

## Adding Emails to the Allowlist

```sql
-- Connect via psql, then:
INSERT INTO allowed_users (email) VALUES ('newuser@example.com');
```

No redeployment needed. The check runs at sign-in time against the live table.

---

## Verifying Migration History

```sql
-- Check which migrations have been applied:
SELECT * FROM migrations ORDER BY timestamp DESC;
```

TypeORM records each applied migration in the `migrations` table automatically.
