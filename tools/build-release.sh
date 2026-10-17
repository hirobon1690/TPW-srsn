#!/bin/bash
# Builds the release packages from src/:
#   chrome.zip  - src/ as is, without the Firefox manifest
#   firefox.zip - src/ with firefox-manifest.json as manifest.json
# usage: tools/build-release.sh [output dir]   (default: build/release)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mkdir -p "${1:-$ROOT/build/release}" && cd "${1:-$ROOT/build/release}" && pwd)"

rm -rf "$OUT/chrome" "$OUT/firefox" "$OUT/chrome.zip" "$OUT/firefox.zip"
mkdir -p "$OUT/chrome" "$OUT/firefox"

cp -R "$ROOT/src/." "$OUT/chrome/"
rm -f "$OUT/chrome/firefox-manifest.json"

cp -R "$ROOT/src/." "$OUT/firefox/"
mv -f "$OUT/firefox/firefox-manifest.json" "$OUT/firefox/manifest.json"

find "$OUT/chrome" "$OUT/firefox" -name .DS_Store -delete
(cd "$OUT/chrome" && zip -qr -X "$OUT/chrome.zip" .)
(cd "$OUT/firefox" && zip -qr -X "$OUT/firefox.zip" .)

ls -l "$OUT/chrome.zip" "$OUT/firefox.zip"
