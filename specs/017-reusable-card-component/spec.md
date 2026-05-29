# Feature Specification: Reusable Card Component

**Feature Branch**: `017-reusable-card-component`
**Created**: 2026-05-16
**Status**: Draft
**Input**: User description: "a reusable card component that can be rendered in multiple screens. While in a loading state a skeleton inside the a dashed border should be displayed the following screen will need that [Image #1]. In addition the component should encapsulate the request to get the image for that card via the cards/images/:id route in the server."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Card image self-loads inside the dashed-border frame (Priority: P1)

A user opens any screen that displays one or more of their cards (today: the
binder home page; tomorrow: search results, scan results, card detail). Each
card slot immediately shows the same dashed-border frame with a skeleton inside
it. As the card images arrive from the server, each frame swaps the skeleton
for the rendered card image without any layout shift. The user never sees a
blank gap, never sees a layout reflow, and never has to wait for the *whole*
page before *any* card appears.

**Why this priority**: This is the only behaviour the user actually sees. The
reuse and encapsulation goals are means to an end — the end is a consistent,
non-jumpy loading experience for card images on every screen that shows them.
Without this story, the feature has no observable value.

**Independent Test**: Open the binder home view (the screen in the supplied
wireframe) on a fresh session with no warm image cache. Confirm that every
slot on the visible page shows a dashed-border frame with a skeleton inside it
within the first frame, and that each frame transitions to the rendered card
image as the per-card image request completes, with no layout shift in the
3×3 grid and no visible flash.

**Acceptance Scenarios**:

1. **Given** a screen renders a card by id and no image for that id is cached,
   **When** the screen first mounts,
   **Then** the card slot shows a dashed-border frame with a skeleton inside
   it within the first paint, before any network response has been received.
2. **Given** a card slot is in the loading state with a dashed border and a
   skeleton inside,
   **When** the per-card image request completes successfully,
   **Then** the slot swaps the skeleton for the card image inside the same
   dashed-border footprint, with no change to the slot's outer dimensions and
   no visible flash between the two states.
3. **Given** the binder home page renders 9 card slots,
   **When** the page first mounts,
   **Then** each slot independently shows its own dashed-border-with-skeleton
   state and independently transitions to its rendered image as its own
   request completes — slots do not wait for any other slot to finish.

---

### User Story 2 - Warm-cache renders feel instant (Priority: P2)

A user who has already viewed a particular card during their current session
(by browsing past it on the binder, opening it in search results, or scanning
it) revisits a screen that shows the same card. The card image renders
immediately from the warm cache, without a visible skeleton-to-image
transition.

**Why this priority**: Returning users spend most of their time re-visiting
the same pages of their binder. A perceptible skeleton flash on every revisit
makes the app feel slow even when it is fast. Warm-cache rendering is what
makes the reusable component pull its weight relative to inline image tags.

**Independent Test**: Render a screen that displays card X, wait for the
image to load, navigate away, then navigate back. Confirm that the second
render shows the rendered image immediately on the first paint, without a
dashed-border-skeleton interstitial.

**Acceptance Scenarios**:

1. **Given** a card's image has already been fetched and rendered earlier in
   the same session,
   **When** the user navigates to another screen that renders the same card,
   **Then** the new screen displays the card image on its first paint, with
   no skeleton interstitial.
2. **Given** the same card id is rendered in two different slots on the same
   screen at the same time (e.g., a card appears in both the binder and a
   search-results overlay),
   **When** the screen first mounts,
   **Then** the system issues at most one image request for that card id and
   both slots resolve from the shared cache.

---

### User Story 3 - Broken or missing card image fails gracefully (Priority: P3)

A user opens a screen that includes a card whose image cannot be retrieved —
either because the card id is unknown to the server (404) or because the
image service is temporarily unavailable (network error / 503). Instead of
showing an indefinite skeleton, the card slot surfaces a clear fallback
inside the same dashed-border frame so the user can tell the difference
between "still loading" and "couldn't load."

