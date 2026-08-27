# Build and review the HTMLTrust research paper

| Field | Value |
|---|---|
| Status | Working paper |
| Updated | 2026-08-27 |
| Author | Jason Grey |
| Primary readers | Researchers, reviewers, and paper contributors |
| Reading time | 2 minutes |

The paper source is `htmltrust.tex`. Build it from the repository root:

```sh
make paper
```

The build runs `pdflatex`, `biber`, and two final `pdflatex` passes. It writes
`paper/htmltrust.pdf`, which Git ignores.

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

The current paper is 9 pages. PaperReview.ai receives the full PDF because it
is below the service's 15-page review window. Completed external reviews live
under `paper/reviews/` with their submission date.

## Related documents

- [Repository guide](../README.md)
- [IETF protocol draft](../ietf-draft/README.md)
- [W3C browser-integration draft](../w3c-cg/README.md)
