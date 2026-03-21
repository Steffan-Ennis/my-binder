# Feature Specification: Card Data Provider

**Feature Branch**: `004-card-data-provider`
**Created**: 2026-03-21
**Status**: Draft
**Input**: User description: "a provider of cards should be selectable — the first provider
is MTGJSON for Magic: The Gathering"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Look Up a Card by Name (Priority: P1)

When any part of the app needs card data — during a scan confirmation, when viewing card
details, or when building a decklist — it queries the active card data provider by name and
receives complete card information. The user never sees the provider directly; they simply
get accurate, complete card data wherever they need it.

**Why this priority**: Every card-facing feature (binder display, scan recognition, deck
building) depends on a reliable source of card data. Without a working provider integration,
no card information can be populated or verified.

**Independent Test**: Can be fully tested by triggering a card name lookup for a known Magic
card and confirming the response contains name, set, card number, and mana cost — and by
confirming an unknown name returns a clear "not found" result.

**Acceptance Scenarios**:

1. **Given** a card name is submitted to the data provider, **When** the card exists in the
   provider's catalogue, **Then** the response includes the card's name, set, card number,
   and mana cost.
2. **Given** a card name is submitted, **When** the card does not exist in the catalogue,
   **Then** a clear "not found" result is returned (no error crash).
3. **Given** a partial or fuzzy card name is submitted, **When** matches exist, **Then** a
   list of matching cards is returned so the caller can present options to the user.
4. **Given** multiple printings of the same card exist (different sets), **When** a lookup is
   performed, **Then** all printings are returned with their respective set and card number.
5. **Given** a card name and set code are submitted, **When** the card exists in that set,
   **Then** only printings from that set are returned, narrowing the result to one or more
   cards within a single set.
6. **Given** a card name, set code, and collector number are submitted, **When** a matching
   printing exists, **Then** exactly that printing is returned — unambiguously identifying a
   single physical card.

---

### User Story 2 - Look Up a Card's Legality for Commander (Priority: P2)

When the user attempts to add a card to a Commander decklist, the app queries the provider
to check whether that card is legal in Commander format — including colour identity and
banned-list status. The user receives an immediate, clear answer with no ambiguity.

**Why this priority**: Commander legality enforcement (defined in spec 003) requires a
reliable, up-to-date source of truth. The provider must supply this — it cannot be hardcoded.

**Independent Test**: Can be fully tested by querying legality for a known legal card, a
banned card, and a card with a colour identity mismatch against a test Commander — and
confirming the correct legal/illegal result with reason is returned in each case.

**Acceptance Scenarios**:

1. **Given** a card is queried for Commander legality, **When** the card is legal in
   Commander, **Then** the response confirms it is legal.
2. **Given** a card is queried, **When** the card is on the Commander banned list, **Then**
   the response indicates it is banned, identifying it as a legality violation.
3. **Given** a card is queried with a specific Commander's colour identity, **When** the
   card's colour identity falls outside that Commander's colours, **Then** the response
   indicates the colour identity conflict.
4. **Given** a card has multiple printings, **When** legality is queried, **Then** the
   legality result reflects the card's atomic legality (not printing-specific) as Commander
   bans apply to the card name, not the printing.

---

### User Story 3 - Browse and Search the Card Catalogue (Priority: P3)

The user can search the full MTG card catalogue directly within the app — by name, set,
colour, mana cost range, or card type — and add found cards to their binder or a decklist
without needing to scan a physical card.

**Why this priority**: Scanning is the primary input method, but catalogue search is the
fallback for cards the user does not have physically, for verifying scan results, and for
browsing. It is independently deliverable after the lookup story.

**Independent Test**: Can be fully tested by performing a search with each filter type
(name, set, colour, mana cost) and confirming results are returned, filtered correctly, and
displayable in the app's card UI.

**Acceptance Scenarios**:

1. **Given** the user searches by card name (full or partial), **When** results exist,
   **Then** a list of matching cards is returned with name, set, mana cost, and card number.
2. **Given** the user filters by set, **When** the set is valid, **Then** only cards
   belonging to that set are returned.
3. **Given** the user filters by colour identity, **When** results exist, **Then** only cards
   matching the specified colour identity are returned.
4. **Given** the user filters by mana cost (converted mana value range), **When** results
   exist, **Then** only cards within that cost range are returned.
5. **Given** a search returns more results than can be displayed at once, **When** the user
   scrolls or requests more, **Then** additional results are loaded without re-running the
   full search.

---

### User Story 4 - Switch the Active Card Data Provider (Priority: P4)

An administrator or technically capable user can change which card data provider the system
uses — for example, switching from MTGJSON to a future provider. The switch takes effect for
all subsequent card lookups. Existing cards already in the user's binder are not affected.

**Why this priority**: The provider system is designed to be swappable. Making the switch
mechanism explicit and testable ensures the architecture is not accidentally locked to a
single source. This story is P4 because MTGJSON is the only provider for this release —
but the mechanism must exist.

**Independent Test**: Can be fully tested by configuring an alternative provider (or a test
stub), performing a card lookup, and confirming the response comes from the newly active
provider rather than the previous one.

**Acceptance Scenarios**:

1. **Given** a second provider is configured, **When** the active provider is switched,
   **Then** all subsequent card lookups use the new provider.
2. **Given** the provider is switched, **When** cards already saved in the binder are
   viewed, **Then** their stored data is unaffected (the switch only affects future lookups).
3. **Given** an invalid or unavailable provider is selected, **When** the switch is
   attempted, **Then** the system rejects it with a clear explanation and keeps the current
   provider active.

