#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Keep local artifacts on the caller's disk-backed scratch volume. GitHub
# Actions exposes RUNNER_TEMP instead of TMPDIR; /var/tmp is the portable
# disk-backed fallback when neither variable is set.
scratch_root="${TMPDIR:-${RUNNER_TEMP:-/var/tmp}}"
npm_cache="$scratch_root/htmltrust-spec-npm-cache"
snapshot="$scratch_root/htmltrust-w3c-snapshot.html"
respec_work="$scratch_root/htmltrust-respec-work"

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
mkdir -p "$respec_work"

# ReSpec's CLI intercepts its main browser script when --use-local is used,
# but a Web Worker then fetches the syntax highlighter cross-origin. Chromium
# rejects that fetch without CORS headers. Stage both pinned browser bundles
# beside a scratch copy of the source so the worker fetch remains same-origin.
respec_command="$({
  npm_config_cache="$npm_cache" npx --yes --package=respec@37.3.5 \
    -c 'command -v respec'
})"
respec_entry="$(node -e \
  'console.log(require("node:fs").realpathSync(process.argv[1]))' \
  "$respec_command")"
respec_root="$(cd "$(dirname "$respec_entry")/.." && pwd)"
cp "$respec_root/builds/respec-w3c.js" "$respec_work/respec-w3c.js"
cp "$respec_root/builds/respec-highlight.js" "$respec_work/respec-highlight.js"
sed 's#https://www.w3.org/Tools/respec/respec-w3c#./respec-w3c.js#' \
  "$repo_root/w3c-cg/index.html" > "$respec_work/index.html"

cd "$respec_work"
npm_config_cache="$npm_cache" \
PUPPETEER_EXECUTABLE_PATH="$chrome_path" \
npx --yes respec@37.3.5 \
  --localhost \
  --disable-sandbox \
  --haltonerror \
  --haltonwarn \
  index.html \
  "$snapshot"