**Why this priority**: This is an edge-case guard, not a primary flow. Most
users will never hit it, but a card that sits in a dashed-border skeleton
forever is indistinguishable from a hung app. Surfacing a distinct failure
state makes the loading state itself trustworthy.

**Independent Test**: Render the card component with an id that the server
returns 404 for. Confirm the slot exits the skeleton state within the
component's failure timeout and renders a distinct fallback inside the
dashed-border frame (e.g., a broken-image glyph or a "couldn't load"
indicator). Repeat with the image service offline; confirm the fallback
includes a way to retry.

**Acceptance Scenarios**:

1. **Given** the server returns 404 for a card id,
   **When** the card component requests the image,
   **Then** the slot exits the skeleton state and renders a distinct
   not-found fallback inside the same dashed-border frame, never reverting
   to an indefinite skeleton.
2. **Given** the image request fails with a network error or 503,
   **When** the card component has exhausted its retry budget,
   **Then** the slot renders an error fallback inside the dashed-border
   frame with a way for the user to retry the load on demand.

---

### Edge Cases

- **Duplicate renders on one screen.** The same card id rendered in N slots
  simultaneously MUST issue exactly one image request and resolve all N
  slots from the shared result.
- **Component unmounts mid-fetch.** A card slot that disappears before its
  image arrives (the user swipes to another binder page, dismisses a search
  overlay, etc.) MUST NOT trigger errors, MUST NOT leak the in-flight request,
  and MUST NOT cause a "set state on unmounted component" warning.
- **Session expiry during a fetch.** If the image request fails with an
  authentication error (401), the slot MUST surface the error fallback per
  US3 — re-authentication is the responsibility of the existing session flow,
  not the card component.
- **Image arrives after the slot's card id has changed.** A slot whose `id`
  prop changes mid-flight (parent reassigns the slot to a different card)
  MUST discard the in-flight response and start a fresh fetch for the new id;
  it MUST NOT briefly render the old card's image.
- **Slow image fetch.** A card whose image takes longer than typical
  (multi-second) MUST remain in the dashed-border-skeleton state for the
  full duration — the skeleton is the only acceptable interstitial.
- **Repeated retries.** A user who taps "retry" on the error fallback (per
  US3) MUST trigger a fresh fetch each time, without inheriting the cached
  failure from the previous attempt.
- **Empty slot vs. loading slot.** Empty pockets on a binder page (slots
  with no card assigned) remain a separate visual concern of the consuming
  screen and are out of scope for this component. The component is for slots
  with a known card id only.

## Clarifications

### Session 2026-05-16

- Q: Does the `/cards` list endpoint still pre-populate `frontFaceImageUrl`, or
  does the new component own image-URL retrieval exclusively?
  → A: The `/cards` query no longer returns `frontFaceImageUrl`. The reusable
  card component is the sole owner of image-URL retrieval via
  `/cards/images/:id`. Rationale: constructing the image URL server-side is
  expensive enough that paying that cost for every card in the list
  (potentially hundreds — see the wireframe's "426 CARDS · 48 PAGES" header)
  on every page load is unacceptable. Per-card lazy loading via the new
  component spreads the cost over only the slots the user actually views.
- Q: Which image variant from `/cards/images/:id` fills the standard
  binder-pocket footprint? → A: medium. Rationale: the small variant
  blurs on retina screens; large doubles bandwidth for no perceptible
  pocket-size gain. Medium is sharp on 3× displays at a ~120pt pocket
  width and keeps the per-page payload reasonable across all 9 visible
  slots.
- Q: Does the warm-cache experience (SC-002) need to survive an app
  restart? → A: In-memory only for this feature, handled by the
  existing TanStack Query cache. Cross-session persistence is
  explicitly out of scope and will be revisited later as part of a
  holistic local-storage solution for the whole app. SC-002 therefore
  applies within-session only: revisiting a card during the same app
  session renders instantly from the in-memory cache; revisiting it
  after a cold app launch repays the per-card `/cards/images/:id`
  request.
- Q: What's the retry policy when an image fetch fails with a server
  error or network failure? → A: TanStack Query's built-in exponential
  back-off with **5 attempts** (overriding the project-wide default of
  3). Back-off follows TanStack's default schedule (1s → 2s → 4s → 8s →
  16s, capped at 30s). 4xx responses (including the 404 not-found path
  per FR-005) MUST skip retry and surface immediately. The user-tappable
  retry per FR-006 is the recovery affordance *after* all 5 automatic
  attempts have failed.
