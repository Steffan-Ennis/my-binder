# Feature Specification: Mobile Binder App

**Feature Branch**: `002-mobile-binder-app`
**Created**: 2026-03-21
**Status**: Draft
**Input**: User description: "a mobile application, the screen should appear like a binder —
see the images in design-resources, it should have a login screen, with user-name, password,
support multi factor authentication from a provider. We'll start with google."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In with Username and Password (Priority: P1)

A returning user opens the app and is greeted by a login screen. They enter their username
and password and are authenticated into their personal binder. The login screen visually
reflects the binder aesthetic — it feels like the cover of their physical collectors album.

**Why this priority**: Authentication is the front door to all other functionality. Without
it, no personalised binder content can be shown. It is the smallest independently deliverable
slice that proves the app exists and can protect personal data.

**Independent Test**: Can be fully tested by launching the app, entering valid credentials,
and confirming the user lands on their binder home screen — and by confirming that invalid
credentials are rejected with a clear message.

**Acceptance Scenarios**:

1. **Given** the app is launched, **When** the login screen appears, **Then** fields for
   username and password are visible and the screen reflects the binder visual theme.
2. **Given** the login screen is shown, **When** the user enters a valid username and password
   and submits, **Then** the user is authenticated and lands on their binder home screen.
3. **Given** the login screen is shown, **When** the user enters an incorrect password,
   **Then** a clear error message is displayed and the user remains on the login screen.
4. **Given** the login screen is shown, **When** the user submits with empty fields, **Then**
   each empty field is highlighted and a message indicates what is required.
5. **Given** the user is authenticated, **When** they close and reopen the app within the
   session window, **Then** they are not required to log in again.

---

### User Story 2 - Sign In with Google (Multi-Factor Authentication) (Priority: P2)

A user who prefers not to manage a separate password can tap "Sign in with Google" on the
login screen. They are taken through Google's own authentication flow — which may include
Google's built-in MFA — and land on their binder home screen upon success.

**Why this priority**: Google sign-in delegates credential management and MFA to a trusted
provider, significantly raising account security. It is independently deliverable alongside
or after basic login.

**Independent Test**: Can be fully tested by tapping the Google sign-in option, completing
Google's auth flow in a test account, and confirming the user lands on their binder home
screen with their account identity displayed.

**Acceptance Scenarios**:

1. **Given** the login screen is shown, **When** the user taps "Sign in with Google", **Then**
   Google's authentication flow is presented without leaving the app context.
2. **Given** the Google auth flow is in progress, **When** the user successfully authenticates
   with Google (including any MFA steps Google requires), **Then** the user is signed in and
   lands on their binder home screen.
3. **Given** the Google auth flow is in progress, **When** the user cancels or Google auth
   fails, **Then** the user is returned to the login screen with an appropriate message.
4. **Given** a user has previously signed in with Google, **When** they open the app again
   within the session window, **Then** they are not required to go through Google auth again.

---

### User Story 3 - Browse the Binder Home Screen (Priority: P3)

After signing in, the user sees their binder represented as a digital collectors album. The
home screen visually mirrors a physical 9-pocket binder page (3 columns × 3 rows of card
slots per page), matching the look of the reference images. The user can page through their
collection just as they would turn pages in a real binder.

**Why this priority**: This is the core visual experience that differentiates the app. It
delivers the binder aesthetic end-to-end and is the foundation all card management features
will build on.

**Independent Test**: Can be fully tested by signing in with an account that has cards in
its collection and confirming the 9-pocket grid layout is rendered, cards are displayed in
their slots, and the user can navigate between pages.

**Acceptance Scenarios**:

1. **Given** the user is authenticated, **When** the binder home screen loads, **Then** the
   screen displays a 3×3 grid of card slots resembling a physical binder page.
2. **Given** the binder home screen is shown, **When** the user's collection has cards,
   **Then** each card occupies a slot showing the card's front face.
3. **Given** the binder home screen is shown, **When** a card slot is empty, **Then** the
   slot appears as an empty pocket (visually distinct from a filled slot).
4. **Given** the binder has more than 9 cards, **When** the user swipes or taps to turn the
   page, **Then** the next page of 9 slots is shown in the same grid layout.
5. **Given** the user is on a page beyond the first, **When** they navigate back, **Then**
   the previous page is shown with its cards intact.

