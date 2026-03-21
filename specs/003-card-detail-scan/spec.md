# Feature Specification: Card Detail and Scan

**Feature Branch**: `003-card-detail-scan`
**Created**: 2026-03-21
**Status**: Draft
**Input**: User description: "clicking/pressing a card in your personal binder brings up its
details. It allows you to put it in a for sale binder, add it to a decklist (for the time
being we support 100 commander card formats for magic the gathering). In addition there is a
scan icon always present at the top of each page that allows the user to take a photograph of
a single/multiple cards and use character recognition and image recognition to recognise the
following: Card Name, Card Set, Card number, Card mana cost."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Card Details (Priority: P1)

The user is browsing their personal binder and taps on a card. A detail view opens showing
that card's full information — name, set, card number, and mana cost. From this view the user
can take further actions (move to for-sale binder, add to a decklist).

**Why this priority**: Viewing card details is the foundation for every other card-level
action. Without it, no subsequent interaction (selling, deck-building) can be initiated. It
is also the simplest increment and immediately delivers value on its own.

**Independent Test**: Can be fully tested by tapping any card in the binder and confirming
the correct card name, set, card number, and mana cost are displayed on the detail screen.

**Acceptance Scenarios**:

1. **Given** the user is on a binder page with cards, **When** they tap a card, **Then** a
   detail view opens showing that card's name, set, card number, and mana cost.
2. **Given** the card detail view is open, **When** the user inspects the card image, **Then**
   the full-size front-face image of the card is displayed.
3. **Given** the card detail view is open, **When** the user taps the back/close action,
   **Then** they are returned to their binder page at the same position.
4. **Given** a card has no mana cost (e.g., a land card), **When** the detail view opens,
   **Then** the mana cost field is either absent or shown as empty — no error is displayed.

---

### User Story 2 - Move Card to For-Sale Binder (Priority: P2)

From the card detail view, the user can flag the card as for sale. The card is added to a
separate "for sale" binder the user maintains. The card remains visible in the personal binder
until explicitly removed, with a visual indicator that it is listed for sale.

**Why this priority**: This directly enables the user to manage their selling workflow without
leaving the app. It is independently deliverable after the detail view exists.

**Independent Test**: Can be fully tested by opening a card's detail view, tapping "Add to
for-sale binder", and confirming the card appears in the for-sale binder and a sale indicator
is shown on the card in the personal binder.

**Acceptance Scenarios**:

1. **Given** the card detail view is open, **When** the user taps "Add to for-sale binder",
   **Then** the card is added to the for-sale binder and a visual indicator is shown on the
   card in the personal binder.
2. **Given** a card has already been added to the for-sale binder, **When** the user opens its
   detail view, **Then** the option shown is "Remove from for-sale binder" (not "Add").
3. **Given** a card is in the for-sale binder, **When** the user taps "Remove from for-sale
   binder" in the detail view, **Then** the card is removed from the for-sale binder and the
   sale indicator is removed from the personal binder.
4. **Given** a card has been added to the for-sale binder, **When** the user navigates to the
   for-sale binder view, **Then** that card appears there.

---

### User Story 3 - Add Card to a Commander Decklist (Priority: P3)

From the card detail view, the user can add the card to an existing Commander decklist or
create a new one. Commander format is enforced: a deck holds exactly 100 cards, one of which
is designated the Commander. The app prevents adding a card that would violate the 100-card
limit.

**Why this priority**: Deck management is a key use case for Magic players. It is independently
deliverable after card detail exists and adds significant utility to the app.

**Independent Test**: Can be fully tested by opening a card's detail, adding it to a new
Commander deck, confirming it appears in that deck, and verifying the deck count increments.

**Acceptance Scenarios**:

1. **Given** the card detail view is open, **When** the user taps "Add to decklist", **Then**
   they are presented with a list of their existing Commander decklists and an option to create
   a new one.
2. **Given** the user selects an existing decklist with fewer than 100 cards, **When** they
   confirm the addition, **Then** the card is added to that decklist and the deck count
   increments by one.
3. **Given** the user selects an existing decklist that already has 100 cards, **When** they
   attempt to add the card, **Then** the app prevents the addition and explains that the deck
   is full.
