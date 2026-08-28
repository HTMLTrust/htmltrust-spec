#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image="${HTMLTRUST_PAPER_IMAGE:-htmltrust-paper-builder:bookworm}"

docker build \
  --tag "$image" \
  --file "$repo_root/.docker/paper/Dockerfile" \
  "$repo_root"

exec docker run --rm --init \
  --user "$(id -u):$(id -g)" \
  --env HOME=/work \
  --env TMPDIR=/work \
  --mount type=tmpfs,destination=/work,tmpfs-mode=1777 \
  --volume "$repo_root:/repo" \
  --workdir /repo \
  "$image"
