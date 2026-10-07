#!/bin/bash
# Runs inside the builder image (see build-apk.sh): /src is frontend/ (read-only), /data is
# devops/data/android/ (the release key, and apk/ for the result).
set -euo pipefail

# Key commands: create the release key once, or print its fingerprint.
if [ "${1:-}" = "genkey" ]; then
  password=$(openssl rand -hex 24)
  keytool -genkeypair -keystore /data/release.keystore -storetype PKCS12 \
    -alias personal-copilot -keyalg RSA -keysize 4096 -validity 36500 \
    -storepass "$password" -keypass "$password" -dname "CN=Personal Copilot" > /dev/null
  printf 'PC_KEYSTORE_PASSWORD=%s\nPC_KEY_ALIAS=personal-copilot\n' "$password" > /data/keystore.properties
  exit 0
fi

# A clean copy to build in, without the host's node_modules (installed for another OS) or its .env.
mkdir -p /work
tar -C /src --exclude=./node_modules --exclude=./android --exclude=./ios --exclude=./dist \
  --exclude=./e2e --exclude=./.expo --exclude='./.env*' -cf - . | tar -C /work -xf -
cd /work
npm ci --no-audit --no-fund --loglevel=error

npx expo prebuild --platform android --clean --no-install

set -a
. /data/keystore.properties
set +a
export PC_KEYSTORE_FILE=/data/release.keystore

cd android
# Every current Android phone is arm64; building one ABI instead of four is ~4× faster.
# ANDROID_ABIS=arm64-v8a,x86_64 adds the emulator's, for testing — a separate -emulator file.
ABIS=${ANDROID_ABIS:-arm64-v8a}
./gradlew assembleRelease --no-daemon -PreactNativeArchitectures="$ABIS"

SUFFIX=$([ "$ABIS" = arm64-v8a ] || echo -emulator)
mkdir -p /data/apk
cp app/build/outputs/apk/release/app-release.apk "/data/apk/personal-copilot-$FRONTEND_VERSION$SUFFIX.apk"