4. **Given** the user chooses to create a new decklist, **When** they provide a deck name and
   confirm, **Then** a new Commander decklist is created containing that card as its first
   entry.
5. **Given** a card has been added to a decklist, **When** the user views that decklist,
   **Then** the card appears in the list with its name, set, and mana cost visible.

---

### User Story 4 - Scan Cards into the Binder (Priority: P4)

A persistent scan icon is always visible at the top of every binder page. The user taps it
and takes a photograph of one or more physical cards. The app uses image and character
recognition to identify each card's name, set, card number, and mana cost. The user reviews
the recognised results, confirms or corrects them, and the identified cards are added to their
personal binder.

**Why this priority**: Scanning is the primary card-entry method for a real collector — it
is far faster than manual entry. It is placed at P4 because the binder, card detail, and
action flows must exist first, but it is the feature that will drive daily use.

**Independent Test**: Can be fully tested by tapping the scan icon, photographing a physical
Magic card, and confirming the app displays the correct name, set, card number, and mana cost
for review before saving to the binder.

**Acceptance Scenarios**:

1. **Given** the user is on any binder page, **When** they tap the scan icon, **Then** the
   device camera is activated in capture mode.
2. **Given** the camera is active, **When** the user photographs a single card, **Then** the
   app identifies the card name, set, card number, and mana cost and presents them for
   confirmation.
3. **Given** the camera is active, **When** the user photographs multiple cards in one image,
   **Then** the app identifies each card individually and presents all recognised results for
   review.
4. **Given** the recognition results are shown, **When** the user confirms a card, **Then** it
   is added to their personal binder.
5. **Given** the recognition results are shown, **When** the app is uncertain about a field,
   **Then** that field is visually flagged so the user knows to review or correct it before
   confirming.
6. **Given** the recognition results are shown, **When** the user corrects a misidentified
   field and confirms, **Then** the corrected values are saved (not the original guess).
7. **Given** the camera is active, **When** the user cancels without taking a photo, **Then**
   they are returned to the binder page with no changes made.

---

### Edge Cases

- What happens when a scanned card cannot be identified at all?
  The user is shown an "unrecognised card" result with all fields empty and editable, so they
  can enter the details manually before saving.
- What happens when the scan photo is too blurry or poorly lit?
  The app prompts the user to retake the photo rather than saving a low-confidence result
  silently.
- What happens when multiple cards in a multi-card scan overlap or are partially obscured?
  Each partially-recognised card is flagged individually; the user can confirm valid results
  and retake or manually correct unclear ones.
- What happens when the user tries to add a Commander-illegal card to a decklist?
  The app enforces full Commander legality rules: a card that violates the colour identity of
  the deck's Commander or appears on the Commander banned list is blocked with a clear
  explanation of why it cannot be added.
- What happens when the user taps a card in the for-sale binder?
  The same card detail view opens with all actions available (including "Add to decklist"
  and "Remove from for-sale binder") — there is a single unified card detail menu regardless
  of which binder view the user tapped from.

## Requirements *(mandatory)*

### Functional Requirements

**Card Detail View**

- **FR-001**: The app MUST open a card detail view when the user taps any card in the personal
  binder.
- **FR-002**: The card detail view MUST display the card's name, set, card number, mana cost,
  and front-face image.
- **FR-003**: The card detail view MUST provide a clear action to return to the binder page
  without any changes.

**For-Sale Binder**

- **FR-004**: The card detail view MUST include an "Add to for-sale binder" action for cards
  not already listed for sale.
- **FR-005**: The card detail view MUST include a "Remove from for-sale binder" action for
  cards already listed.
- **FR-006**: Cards listed for sale MUST be visually marked with a for-sale indicator in the
  personal binder view.
- **FR-007**: The app MUST maintain a dedicated for-sale binder view showing all cards the
  user has listed.

**Commander Decklists**

- **FR-008**: The card detail view MUST include an "Add to decklist" action.
- **FR-009**: The app MUST present the user's existing Commander decklists and an option to
  create a new one when "Add to decklist" is tapped.
- **FR-010**: The app MUST enforce a maximum of 100 cards per Commander decklist and prevent
  additions that would exceed this limit.
