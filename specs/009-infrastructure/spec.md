# Feature Specification: Infrastructure

**Feature Branch**: `009-infrastructure`
**Created**: 2026-03-28
**Status**: Complete
**Input**: User description: "infrastructure"

## Clarifications

### Session 2026-03-28

- Q: Should CI/CD (automated pipelines, auto-deploy on merge) be in scope? -> A: No. CI/CD is out of scope. Deployment will be manual for now.
- Q: Where will the server be hosted? -> A: AWS, using Lambda for compute and API Gateway HTTP API for the public endpoint.
- Q: Should infrastructure be defined as code or configured manually? -> A: Infrastructure as code using AWS CDK, checked into the repository.
- Q: What persistent storage approach for the DuckDB file? -> A: EFS (Elastic File System) mounted to Lambda. DuckDB parquet source data and the rebuilt database are stored on EFS. The database is treated as a rebuildable cache -- if lost, the server rebuilds it from MTGJSON parquet data on the same EFS volume.
- Q: Should traffic be encrypted? -> A: Yes. All traffic MUST be served over HTTPS. API Gateway HTTP API provides a free HTTPS endpoint (`*.execute-api.amazonaws.com`) with AWS-managed TLS.
- Q: How is the domain and TLS certificate handled? -> A: No custom domain. API Gateway HTTP API provides a free `*.execute-api.<region>.amazonaws.com` HTTPS URL with AWS-managed TLS. Custom domain can be added later via ACM.
- Q: Should the server run continuously? -> A: No. Lambda is idle by default -- no compute cost when no requests. No scale-to-zero machinery needed.
- Q: How should cold-start requests be handled? -> A: Lambda cold starts (5-15s) are acceptable for a personal project. The mobile app client handles 503/timeout responses with a "warming up" UI state. API Gateway Gateway Responses can customize the error body for non-app clients.

### Session 2026-03-29 (Architecture Revision)

- Q: Why was the architecture revised from Fargate to Lambda? -> A: Cost analysis revealed the ALB (required for Fargate) has a fixed cost of ~$16.43/month regardless of traffic -- 86% of total infrastructure cost. Lambda + API Gateway eliminates all fixed compute and load balancer costs, reducing the estimated bill from ~$19/month to ~$1.50/month.
- Q: Why EFS instead of ephemeral Lambda storage? -> A: Lambda's `/tmp` is limited to 512MB (expandable to 10GB at extra cost) and is not shared across invocations. EFS provides persistent, shared storage for DuckDB parquet data (~500MB) and the rebuilt database, avoiding re-download and rebuild on every cold start.
- Q: What are the known risks of this approach? -> A: (1) DuckDB temp file writes on EFS have higher latency than local disk. (2) API Gateway has a 29-second per-request timeout hard limit. (3) Lambda cold starts with VPC + EFS mount add 1-2s overhead. All accepted for a personal project with low traffic.

### Session 2026-03-29 (MTGJSON DuckDB on EFS)

