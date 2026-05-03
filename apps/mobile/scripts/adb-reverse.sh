#!/usr/bin/env bash
#
# Forward the device/emulator's TCP port 3000 back to the host machine's TCP
# port 3000 via `adb reverse`. This lets the Android app reach a server
# running on the developer's localhost as if it were running on-device.
#
# Usage:
#   ./scripts/adb-reverse.sh           # default: 3000 -> 3000
#   ./scripts/adb-reverse.sh 8080      # 8080 -> 8080
#   ./scripts/adb-reverse.sh 8080 3000 # device:8080 -> host:3000
#
# Notes:
#   - `adb reverse` only works over USB or with an emulator; it does not
#     persist across reboots or device reconnects, so re-run after either.
#   - Requires the Android Platform Tools `adb` binary on PATH (or
#     ANDROID_HOME/platform-tools).

set -euo pipefail

DEVICE_PORT="${1:-3000}"
HOST_PORT="${2:-$DEVICE_PORT}"

if ! command -v adb >/dev/null 2>&1; then
  if [[ -n "${ANDROID_HOME:-}" && -x "$ANDROID_HOME/platform-tools/adb" ]]; then
    ADB="$ANDROID_HOME/platform-tools/adb"
  elif [[ -n "${ANDROID_SDK_ROOT:-}" && -x "$ANDROID_SDK_ROOT/platform-tools/adb" ]]; then
    ADB="$ANDROID_SDK_ROOT/platform-tools/adb"
  else
    echo "error: adb not found on PATH and ANDROID_HOME/ANDROID_SDK_ROOT are unset." >&2
    echo "       install Android Platform Tools or export ANDROID_HOME." >&2
    exit 1
  fi
else
  ADB="adb"
fi

DEVICES="$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')"
if [[ -z "$DEVICES" ]]; then
  echo "error: no adb devices in 'device' state. start an emulator or plug in a device." >&2
  "$ADB" devices >&2
  exit 1
fi

while IFS= read -r SERIAL; do
  echo "→ $SERIAL: reverse tcp:${DEVICE_PORT} -> tcp:${HOST_PORT}"
  "$ADB" -s "$SERIAL" reverse "tcp:${DEVICE_PORT}" "tcp:${HOST_PORT}"
done <<< "$DEVICES"

echo
echo "active reverse forwards:"
while IFS= read -r SERIAL; do
  echo "  [$SERIAL]"
  "$ADB" -s "$SERIAL" reverse --list | sed 's/^/    /'
done <<< "$DEVICES"
