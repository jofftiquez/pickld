#!/usr/bin/env bash
# Regenerates the app icon and splash images from assets/pickld-mark.svg and assets/pickld-logo.svg.
# Needs ImageMagick 7 (`magick`). Brand colors come from src/theme/tokens.ts (brand #7fad33).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=../..
OUT=assets/brand
BRAND=$(sed -n "s/^  brand: '\(#[0-9a-f]*\)'.*/\1/p" src/theme/tokens.ts)
mkdir -p "$OUT"
TMP=$(mktemp -d)
sed "s/fill=\"[^\"]*\"/fill=\"#ffffff\"/g" "$ROOT/assets/pickld-mark.svg" > "$TMP/mark-white.svg"
sed "s/fill=\"[^\"]*\"/fill=\"#ffffff\"/g" "$ROOT/assets/pickld-logo.svg" > "$TMP/logo-white.svg"
render() { magick -background none -density 1200 "$1" -resize "$2" "$3"; }

# iOS: 1024 master, no transparency, mark at ~42% of the height (inside the 66% safe zone).
render "$TMP/mark-white.svg" x430 "$TMP/mark-430.png"
magick -size 1024x1024 "xc:$BRAND" "$TMP/mark-430.png" -gravity center -compose over -composite -alpha off "$OUT/icon.png"
# Android adaptive: transparent foreground and monochrome layers (mark inside the center 66%), solid background.
render "$TMP/mark-white.svg" x380 "$TMP/mark-380.png"
magick -size 1024x1024 xc:none "$TMP/mark-380.png" -gravity center -compose over -composite "$OUT/android-foreground.png"
cp "$OUT/android-foreground.png" "$OUT/android-monochrome.png"
magick -size 1024x1024 "xc:$BRAND" -alpha off "$OUT/android-background.png"
# Native splash: the white logo, shown centered on brand green.
render "$TMP/logo-white.svg" 1200x "$OUT/splash-logo.png"
rm -rf "$TMP"
echo "brand assets written to $OUT"
