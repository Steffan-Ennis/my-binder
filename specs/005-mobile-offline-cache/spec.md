# Feature Specification: Mobile Offline Cache

**Feature Branch**: `005-mobile-offline-cache`
**Created**: 2026-03-21
**Status**: Draft
**Input**: User description: "mobile cache, once an image has been requested it should be
stored on the users device, the user should also be able to download full sets, images and
have a local database for offline usage."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Image Caching on First View (Priority: P1)

When the user views any card in the app — whether in the binder, a detail view, or a
decklist — the card's image is fetched once and stored on the device. Every subsequent view
of that card loads the image instantly from local storage, with no network request needed.
The caching is completely transparent — the user never has to think about it.

**Why this priority**: This is the baseline offline capability that improves every interaction
in the app. It requires no user action, delivers immediate perceived performance gains, and
forms the foundation on which deliberate offline downloads are built.

**Independent Test**: Can be fully tested by viewing a card image while online, then enabling
airplane mode and navigating to the same card — confirming the image loads correctly without
a network connection.

**Acceptance Scenarios**:

1. **Given** a card image has never been viewed, **When** the user views that card, **Then**
   the image is fetched from the network and stored on the device for future use.
2. **Given** a card image has previously been viewed, **When** the user views the same card
   again (with or without network), **Then** the cached image is displayed without any network
   request.
3. **Given** the device has no network connection, **When** the user views a card whose image
   is cached, **Then** the image loads correctly from the local cache.
4. **Given** the device has no network connection, **When** the user views a card whose image
   is NOT cached, **Then** a clear placeholder is shown indicating the image is unavailable
   offline.
5. **Given** the cached image data is newer on the server (card art updated), **When** the
   app is next online and the card is viewed, **Then** the cached image is refreshed.

---

### User Story 2 - Manage Local Storage Usage (Priority: P2)

The user can see how much device storage the cache is using and can clear cached data when
they want to reclaim space. The app never silently fills the device's storage to capacity.

**Why this priority**: Automatic caching (P1) and bulk downloads (P3) can accumulate
significant storage. The user must remain in control of their device's storage. This story
is independently deliverable as a settings screen.

**Independent Test**: Can be fully tested by caching several images, opening the cache
management screen, verifying the storage size is reported accurately, clearing the cache, and
confirming all cached images are removed and the size resets to zero.

**Acceptance Scenarios**:

1. **Given** the user opens the cache management screen, **When** it loads, **Then** the
   total storage used by the cache (images + local database) is displayed in human-readable
   form (e.g., "142 MB").
2. **Given** the cache management screen is open, **When** the user taps "Clear all cached
   images", **Then** all cached images are deleted, the storage figure updates to reflect the
   removal, and card images revert to being fetched on demand.
3. **Given** the cache is approaching the device's available storage, **When** a download is
   requested, **Then** the app warns the user before proceeding and does not silently fill
   the device.
4. **Given** the user has downloaded specific sets, **When** they view the cache management
   screen, **Then** each downloaded set is listed with its individual storage footprint and
   a delete option.

---

### User Story 3 - Download a Full Set for Offline Use (Priority: P3)

The user can browse the available Magic: The Gathering sets and choose to download a
complete set — all card images and card data — to their device. Once downloaded, every card
in that set is fully accessible offline: image, name, set, card number, and mana cost.

**Why this priority**: Deliberate set downloads are the power-user offline story. They
require the image cache (P1) and storage management (P2) to exist first, and build on both.

**Independent Test**: Can be fully tested by downloading a small set, enabling airplane mode,
and confirming that every card in that set displays its full image and card data without any
network request.

**Acceptance Scenarios**:

1. **Given** the user navigates to the set download screen, **When** it loads, **Then** a
   list of available Magic sets is shown, each indicating whether it has been downloaded.
2. **Given** the user selects a set to download, **When** they confirm, **Then** a download
   begins showing progress (number of cards downloaded / total).
3. **Given** a set download is in progress, **When** the user backgrounds the app, **Then**
   the download continues and the user is notified when it completes.
4. **Given** a set download is in progress, **When** the user cancels it, **Then** the
   download stops cleanly and any partially downloaded data is removed.
5. **Given** a set has been fully downloaded, **When** the user is offline and views any card
   from that set, **Then** the image and card data are available with no network dependency.
6. **Given** a set has been fully downloaded, **When** the user deletes it from the cache
   management screen, **Then** all images and data for that set are removed from the device.

---

### User Story 4 - Local Card Database for Offline Lookup (Priority: P4)

The user can perform card lookups, legality checks, and collection browsing while fully
offline, because the app maintains a local copy of card data (name, set, card number, mana
cost, colour identity, Commander legality). This local database is kept up to date when the
app is online.

**Why this priority**: Images alone are not enough for full offline use — card metadata is
needed for search, legality checks in deck building, and the scan confirmation flow. This
story completes the offline experience.

**Independent Test**: Can be fully tested by performing a card search and a legality check
while in airplane mode, confirming results are returned from local data without a network
call.

**Acceptance Scenarios**:

1. **Given** the app has synced card data while online, **When** the user is offline and
   searches for a card by name, **Then** results are returned from the local database.
2. **Given** the app has synced card data while online, **When** the user is offline and
   checks Commander legality for a card, **Then** the legality result is returned from the
   local database.
3. **Given** the app comes back online after being offline, **When** new card data is
   available (e.g., a new set was released), **Then** the local database is updated
   automatically in the background.
4. **Given** the local database has never been synced, **When** the user is offline, **Then**
   a clear message explains that card data is not yet available offline and instructs the user
   to connect to download it.

---

### Edge Cases