- **FR-011**: The user MUST be able to name a new decklist when creating it.
- **FR-012**: Each decklist MUST display its current card count alongside its name.
- **FR-013**: The app MUST enforce Commander format rules in full: the 100-card limit, colour
  identity restrictions (all cards must match the Commander's colour identity), and the
  Commander banned list. Cards violating any rule MUST be blocked with a clear explanation.
- **FR-013a**: The app MUST require a Commander card to be designated when a new decklist is
  created, so colour identity can be validated for all subsequent additions.
- **FR-014**: The card detail view MUST be the single unified detail menu regardless of which
  binder view (personal binder or for-sale binder) the user tapped from — all actions are
  available in both contexts.

**Card Scanning**

- **FR-015**: A scan icon MUST be persistently visible at the top of every binder page.
- **FR-016**: Tapping the scan icon MUST activate the device camera in a capture mode.
- **FR-017**: The app MUST use image and character recognition to identify the following fields
  from a card photograph: Card Name, Card Set, Card Number, Card Mana Cost.
- **FR-018**: The app MUST support scanning a single card in one photograph.
- **FR-019**: The app MUST support scanning multiple cards captured in a single photograph,
  identifying each card individually.
- **FR-020**: Recognition results MUST be presented to the user for review and confirmation
  before any card is saved to the binder.
- **FR-021**: Fields the app is uncertain about MUST be visually flagged so the user can
  review or correct them.
- **FR-022**: The user MUST be able to edit any recognised field before confirming.
- **FR-023**: Confirmed cards MUST be added to the user's personal binder.
- **FR-024**: The user MUST be able to cancel scanning at any point without modifying the
  binder.

### Key Entities

- **Card**: A single Magic: The Gathering card. Attributes relevant to this feature: name,
  set, card number, mana cost, front-face image. A card may exist in the personal binder,
  the for-sale binder, and one or more decklists simultaneously.
- **For-Sale Binder**: A filtered view of cards the user has marked as available for sale.
  Not a separate copy of the card — a status flag on the card's binder entry.
- **Decklist**: A named collection of cards in Commander format. Has a name, a card count
  (max 100), and an ordered list of card entries.
- **Scan Session**: A single use of the scan feature — one camera activation, one or more
  cards photographed, recognition results reviewed, and zero or more cards confirmed into the
  binder.
- **Recognition Result**: The app's best-guess identification of a card from a photograph.
  Contains: card name, set, card number, mana cost, and a confidence indicator per field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The card detail view opens within 1 second of the user tapping a card.
- **SC-002**: A user can move a card to the for-sale binder in under 10 seconds from tapping
  the card.
- **SC-003**: A user can add a card to an existing decklist in under 15 seconds from tapping
  the card.
- **SC-004**: The scan feature correctly identifies card name, set, card number, and mana cost
  for at least 85% of cards photographed under reasonable lighting conditions.
- **SC-005**: Recognition results for a single scanned card are presented to the user within
  5 seconds of the photograph being taken.
- **SC-006**: Recognition results for a multi-card photograph (up to 9 cards) are presented
  within 15 seconds.
- **SC-007**: 100% of decklist additions that would exceed 100 cards are blocked with a
  clear explanation.
- **SC-008**: A user can complete a full scan-to-binder flow (scan, review, confirm) for a
  single card in under 30 seconds.

## Assumptions

- The for-sale binder is a status/view on the user's personal binder, not a separate storage
  location — a card can appear in both the personal binder and the for-sale binder at the
  same time.
- Commander is the only supported deck format for this release; other formats (Standard,
  Modern, etc.) are out of scope.
- Decklists belong to the authenticated user and are stored in the same account as the binder.
- The scan feature requires device camera permission; the app will request this permission
  on first use.
- Card recognition draws on a card database (provided by the server, spec 001) for matching
  scanned cards — the app does not maintain a local card database.
- A card can be added to multiple decklists (not limited to one).
- The scan icon is rendered above the 3×3 grid on every binder page, consistent with the
  layout defined in spec 002.
- Mana cost for land cards (which have no mana cost) is represented as an explicitly empty
  value, not an error.
