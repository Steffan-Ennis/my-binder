# Feature Specification: Sequential Card Enrichment

**Feature Branch**: `014-sequential-card-enrichment`
**Created**: 2026-04-27
**Status**: Draft
**Input**: User description: "Replace Promise.all in search enrichment with an async generator that buffers each card result individually, preventing race conditions on MTGJSON SDK parquet file downloads."

## Background

The `MtgjsonProvider.search()` method enriches each card result with identifiers and legalities fetched from separate parquet files via the MTGJSON SDK. Currently, `Promise.all(cards.map(card => this.enrichCard(card)))` fans out all enrichment calls in parallel. The SDK lazily downloads and caches these parquet files on first access — when multiple `enrichCard` calls land concurrently, they all trigger the same download simultaneously, creating a race condition on the file system. This causes search to fail intermittently.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Card search returns enriched results without errors (Priority: P1)

A user searches for cards and receives results that include scryfall IDs and commander legality, without the request failing due to SDK file access contention.

**Why this priority**: The search endpoint is currently broken due to the race condition. This is the core fix.

**Independent Test**: Can be tested by calling `GET /cards/search?name=bolt` and verifying results include `imageRef` (scryfallId) and `commanderLegal` fields.

**Acceptance Scenarios**:

1. **Given** the SDK parquet cache is cold (no cached files), **When** a search returns 10+ cards, **Then** all cards are enriched successfully and no file-access errors are thrown.
2. **Given** the SDK parquet cache is warm (files already downloaded), **When** a search returns cards, **Then** enrichment completes without re-downloading parquet files.
3. **Given** a search returns cards, **When** the response is inspected, **Then** each card has a non-null `imageRef` (scryfallId) and a boolean `commanderLegal` field.

---

### User Story 2 — Commander legality enrichment is restored (Priority: P1)

The `sdk.legalities.isLegal()` call, currently commented out in `enrichCard`, is re-enabled so that search results include accurate commander legality data.

**Why this priority**: The legality data was disabled as a workaround for the race condition. Fixing the race condition unblocks restoring this functionality.

**Independent Test**: Can be tested by searching for a card known to be banned in Commander (e.g., "Channel") and verifying `commanderLegal` is `false`.

**Acceptance Scenarios**:

1. **Given** a card is legal in Commander, **When** it appears in search results, **Then** `commanderLegal` is `true`.
2. **Given** a card is banned in Commander, **When** it appears in search results, **Then** `commanderLegal` is `false`.

---

### Edge Cases

- What happens when `sdk.identifiers.getIdentifiers(uuid)` returns `undefined` for a card? The `scryfallId` should fall back to `null`.
- What happens when the SDK parquet download fails mid-sequence (e.g., network error on the 5th card)? The error should propagate naturally — no silent swallowing.
- What happens with a search that returns 0 cards? The generator yields nothing and an empty array is returned.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `MtgjsonProvider.search()` MUST enrich cards sequentially, not in parallel, to prevent concurrent parquet file downloads.
- **FR-002**: `enrichCard()` MUST fetch both identifiers and legalities for each card (re-enabling the currently commented-out `sdk.legalities.isLegal()` call).
- **FR-003**: Within a single `enrichCard()` call, identifiers and legalities MAY be fetched in parallel (they are different parquet files and do not contend with each other once the per-card sequencing prevents the fan-out).
- **FR-004**: The `search()` method signature and return type (`Promise<CardRecord[]>`) MUST NOT change.
- **FR-005**: If `sdk.identifiers.getIdentifiers()` returns `undefined` or a non-string `scryfallId`, the card's `imageRef` MUST be `null`.

### Key Entities

- **`MtgjsonProvider`**: The card data provider that wraps the MTGJSON SDK (`apps/server/src/providers/mtgjson/index.ts`).
- **`enrichCard()`**: Private method that fetches identifiers and legalities for a single card and maps it to a `CardRecord`.
- **Async generator (`enrichCards`)**: New private method that yields enriched cards one at a time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `search()` completes successfully on a cold parquet cache with 10+ card results — no file-access race errors.
- **SC-002**: Every `CardRecord` returned by `search()` includes a boolean `commanderLegal` field (not the hardcoded `false` default).
- **SC-003**: The `CardProvider` interface is unchanged — no breaking changes to consumers.
- **SC-004**: The `sdk.legalities.isLegal()` call is uncommented and active in `enrichCard()`.
