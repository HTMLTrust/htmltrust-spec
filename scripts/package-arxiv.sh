#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
paper_dir="$repo_root/paper"
output_dir="${ARXIV_OUTPUT_DIR:-$paper_dir/dist}"
archive="$output_dir/htmltrust-arxiv.tar.gz"

for required in htmltrust.tex references.bib htmltrust.bbl images/architecture1.png; do
  if [[ ! -s "$paper_dir/$required" ]]; then
    echo "Missing paper/$required. Build the paper before packaging." >&2
    exit 1
  fi
done

mkdir -p "$output_dir"
tar -czf "$archive" \
  -C "$paper_dir" \
  htmltrust.tex references.bib htmltrust.bbl images/architecture1.png

echo "Wrote $archive"
tar -tzf "$archive"
