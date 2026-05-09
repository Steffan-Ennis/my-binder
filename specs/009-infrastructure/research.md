# Research: 009-infrastructure

**Date**: 2026-03-29 (revised -- single DuckDB on EFS with SDK-managed parquet cache)

## R1: Lambda Adapter for Fastify

**Decision**: Use `@fastify/aws-lambda` (v6.x)

**Rationale**: Official Fastify adapter, maintained under the `fastify` GitHub org. Uses Fastify's built-in `inject()` method (no internal sockets), benchmarks at ~56,500 ops/sec. Supports API Gateway HTTP API payload format v2.0 natively. Tiny footprint (3.9 kB minified).

**Alternatives considered**:
- `aws-lambda-fastify` (v2.x) -- deprecated, redirects to `@fastify/aws-lambda`
- `serverless-http` -- generic adapter, slower (~45,900 ops/sec), no Fastify-specific optimizations
- `aws-serverless-fastify` -- slower (~17,900 ops/sec)

## R2: Deployment Packaging -- Container Image

**Decision**: Container image deployed via CDK `DockerImageFunction` construct. Built with multi-stage Dockerfile using `public.ecr.aws/lambda/nodejs:22` as the base.

**Rationale**: The combination of pnpm symlinks, native DuckDB bindings (`@duckdb/node-bindings-linux-x64`), and the need for EFS compatibility makes zip packaging fragile. Container images provide:
- Full control over the build environment (ensures native binary compatibility with Amazon Linux 2023)
- 10 GB size limit (vs 250 MB for zip)
- Multi-stage Docker build naturally handles pnpm monorepo via `pnpm deploy --prod`
- Building inside Lambda's base image guarantees glibc compatibility for DuckDB native bindings

**Alternatives considered**:
- Zip archive -- 250 MB limit is tight; pnpm symlinks require `pnpm deploy` to flatten; native dep cross-compilation is fragile
- Lambda Layer for DuckDB -- adds deployment complexity and version management overhead

**Trade-off**: Container images have slightly slower cold starts (~100-200ms) than zip. Acceptable for a personal project.

## R3: DuckDB Storage Strategy (Revised)

**Decision**: Single file-based DuckDB on EFS containing both user data and imported card data. Card tables are rebuilt from parquet when source data changes.

**Rationale**: Simplifies the architecture — one database, one connection, one set of migrations. Card data is imported into DuckDB tables (not queried directly from parquet via the SDK), enabling joins between card and user data and consistent query patterns.

**Key constraints**:
1. **DuckDB single-writer limitation**: Only one process can open a DuckDB file in `READ_WRITE` mode. Multiple concurrent Lambda invocations writing to the same file will cause errors. For a single-user personal project, write contention is unlikely.
2. **DuckDB temp files**: DuckDB creates temp files during large queries. These MUST be directed to Lambda `/tmp` (not EFS) to avoid "Stale file handle" errors. Set via `SET temp_directory='/tmp'` after connection.
3. **EFS read latency**: 5-10x higher than `/tmp`. Acceptable for indexed DuckDB queries; initial parquet import is a one-time cost per data update.

**Card data lifecycle**:
1. Lambda cold starts → checks if parquet files on EFS are newer than last import timestamp
2. If newer: acquires lock file, re-imports card data from parquet into DuckDB tables, updates timestamp
3. If current: opens existing DuckDB file, serves requests immediately
4. Lock file prevents concurrent rebuilds; non-locking invocations wait or serve stale data

**Future path**: Split into separate card-data and user-data DuckDB files when needed (e.g., if card data grows or access patterns diverge).

**Alternatives considered**:
- In-memory DuckDB for cards + EFS for users (previous design) -- rejected; user wants unified DB on EFS
- Point MTGJSON SDK cache at EFS, keep SDK direct parquet queries -- rejected; user chose importing into DuckDB
- DynamoDB for user data -- adds complexity and a second data store

## R4: Infrastructure as Code -- AWS CDK v2 (TypeScript)

**Decision**: Use AWS CDK v2 with TypeScript. CDK code lives in `packages/infrastructure` as a pnpm workspace package (`@my-binder/infrastructure`).

