#!/usr/bin/env bash
# Builds the Android app: devops/data/android/apk/personal-copilot-<frontend version>.apk.
#
#   devops/android/build-apk.sh
#   ANDROID_ABIS=arm64-v8a,x86_64 devops/android/build-apk.sh   # also runs on an x86_64 emulator
#                                                              # → personal-copilot-<v>-emulator.apk
#
# Everything runs in Docker (devops/android/Dockerfile); the first build downloads the Android SDK
# parts and Gradle into Docker volumes and takes a while, later ones reuse them. The app talks to
# GATEWAY_PUBLIC_URL from devops/.env (the HTTPS tailnet Gateway URL). The version is the
# `frontend` entry of version/versions.json; Android's versionCode is computed from it
# (frontend/app.config.js).
#
# The first run creates the release signing key in devops/data/android/ (git-ignored). Back up
# release.keystore and keystore.properties from there: an APK signed with any other key can't
# update the installed app — it has to be uninstalled first.
set -euo pipefail

# Windows paths for Docker when run from Git Bash; plain paths elsewhere.
export MSYS_NO_PATHCONV=1
ROOT=$(cd "$(dirname "$0")/../.." && (pwd -W 2>/dev/null || pwd))
DATA="$ROOT/devops/data/android"
IMAGE=personal-copilot-android-builder

version() { sed -n "s/^ *\"$1\": *\"\([^\"]*\)\".*/\1/p" "$ROOT/version/versions.json"; }
FRONTEND_VERSION=$(version frontend)
APP_VERSION=$(version app)

GATEWAY=${GATEWAY_PUBLIC_URL:-$(sed -n 's/^GATEWAY_PUBLIC_URL=//p' "$ROOT/devops/.env" 2>/dev/null | tr -d '\r')}
case "$GATEWAY" in
  https://*) ;;
  *) echo "GATEWAY_PUBLIC_URL must be the HTTPS Gateway URL (devops/.env), got '$GATEWAY'." >&2
     echo "Android blocks plain HTTP. See README's 'Phone access (Tailscale HTTPS)'." >&2
     exit 1 ;;
esac

docker build -q -t "$IMAGE" "$ROOT/devops/android" > /dev/null

mkdir -p "$DATA"
if [ ! -f "$DATA/release.keystore" ]; then
  docker run --rm -v "$DATA:/data" "$IMAGE" build-inside genkey
  echo "Created the release signing key in devops/data/android/."
  echo "BACK UP release.keystore and keystore.properties from there now — without them, no later"
  echo "APK can update the installed app."
fi

echo "Building Personal Copilot $FRONTEND_VERSION for $GATEWAY ..."
docker run --rm \
  -v "$ROOT/frontend:/src:ro" \
  -v "$DATA:/data" \
  -v pc-android-sdk:/opt/android-sdk \
  -v pc-android-gradle:/root/.gradle \
  -v pc-npm-cache:/root/.npm \
  -e FRONTEND_VERSION="$FRONTEND_VERSION" \
  -e ANDROID_ABIS="${ANDROID_ABIS:-arm64-v8a}" \
  -e EXPO_PUBLIC_GATEWAY_ORIGIN="$GATEWAY" \
  -e EXPO_PUBLIC_APP_VERSION="$APP_VERSION" \
  -e EXPO_PUBLIC_FRONTEND_VERSION="$FRONTEND_VERSION" \
  -e EXPO_PUBLIC_BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$IMAGE" build-inside

SUFFIX=$([ "${ANDROID_ABIS:-arm64-v8a}" = arm64-v8a ] || echo -emulator)
echo "Done: devops/data/android/apk/personal-copilot-$FRONTEND_VERSION$SUFFIX.apk"
echo "(Back up devops/data/android/release.keystore and keystore.properties if you haven't.)"
