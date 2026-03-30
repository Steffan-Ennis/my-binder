# Deployment Guide: my-binder Server

This guide covers deploying the server to AWS Lambda + API Gateway using CDK.
See also: `specs/009-infrastructure/contracts/deployment.md` for the full contract.

## Prerequisites

- **AWS CLI** configured with IAM credentials that can create Lambda, API Gateway, EFS, VPC, ECR, and Secrets Manager resources
- **Docker** installed and running (CDK builds the container image during deploy)
- **Node.js 22** and **pnpm** installed

## One-Time Setup

### 1. Create secrets in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name my-binder/SESSION_JWT_SECRET \
  --secret-string "$(openssl rand -base64 48)"

aws secretsmanager create-secret \
  --name my-binder/GOOGLE_CLIENT_IDS \
  --secret-string "your-ios-client-id,your-android-client-id,your-web-client-id"

aws secretsmanager create-secret \
  --name my-binder/GOOGLE_WEB_CLIENT_ID \
  --secret-string "your-web-client-id"
```

### 2. Bootstrap CDK (first time only)

```bash
cd packages/infrastructure
pnpm install
npx cdk bootstrap
```

## Deploy

```bash
cd packages/infrastructure
npx cdk deploy
```

CDK builds the Docker image from `apps/server/Dockerfile`, pushes it to ECR, and deploys/updates all AWS resources in one command. No manual Docker build or push needed.

## Verify

```bash
# Get the API URL from CloudFormation outputs
API_URL=$(aws cloudformation describe-stacks \
  --stack-name MyBinderStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Health check (first request may take 30-60s on fresh deployment)
curl "$API_URL/health"
# Expected: {"status":"ok","database":"connected"}

# Card search
curl "$API_URL/provider/cards/search?name=Lightning+Bolt"
# Expected: JSON array of card records
```

## Update

Same as deploy — re-run `npx cdk deploy` from `packages/infrastructure`.

## Cold Start Behaviour

On the first cold start, the MTGJSON SDK downloads its parquet files (~200 MB) into the
EFS-backed `mtgjson-cache` subdirectory. Subsequent cold starts read directly from the
existing EFS cache — no re-download occurs.

| Scenario | Expected latency |
|----------|-----------------|
| First ever cold start (no EFS cache) | 30–60 s (parquet download) |
| Cold start with EFS cache present | 5–15 s |
| Warm invocation | < 1 s |

## Cost

~$1.50–$2.00/month at rest:
- EFS storage: ~$0.30/GB/month (~$0.04/month for ~128 MB of data)
- Secrets Manager: $0.40/secret × 3 = $1.20/month
- Lambda + API Gateway: $0 when idle (pay-per-invocation)

## Tear Down

```bash
cd packages/infrastructure
npx cdk destroy
```

Note: EFS filesystem and ECR repository use `RemovalPolicy.RETAIN` — they are NOT deleted on `cdk destroy`. Delete them manually if needed.
