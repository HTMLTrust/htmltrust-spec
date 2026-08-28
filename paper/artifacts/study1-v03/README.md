# HTMLTrust Study 1 v0.3 supplementary artifact

This directory archives the exact study source and compact evidence cited by
the HTMLTrust paper.

| Field | Value |
|---|---|
| Study commit | `dcb2b451a7f1ab7ab5fed5128af6990e6911d0d9` |
| Canonicalization commit | `12bc7e839d5e2a858c29bba651e704e8ed036d95` |
| Corpus SHA-256 | `8c6831bece6f45f25622cf011ac1fcf45d1fcda36f14b8e111566317c12c7f92` |
| Container image ID | `sha256:2cea8d3af40cf4815ff7f38693901cd554e271ef374b5cb0704827182db626aa` |

[`htmltrust-study1-dcb2b451.tar.gz`](htmltrust-study1-dcb2b451.tar.gz)
contains the Docker harness, tests, corpus manifest, run manifests, aggregate
results, benchmark records, and checksums. It excludes the 1.2 GB corpus and
the source WARC files. The corpus manifest identifies each WARC by filename,
size, and SHA-256 and records every selection parameter.

Verify and extract the archive:

```sh
sha256sum -c SHA256SUMS
tar xzf htmltrust-study1-dcb2b451.tar.gz
cd htmltrust-study1
```

The extracted top-level README gives the Docker build, test, corpus, analysis,
shared-core control, and benchmark commands. A rebuild fetches the exact
canonicalization commit recorded above. Debian, NodeSource, and language
package repositories remain mutable; retain the recorded container image when
the original runtime layers are required.
