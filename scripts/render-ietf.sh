#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
draft_dir="$repo_root/ietf-draft"
draft_name="draft-grey-htmltrust-00"
ruby_image="ruby:3.3-bookworm@sha256:daf7fa54695b1fcb24fadd7b8cd18ff847e20ce76fe5a908e3cfe9af9147bc46"

cd "$draft_dir"

if command -v kramdown-rfc >/dev/null 2>&1; then
  kramdown-rfc "$draft_name.md" > "$draft_name.xml.next"
elif command -v docker >/dev/null 2>&1; then
  docker run --rm -i "$ruby_image" sh -lc \
    'gem install kramdown-rfc -v 1.7.43 --no-document >/dev/null && /usr/local/bundle/bin/kramdown-rfc /dev/stdin' \
    < "$draft_name.md" > "$draft_name.xml.next"
else
  echo "Missing kramdown-rfc and Docker. See ietf-draft/README.md." >&2
  exit 1
fi

mv "$draft_name.xml.next" "$draft_name.xml"

if command -v xml2rfc >/dev/null 2>&1; then
  xml2rfc --html --text "$draft_name.xml"
elif command -v uvx >/dev/null 2>&1; then
  uvx --from xml2rfc==3.34.0 xml2rfc --html --text "$draft_name.xml"
else
  echo "Missing xml2rfc and uvx. See ietf-draft/README.md." >&2
  exit 1
fi

# The generators leave a few trailing blanks and an extra XML EOF line.
# Normalize those generated-only differences so review diffs stay clean.
sed -i 's/[[:blank:]]*$//' "$draft_name.xml" "$draft_name.html"
sed -i '${/^$/d;}' "$draft_name.xml"
