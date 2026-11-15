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
# The white logo: Android's native splash, and the logo under the jar on iOS.
render "$TMP/logo-white.svg" 1200x "$OUT/splash-logo.png"
# iOS native splash (D-147): the empty jar (splash-jar.svg) centered on a brand green canvas, the logo on its
# bottom edge. Sizes in points come from splash in tokens.ts; drawn at 3x so the 3x launch image isn't resampled.
# Opaque on purpose: Expo's splash image resizer turns translucent white (the jar's glass) dark grey.
tok() { sed -n "s/^  $1: \([0-9]*\),.*/\1/p" src/theme/tokens.ts; }
S=3
CW=$(($(tok canvasWidth) * S)) CH=$(($(tok canvasHeight) * S))
JW=$(($(tok jarWidth) * S)) LW=$(($(tok logoWidth) * S))
JH=$((JW * 60 / 48)) LH=$((LW * 496 / 1200))
render assets/brand/splash-jar.svg "${JW}x${JH}!" "$TMP/jar.png"
magick "$OUT/splash-logo.png" -resize "${LW}x${LH}!" "$TMP/logo.png"
magick -size "${CW}x${CH}" "xc:$BRAND" \
  "$TMP/jar.png" -geometry "+$(((CW - JW) / 2))+$(((CH - JH) / 2))" -compose over -composite \
  "$TMP/logo.png" -geometry "+$(((CW - LW) / 2))+$((CH - LH))" -compose over -composite \
  -alpha off "$OUT/splash.png"
rm -rf "$TMP"
echo "brand assets written to $OUT"