---

### Edge Cases

- What happens when the provider's data source is temporarily unavailable?
  The system returns a clear "provider unavailable" error; no partial or stale data is served.
  The app surfaces a user-friendly message and allows retry.
- What happens when the provider returns data for a card but a field (e.g., mana cost) is
  missing?
  The missing field is treated as explicitly empty — the system does not error, but the
  calling feature must handle an empty value gracefully (as defined in spec 003 for lands).
- What happens when a card name has multiple exact matches across sets?
  All printings are returned; the caller (scan confirmation, decklist add) is responsible for
  presenting the choice to the user.
- What happens when the provider's card data is outdated (new set not yet in the catalogue)?
  Cards from unrecognised sets return "not found"; the scan flow's manual correction path
  (spec 003) allows the user to enter data manually.

## Requirements *(mandatory)*

### Functional Requirements

**Card Lookup**

- **FR-001**: The system MUST provide a card lookup capability that accepts a card name and
  returns: name, set, card number, mana cost, colour identity, and format legality data.
- **FR-002**: Card lookup MUST support exact name matching.
- **FR-003**: Card lookup MUST support partial and fuzzy name matching, returning a ranked
  list of candidates.
- **FR-004**: Card lookup MUST return all printings of a card across different sets when
  multiple exist.
- **FR-005**: Card lookup MUST return a clear "not found" result (not an error) when no
  match exists.
- **FR-005a**: Card lookup MUST accept an optional set code filter. When provided, only
  printings from the specified set are returned.
- **FR-005b**: Card lookup MUST accept an optional collector number filter. When provided
  alongside a set code, only the matching printing is returned. Collector number without a
  set code is ignored.

**Commander Legality**

- **FR-006**: The system MUST expose a legality check that accepts a card identifier and
  returns its Commander format legality status (legal / banned).
- **FR-007**: The legality check MUST include colour identity data so the calling feature
  can enforce Commander colour identity rules.
- **FR-008**: Legality results MUST reflect the card's name-level legality — printings of
  the same card share the same legality status.

**Card Catalogue Search**

- **FR-009**: The system MUST support searching the full card catalogue by: name (full,
  partial, fuzzy), set, colour identity, and mana cost range.
- **FR-010**: Search results MUST be paginated so large result sets do not degrade
  performance.
- **FR-011**: Each search result MUST include at minimum: card name, set, card number, mana
  cost, and colour identity.

**Provider Selection**

- **FR-012**: The system MUST support a configurable active card data provider. MTGJSON is
  the default and first supported provider.
- **FR-013**: The active provider MUST be selectable without requiring a code change or
  application rebuild — configuration only.
- **FR-014**: Switching the active provider MUST NOT alter card data already stored in user
  binders or decklists.
- **FR-015**: The system MUST validate that a selected provider is reachable before
  activating it and reject unreachable providers with a clear explanation.
- **FR-016**: The system MUST operate with exactly one active provider at any time; there is
  no multi-provider fan-out in this release.

### Key Entities

- **Card Data Provider**: An external source of Magic card information. Has a name, a
  reachability status, and a defined set of capabilities (lookup, legality, search). MTGJSON
  is the first concrete provider.
- **Card Record**: The normalised card data returned by the provider regardless of which
  provider is active. Contains: name, set, card number, mana cost, colour identity, format
  legality map, and front-face image reference.
- **Printing**: A specific physical release of a card in a named set with a set-specific
  card number. One card may have many printings.
- **Legality Result**: The response from a legality check — includes the card's status in
  Commander format and its colour identity.
- **Search Query**: A parameterised request to the provider. Contains one or more filters
  (name, set, colour identity, mana cost range) and pagination state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A card name lookup returns a complete card record within 2 seconds under normal
  operating conditions.
- **SC-002**: A Commander legality check returns a result within 1 second.
- **SC-003**: A catalogue search with a single filter returns the first page of results
  within 3 seconds.
- **SC-004**: The provider can be switched without any application downtime — all subsequent
  lookups use the new provider within 5 seconds of the configuration change.
- **SC-005**: 100% of lookups for cards that exist in the MTGJSON catalogue return a result
  that includes name, set, card number, and mana cost.
- **SC-006**: 100% of cards on the Commander banned list are correctly identified as banned
  by the legality check.
- **SC-007**: Fuzzy name matching returns the correct card in the top 3 results for at least
  90% of common misspellings or partial names.

## Assumptions

- MTGJSON is the first and only provider in this release; the provider selection mechanism
  is built now to avoid architectural lock-in, not to support multiple active providers
  simultaneously.
- The MTGJSON data source provides: card name, set, card number, mana cost, colour identity,
  and Commander format legality — all of which are confirmed available in the MTGJSON SDK.
- Card image URLs or references are supplied by the provider; the app does not host card
  images directly.
- Provider configuration is a server-side setting (spec 001), not a per-user preference —
  all users of the application use the same active provider.
- The "card data provider" layer sits on the server (spec 001); the mobile app (spec 002)
  requests card data from the server, which in turn queries the provider. The app does not
  call the provider directly.
- Commander legality is determined at the card-name level (not per-printing), consistent
  with how the official Commander banned list works.
- Pagination page size defaults to 20 results; this is a server-side default and not
  user-configurable in this release.

## External References

- **MTGJSON TypeScript SDK**: https://github.com/mtgjson/mtgjson-sdk-typescript
  Provides: full card catalogue, set metadata, format legality, colour identity, fuzzy/exact
  name search, mana cost filtering, and colour identity filtering.
