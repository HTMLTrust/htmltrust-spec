# Build and review the HTMLTrust research paper

| Field | Value |
|---|---|
| Status | Working paper |
| Updated | 2026-08-28 |
| Author | Jason Grey |
| Primary readers | Researchers, reviewers, and paper contributors |
| Reading time | 2 minutes |

The paper source is `htmltrust.tex`. Build it from the repository root:

```sh
make paper
```

The build runs `pdflatex`, `biber`, and two final `pdflatex` passes. It writes
`paper/htmltrust.pdf`, which Git ignores.

If TeX Live is unavailable on the host, use Docker:

```sh
make paper-docker
```

The first Docker build downloads Debian Bookworm package indexes and installs
the TeX packages listed in `.docker/paper/Dockerfile` into a local image. A
later build reuses that image layer while Docker's cache is valid. Changing
the Dockerfile or building with `docker build --no-cache` downloads the
packages again. The container mounts the checkout and writes the PDF as your
host user.

Build the PDF and create an arXiv source archive with the host toolchain:

```sh
make paper-arxiv
```

Use `make paper-arxiv-docker` when TeX Live is unavailable locally. Both
commands write `paper/dist/htmltrust-arxiv.tar.gz`. The archive includes the
generated `htmltrust.bbl`, paper source, bibliography, and architecture image.
Its contents are printed after packaging.

## Install the required tools

Install a TeX Live distribution that provides `pdflatex`, `biblatex`, and
`biber`. The exact Debian and Ubuntu packages are listed in the root
[README](../README.md#research-paper) and in `.github/workflows/ci.yml`.

## Check a paper change

After `make paper` succeeds:

1. Confirm the build log has no undefined references or citations.
2. Inspect every PDF page for clipped text, overlapping floats, and unreadable
   figures.
3. Keep citations in `references.bib`; do not edit generated `.bbl` files.

Check the page limit of any external review service before submitting. The
paper length can change as the source changes. Completed external reviews live
under `paper/reviews/` with their submission date.

## Related documents

- [Repository guide](../README.md)
- [IETF protocol draft](../ietf-draft/README.md)
- [W3C browser-integration draft](../w3c-cg/README.md)
- [Study 1 v0.3 supplementary artifact](artifacts/study1-v03/README.md)
- [PaperReview.ai round-one review](reviews/paperreview-round1.md)
