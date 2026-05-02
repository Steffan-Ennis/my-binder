# @my-binder/mobile

React Native + Expo SDK 54 client for the My-Binder personal card binder. See spec
[`002-mobile-binder-app`](../../specs/002-mobile-binder-app/) for the full design.

## Quick reference

- **Run / test commands**: see [`specs/002-mobile-binder-app/quickstart.md`](../../specs/002-mobile-binder-app/quickstart.md)
- **Architecture**: see [`specs/002-mobile-binder-app/plan.md`](../../specs/002-mobile-binder-app/plan.md)
- **Constitution rules** (Principle X four-layer split, FC declaration, hook memoisation): [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

## Scripts

```bash
pnpm --filter @my-binder/mobile dev         # expo start
pnpm --filter @my-binder/mobile typecheck   # tsc --noEmit
pnpm --filter @my-binder/mobile test        # jest
pnpm --filter @my-binder/mobile lint        # expo lint
pnpm --filter @my-binder/mobile build       # expo export
```

Copy `.env.example` to `.env.local` and fill in the API base URL plus Google OAuth
client IDs before running `dev`.

## Google OAuth — Android setup

Three things have to line up for `expo-auth-session/providers/google` to round-trip a
sign-in on Android: a registered SHA-1, the Android client ID baked into the bundle,
and an intent-filter that catches Google's redirect.

### 1. Generate a keystore and register its SHA-1

The Android OAuth client validates the calling app via package name + SHA-1.

```bash
# Create the keystore (prompts for password + dname). Run from apps/mobile/.
keytool -genkey -v -keystore my-binder.keystore -alias google-id -keyalg RSA -keysize 2048 -validity 10000

# Print SHA-1 / SHA-256 — paste SHA-1 into Google Cloud Console → Credentials → Android OAuth client
keytool -list -v -keystore my-binder.keystore -alias google-id
```

For local `expo run:android` builds, also register the **debug** keystore SHA-1
(builds are signed with `~/.android/debug.keystore`, not `my-binder.keystore`):

```bash
keytool -list -v -keystore ~/.android/debug.keystore \
  -storepass android -keypass android -alias androiddebugkey | grep SHA1
```

Add both fingerprints to the same Android OAuth client in Google Cloud Console.
`*.keystore` is gitignored — do not commit. Store passwords in a password manager.

### 2. Set client IDs in `.env.local`

```
GOOGLE_ANDROID_CLIENT_ID=<from Android OAuth client>
GOOGLE_IOS_CLIENT_ID=<from iOS OAuth client>
GOOGLE_WEB_CLIENT_ID=<from Web OAuth client>
```

Env vars are baked into the bundle at build time via `app.config.ts` →
`Constants.expoConfig.extra` — **rebuild after changing them** (no hot-reload).

### 3. Intent-filter for the OAuth redirect

`expo-auth-session/providers/google` redirects to `<package>:/oauthredirect` on
Android. Without a matching intent-filter the Custom Tab can't hand control back to
the app — the user lands on `google.com` after sign-in. `expo-auth-session` has no
config plugin, so register the scheme via `app.json`:

```json
"android": {
  "package": "com.steffan87.mybinder",
  "intentFilters": [
    {
      "action": "VIEW",
      "category": ["BROWSABLE", "DEFAULT"],
      "data": [{ "scheme": "com.steffan87.mybinder", "path": "/oauthredirect" }]
    }
  ]
}
```

Then regenerate the native folder and rebuild:

```bash
rm -rf android
npx expo prebuild --platform android --clean
npx expo run:android
```

### Verify

```bash
# Manifest should list both schemes — `mybinder` (app deep links) and the package-name scheme
grep "android:scheme" android/app/src/main/AndroidManifest.xml

# Manually fire the redirect — app should open
adb shell am start -W -a android.intent.action.VIEW \
  -d "com.steffan87.mybinder:/oauthredirect?code=test"
```

### Troubleshooting

| Symptom | Cause |
|---|---|
| Stuck on `google.com` after sign-in | Intent-filter missing, **or** `GOOGLE_ANDROID_CLIENT_ID` empty (SDK falls back to web client) |
| Error page in Custom Tab before consent | SHA-1 / package mismatch on Google's side |
| `redirectUri` logs as `https://auth.expo.io/...` | Android client ID didn't reach the bundle — rebuild |
| `adb` test fails with "unable to resolve Intent" | Intent-filter not in merged manifest — re-run `expo prebuild --clean` |

Log the redirect URI in `src/services/auth/googleAuth.ts` to debug:

```ts
const [request] = result;
console.log('[google-auth] redirectUri =', request?.redirectUri);
console.log('[google-auth] clientId    =', request?.clientId);
```