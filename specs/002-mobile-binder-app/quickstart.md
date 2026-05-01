# Quickstart: Mobile Binder App

**Feature**: 002-mobile-binder-app
**Date**: 2026-05-01

This quickstart describes how to scaffold, run, and test `apps/mobile` once the implementation
lands. It double-serves as the **end-to-end success criteria**: when every step here passes
on a developer machine, the feature is ready for store builds.

---

## Prerequisites

Same as the rest of the monorepo:

```bash
nvm use            # Node 22 (.nvmrc)
pnpm install       # workspace deps
```

Mobile-specific extras (one-time per machine):

| Tool | Purpose | Install |
|---|---|---|
| Xcode 15+ | iOS Simulator | App Store |
| Android Studio Hedgehog+ | Android emulator | https://developer.android.com/studio |
| Watchman | RN file-watching | `brew install watchman` |
| EAS CLI (later) | Store build pipeline (out of scope for local dev) | `pnpm add -g eas-cli` |

---

## Local development

### 1. Configure env

`apps/mobile` reads its config via `expo-constants` from `apps/mobile/app.json` (`expo.extra`)
combined with environment variables loaded via `app.config.ts`. For local development, copy
the example file and adjust the API base URL:

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
# Edit .env.local — set API_BASE_URL=http://localhost:3000
```

`.env.local` is gitignored (matches the existing `apps/server` convention).

Required variables:

| Var | Purpose |
|---|---|
| `API_BASE_URL` | Base URL for the API server. Local dev: `http://localhost:3000`. |
| `GOOGLE_IOS_CLIENT_ID` | iOS-specific OAuth 2.0 client ID from Google Cloud Console. |
| `GOOGLE_ANDROID_CLIENT_ID` | Android-specific OAuth 2.0 client ID. |
| `GOOGLE_WEB_CLIENT_ID` | Same web client ID the server validates ID tokens against. |

### 2. Start the server

In one terminal:

```bash
pnpm --filter @my-binder/server dev
# Listens on http://localhost:3000
```

### 3. Start the mobile app

In a second terminal:

```bash
pnpm --filter @my-binder/mobile dev
# Or equivalently:
turbo dev --filter=@my-binder/mobile
```

This launches the Expo dev server. Press `i` to open the iOS Simulator, `a` for Android
emulator, or scan the QR code with Expo Go on a physical device.

### 4. Sign in

- Tap **Sign in with Google**.
- Complete Google's flow in the in-app browser sheet.
- Land on `BinderHome` if your Google account is on the server allowlist; land on
  `AccessDenied` otherwise (US1.AS5).

To add yourself to the allowlist locally, see `apps/server/README.md` for the
`allowed_users` table seed instructions.

---

## Running tests

### All mobile tests

```bash
pnpm --filter @my-binder/mobile test
```

### Watch mode

```bash
pnpm --filter @my-binder/mobile test --watch
```

### Coverage

```bash
pnpm --filter @my-binder/mobile test --coverage
```

The `coverageThreshold` in `apps/mobile/jest.config.ts` enforces the floors declared in
`plan.md`'s Unit Testing Phase (80% global, 90/95% on the load-bearing hooks).

### Whole-monorepo CI run

```bash
turbo test
turbo typecheck
```

Both pass cleanly is the gate for `main`.

---

## End-to-end success criteria (manual)

These manual checks correspond to the spec's Success Criteria and Acceptance Scenarios.
Run them on at least one iOS Simulator and one Android emulator before declaring the feature
done.

| ID | Check | Expected result |
|---|---|---|
| SC-001 | Tap "Sign in with Google" → complete Google flow with an allowlisted account | BinderHome visible within 90s end-to-end (US1.AS3). |
| SC-002 | Reopen the app within 7 days of last successful sign-in | BinderHome appears within 2s; no Google flow shown (US1.AS6). |
| SC-003 | On BinderHome cold-load | 3×3 grid is rendered and interactive within 2s of authentication. |
| SC-004 | Toggle Airplane mode, tap "Sign in with Google" | Retryable error banner within 3s; user remains on Login (FR-004). |
| SC-005 | Swipe through 50+ pages | No perceptible stutter (60fps target). |
| SC-006 | Cold-launch the app with no session | Login screen appears; no binder content is rendered first. |
| SC-007 | Seed the test account with 0, 9, 11, and 1000 cards | Layout is correct for each (1, 1, 2, and 112 pages respectively); partial last pages show empty trailing slots, never phantom cards. |
| SC-008 | Sign out, then tap "Sign in with Google" again | Google's full consent flow appears (the prior grant is revoked, US1.AS7). |

| Edge case | Check | Expected result |
|---|---|---|
| Allowlist rejection | Sign in with a Google account NOT on the allowlist | AccessDeniedScreen appears with the "access not yet granted" message and contact CTA. |
| Session expiry | Manually edit `expo-secure-store` to set `iat` to 8 days ago, reopen app | Login screen appears (FR-007). |
| Empty collection | Allowlisted user with 0 cards | BinderHome shows page 1 of 1 with all 9 slots empty and the "add your first card" prompt. |

### Tab shell verification (matches v3 wireframe)

| Check | Expected result |
|---|---|
| After successful sign-in, observe the bottom of the screen | A four-tab bar is visible with labels Binder, Search, Scan, Profile and Ionicons-style glyphs matching the v3 wireframe. |
| Initial selected tab on landing | Binder, with the active-state filled glyph. The 3×3 binder grid is rendered above the tab bar (US2). |
| Tap "Search" | Tab indicator moves; the Search route renders the `<ComingSoonContainer feature="search" />` placeholder with title + message + icon. No errors, no "white screen". |
| Tap "Scan" | Same placeholder pattern with the scan-specific copy and glyph. |
| Tap "Profile" | Same placeholder pattern with the profile-specific copy and glyph. |
| Tap "Binder" again | Returns to the live binder, preserving the page the user was on (Expo Router default behaviour for tab navigators). |
| Sign out from anywhere within the tabs | Returns to the Login screen and the tab bar disappears (the entire `(authenticated)` group unmounts). |

---

## Building for the stores (out of scope here, listed for completeness)

`/speckit.tasks` will add EAS Build configuration in a follow-up phase. For now:

```bash
# Future:
pnpm --filter @my-binder/mobile run build:ios
pnpm --filter @my-binder/mobile run build:android
```

These commands will invoke `eas build` once `eas.json` is added.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Module @my-binder/core not found` after `pnpm install` | core not built | `turbo build --filter=@my-binder/core` |
| Google flow opens then immediately closes | Bundle ID / package name does not match the OAuth client config in Google Cloud Console | Verify `app.json` `ios.bundleIdentifier` and `android.package` match the OAuth client redirect URIs. |
| Allowlist rejection on a known-allowed account | Server `.env.local` points at a stale DB | Run server migrations: `pnpm --filter @my-binder/server migration:run`. |
| 60fps target missed on Android | `removeClippedSubviews` not enabled or `getItemLayout` missing | See `BinderHomeView.tsx` — both must be present per `research.md` §6. |
