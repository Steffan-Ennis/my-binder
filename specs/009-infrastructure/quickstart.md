# Quickstart: 009-infrastructure

**Date**: 2026-03-29 (revised -- single DuckDB on EFS with SDK-managed parquet cache)

## Scenario 1: Build and Test Lambda Handler Locally

**Goal**: Verify the Fastify app works when wrapped with the Lambda adapter.

### Steps

1. Build the container image from the repo root:
   ```bash
   docker build -t my-binder-server:latest -f apps/server/Dockerfile .
   ```

2. Run the container locally (simulating Lambda environment):
   ```bash
   docker run -p 9000:8080 \
     -e NODE_ENV=development \
     -e DB_PATH=/tmp/binder.duckdb \
     -e MTGJSON_CACHE_DIR=/tmp/mtgjson-cache \
     -e SESSION_JWT_SECRET=dev-secret-at-least-32-characters-long \
     -e GOOGLE_CLIENT_IDS=test-client-id \
     -e GOOGLE_WEB_CLIENT_ID=test-client-id \
     my-binder-server:latest
   ```

3. Invoke the Lambda handler with a simulated API Gateway event:
   ```bash
   curl -X POST http://localhost:9000/2015-03-31/functions/function/invocations \
     -d '{"version":"2.0","requestContext":{"http":{"method":"GET","path":"/health"}},"rawPath":"/health","rawQueryString":"","headers":{}}'
   ```

4. Verify the response includes `{"status":"ok","database":"connected"}`.

### Success Criteria
- Container builds without errors
- Lambda handler responds to simulated events
- Health check returns 200 with expected body
- Card data import completes (SDK downloads parquet, imports into DuckDB)

---

## Scenario 2: Deploy Infrastructure with CDK

**Goal**: Provision all AWS resources from scratch.

### Prerequisites
- AWS CLI configured with appropriate credentials
- Docker installed and running
- Node.js 22 installed
- Secrets created in AWS Secrets Manager:
  - `my-binder/SESSION_JWT_SECRET`
  - `my-binder/GOOGLE_CLIENT_IDS`
  - `my-binder/GOOGLE_WEB_CLIENT_ID`

### Steps

1. Install CDK dependencies (or run `pnpm install` from repo root):
   ```bash
   cd packages/infrastructure && pnpm install
   ```

2. Bootstrap CDK (first time only):
   ```bash
   npx cdk bootstrap
   ```

3. Deploy the stack:
   ```bash
   npx cdk deploy
   ```

4. Note the API Gateway URL from stack outputs.

### Success Criteria
- `cdk deploy` completes without errors
- Stack outputs include API Gateway URL and ECR repository URI
- Lambda function, API Gateway, EFS, VPC all created
- No secrets in CloudFormation template or stack parameters

---

## Scenario 3: First Deployment End-to-End

**Goal**: Deploy the server to AWS and verify card data bootstraps from MTGJSON API.

### Steps

1. Deploy (CDK builds, pushes, and updates Lambda automatically):
   ```bash
   cd packages/infrastructure
   npx cdk deploy
   ```

2. Trigger first cold start (allow extra time for SDK download + import):
   ```bash
   curl https://<api-gateway-url>/health
   # First request may take 30-60s (parquet download + card import)
   # Expected: {"status":"ok","database":"connected"}
   ```

3. Verify card data was imported:
   ```bash
   curl https://<api-gateway-url>/provider/cards/search?name=Lightning+Bolt
   # Expected: JSON response with card data
   ```

4. Verify a second request is fast (warm invocation):
   ```bash
   time curl https://<api-gateway-url>/provider/cards/search?name=Lightning+Bolt
   # Expected: <1s response time
   ```

### Success Criteria
- Server accessible via HTTPS at API Gateway URL
- Health check returns 200
- Card search returns results (card data imported from parquet)
- Full first cold start completes within 60 seconds
- Warm requests respond in under 1 second

---

## Scenario 4: Verify Cold Start with Cached Data

**Goal**: Confirm subsequent cold starts reuse cached parquet and DuckDB data on EFS.

### Steps

1. Force a cold start by updating the Lambda configuration:
   ```bash
   aws lambda update-function-configuration \
     --function-name my-binder-server \
     --environment "Variables={FORCE_COLD_START=$(date +%s)}"
   ```

2. Time the cold start:
   ```bash
   time curl https://<api-gateway-url>/health
   # Expected: <15s (no parquet download, no card import -- data already current)
   ```

3. Verify card data is still available:
   ```bash
   curl https://<api-gateway-url>/provider/cards/search?name=Lightning+Bolt
   ```

### Success Criteria
- Cold start with cached data completes within 15 seconds
- Card data available immediately (no rebuild)
- Timestamp check correctly identifies data as current

---

## Scenario 5: Local Development (No AWS)

**Goal**: Confirm the server runs locally with the same card import logic, no AWS resources.

### Steps

1. Start the server locally:
   ```bash
   pnpm turbo dev
   ```

2. First startup downloads parquet via SDK and imports into DuckDB:
   ```bash
   curl http://localhost:3000/health
   # Expected: {"status":"ok","database":"connected"}
   ```

3. Verify card data:
   ```bash
   curl http://localhost:3000/provider/cards/search?name=Lightning+Bolt
   ```

4. Restart server and confirm no re-download or re-import:
   ```bash
   # Stop and restart
   pnpm turbo dev
   curl http://localhost:3000/provider/cards/search?name=Lightning+Bolt
   # Expected: fast response, no SDK download, no card import
   ```

### Success Criteria
- Server starts locally without any AWS resources
- SDK downloads parquet to `./data/mtgjson-cache/` on first run
- Card data imported into `./binder.duckdb`
- Subsequent startups skip download and import (timestamps current)
- Same code path as Lambda (no conditional branching)