---

### Edge Cases

- What happens when the user's session expires while the app is backgrounded?
  The user is returned to the login screen when they next bring the app to the foreground,
  without losing their place in the binder.
- What happens when Google authentication is unavailable (no internet, Google service down)?
  A clear message informs the user that Google sign-in is temporarily unavailable and
  prompts them to try the username/password option instead.
- What happens when the user's collection is empty?
  The binder home screen shows an empty first page with all 9 slots visible but unfilled,
  and a prompt inviting the user to add their first card.
- What happens when the user has a partial last page (e.g., 11 cards = 1 full page + 2)?
  The second page shows 2 filled slots and 7 empty slots; no phantom cards are displayed.
- What happens when login is attempted with no network connection?
  A clear offline message is shown; the user is not left on a spinner indefinitely.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**

- **FR-001**: The app MUST present a login screen as the first screen on launch for
  unauthenticated users.
- **FR-002**: The login screen MUST include a username field, a password field, and a submit
  action.
- **FR-003**: The app MUST authenticate users with valid username and password credentials.
- **FR-004**: The app MUST reject invalid credentials and display a clear, user-friendly error
  message without revealing which field is incorrect.
- **FR-005**: The app MUST offer a "Sign in with Google" option on the login screen.
- **FR-006**: The app MUST complete Google authentication without requiring the user to leave
  the app to a browser (in-app auth flow).
- **FR-007**: The app MUST maintain an authenticated session so the user is not required to
  log in again on subsequent opens within the session period.
- **FR-008**: The app MUST allow the user to sign out, returning them to the login screen and
  clearing the active session.

**Binder Experience**

- **FR-009**: The binder home screen MUST display the user's card collection in a 3×3 grid
  layout (9 card slots per page), visually styled to resemble a physical pocket binder page.
- **FR-010**: Each card slot MUST display the card's front-face image when occupied.
- **FR-011**: Empty card slots MUST be visually distinguished from occupied slots (empty pocket
  appearance).
- **FR-012**: The user MUST be able to navigate between pages of 9 slots each, moving
  forward and backward through their collection.
- **FR-013**: The total number of pages MUST be derived from the size of the user's collection
  (rounded up to the nearest full page).
- **FR-014**: The app MUST display the current page number and total page count to help the
  user orient themselves within the binder.

### Key Entities

- **User**: The account holder. Has a unique identifier, username, and one or more
  authentication methods (password, Google).
- **Binder**: A personal collection belonging to a user, composed of ordered pages.
- **Page**: A single binder page holding up to 9 card slots in a 3×3 arrangement.
- **Card Slot**: A position within a page — either occupied by a card or empty.
- **Card**: A collectible card stored in a slot. Has at minimum a unique identifier, a name,
  and a front-face image.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can complete login (username/password) in under 60 seconds from
  first launching the app.
- **SC-002**: Google sign-in is completable in under 90 seconds including Google's own auth
  steps.
- **SC-003**: The binder home screen renders and is interactive within 2 seconds of
  successful authentication on a standard mobile device.
- **SC-004**: Invalid login attempts are rejected and an error is displayed within 3 seconds.
- **SC-005**: Page navigation between binder pages is visually smooth with no perceptible
  stutter on a standard mobile device.
- **SC-006**: 100% of unauthenticated app launches are intercepted by the login screen — no
  binder content is accessible without a valid session.
- **SC-007**: The binder layout correctly renders for collections ranging from 0 to at least
  1,000 cards without layout errors.

## Assumptions

- The app targets both iOS and Android.
- Google is the first supported MFA/SSO provider; additional providers (Apple, Facebook, etc.)
  are out of scope for this feature.
- Username is a text identifier chosen at registration; email address may serve as username
  (to be confirmed at registration feature spec time).
- Session persistence duration follows a standard "stay logged in" pattern — users are not
  forced to re-authenticate on every app open unless they explicitly sign out or the session
  expires.
- Card images are sourced from the server (feature spec 001); this spec does not define how
  images are fetched, only that they are displayed in slots.
- The binder visual theme is inspired by the physical Ultra Pro Collectors Album shown in
  design-resources: dark/navy cover aesthetic, transparent pocket pages, 3×3 card grid.
- Page navigation uses a horizontal swipe gesture and/or on-screen previous/next controls.
