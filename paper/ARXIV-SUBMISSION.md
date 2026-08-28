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
`paper/artifacts/study1-v03/`; the paper cites that stable repository snapshot.

## Plain-text abstract

> We specify HTMLTrust, an in-band signature protocol for semantic regions of HTML. A signed section binds normalized text and four reader-relevant attributes through a content hash. An RFC 8785 canonical JSON signing object binds that hash with the claims hash, signer key identifier, signature algorithm, publication location, signed time, and profile identifiers. Verification is deterministic after the verifier obtains the source snapshot and resolves the key; optional federated directories distribute key records and signed endorsements. The version 0.3 prototype includes five parser-backed language bindings, a reference directory, a browser verifier, and publishing integrations. All five bindings pass 118 shared canonicalization fixtures, including expected rejections. A separate Ed25519 vector fixes the signing input and signature; JavaScript and Go recompute and verify the full vector, while the remaining bindings exercise its canonicalization or payload stages. On 4,846 Common Crawl News body regions, the five independent ports produce matching digests for 119 of the 121 jointly canonicalizable inputs. Shared-core adapters agree on all 174 inputs they jointly canonicalize. The protocol separates cryptographic integrity from user-selected trust policy and defines explicit limits for replay, parser ambiguity, URL handling, and resource use.

## Replacement comment

Use this comment for a replacement submission and adjust the version number if
needed:

> Updated the protocol description to match signing profile v1 and canonicalization revision 12bc7e839d5e2a858c29bba651e704e8ed036d95. Added the final 4,846-region Common Crawl operational study, including separate independent-port and shared-core results, source-transformation probes, sampling limits, and a supplementary reproducibility archive. Narrowed claims about end-to-end vector coverage, replay scope, deployment evidence, and generalizability.

## Final checks

- Confirm the title, author name, email address, and category in the submission
  form.
- Open `paper/htmltrust.pdf` and inspect every page.
- Confirm every citation is resolved and the bibliography is present.
- Verify the page and file-size limits shown by the submission service.
- Upload `paper/dist/htmltrust-arxiv.tar.gz` as source.
- Download arXiv's compiled preview and compare it with the local PDF before
  submitting.
