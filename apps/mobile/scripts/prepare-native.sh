#!/usr/bin/env bash
# Native files the iOS build needs after `pnpm install`, found on the Mac builds (Nov 12): Skia's prebuilt
# xcframeworks into node_modules/@shopify/react-native-skia/libs/<platform>, and expo-sqlite's vendored
# sqlite3.c/.h into its ios/ folder. Both podspecs try to do this themselves, but with the hoisted pnpm
# layout the build failed without it. Safe to run more than once. EAS runs it as `eas-build-post-install`.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)/node_modules"

skia="$root/@shopify/react-native-skia"
for p in ios macos tvos; do
  pkg="$root/react-native-skia-apple-$p"
  [[ -d "$pkg/libs" ]] || continue
  mkdir -p "$skia/libs/$p"
  cp -R "$pkg"/libs/*.xcframework "$skia/libs/$p/"
  node -p "require('$pkg/package.json').version" >"$skia/libs/$p/.version"
done

cp "$root/expo-sqlite/vendor/sqlite3/sqlite3.c" "$root/expo-sqlite/vendor/sqlite3/sqlite3.h" "$root/expo-sqlite/ios/"
echo "prepare-native: done"
