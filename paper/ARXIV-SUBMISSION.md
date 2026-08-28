# Submit the HTMLTrust paper to arXiv

This checklist packages the current paper source and records the text needed
for an arXiv submission. The current title is:

> Toward Decentralized Trust and Verifiable Content on the Web

Use a replacement submission when an earlier version already has an arXiv
identifier. Use a new submission when no arXiv record exists. The suggested
primary category is `cs.CR`.

## Build and package

From the repository root, run:

```sh
make paper-arxiv-docker
```

This command builds the PDF and writes
`paper/dist/htmltrust-arxiv.tar.gz`. The archive contains:

- `htmltrust.tex`
- `references.bib`
- the generated `htmltrust.bbl`
- `images/architecture1.png`

Inspect the printed archive listing and the final PDF before upload. The
supplementary Study 1 source and evidence remain in
`paper/artifacts/study1-v04/`; the paper cites that stable repository snapshot.

## Plain-text abstract

> We specify HTMLTrust, an in-band signature protocol for semantic regions of HTML. A signed section binds normalized text and four reader-relevant attributes through a content hash. An RFC 8785 canonical JSON signing object binds that hash with the claims hash, signer key identifier, signature algorithm, publication location, signed time, and profile identifiers. Verification is deterministic after the verifier obtains the source snapshot and resolves the key; optional federated directories distribute key records and signed endorsements. The v1 prototype includes five parser-backed language bindings, a reference directory, a browser extension, and publishing integrations. At the evaluated revision, all five bindings pass 123 shared canonicalization fixtures, including expected rejections. On 4,846 Common Crawl News body regions, all five ports accepted 121 (2.5%); 119 of those 121 produced identical digests. An earlier permissive profile produced identical bytes for 31.4% of jointly accepted regions on a different corpus. Strict v1 preflight converts many ambiguous inputs into explicit rejection, but broad real-web byte identity remains unresolved. A selected 47-case adversarial evaluation matched every expected outcome. The protocol separates cryptographic integrity from user-selected trust policy and defines explicit limits for replay, parser ambiguity, URL handling, and resource use.

## Replacement comment

Use this comment for a replacement submission and adjust the version number if
needed:

> Updated the implementation evidence to canonicalization revision b0c8f305425de190a7f209ac117d34f88c2b1946 and expanded the evaluated conformance suite to 123 fixtures. Added selected adversarial cases, signing measurements, production content-script and Chromium walker lifecycle checks, a local HTTPS integration simulation, and a Sybil policy-sensitivity model. Reframed the historical 31.4% result and the strict v1 result to make clear that 119 regions, or 2.46% of the full real-web corpus, achieved cross-implementation byte identity. Expanded the stated limits of the operational sample, benchmark, browser tests, and Sybil model. Replaced the supplementary archive with Study 1 v0.4.

## Final checks

- Confirm the title, author name, email address, and category in the submission
  form.
- Open `paper/htmltrust.pdf` and inspect every page.
- Confirm every citation is resolved and the bibliography is present.
- Verify the page and file-size limits shown by the submission service.
- Upload `paper/dist/htmltrust-arxiv.tar.gz` as source.
- Download arXiv's compiled preview and compare it with the local PDF before
  submitting.
