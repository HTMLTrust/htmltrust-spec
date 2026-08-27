#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

for vector in ietf-draft/vectors/*.json; do
  jq empty "$vector"
done

node scripts/check-vectors.mjs

if grep -nE '\{DATE\}|\{TBD\}|(^|[^[:alnum:]_])TODO([^[:alnum:]_]|$)' \
  ietf-draft/draft-grey-htmltrust-00.md \
  w3c-cg/index.html; then
  echo "Draft placeholder found." >&2
  exit 1
fi

if grep -nF -- 'origin-mismatch' \
  ietf-draft/draft-grey-htmltrust-00.md \
  w3c-cg/index.html; then
  echo "Retired failure identifier found." >&2
  exit 1
fi

git diff --check
