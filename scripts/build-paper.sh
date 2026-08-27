#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for command_name in pdflatex biber; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing $command_name. See paper/README.md." >&2
    exit 1
  fi
done

cd "$repo_root/paper"
pdflatex -halt-on-error -interaction=nonstopmode htmltrust.tex
biber htmltrust
pdflatex -halt-on-error -interaction=nonstopmode htmltrust.tex
pdflatex -halt-on-error -interaction=nonstopmode htmltrust.tex
