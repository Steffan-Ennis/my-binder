# Feature Specification: Mobile Binder App

**Feature Branch**: `002-mobile-binder-app`
**Created**: 2026-03-21
**Status**: Draft
**Input**: User description: "a mobile application, the screen should appear like a binder —
see the images in design-resources, it should have a login screen, with user-name, password,
support multi factor authentication from a provider. We'll start with google."

## Clarifications

### Session 2026-05-01

- Q: With password removed, is Google the only sign-in path, or should the app also expose guest mode? → A: Google only — no guest mode, no other entry path
- Q: What should the app do when Google sign-in is unavailable (no internet, Google service outage, user cancels)? → A: Show a clear error with retry; user remains on the login screen until Google is reachable
- Q: What should the mobile app show when a Google-authenticated user is rejected by the server allowlist (`allowed_users` table, spec 011)? → A: Dedicated "access not yet granted" screen explaining the binder is invite-only, with contact instructions (future enhancement: redirect to a signup route — out of scope for this feature)
- Q: What is the mobile session duration before requiring fresh Google sign-in? → A: 7 days, matching server `SESSION_JWT_TTL_DAYS`
- Q: What does sign-out do? → A: Clear local session JWT AND revoke the Google grant so the user must re-consent (full Google flow) on next sign-in

### Session 2026-05-02

- Q: The first implementation attempt was abandoned and `apps/mobile/` was re-bootstrapped from `npx create-expo-app` on Expo SDK 54. What should be done with the template scaffolding the bootstrap left behind (demo screens, `HelloWave`/`ThemedText` components, Expo logo PNGs)? → A: Hybrid — delete the demo files in `app/(tabs)/`, `assets/images/`, `components/`, `components/ui/`, but preserve the template configs (`tsconfig.json` paths-to-be-rewritten, `eslint.config.js`, `app.json`, `expo-env.d.ts`, `assets/`) and update `apps/mobile/constants/theme.ts` to the wireframe v3 design tokens (deep crimson cover + warm dusty-gold accent + display serif). Subsequent feature work rebuilds against this slimmer baseline rather than wiping or fully refactoring the template.
- Q: The bootstrap actually pins `react-native@0.81.5` + `expo@~54.0` + `react@19.1` + `expo-router@~6.0` + `typescript@~5.9`, not RN 0.82 as initially mentioned. Should the constitution and plan be updated to those actual versions or force-upgraded to RN 0.82? → A: Pin the actual bootstrap versions (Option A). RN 0.82 is not yet certified on Expo SDK 54; the cleaner upgrade window is Expo SDK 55 when it ships with first-class RN 0.82 support. The constitution amendment, plan.md "Active Technologies" + Technical Context, tasks.md T002, and root CLAUDE.md MUST all reflect SDK 54.0.x / RN 0.81.5 / React 19.1 / Expo Router 6 / TypeScript 5.9.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In with Google (Priority: P1)

A user opens the app and is greeted by a login screen reflecting the binder aesthetic. The
only sign-in option is "Sign in with Google". They tap it, complete Google's authentication
flow (including any MFA steps Google enforces on their account), and land on their binder
home screen.

**Why this priority**: Authentication is the front door to all other functionality. Google
sign-in delegates credential management and MFA to a trusted provider and is the sole
authentication path for this feature (password authentication is postponed). Without it, no
personalised binder content can be shown.

**Independent Test**: Can be fully tested by launching the app, tapping "Sign in with Google",
completing Google's auth flow in a test account that is on the server allowlist, and
confirming the user lands on their binder home screen with their account identity displayed.

**Acceptance Scenarios**:

1. **Given** the app is launched, **When** the login screen appears, **Then** "Sign in with
   Google" is the only authentication option presented and the screen reflects the binder
   visual theme.
2. **Given** the login screen is shown, **When** the user taps "Sign in with Google", **Then**
   Google's authentication flow is presented without leaving the app context.
3. **Given** the Google auth flow is in progress, **When** the user successfully authenticates
   (including any MFA steps Google requires) AND their account is on the server allowlist,
   **Then** the user is signed in and lands on their binder home screen.
4. **Given** the Google auth flow is in progress, **When** the user cancels or Google auth
   fails, **Then** the user is returned to the login screen with a clear error and a retry
   action.
5. **Given** Google authentication succeeds, **When** the server rejects the user because
   their Google account is not on the allowlist, **Then** the app displays a dedicated
   "access not yet granted" screen explaining the binder is invite-only and how to request
   access.
6. **Given** a user signed in with Google within the last 7 days, **When** they open the app
   again, **Then** they are not required to go through Google auth again.
7. **Given** the user signs out, **When** they next tap "Sign in with Google", **Then** the
   full Google consent flow is presented again (the prior grant has been revoked).

---

### User Story 2 - Browse the Binder Home Screen (Priority: P2)

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