- Q: How should MTGJSON card data be accessed on EFS? → A: Import parquet data into the main DuckDB file on EFS (stop using SDK's direct parquet queries). Future path: separate card-data and user-data into distinct DuckDB files.
- Q: How do parquet files initially get onto EFS? → A: Lambda downloads from MTGJSON API on first cold start via the SDK. The SDK may also push additional parquet files at indeterminate times.
- Q: How should DuckDB card data be refreshed when new parquet files arrive? → A: Check parquet file timestamps on cold start; rebuild card tables only if parquet files are newer than the last import.
- Q: How should concurrent Lambda cold-start rebuild contention be handled? → A: Lock file on EFS; first invocation acquires lock and rebuilds, others wait or serve stale data.
- Q: Should the MTGJSON SDK parquet cache directory live on EFS? → A: Yes. SDK cache dir on EFS so downloaded parquet files persist and are reused across invocations.
- Q: Must the EFS-based DuckDB approach work locally without deployed AWS resources? → A: Yes. The same code must run locally using the existing `DB_PATH` and `MTGJSON_CACHE_DIR` config values (local filesystem paths). EFS is just the backing filesystem in Lambda; locally it's regular disk. No AWS resources required for local development.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Packages Server as Lambda Function (Priority: P1)

A developer clones the repository, packages the server application as a Lambda-compatible deployment artifact (wrapping Fastify with a Lambda adapter), and tests it locally. The packaged server handles API requests identically to the non-Lambda development setup.

**Why this priority**: Packaging the server for Lambda is the foundation for all other infrastructure -- without a working Lambda artifact, there is no hosted environment.

**Independent Test**: Can be fully tested by packaging the server, invoking the Lambda handler locally, and verifying a successful API response.

**Acceptance Scenarios**:

1. **Given** the repository is cloned and build tooling is installed, **When** the developer packages the server for Lambda deployment, **Then** the build completes successfully with no errors and produces a deployment artifact under the size limit.
2. **Given** a successfully built Lambda artifact, **When** the developer invokes the handler locally with a simulated API Gateway event, **Then** the server responds correctly to health-check requests.
3. **Given** a locally invoked Lambda handler, **When** the developer sends a simulated API request (e.g., to an existing endpoint), **Then** the response is identical to running the server outside of Lambda.

---

### User Story 2 - Developer Manually Deploys Server to Hosted Environment (Priority: P2)

A developer packages the server, uploads it to AWS Lambda, and manually deploys the infrastructure using CDK. The server becomes accessible at a stable HTTPS URL.

**Why this priority**: Getting the server running in a hosted environment is the primary goal of infrastructure. Manual deployment is acceptable for now; CI/CD automation can be added later.

**Independent Test**: Can be tested by packaging and deploying the artifact, running CDK deploy, and accessing the server at its stable URL.

**Acceptance Scenarios**:

1. **Given** a successfully built Lambda deployment artifact, **When** the developer deploys infrastructure using CDK, **Then** all AWS resources are provisioned and the Lambda function is deployed.
2. **Given** the deployment completes, **When** a user accesses the server's stable HTTPS URL, **Then** they receive responses from the deployed server over an encrypted connection.
3. **Given** a subsequent code change, **When** the developer follows the documented manual deployment steps, **Then** the hosted server is updated to run the new version.

---

### User Story 3 - Server Accesses Card Data from Persistent Storage (Priority: P3)

When the Lambda function starts (cold start), it connects to the EFS-mounted filesystem where the DuckDB database and MTGJSON SDK parquet cache reside. If no parquet data exists on EFS, the SDK downloads it from the MTGJSON API. Card data is imported into the main DuckDB database file; on subsequent cold starts, parquet file timestamps are checked and card tables are only rebuilt if the data is newer. A lock file on EFS prevents concurrent rebuilds. Subsequent warm invocations reuse the existing database and connection.

**Why this priority**: With Lambda, each cold start must have access to card data. EFS provides persistent shared storage across invocations for both the SDK's parquet cache and the DuckDB database, ensuring fast warm starts and resilient cold starts.

**Independent Test**: Can be tested by invoking the Lambda function and verifying it downloads parquet data, imports it into DuckDB on EFS, and responds to card data queries.

**Acceptance Scenarios**:

1. **Given** an empty EFS volume (first deployment), **When** the Lambda function cold-starts, **Then** the SDK downloads parquet data from the MTGJSON API to EFS, imports it into DuckDB, and becomes ready to serve requests.
2. **Given** an EFS volume with existing DuckDB database and up-to-date parquet, **When** the Lambda function cold-starts, **Then** it reuses the existing database without rebuilding (fast cold start).
3. **Given** the SDK has pushed newer parquet files to EFS, **When** the Lambda function cold-starts, **Then** it detects the newer timestamps and rebuilds card tables from the updated parquet data.
4. **Given** a rebuild is already in progress (lock file held), **When** another Lambda invocation cold-starts, **Then** it waits or serves stale data rather than attempting a concurrent rebuild.

---

### User Story 4 - Server Incurs No Cost When Idle (Priority: P4)

The infrastructure incurs no compute charges when no requests are being made. Lambda functions are idle by default -- there is no need for scale-to-zero alarms, timers, or orchestration. The developer pays only for actual request processing time.

**Why this priority**: Cost control is essential for a personal project. Unlike always-on containers, Lambda's pay-per-invocation model means zero cost at rest with no additional infrastructure.

**Independent Test**: Can be verified by reviewing the AWS bill after a period of no usage and confirming zero compute charges.

**Acceptance Scenarios**:

1. **Given** no requests have been made for any period of time, **When** the developer reviews AWS charges, **Then** there are no compute charges for the idle period.
2. **Given** the server has been idle, **When** a new request arrives, **Then** the Lambda function cold-starts and serves the request without manual intervention.
3. **Given** the server is handling requests, **When** requests stop, **Then** no additional action is needed -- the function naturally becomes idle with no teardown process.

---

### Edge Cases

- What happens if the Lambda deployment artifact exceeds the size limit (250MB zip / 10GB container)?
- What happens if the DuckDB database rebuild from parquet data takes longer than the 29-second API Gateway timeout?
- What happens if EFS throughput is insufficient during a burst of concurrent cold starts?
- What happens if the EFS volume runs out of space?
- What happens if multiple concurrent Lambda invocations attempt to rebuild the DuckDB database simultaneously? → Handled via lock file on EFS (FR-010).
- What happens if the MTGJSON API is unavailable on first cold start (no cached parquet on EFS yet)?
- What happens if the SDK pushes a partial or corrupt parquet file update while the server is running?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Lambda-compatible deployment artifact for the server application that wraps Fastify with a Lambda adapter.
- **FR-002**: System MUST store MTGJSON parquet source data on EFS (via the SDK's cache directory), accessible to all Lambda invocations. The SDK downloads parquet from the MTGJSON API on first cold start; files persist across invocations.
- **FR-003**: System MUST import MTGJSON parquet data into the main DuckDB database file on EFS. On cold start, the system checks parquet file timestamps against the last import; card tables are rebuilt only when parquet data is newer.
- **FR-010**: System MUST use a lock file on EFS to coordinate concurrent DuckDB card-data rebuilds. The first Lambda invocation to detect stale data acquires the lock and rebuilds; concurrent invocations wait or serve stale data.
- **FR-011**: System MUST run locally without any deployed AWS resources. The DuckDB file path (`DB_PATH`) and MTGJSON cache directory (`MTGJSON_CACHE_DIR`) are configured via environment variables; locally these resolve to regular filesystem paths (e.g., `./binder.duckdb`, `./data/mtgjson-cache`). The same server code runs on both Lambda (EFS-backed paths) and local development (local disk paths) with no conditional branching.
- **FR-004**: System MUST provide a stable HTTPS URL (via API Gateway HTTP API) where the deployed server is accessible. All traffic MUST be encrypted with TLS.
- **FR-005**: System MUST support environment-specific configuration (e.g., secrets, database paths) without hardcoding values in the deployment artifact.
- **FR-006**: System MUST NOT expose secrets (API keys, signing keys) in deployment artifacts or source code.
- **FR-007**: System MUST include documented steps for manual deployment.
- **FR-008**: System MUST incur no compute charges when no requests are being processed (Lambda pay-per-invocation model).
- **FR-009**: System MUST handle concurrent Lambda invocations safely, particularly during database rebuild scenarios (e.g., file locking or single-writer guarantees on EFS).

### Out of Scope

- Automated CI/CD pipelines (no automated quality checks on PR, no auto-deploy on merge)
- Automated rollback on failed deployments
- Multiple environments (staging, production) -- single environment only for now
- Custom domain name (using default `*.execute-api` URL for now; custom domain via ACM is a future option)
- Provisioned concurrency for Lambda (cold starts are acceptable)

### Key Entities

- **Deployment Artifact**: A packaged, Lambda-compatible version of the server application (zip or container image), versioned and deployed via CDK.
- **API Endpoint**: An API Gateway HTTP API that provides the stable HTTPS URL (`*.execute-api.<region>.amazonaws.com`) and routes requests to the Lambda function.
- **Persistent Storage**: An EFS filesystem mounted to the Lambda function, storing: (1) the MTGJSON SDK parquet cache directory, (2) a single DuckDB database file containing both user data and imported card data. Future: card-data and user-data may be split into separate DuckDB files.
- **Infrastructure Definition**: AWS CDK code checked into the repository that defines all AWS resources.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Server Lambda artifact can be built and tested locally in under 5 minutes on a standard developer machine.
- **SC-002**: Manual deployment from local build to live-on-stable-URL can be completed in under 15 minutes following documented steps.
- **SC-003**: Server connects to card data and is ready to serve requests within 30 seconds on a warm start (existing database on EFS).
- **SC-004**: Server rebuilds its database from parquet source data and is ready to serve requests within 3 minutes on a cold start with no existing database.
- **SC-005**: No secrets are present in deployment artifacts or version control history.
- **SC-006**: All traffic to the server is encrypted via HTTPS.
- **SC-007**: Zero compute charges accrue during periods of no traffic (verified on AWS bill).
- **SC-008**: Monthly infrastructure cost is under $5 for typical personal usage (~2 hours active use per day).
