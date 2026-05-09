# Feature Specification: Migrate User and Collection Storage to PostgreSQL

**Feature Branch**: `011-postgres-migration`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "migrate user and collection storage off duckDB into postgress sql"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In Persists Correctly (Priority: P1)

A registered user signs in with Google. Their profile (email, display name, avatar) is stored and retrieved correctly, and their session works as before.

**Why this priority**: User identity and authentication are the foundation of the application. If users cannot sign in and have their identity persisted, no other feature works. This is the most critical data to migrate correctly.

**Independent Test**: Can be fully tested by signing in with a Google account and verifying the `/auth/me` endpoint returns correct user data, delivering a working authentication flow.

**Acceptance Scenarios**:

1. **Given** a new user signs in with Google, **When** their authentication completes, **Then** their profile is stored and `/auth/me` returns their email, display name, and avatar.
2. **Given** an existing user signs in again, **When** their profile details have changed (e.g., new avatar), **Then** their stored profile is updated to reflect the latest Google data.
3. **Given** the system is processing sign-ins, **When** two sign-in requests for the same user arrive simultaneously, **Then** only one user record is created without errors.

---

### User Story 2 - Collection Cards Are Preserved (Priority: P2)

A user's saved card collection is fully accessible after the migration. No existing card entries are lost.

**Why this priority**: The card collection is the core user-facing data of the application. Loss or corruption of this data would break the primary use case.

**Independent Test**: Can be fully tested by seeding card records and verifying all CRUD operations (list, create, update, delete) work correctly, delivering a fully functional card collection experience.

**Acceptance Scenarios**:

1. **Given** a user has cards in their collection, **When** they retrieve their collection, **Then** all previously saved cards are returned in full.
2. **Given** a user adds a new card, **When** the card is saved, **Then** it appears immediately in subsequent collection queries.
3. **Given** a user updates or deletes a card, **When** the operation completes, **Then** the collection reflects the change on the next retrieval.

---

### User Story 3 - No Degradation in API Response Behaviour (Priority: P3)

All existing API endpoints that read or write user/collection data behave identically before and after the migration, from the perspective of any caller.

**Why this priority**: External behaviour must not regress. This is important for client compatibility but can be validated after the core data operations are confirmed working.

**Independent Test**: Can be fully tested by running the existing route tests against the migrated storage, delivering confidence that no API contract has changed.

**Acceptance Scenarios**:

1. **Given** any existing API request that previously succeeded, **When** the same request is made after migration, **Then** the response shape, status code, and data are identical.
2. **Given** any existing API request that previously failed with a specific error, **When** the same invalid request is made after migration, **Then** the same error response is returned.

---

### Edge Cases

- What happens when the database connection is unavailable at startup?
- How does the system handle a failed upsert due to a constraint violation?
- How does the system behave when a card is referenced by ID that does not exist?
- What response does a user receive when their email is not in the allowed pool?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store user identity records (Google subject, email, display name, avatar URL) in a PostgreSQL database.
- **FR-002**: System MUST store card collection records in a PostgreSQL database.
- **FR-003**: System MUST support upsert semantics for user records keyed on email address, with no duplicate users created under concurrent sign-ins.
- **FR-004**: System MUST support full CRUD operations (create, read, update, delete) for card collection records, scoped to the authenticated user — a user can only access their own cards.
- **FR-005**: TypeORM migrations MUST be applied manually by the developer before deploying a new version, using the TypeORM CLI. The application MUST NOT run migrations automatically on startup.
- **FR-006**: System MUST remove all dependency on DuckDB for user and collection storage; DuckDB usage is retained only for the MTGJSON card data SDK cache.
- **FR-007**: System MUST read PostgreSQL connection details from environment configuration, with credentials sourced from a secrets store.
- **FR-008**: System MUST close the PostgreSQL connection pool gracefully on application shutdown.
- **FR-009**: Infrastructure MUST place the PostgreSQL instance in a public subnet with public accessibility enabled, so an authorised developer can connect directly from a local machine using a standard PostgreSQL client.
- **FR-010**: The User and Card repositories MUST be implemented using the TypeORM repository pattern with entity classes mapped to the database schema.
- **FR-011**: The project MUST include documented instructions for generating and running TypeORM migrations so that schema changes can be produced and applied without manual SQL authoring.
- **FR-012**: System MUST verify a user's email against an allowed users pool immediately after Google authentication. Users whose email is not in the pool MUST be rejected with an appropriate error and MUST NOT have a session created or a user record persisted.
- **FR-013**: The allowed users pool MUST be stored in a dedicated `allowed_users` table in PostgreSQL, seeded via migration with `steffanennis87@gmail.com` as the initial entry. New emails can be added via direct database insert without redeployment.

### Key Entities

- **User**: Represents an authenticated person. Attributes: unique internal ID, email address (unique), display name, optional avatar URL, record timestamps.
- **Card (Collection Entry)**: Represents a card saved to a specific user's binder. Attributes: unique internal ID, card name, record timestamps, and a required association to the owning user. A user can only see and manage their own cards.
- **AllowedUser**: Represents a pre-approved email address permitted to sign in. Attributes: email address (unique). Checked during sign-in before any user record is created.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All user sign-in and profile retrieval flows work correctly end-to-end after migration, with zero data loss for existing user records.
- **SC-002**: All card collection CRUD operations return correct results with no change in API response shape or status codes.
- **SC-003**: Application startup completes successfully with PostgreSQL connected within the existing startup time budget. Migrations are applied manually prior to deploy and do not contribute to startup time.
- **SC-004**: No existing passing tests are broken by the migration; all repository-level behaviour is preserved.
- **SC-005**: DuckDB is no longer used as the storage layer for users or card collection data.

## Constraints

- **TypeORM** is the required ORM; the repository pattern must be used for both User and Card data access.
- Schema changes must be managed through TypeORM-generated migrations — no hand-written SQL migrations for entity changes.

## Assumptions

- Infrastructure provisioning is in scope for the local-access requirement (bastion host); application-layer migration and infrastructure changes are delivered together.
- Existing data in DuckDB does not need to be migrated to PostgreSQL (fresh start is acceptable, given the personal/development nature of the app).
- Connection pooling is preferred over single-connection patterns for Lambda compatibility.

## Clarifications

### Session 2026-04-03

- Q: How should local machine access to the Aurora PostgreSQL instance be provided? → A: RDS placed in a public subnet with public accessibility enabled; developer connects directly via psql client.
- Q: Should the NAT instance be kept now that RDS is in a public subnet? → A: Yes, keep NAT instance — Lambda still needs outbound internet for MTGJSON and Google OAuth.
- Q: What ORM / data-access pattern should the repositories use? → A: TypeORM repository pattern; project must include documented instructions for generating migrations.
- Q: Should the User entity store the Google subject identifier (sub)? → A: No — email is sufficient as the unique identifier; googleSub is not stored.
- Q: Do existing DuckDB user/card records need to be migrated to PostgreSQL? → A: No — fresh start is acceptable.
- Q: When should TypeORM migrations run? → A: Manually, via the TypeORM CLI, before each deploy. The application does not run migrations on startup.
- Q: Should sign-in be gated to an allowlist during development? → A: Yes — only users whose email is in an allowed pool may sign in. Initial allowlist: steffanennis87@gmail.com.
- Q: Where should the allowed users pool be stored? → A: Dedicated `allowed_users` table in PostgreSQL, seeded on first migration.
