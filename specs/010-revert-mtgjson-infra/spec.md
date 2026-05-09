# Feature Specification: Revert MTGJSON Infrastructure Replication

**Feature Branch**: `010-revert-mtgjson-infra`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User description: "the MTGJSON sdk should act as the source of truth for the card search, 009 infrastructure complicates the access. By replicating MTGJson sdk capabilities. Revert those changes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Card Search Uses SDK Directly (Priority: P1)

A developer (or the running server) performs a card lookup, search, or legality check. Instead of routing through a DuckDB replica of MTGJSON parquet files, the provider calls the MTGJSON SDK directly. The SDK handles all card data access using its own downloaded files, which are stored on the persistent EFS-connected volume.

**Why this priority**: This is the core revert. All other stories are clean-up that follows from this decision.

**Independent Test**: Deploy the server pointing its SDK cache at the EFS volume. Perform a card search and confirm results are returned from the SDK without any DuckDB import step.

**Acceptance Scenarios**:

1. **Given** the server starts, **When** a card lookup is performed, **Then** results are returned using the MTGJSON SDK without any DuckDB data import step running.
2. **Given** the server starts with no prior MTGJSON cache on EFS, **When** a card lookup is performed, **Then** the SDK downloads its data to EFS and returns results correctly.
3. **Given** the server restarts after a prior run, **When** a card lookup is performed, **Then** the SDK reads from the previously downloaded files on EFS without re-downloading.
4. **Given** the server starts, **When** a card legality check is performed, **Then** the result uses SDK-provided legality data directly.
5. **Given** the server starts, **When** a card search with filters (colour identity, CMC range, set) is performed, **Then** results are returned correctly via the SDK.

---

### User Story 2 - SDK Cache Is Persisted on the EFS Volume (Priority: P2)

When deployed, the MTGJSON SDK's cache directory is configured to use the EFS-connected volume. This means downloaded card data survives Lambda restarts and is shared across concurrent invocations without any re-download.

**Why this priority**: Without EFS-backed persistence the SDK would re-download card data on every cold start, making the function slow and unreliable.

**Independent Test**: Trigger two sequential Lambda cold starts. Confirm the second start does not re-download card data and serves requests immediately.

**Acceptance Scenarios**:

1. **Given** the server is configured with an EFS mount path, **When** the SDK initialises, **Then** the SDK cache directory is set to a path on the EFS volume.
2. **Given** card data was downloaded in a previous invocation, **When** the Lambda restarts, **Then** the SDK reads from the existing EFS cache without downloading again.
3. **Given** no EFS path is configured (local development), **When** the SDK initialises, **Then** the SDK uses a local temporary cache directory and works correctly.

---

### User Story 3 - Card Import Machinery Is Removed (Priority: P3)

The card data replication pipeline (parquet import into DuckDB, import metadata tracking, EFS lock coordination) is removed from the codebase. The server no longer maintains its own copy of MTGJSON card tables in DuckDB.

**Why this priority**: Removing the replication code reduces operational complexity and aligns with using the SDK as the single source of truth.

**Independent Test**: Verify that the server builds and starts without any reference to card import functions, card data migrations, or card data DuckDB tables.

**Acceptance Scenarios**:

1. **Given** the codebase after the revert, **When** the server starts, **Then** no card data import step executes.
2. **Given** the codebase after the revert, **When** database migrations run, **Then** no card data tables or import metadata tables are created.
3. **Given** the codebase after the revert, **When** the build runs, **Then** no references to the card importer module exist.

---

### Edge Cases

- What happens when the MTGJSON SDK has not yet downloaded its data on first startup? The SDK manages its own download lifecycle; the server should return an appropriate "not available" response if the SDK is not ready.
- What happens to existing DuckDB databases that already have card tables from migrations 003/004? Those tables remain but are no longer used. A compensating drop migration is out of scope for this revert.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The MTGJSON provider MUST use the MTGJSON SDK directly for all card lookup, search, and legality operations.
- **FR-002**: The server startup MUST NOT include a card data import step from parquet files into DuckDB.
- **FR-003**: The card importer module MUST be removed from the codebase.
- **FR-004**: Database migrations for card data tables and import metadata MUST be removed from the migration set that runs on startup.
- **FR-005**: The MTGJSON provider MUST satisfy the existing card provider interface (lookup, legality check, search, reachability check) using SDK calls.
- **FR-006**: The existing mapper that translates SDK card objects into the application's card record format MUST continue to be used.
- **FR-007**: All existing card provider tests MUST pass with the reverted implementation.
- **FR-008**: When an EFS mount path is configured, the MTGJSON SDK cache directory MUST be set to a path on that EFS volume so downloaded card data persists across restarts.
- **FR-009**: When no EFS mount path is configured (local development), the SDK MUST fall back to a local cache directory.

### Key Entities

- **MTGJSON Provider**: The card provider implementation — reverted from querying DuckDB card tables to calling the MTGJSON SDK directly.
- **MTGJSON SDK**: The card data library responsible for downloading, caching, and querying card data. It is the sole source of truth for card information after this revert.
- **SDK Cache Directory**: The path where the SDK stores its downloaded card data. In production this is a directory on the EFS volume; locally it is a temporary directory.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The server starts successfully with zero card-data-related migrations or import steps running.
- **SC-002**: All existing card route integration tests pass without modification to test assertions.
- **SC-003**: The codebase contains no references to the card importer, card data tables, or import metadata after the revert.
- **SC-004**: A card lookup, search, and legality check each return correct results in a fresh environment where only the SDK cache on EFS is present.
- **SC-005**: A second Lambda cold start after card data has been downloaded completes without re-downloading, confirming EFS persistence is working.

## Assumptions

- The MTGJSON SDK provides native lookup, search, and legality data access — the existing mapper already reflects this SDK API.
- Configuring the SDK's cache directory to a path on EFS is sufficient for persistence; no additional coordination layer (lock files, import metadata) is needed.
- Removing the card data migrations from the active set (not running them on startup) is sufficient. A compensating drop-table migration for existing databases is out of scope.
- The EFS lock-file coordination added in spec 009 was specific to the DuckDB import pipeline and can be removed with the importer.
- The EFS volume itself (mount point, CDK construct) is already provisioned by spec 009 and does not need to change — only its usage shifts from housing the DuckDB import artefacts to housing the SDK cache.
