#!/usr/bin/env bash
# One command for milestone screenshots (M1-24):
#   scripts/capture.sh M1 Main=today apps/mobile/.maestro/gallery.yaml ...
# Each argument is either Screen=route (opens pickld://<route> and saves <Screen>-ios.png) or a Maestro
# flow file whose takeScreenshot names end in -ios. iOS captures come from the booted Simulator (dev
# build, Metro running) and land in docs/milestones/<M>/. For every Screen with a design/screens/<Screen>.html
# (from Screen=route, or a flow screenshot named <Screen>-ios), <Screen>-design.png is captured with
# Playwright next to it. Android captures are not automated yet.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
milestone="${1:-}"
shift || true
if [[ ! "$milestone" =~ ^M[0-9]$ || $# -eq 0 ]]; then
  echo "usage: scripts/capture.sh M<n> <Screen>=<route>|<flow.yaml> [...]" >&2
  exit 1
fi
out="$root/docs/milestones/$milestone"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"
for arg in "$@"; do
  if [[ "$arg" == *.yaml ]]; then
    maestro test --test-output-dir "$tmp" "$arg"
  else
    maestro test --test-output-dir "$tmp" -e ROUTE="${arg#*=}" -e NAME="${arg%%=*}-ios" \
      "$root/apps/mobile/.maestro/capture-route.yaml"
  fi
done
designs=()
while IFS= read -r png; do
  name="$(basename "$png")"
  mv "$png" "$out/$name"
  echo "$out/$name"
  screen="${name%-ios.png}"
  [[ -f "$root/design/screens/$screen.html" ]] && designs+=("$screen")
done < <(find "$tmp" -path '*/takeScreenshot/*-ios.png')
if (( ${#designs[@]} )); then
  node "$root/scripts/capture-design.mjs" "$milestone" "${designs[@]}"
fi
