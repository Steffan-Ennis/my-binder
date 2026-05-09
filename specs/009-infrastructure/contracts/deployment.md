# Deployment Contract: 009-infrastructure

**Date**: 2026-03-29 (revised -- single DuckDB on EFS with SDK-managed parquet cache)

## Manual Deployment Interface

### Infrastructure Provisioning (One-Time)

```bash
# From the packages/infrastructure workspace
cd packages/infrastructure
pnpm install         # or pnpm install from repo root
npx cdk bootstrap    # First time only -- bootstraps CDK in the AWS account
npx cdk deploy       # Create/update all AWS resources
```

**Pre-requisites for first deploy**:
1. AWS CLI configured with appropriate IAM permissions
2. Docker installed and running (CDK builds the container image during deploy)
3. Create secrets in AWS Secrets Manager:
   - `my-binder/SESSION_JWT_SECRET`
   - `my-binder/GOOGLE_CLIENT_IDS`
   - `my-binder/GOOGLE_WEB_CLIENT_ID`

### Deploy New Version

```bash
# From the packages/infrastructure workspace
cd packages/infrastructure
npx cdk deploy
```

CDK's `DockerImageFunction` builds the container image from the Dockerfile, pushes it to ECR, and updates the Lambda function automatically. No manual Docker build/push/tag steps needed.

### First Deployment: Card Data Bootstrap

On the first invocation after deployment, the Lambda function will:
1. Create the DuckDB database file on EFS (empty)
2. Run migrations (users, card_import_metadata tables)
3. MTGJSON SDK downloads parquet files from the MTGJSON API to EFS cache (~28MB, 5-30s)
4. Card importer reads parquet and populates DuckDB card tables

**Expected first cold start**: 30-60 seconds. Subsequent cold starts (parquet cached, DB populated): <15 seconds.

### Verify

```bash
# Get the API Gateway URL from stack outputs
aws cloudformation describe-stacks --stack-name MyBinderStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text

# Hit the health endpoint (HTTPS)
curl https://<api-gateway-url>/health
# Expected: {"status":"ok","database":"connected"}

# Verify card data was imported
curl https://<api-gateway-url>/provider/cards/search?name=Lightning+Bolt
# Expected: JSON response with card data
```

## Environment Variables Contract

### Application Config (Lambda environment)

| Variable          | Required | Lambda Default             | Local Default            | Description                                    |
|-------------------|----------|----------------------------|--------------------------|------------------------------------------------|
| PORT              | No       | 3000                       | 3000                     | Server listen port (used by Fastify init)      |
| DB_PATH           | No       | /mnt/data/db/binder.duckdb | ./binder.duckdb          | DuckDB file path                               |
| MTGJSON_CACHE_DIR | No       | /mnt/data/mtgjson-cache    | ./data/mtgjson-cache     | MTGJSON SDK parquet cache directory             |
| NODE_ENV          | No       | production                 | development              | Environment mode                               |
| CARD_PROVIDER     | No       | mtgjson                    | mtgjson                  | Card data provider name                        |
| EFS_PATH          | No       | /mnt/data                  | (not used locally)       | EFS mount path (used for lock file directory)  |

### Secrets (from AWS Secrets Manager)

| Secret               | Required | Description                         |
|----------------------|----------|-------------------------------------|
| SESSION_JWT_SECRET   | Yes      | HS256 signing key (min 32 chars)    |
| GOOGLE_CLIENT_IDS    | Yes      | Comma-separated OAuth client IDs    |
| GOOGLE_WEB_CLIENT_ID | Yes      | Web-specific Google OAuth client ID |

## Health Check Contract

| Property        | Value       |
|-----------------|-------------|
| Path            | GET /health |
| Success         | HTTP 200    |
| Failure         | HTTP 503    |

Note: No ALB-style health check polling. Lambda health is managed by AWS Lambda service. The `/health` endpoint is used for manual verification and application-level readiness.

## Scale-to-Zero Behavior

| Event                     | Mechanism                        | Expected Latency         |
|---------------------------|----------------------------------|--------------------------|
| No traffic                | Lambda naturally idle (no cost)  | Immediate                |
| First request (no data)   | Lambda cold start + SDK download + import | 30-60s          |
| First request (data cached) | Lambda cold start + timestamp check | 5-15s               |
| Warm request              | Reuse existing execution context | <1s overhead             |

No CloudWatch alarms, SNS topics, or scale-up Lambda functions needed. Lambda's pay-per-invocation model provides native scale-to-zero.

## API Gateway Configuration

| Property              | Value                                              |
|-----------------------|----------------------------------------------------|
| Type                  | HTTP API (v2)                                      |
| URL format            | `https://<id>.execute-api.<region>.amazonaws.com`  |
| Route                 | `$default` (catch-all to Lambda)                   |
| Payload format        | v2.0                                               |
| Timeout               | 29 seconds                                         |
| TLS                   | AWS-managed, TLS 1.2 minimum                      |
| CORS                  | Configured via API Gateway (Authorization, Content-Type headers) |

## Local Development

No AWS resources required. The same server code runs locally:

```bash
# Standard local development (unchanged from before this feature)
pnpm turbo dev
```

- `DB_PATH` defaults to `./binder.duckdb` (local filesystem)
- `MTGJSON_CACHE_DIR` defaults to `./data/mtgjson-cache` (local filesystem)
- MTGJSON SDK downloads parquet on first run, caches locally
- Card import into DuckDB happens on first startup
- No lock file contention (single process)
- No EFS, no VPC, no Lambda adapter
