# arXiv submission kit — HTMLTrust paper

Everything needed to submit `htmltrust.tex` to arXiv. **I have not uploaded anything** — the upload is yours to make from your account. This kit is ready to execute once you've made the two framing choices below.

## Two decisions for you

1. **Title.** The `.tex` currently keeps the original framing:
   > *Toward Decentralized Trust and Verifiable Content on the Web*

   Now that the paper reports a working, cross-implementation system with a measured interoperability result, consider leading with that:
   > *Byte-Identical Canonicalization for Browser-Verifiable HTML Authorship*
   > (subtitle/or: *…and the Text-Normalization Hazards It Surfaces*)

   The abstract already reflects the implemented-and-measured framing either way. Change `\title{...}` if you want the stronger version.

2. **New submission or v2 replacement.** If a prior version is already on arXiv, submit this as a **replace (v2)** under the same identifier (recommended — preserves citations); otherwise a fresh submission. Category: **`cs.CR`** (Cryptography and Security), cross-list **`cs.NI`** and/or **`cs.DL`**.

## Plain-text abstract (arXiv abstract field — no LaTeX)

> We present a decentralized, standards-aligned framework for embedding cryptographic trust directly into HTML content. Using a new <signed-section> element, publishers can sign semantically meaningful regions of web pages and carry identity-linked metadata in band. Signatures are validated against public-key infrastructure such as DIDs and can be enhanced with third-party endorsements submitted to optional, federated trust directories. We define a canonicalization method for content normalization and show how browsers and content-management systems can apply user-configured web-of-trust policies to live content. The scheme is fully implemented: five independent language libraries, a reference trust directory, a browser verifier, and static-site and CMS signers reproduce a shared conformance suite and a complete end-to-end test vector byte-for-byte. We report the specific text-normalization hazards this cross-implementation discipline surfaced and resolved -- URL serialization, HTML character references, quotation-mark classing, claim ordering, and excluded subtrees -- each of which silently produced divergent hashes across independent implementations before being pinned. Unlike blockchain-based or DRM-centric systems, the approach is lightweight, browser-compatible, and web-native.

## Pre-submission checklist

- [ ] **Compile it.** No LaTeX toolchain was available where the edits were made, so the source has been statically validated (all citations/labels/environments/braces balance) but **not typeset**. Build and read the PDF:
  ```sh
  cd htmltrust-spec/paper
  latexmk -pdf htmltrust.tex        # or: tectonic htmltrust.tex
  ```
- [ ] **Generate the `.bbl`.** The paper uses `biblatex`+`biber`. **arXiv does not run biber**, so you must include the generated `htmltrust.bbl` in the upload (a normal `latexmk -pdf` run produces it). Without it, references will not resolve on arXiv. (Alternative: convert to `\usepackage[numbers]{natbib}` + `bibtex` if you prefer arXiv's default path — but including the `.bbl` is simpler.)
- [ ] Confirm `images/architecture1.*` is present and referenced correctly (it is the only figure).
- [ ] Decide the title (above) and set `\title{}`.

## Packaging (once compiled and `.bbl` exists)

arXiv wants the source, not the PDF. From `htmltrust-spec/paper/`:
```sh
tar czf htmltrust-arxiv.tar.gz htmltrust.tex references.bib htmltrust.bbl images/
```
Upload `htmltrust-arxiv.tar.gz`. (Include `htmltrust.bbl`; you may omit `references.bib` if the `.bbl` is present, but including both is harmless.)

## Revision comment (if submitting as v2)

> v2: Corrected the canonicalization description to the algorithm as actually specified and implemented (removed the SimHash / attribute-sorting description that never existed); updated the endorsement format, algorithm identifiers, and timestamp format to match the normative draft; added an Implementation and Results section reporting byte-identical cross-language interoperability (five implementations reproducing a shared conformance suite and end-to-end test vectors) and a catalog of the text-normalization hazards this surfaced; added an honest limitations discussion.

## Not blocking arXiv, but do before you cite the repos as artifacts

- Drop the `LOCAL DEV ONLY` `replace` line in `htmltrust-hugo/go.mod` and pin the published canonicalization lib (a committed filesystem `replace` breaks the production signing job).
- Re-pin the website `ci.yml` signer commit after the hugo x/net bump lands.
- Land the reconciled website copy (the factual fixes are in place; the rest is your in-progress edit).

---
**When you've picked a title and fresh-vs-v2, say so and I'll set `\title{}`, produce the exact tar command output list, and finalize the abstract/comment. The upload stays with you.**