- What happens when the user's 7-day session expires while the app is backgrounded?
  The user is returned to the login screen when they next bring the app to the foreground,
  without losing their place in the binder.
- What happens when Google authentication is unavailable (no internet, Google service down,
  or the user cancels)?
  The user remains on the login screen with a clear, retryable error. There is no fallback
  authentication path — the user must wait until Google is reachable and retry.
- What happens when the user is rejected by the server allowlist after a successful Google
  sign-in?
  The app shows a dedicated "access not yet granted" screen explaining the binder is
  invite-only and how to request access. (A future enhancement may redirect to a self-serve
  signup route — out of scope for this feature.)
- What happens when the user's collection is empty?
  The binder home screen shows an empty first page with all 9 slots visible but unfilled,
  and a prompt inviting the user to add their first card.
- What happens when the user has a partial last page (e.g., 11 cards = 1 full page + 2)?
  The second page shows 2 filled slots and 7 empty slots; no phantom cards are displayed.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**

- **FR-001**: The app MUST present a login screen as the first screen on launch for
  unauthenticated users.
- **FR-002**: The login screen MUST present "Sign in with Google" as the only authentication
  option. No username/password fields are shown (password authentication is postponed).
- **FR-003**: The app MUST complete Google authentication without requiring the user to leave
  the app to an external browser (in-app auth flow).
- **FR-004**: When Google authentication is unavailable (no network, Google service outage,
  or user cancellation), the app MUST keep the user on the login screen and display a clear,
  retryable error. The app MUST NOT offer any non-Google authentication path.
- **FR-005**: When Google authentication succeeds but the server rejects the user because
  their account is not on the allowlist, the app MUST display a dedicated "access not yet
  granted" screen explaining the binder is invite-only and how to request access.
- **FR-006**: The app MUST maintain an authenticated session for 7 days (matching the server
  `SESSION_JWT_TTL_DAYS`) so the user is not required to sign in again on subsequent opens
  within that window.
- **FR-007**: When the 7-day session expires, the app MUST return the user to the login
  screen on next foreground without losing the binder page they were last viewing.
- **FR-008**: The app MUST allow the user to sign out. Sign-out MUST clear the local session
  and revoke the Google grant so that the next sign-in presents the full Google consent flow.

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

- **User**: The account holder. Identified by their Google account (the only authentication
  method in scope) and a server-side unique identifier. Must be present on the server's
  allowlist to access the binder.
- **Binder**: A personal collection belonging to a user, composed of ordered pages.
- **Page**: A single binder page holding up to 9 card slots in a 3×3 arrangement.
- **Card Slot**: A position within a page — either occupied by a card or empty.
- **Card**: A collectible card stored in a slot. Has at minimum a unique identifier, a name,
  and a front-face image.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Google sign-in is completable in under 90 seconds including Google's own auth
  steps, measured from tapping "Sign in with Google" to landing on the binder home screen.
- **SC-002**: A returning user with an unexpired (≤7 day) session reaches the binder home
  screen within 2 seconds of launching the app.
- **SC-003**: The binder home screen renders and is interactive within 2 seconds of
  successful authentication on a standard mobile device.
- **SC-004**: Google sign-in failures (outage, cancellation, allowlist rejection) surface a
  clear message within 3 seconds and never leave the user on a spinner indefinitely.
- **SC-005**: Page navigation between binder pages is visually smooth with no perceptible
  stutter on a standard mobile device.
- **SC-006**: 100% of unauthenticated app launches are intercepted by the login screen — no
  binder content is accessible without a valid session.
- **SC-007**: The binder layout correctly renders for collections ranging from 0 to at least
  1,000 cards without layout errors.
- **SC-008**: After sign-out, 100% of next sign-in attempts present the full Google consent
  flow (the prior grant is revoked).

## Assumptions

- The app targets both iOS and Android.
- Google is the only supported authentication provider in this feature. Username/password
  authentication is explicitly **postponed** and not in scope here. Additional federated
  providers (Apple, Facebook, etc.) are also out of scope.
- Guest mode (unauthenticated browsing) is not exposed in this feature, even though the
  server supports it (spec 007).
- A self-serve signup or invite-request flow may be added in a future feature; for now,
  allowlist additions are handled out-of-band.
- Session duration is fixed at 7 days to match the server `SESSION_JWT_TTL_DAYS` constant.
  Users are not forced to re-authenticate on every app open within that window unless they
  explicitly sign out.
- Sign-out revokes the Google grant in addition to clearing the local session, so the next
  sign-in presents the full Google consent flow.
- Card images are sourced from the server (feature spec 001); this spec does not define how
  images are fetched, only that they are displayed in slots.
- The binder visual theme is inspired by the physical Ultra Pro Collectors Album shown in
  design-resources: dark/navy cover aesthetic, transparent pocket pages, 3×3 card grid.
- Page navigation uses a horizontal swipe gesture and/or on-screen previous/next controls.