- Q: How many distinct footprint sizes must the component support at
  launch? → A: Exactly **two** — `pocket` (medium variant) and `detail`
  (large variant). The small variant is not consumed by this component
  and is not reserved for any future use here; if a future screen needs
  a smaller card rendering, it will be revisited then. This tightens
  FR-009's "at least one additional larger footprint" lower bound to a
  hard count of two.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single reusable card component that
  any screen can render by passing only a card id. Consuming screens MUST
  NOT need to fetch the card's image URL themselves or pass it as a prop.
- **FR-002**: The component MUST render a dashed-border frame with a
  skeleton inside it while the card's image is loading. The dashed-border
  appearance MUST match the binder-home loading state shown in the supplied
  wireframe (consistent border radius, dashed stroke style, and inner padding
  with the existing binder pocket).
- **FR-003**: The component MUST fetch the card's image via the existing
  `/cards/images/:id` route on the server. The fetch MUST start automatically
  when the component mounts with a card id.
- **FR-004**: Once the image has loaded, the component MUST display the
  card's front face image filling the same dashed-border footprint that the
  skeleton occupied, with no change to outer dimensions.
- **FR-005**: When the server returns a not-found response for the card id,
  the component MUST render a distinct not-found fallback inside the
  dashed-border frame and MUST exit the skeleton state. An indefinite
  skeleton on a not-found id is prohibited.
- **FR-006**: When the image request fails due to a network or
  service-unavailable error, the system MUST automatically retry the
  request up to **5 times** with exponential back-off (1s → 2s → 4s →
  8s → 16s, capped at 30s). 4xx responses (including the 404 not-found
  path handled by FR-005) MUST skip retry and surface immediately.
  After all 5 automatic attempts have failed, the component MUST render
  an error fallback inside the dashed-border frame that includes a way
  for the user to retry the request on demand.
- **FR-007**: When the same card id is rendered in multiple component
  instances simultaneously, the system MUST issue at most one image request
  per card id and resolve every instance from the shared result
  (request deduplication).
- **FR-008**: When a card's image has already been retrieved earlier in the
  user's current session, subsequent renders of the same card id MUST
  display the image on the first paint without a visible skeleton
  interstitial (warm-cache render).
- **FR-009**: The component MUST support exactly two footprints:
  `pocket` (the standard binder pocket size used in the wireframe,
  rendered with the medium image variant) and `detail` (a larger
  single-card presentation, rendered with the large image variant).
  The footprint MUST be selectable by the consuming screen via a single
  prop, with no code changes to the component required to switch
  between them.
- **FR-010**: The component MUST be testable in isolation. Each of its
  visible states (loading, loaded, not-found, error) MUST be reachable in a
  test environment without making real network calls.
- **FR-011**: The skeleton-to-image transition MUST NOT cause a visible
  layout shift in the surrounding grid or page. The dashed-border frame's
  outer dimensions in the loading state MUST equal the rendered image's
  outer dimensions in the loaded state.
- **FR-012**: A component instance whose card id prop changes while a
  previous image request is still in flight MUST discard the in-flight
  response and start a fresh request for the new id. The slot MUST NOT
  briefly render the previous card's image.
- **FR-013**: The component MUST be safe to unmount while a fetch is in
  progress: in-flight requests MUST be cancelled or detached, with no error
  surfaced to the user and no warning logged.
- **FR-014**: The `/cards` list endpoint MUST NOT return image URLs in its
  response payload. Image-URL retrieval is the exclusive responsibility of
  the reusable card component (via `/cards/images/:id`). Removing the URL
  from the list response is required because server-side image-URL
  construction is expensive and MUST NOT be paid for cards the user never
  views.
