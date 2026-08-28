# HTMLTrust Study 1 v0.4 supplementary artifact

This directory archives the study source and compact evidence cited by the
HTMLTrust paper.

| Field | Value |
|---|---|
| Study commit | `2265eebdbc20cf16e59c1d8d4571d0235f9ebadf` |
| Canonicalization commit | `b0c8f305425de190a7f209ac117d34f88c2b1946` |
| Corpus records | 4,846 |
| Corpus SHA-256 | `8c6831bece6f45f25622cf011ac1fcf45d1fcda36f14b8e111566317c12c7f92` |
| Container image ID | `sha256:579515b828ef6930af9fc52b92c79ed9bc91520577682b11de1aa14214be09f1` |

[`htmltrust-study1-2265eeb.tar.gz`](htmltrust-study1-2265eeb.tar.gz)
contains the Docker harness, tests, corpus and run manifests, aggregate corpus
results, adversarial fixture evidence, signing measurements, and the Sybil
policy-sensitivity model. It excludes the 1.2 GB corpus, per-record run output,
and source WARC files. The corpus manifest identifies each WARC by filename,
size, and SHA-256 and records the selection parameters.

Verify and extract the archive:

```sh
sha256sum -c SHA256SUMS
tar xzf htmltrust-study1-2265eeb.tar.gz
cd htmltrust-study1
```

Start with `results/v04/README.md`. It gives the current findings, evidence
layout, checksum command, and exact Docker commands for each experiment. The
top-level README explains how to rebuild the pinned image and run the study
from a clean checkout.

The historical v0.2 and v0.3 evidence remains inside the archive so readers
can trace earlier measurements. Reproducing the Common Crawl experiment
requires the external corpus named by the manifest. Package repositories can
change over time, so retain the recorded image when exact runtime layers are
required.
