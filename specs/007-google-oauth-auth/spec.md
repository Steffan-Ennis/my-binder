# Feature Specification: Google OAuth Authentication with Guest Mode

**Feature Branch**: `007-google-oauth-auth`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "incognito with google oauth for authentication"

## Overview

Users need a way to access the card binder application both anonymously (guest/incognito mode) and with a persistent identity via Google sign-in. Authenticated users retain their collection data across sessions and devices, while guest users can explore the app without commitment.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In with Google (Priority: P1)

A registered or first-time user opens the app and taps "Sign in with Google." They are redirected to the Google consent screen, grant permission, and are returned to the app as an authenticated user. Their name and profile picture are visible in the app.

**Why this priority**: The core authentication flow is foundational — all personalized features (saved binders, sync) depend on a verified identity.

**Independent Test**: Can be fully tested by opening the sign-in screen, completing the Google consent flow, and verifying the user is recognized and greeted by name in the app.

**Acceptance Scenarios**:

1. **Given** a user is not signed in, **When** they tap "Sign in with Google" and complete the consent screen, **Then** they are returned to the app and shown as authenticated with their Google display name and avatar.
2. **Given** a user denies permissions on the Google consent screen, **When** they are returned to the app, **Then** they remain in guest mode and see a non-blocking explanation of why sign-in failed.
3. **Given** a previously authenticated user reopens the app, **When** their session is still valid, **Then** they are automatically signed in without needing to repeat the Google flow.

---

### User Story 2 - Use App as Guest (Incognito Mode) (Priority: P2)

A user opens the app and chooses not to sign in. They can browse card data, view binders, and interact with the app with no account required. Their session data is local only and is not persisted beyond the current session.

**Why this priority**: Guest mode lowers the barrier to entry — new users can evaluate the app before committing to an account.

**Independent Test**: Can be fully tested by launching the app, skipping sign-in, and confirming all read-only browsing features are accessible without credentials.

**Acceptance Scenarios**:

1. **Given** a user opens the app for the first time, **When** they dismiss or skip the sign-in prompt, **Then** they can browse cards and binders in guest mode with no account required.
2. **Given** a guest user is browsing the app, **When** they attempt an action that requires authentication (e.g., saving a binder), **Then** they are shown a prompt offering to sign in with Google before the action proceeds.
3. **Given** a guest user closes and reopens the app, **When** their previous session ended, **Then** no personal data from the prior guest session is retained.

---

### User Story 3 - Sign Out (Priority: P3)

An authenticated user chooses to sign out. After signing out, they are returned to the unauthenticated (guest) state and their personal data is no longer accessible on the device.

**Why this priority**: Sign-out is a necessary complement to sign-in and is required for shared-device safety and privacy.

**Independent Test**: Can be fully tested by signing in, triggering sign-out, and verifying the user is returned to the guest state with no personal data visible.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they select "Sign Out," **Then** they are returned to guest mode and their personal data is cleared from the current session.
2. **Given** a guest user, **When** they view account settings, **Then** the sign-out option is not present or is disabled.

---

### Edge Cases

- What happens when the device has no internet connection during the Google sign-in flow? The user sees a clear offline error and can continue as guest.
- What happens if Google's OAuth service is temporarily unavailable? The user sees a friendly error message; guest mode remains accessible.
- What happens when a user's Google account authorization is revoked after initial sign-in? On the next app open, the session is invalidated and the user is prompted to sign in again.
- What happens when the same Google account is used on a second device? Both devices reflect the authenticated user's data without conflict.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide a "Sign in with Google" option on the authentication screen.
- **FR-002**: The app MUST allow users to bypass sign-in and continue as a guest (incognito/anonymous mode).
- **FR-003**: After a successful Google sign-in, the app MUST display the user's Google display name and profile picture.
- **FR-004**: The app MUST persist an authenticated session across app restarts so users are not forced to re-authenticate on every launch.
- **FR-005**: The app MUST provide a "Sign Out" action that ends the authenticated session and clears personal data from the local session.
- **FR-006**: The app MUST gate any write or personalization actions (e.g., saving a binder) behind authentication, prompting guest users to sign in before proceeding.
- **FR-007**: The app MUST handle Google sign-in failures gracefully, showing a user-friendly error without crashing or losing state.
- **FR-008**: The app MUST NOT retain guest session data between separate app launches.
- **FR-009**: The system MUST invalidate sessions when the associated Google account authorization is revoked, prompting re-authentication on next launch.

### Key Entities

- **User**: Represents a person using the app. Has two modes: guest (anonymous, no persistent identity) and authenticated (associated with a Google account). Authenticated users have a display name, avatar, and a stable identifier.
- **Session**: Tracks the current authentication state for a given app launch. Guest sessions are ephemeral; authenticated sessions persist until sign-out or revocation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the full Google sign-in flow (from tap to authenticated state) in under 30 seconds on a standard mobile connection.
- **SC-002**: 100% of app actions that require a saved identity prompt unauthenticated users to sign in before proceeding — no silent failures or data loss.
- **SC-003**: Returning authenticated users are signed in automatically (no re-authentication required) 100% of the time while their session remains valid.
- **SC-004**: Guest users can access all read-only features of the app with zero sign-in prompts — browsing is frictionless.
- **SC-005**: Sign-out completes in under 2 seconds, after which no personal data from the signed-out account is accessible in the current session.

## Assumptions

- Google OAuth is the only third-party identity provider in scope for this feature. Additional providers (Apple, email/password) are out of scope.
- The mobile app (iOS + Android) is the primary target. Web authentication is out of scope unless specified separately.
- "Incognito" mode is interpreted as an anonymous guest session — not a privacy browser mode. Guest sessions are local only and non-persistent.
- The Google Cloud project and OAuth credentials for this app will be configured prior to implementation.