- **FR-015**: The component's image-URL cache MUST be in-memory only for
  this feature. Cross-session (cold-launch) persistence is explicitly out
  of scope and is deferred to a future holistic local-storage initiative
  for the app. Cold app launches MUST repay the `/cards/images/:id`
  request for every viewed slot — this is an accepted trade-off given the
  in-memory hit-rate during a single session.

### Key Entities

- **Card image set**: For a given card id, the set of image URLs the server
  returns from `/cards/images/:id` (small, medium, large variants). The
  component selects the variant appropriate to its rendered footprint
  without exposing that choice to consuming screens. The `pocket`
  footprint MUST use the **medium** variant; the `detail` footprint MUST
  use the **large** variant. The **small** variant is not consumed by
  this component.
- **Card slot**: A rectangular display area in a consuming screen into
  which the reusable card component renders. The slot's outer dimensions
  are governed by the consuming screen; the component fills them in both
  the loading state (dashed border + skeleton) and the loaded state
  (rendered image).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new screen can adopt the component by passing only a card
  id — zero additional fetch wiring, store hookups, or prop plumbing is
  required from the consuming screen. Verified by demonstrating the
  component dropped into a second screen with a single line of JSX.
- **SC-002**: Within the same app session, on a warm cache, 95% of
  card-component renders display the rendered image on the first paint
  with no visible skeleton interstitial. Cross-session warm-cache
  behaviour is out of scope and deferred to a future holistic
  local-storage initiative.
- **SC-003**: On a cold cache with a 9-slot screen (binder home page), 100%
  of slots exit the dashed-border-skeleton state within the same time
  envelope as today's binder-home image load (no regression vs. the spec
  016 baseline).
- **SC-004**: The skeleton-to-image transition produces zero measurable
  layout shift in the surrounding grid for 100% of renders (the loading and
  loaded states share identical outer dimensions).
- **SC-005**: Every component state (loading, loaded, not-found, error) is
  covered by at least one component-level test that does not make a real
  network call.
- **SC-006**: After adoption on the binder home view, all spec 016
  loading-state behavioural tests continue to pass without modification of
  the assertions (the dashed-border-skeleton frame remains the visible
  loading state on the binder home page).

## Assumptions

- **The server route already exists.** `/cards/images/:id` is live in
  `apps/server` and returns a payload that includes the image URLs the
  component needs. The component is a *consumer* of this route. The only
  server-side work in scope for this feature is the removal of
  `frontFaceImageUrl` from the `/cards` list endpoint's response payload
  per FR-014.
- **Server-side image-URL construction is expensive.** Producing the image
  URLs for a card is costly enough that returning them for every card in a
  list response is not viable at the binder's scale (the wireframe header
  shows "426 CARDS · 48 PAGES"). This is the load-bearing reason for FR-001
  and FR-014: image-URL retrieval is per-card-on-demand, not bulk-on-list.
- **Authentication is handled upstream.** The image route requires an
  authenticated session; the existing session flow already attaches the
  Bearer token to outbound requests. The component does not own
  authentication logic.
- **The dashed-border visual is already designed.** The supplied wireframe
  (binder home loading state) is the canonical reference for the loading
  appearance. The component re-uses those design tokens; no new design
  decisions are introduced.
- **Empty slots are a separate concern.** Binder pages can contain pockets
  with no card assigned. Those empty slots are rendered by the consuming
  screen, not by this component. The component is exclusively for slots
  with a known card id.
- **Reuse across screens is the goal, not a side-effect.** Today the only
  consumer is the binder home view, replacing its inline pocket markup.
  Tomorrow's consumers (search results, scan results, card detail) inherit
  the same loading-state contract without re-implementing it.
- **One image size variant per footprint is sufficient.** The component
  picks the appropriate image variant for its current footprint internally;
  consuming screens do not specify a variant. Footprint switching (binder
  pocket vs. detail) is exposed through a high-level size selector, not
  through raw URL choice.