- What happens when a set download is interrupted by a lost network connection?
  The download pauses and resumes automatically when connectivity is restored; the user is
  informed of the interrupted state.
- What happens when the device runs out of storage mid-download?
  The download is cancelled cleanly, the partial data is removed, and the user is shown a
  message stating how much storage was available versus how much was needed.
- What happens when a cached image on the server has changed (e.g., errata art update)?
  The app detects the change on next online access and replaces the stale cached image.
- What happens when the local database is ahead of the server (e.g., user is on an older
  server version)?
  The local database is never written to directly by the user — it is read-only from the
  user's perspective. Sync only flows server → device.
- What happens when multiple sets are being downloaded simultaneously?
  Downloads are queued rather than run in parallel to avoid overwhelming device storage or
  network bandwidth.

## Requirements *(mandatory)*

### Functional Requirements

**Automatic Image Cache**

- **FR-001**: The app MUST cache every card image to local device storage the first time it
  is displayed.
- **FR-002**: Cached images MUST be served from local storage on subsequent views, regardless
  of network connectivity.
- **FR-003**: The app MUST display a visible placeholder for any card image that has not been
  cached when offline.
- **FR-004**: The app MUST refresh a cached image when a newer version is detected on the
  server during an online session.

**Cache Management**

- **FR-005**: The app MUST provide a cache management screen showing total storage used by
  cached images and the local database in human-readable units.
- **FR-006**: The user MUST be able to clear all cached images from the cache management
  screen.
- **FR-007**: Before starting any download, the app MUST display the device's current
  available storage and the estimated storage required for the download, then let the user
  decide whether to proceed.
- **FR-007a**: When available device storage falls below 10%, the app MUST additionally
  offer the user a "Don't notify me again" option. If selected, subsequent storage
  information notices are suppressed for future downloads until the user re-enables
  notifications in settings.
- **FR-007b**: The storage information notice MUST always show the exact figures
  (available space and download size) regardless of whether the "don't notify" preference
  is set — only the low-storage advisory is suppressible, not the figures themselves.
- **FR-008**: Each downloaded set MUST be listed individually in the cache management screen
  with its storage footprint and a delete option.

**Set Downloads**

- **FR-009**: The app MUST provide a set download screen listing all available Magic: The
  Gathering sets, with a clear indicator of which have been downloaded.
- **FR-010**: The user MUST be able to initiate a download of any complete set (all card
  images and card data for that set).
- **FR-011**: Set downloads MUST show real-time progress (cards downloaded / total cards in
  set).
- **FR-012**: Set downloads MUST continue when the app is backgrounded and notify the user
  on completion.
- **FR-013**: The user MUST be able to cancel an in-progress set download; cancellation MUST
  remove all partially downloaded data cleanly.
- **FR-014**: Set downloads MUST be queued sequentially; concurrent downloads of multiple
  sets are not permitted in this release.
- **FR-015**: The user MUST be able to delete a downloaded set from the cache management
  screen, removing all associated images and data.

**Local Card Database**

- **FR-016**: The app MUST maintain a local database of card data including: name, set, card
  number, mana cost, colour identity, and Commander legality status.
- **FR-017**: Card lookups and legality checks MUST be served from the local database when
  the device is offline.
- **FR-018**: The local database MUST update automatically in the background when new card
  data is available and the device is online.
- **FR-019**: The app MUST clearly communicate when the local database has never been synced
  and offline card data is therefore unavailable.
- **FR-020**: The local database is read-only from the user's perspective — users cannot
  manually edit it.

### Key Entities

- **Image Cache**: The collection of card images stored on the device. Each entry maps a
  card's image reference to a local file. Has a total size and a per-card last-fetched
  timestamp.
- **Downloaded Set**: A complete set that has been deliberately downloaded by the user.
  Contains all card images and card data for that set. Has a name, set code, card count,
  storage size, and download date.
- **Local Card Database**: A device-local copy of card data synced from the server. Contains
  card records (name, set, card number, mana cost, colour identity, Commander legality).
  Has a last-synced timestamp.
- **Download Queue**: The ordered list of set downloads pending or in progress. At most one
  download is active at a time.
- **Cache Entry**: A single cached image. Has an image reference, local file path, file size,
  and a timestamp indicating when it was cached.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A card image that has been previously viewed loads in under 200 milliseconds
  from the local cache on subsequent views.
- **SC-002**: A full set download for a set of 200 cards completes within 5 minutes on a
  standard mobile broadband connection.
- **SC-003**: The cache management screen accurately reports storage usage within 1 MB of
  actual disk usage.
- **SC-004**: 100% of card images cached before going offline are available and displayable
  without a network connection.
- **SC-005**: 100% of card lookups and legality checks succeed offline after the local
  database has been synced at least once.
- **SC-006**: A set download cancelled by the user leaves zero residual data on the device.
- **SC-007**: The local database sync completes in the background without any user-visible
  interruption to app usage.

## Assumptions

- Card images are referenced by a Scryfall image identifier (per spec 004); the image files
  themselves are fetched from the Scryfall image CDN and cached locally.
- The local card database is populated from card data served by the API server (spec 001),
  not fetched directly from MTGJSON by the mobile app — consistent with Principle VI
  (Layered Architecture).
- "Full set download" includes both card images and card metadata for every card in the set.
- The app always informs the user of available storage vs download size and lets the user
  decide whether to proceed. Below 10% available device storage, an additional low-storage
  advisory is shown with the option to suppress future advisories (not the size figures).
- Downloads continue in the background while the app is backgrounded, subject to the
  mobile OS's background task constraints.
- The local database is append/replace only — it is never modified by user actions, only
  by syncs from the server.
- Set download progress is measured in number of individual card images downloaded, not
  bytes transferred.
