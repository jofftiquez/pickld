#!/usr/bin/env bash
# One command for milestone screenshots (M1-24):
#   scripts/capture.sh M1 Gallery=dev/gallery Main=today ...
# For each Screen=route it writes docs/milestones/<M>/<Screen>-ios.png from the booted iOS Simulator
# (Maestro, dev build with Metro running) and, when design/screens/<Screen>.html exists,
# docs/milestones/<M>/<Screen>-design.png (Playwright). Android captures are not automated yet.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
milestone="${1:-}"
shift || true
if [[ ! "$milestone" =~ ^M[0-9]$ || $# -eq 0 ]]; then
  echo "usage: scripts/capture.sh M<n> <Screen>=<route> [...]" >&2
  exit 1
fi
out="$root/docs/milestones/$milestone"
mkdir -p "$out"
designs=()
for pair in "$@"; do
  screen="${pair%%=*}"
  route="${pair#*=}"
  maestro test --test-output-dir "$out" -e ROUTE="$route" -e NAME="$screen-ios" "$root/apps/mobile/.maestro/capture-route.yaml"
  echo "$out/$screen-ios.png"
  [[ -f "$root/design/screens/$screen.html" ]] && designs+=("$screen")
done
if (( ${#designs[@]} )); then
  node "$root/scripts/capture-design.mjs" "$milestone" "${designs[@]}"
fi
