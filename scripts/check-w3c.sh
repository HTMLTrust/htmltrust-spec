#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scratch_root="${TMPDIR:?Set TMPDIR to a disk-backed scratch directory.}"
npm_cache="$scratch_root/htmltrust-spec-npm-cache"
snapshot="$scratch_root/htmltrust-w3c-snapshot.html"

if ! command -v npx >/dev/null 2>&1; then
  echo "Missing npx. Install Node.js 22 or newer." >&2
  exit 1
fi

chrome_path="${PUPPETEER_EXECUTABLE_PATH:-}"
if [[ -z "$chrome_path" ]]; then
  for candidate in \
    "$(command -v google-chrome-stable 2>/dev/null || true)" \
    "$(command -v google-chrome 2>/dev/null || true)" \
    "$(command -v chromium 2>/dev/null || true)" \
    /opt/google/chrome/chrome; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      chrome_path="$candidate"
      break
    fi
  done
fi

if [[ -z "$chrome_path" || ! -x "$chrome_path" ]]; then
  echo "Missing Chrome or Chromium. Set PUPPETEER_EXECUTABLE_PATH." >&2
  exit 1
fi

mkdir -p "$npm_cache"
cd "$repo_root"
npm_config_cache="$npm_cache" \
PUPPETEER_EXECUTABLE_PATH="$chrome_path" \
npx --yes respec@37.3.5 \
  --localhost \
  --use-local \
  --disable-sandbox \
  --haltonerror \
  --haltonwarn \
  w3c-cg/index.html \
  "$snapshot"