**Rationale**: CDK uses TypeScript (matching the project's language), provides type-safe infrastructure definitions, and generates CloudFormation under the hood. CDK v2 has all AWS constructs in a single package (`aws-cdk-lib`). Placing it in `packages/infrastructure` keeps it within the pnpm workspace, giving consistent `pnpm install`, `pnpm build`, and Turborepo task integration. It is not consumed as a library by `apps/*` — it is deployed independently.

**Alternatives considered**:
- `infra/` standalone (outside pnpm workspaces) -- functional but inconsistent with the monorepo tooling; rejected in favour of `packages/infrastructure` per explicit project decision
- CloudFormation (raw YAML/JSON) -- verbose, no type safety
- Terraform -- excellent but introduces HCL as a new language
- SST (Serverless Stack) -- opinionated, adds an abstraction layer

## R5: HTTPS via API Gateway HTTP API (No Custom Domain)

**Decision**: API Gateway HTTP API provides a free `*.execute-api.<region>.amazonaws.com` HTTPS endpoint with AWS-managed TLS. No custom domain, no CloudFront, no ACM certificate.

**Rationale**: API Gateway HTTP API includes HTTPS by default on the auto-generated URL. No fixed monthly cost ($1/million requests). Eliminates the need for CloudFront ($0 savings but fewer resources) and ALB ($16.43/month savings). Custom domain can be added later via ACM.

**Alternatives considered**:
- CloudFront + ALB -- $16.43/month ALB fixed cost; overkill for a personal project
- API Gateway + CloudFront -- redundant; API Gateway already handles TLS
- Route 53 + ACM custom domain -- adds ~$10-15/year plus DNS management; deferred

## R6: Secrets Management -- AWS Secrets Manager

**Decision**: Store secrets (SESSION_JWT_SECRET, GOOGLE_CLIENT_IDS, GOOGLE_WEB_CLIENT_ID) in AWS Secrets Manager. Reference them in the Lambda function environment via CDK.

**Rationale**: CDK can reference Secrets Manager values in Lambda environment variables. Secrets stay out of CDK code, container images, and git history. $0.40/secret/month.

**Alternatives considered**:
- SSM Parameter Store (SecureString) -- slightly cheaper but less integrated with CDK for Lambda
- Hardcoded in CDK -- secrets in source code; unacceptable

## R7: EFS Configuration (Revised)

**Decision**: EFS with General Purpose performance mode, Elastic throughput, single access point for Lambda. EFS stores both the DuckDB database file and the MTGJSON SDK parquet cache.

**Rationale**: Elastic throughput is pay-per-use (no provisioned minimum). General Purpose mode is sufficient for low IOPS.

**EFS contents**:
- `/lambda/db/binder.duckdb` -- single DuckDB database (card + user data)
- `/lambda/mtgjson-cache/parquet/*.parquet` -- SDK-managed parquet cache (~28MB)
- `/lambda/locks/` -- lock files for rebuild coordination

**CDK setup**:
- `aws-cdk-lib/aws-efs.FileSystem` with Elastic throughput
- Access point at `/lambda` with POSIX user 1001:1001
- Lambda mounts at `/mnt/data`
- CDK auto-configures security groups (NFS port 2049) and Lambda VPC execution role

**Note**: VPC-attached Lambda has additional cold start overhead (~1-2s) for ENI attachment.

## R8: API Gateway + Lambda Integration

**Decision**: API Gateway HTTP API with catch-all `$default` route to Lambda via `HttpLambdaIntegration`.

**Rationale**: HTTP API (v2) is cheaper ($1/million vs $3.50/million for REST API) and lower latency. Using `defaultIntegration` creates a `$default` catch-all route so Fastify handles all routing internally. Payload format v2.0 is supported natively by `@fastify/aws-lambda`.

**CDK constructs** (all stable, from `aws-cdk-lib`):
- `aws-cdk-lib/aws-apigatewayv2.HttpApi`
- `aws-cdk-lib/aws-apigatewayv2-integrations.HttpLambdaIntegration`

## R9: Parquet File Management (Revised)

**Decision**: MTGJSON SDK downloads parquet files to EFS on first cold start. Parquet files persist across Lambda invocations.

**Rationale**: Storing the SDK's parquet cache on EFS avoids re-downloading ~28MB on every cold start. The SDK manages its own cache (downloads from MTGJSON API when files are missing or stale). The SDK may also push additional parquet files at indeterminate times.

**Lambda cold start flow**:
1. SDK checks `MTGJSON_CACHE_DIR` (points to EFS path `/mnt/data/mtgjson-cache`)
2. If parquet files missing → SDK downloads from MTGJSON API (~28MB, takes 5-30s depending on network)
3. Card importer checks parquet timestamps vs last import → rebuilds DuckDB card tables if needed
4. Subsequent warm invocations skip download and import entirely

**Alternatives considered**:
- Bundle parquet in container image (previous design) -- rejected; user wants SDK to manage downloads on EFS
- Download to Lambda `/tmp` each cold start -- rejected; wastes bandwidth, /tmp is ephemeral

## R10: Lock File Strategy for Concurrent Rebuilds

**Decision**: Use Node.js `fs.open()` with `O_CREAT | O_EXCL` flags to create an atomic lock file on EFS. Include a timestamp in the lock file for stale lock detection.

**Rationale**: EFS supports NFS v4 file locking semantics. `O_EXCL` ensures only one process creates the file (atomic on NFS v4). Stale lock detection handles Lambda invocations that crash before releasing the lock.

**Implementation pattern**:
```typescript
const LOCK_PATH = path.join(efsPath, 'locks', 'card-import.lock');
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

async function acquireLock(): Promise<boolean> {
  try {
    const fd = await fs.open(LOCK_PATH, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
    await fd.write(JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
    await fd.close();
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') {
      // Check if lock is stale
      const stat = await fs.stat(LOCK_PATH);
      if (Date.now() - stat.mtimeMs > STALE_THRESHOLD_MS) {
        await fs.unlink(LOCK_PATH);
        return acquireLock(); // Retry once
      }
      return false; // Lock held by another invocation
    }
    throw err;
  }
}
```

## R11: Local Development Compatibility

**Decision**: Same server code runs locally and on Lambda. No conditional branching based on environment. Environment variables control all paths.

**Rationale**: `DB_PATH` defaults to `./binder.duckdb` and `MTGJSON_CACHE_DIR` defaults to `./data/mtgjson-cache` in `config.ts`. These are already used by the existing server. On Lambda, these env vars point to EFS paths (`/mnt/data/db/binder.duckdb`, `/mnt/data/mtgjson-cache`). The card import logic, lock file, and timestamp checking work identically on both filesystems.

**Local development**: No lock file contention (single process). Parquet download happens once via SDK, cached locally. DuckDB card import happens on first startup if no card data exists. No AWS resources needed.

**Lambda entry point**: `lambda.ts` is a thin wrapper that imports the Fastify app and wraps it with `@fastify/aws-lambda`. The existing `index.ts` continues to serve as the local development entry point.

## Open Risks

1. **DuckDB native binary on AL2023**: `@duckdb/node-api` should work on Lambda's Amazon Linux 2023 (glibc 2.34) but the minimum glibc version is not explicitly documented. Must be validated by building and testing in a Lambda container before committing.
2. **29-second API Gateway timeout**: If card data import takes longer than 29s, the triggering request will fail. Import should happen during Lambda init phase (outside handler, 15-minute timeout). If SDK download + import exceeds init timeout, the invocation fails and retries.
3. **Concurrent user data writes**: DuckDB single-writer limitation on EFS. Acceptable risk for single-user personal project. Monitor for errors; migrate to DynamoDB if needed.
4. **MTGJSON SDK pushing parquet mid-request**: If the SDK updates parquet files while the server is handling requests, the next cold start will detect newer timestamps and rebuild. No mid-request impact since DuckDB tables are already loaded.
5. **First cold start latency**: SDK download (~28MB) + parquet import into DuckDB could take 30-60s on first deployment. Subsequent cold starts (parquet cached, DB current) should be <15s.
6. **EFS stale file handles**: DuckDB temp files must go to `/tmp`, not EFS. Ensure `SET temp_directory='/tmp'` is executed after every connection open.
