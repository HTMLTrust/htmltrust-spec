# HTMLTrust specifications and research paper

| Field | Value |
|---|---|
| Status | Working drafts |
| Version | Internet-Draft `-00` |
| Updated | 2026-08-27 |
| Author | Jason Grey |
| Primary readers | Protocol implementers, standards reviewers, and researchers |
| Reading time | 5 minutes |

This repository contains the protocol drafts and paper for HTMLTrust. Start
with the IETF draft when implementing signatures. Read the W3C Community
Group draft for the HTML element and browser processing model.

## Build and check the repository

From the repository root:

```sh
make check       # validate vectors and repository invariants
make ietf        # regenerate the IETF XML, HTML, and text artifacts
make paper       # build paper/htmltrust.pdf
make w3c         # serve the W3C draft at http://localhost:8000
make w3c-check   # render the W3C draft and fail on ReSpec diagnostics
```

`make check` needs Bash, Git, grep, jq, and Node.js 22 or newer. The other
targets list their tool requirements below.

## Choose the document you need

| Document | Use it for | Canonical source |
|---|---|---|
| [IETF Internet-Draft](ietf-draft/README.md) | Canonicalization, signing payloads, key resolution, verification, endorsements, and the directory API | `ietf-draft/draft-grey-htmltrust-00.md` |
| [Proposed W3C Community Group draft](w3c-cg/README.md) | The `signed-section` element, DOM interface, browser lifecycle, UI, and accessibility | `w3c-cg/index.html` |
| [Research paper](paper/README.md) | Architecture, motivation, prototype results, and related work | `paper/htmltrust.tex` |
| [IETF review](IETF_SPEC_REVIEW.md) | Security and interoperability findings, including the current disposition | Markdown review |
| [W3C review](W3C_SPEC_REVIEW.md) | Browser and Web-platform findings, including the current disposition | Markdown review |

The generated IETF `.xml`, `.html`, and `.txt` files are committed so
reviewers can read the draft without installing the build tools.

## Install the document toolchains

### IETF draft

The target uses installed generators when available. On a clean workstation,
it can use Docker for kramdown-rfc and `uvx` for xml2rfc. Install those two
tools, then run `make ietf`.

To install the generators directly, use Ruby 3.3, Python 3, and these pinned
versions:

```sh
gem install kramdown-rfc --version 1.7.43
python3 -m pip install xml2rfc==3.34.0
```

The target regenerates all three committed outputs.

### Research paper

Install a TeX Live distribution with `pdflatex`, `biblatex`, and `biber`.
On Debian or Ubuntu, the CI workflow uses:

```sh
sudo apt-get install texlive-latex-recommended texlive-latex-extra \
  texlive-bibtex-extra texlive-fonts-recommended texlive-fonts-extra \
  biber cm-super
```

Then run `make paper`. The PDF is ignored by Git.

### W3C draft

The W3C draft uses ReSpec. Run `make w3c`, open <http://localhost:8000>, and
inspect the rendered draft. `make w3c-check` uses pinned ReSpec 37.3.5 and
writes its temporary snapshot under `$TMPDIR` when set, then `RUNNER_TEMP` or
`/var/tmp`. It needs Node.js 24 or newer and Chrome or Chromium.

## Understand implementation status

The drafts define the target protocol. The reference repositories implement
the stable `v0.2.2` canonicalization profile and the current end-to-end flow.
The newest draft rules for parser-profile rejection, U+0040 attribute-record
escaping, complete RFC 8785 processing, resource ceilings, and native browser
DOM integration still require downstream implementation work. The review
documents identify each remaining gap.

Current prototype repositories:

| Repository | Role |
|---|---|
| [htmltrust-canonicalization](https://github.com/HTMLTrust/htmltrust-canonicalization) | Shared canonicalization bindings and conformance vectors |
| [htmltrust-browser-client](https://github.com/HTMLTrust/htmltrust-browser-client) | Browser verification library |
| [htmltrust-browser-reference](https://github.com/HTMLTrust/htmltrust-browser-reference) | Reference browser extension |
| [htmltrust-server-reference](https://github.com/HTMLTrust/htmltrust-server-reference) | Node trust-directory server |
| [htmltrust-cms-reference](https://github.com/HTMLTrust/htmltrust-cms-reference) | WordPress and Hugo publishing integrations |
| [htmltrust-hugo](https://github.com/HTMLTrust/htmltrust-hugo) | Standalone Hugo integration |
| [htmltrust-e2e](https://github.com/HTMLTrust/htmltrust-e2e) | Combined system tests |
| [htmltrust-website](https://github.com/HTMLTrust/htmltrust-website) | Project website and published draft copies |

For a workspace-wide checkout and the combined run order, use the umbrella
[developer guide](../README.md).

## Contribute or report a problem

Open a GitHub issue or pull request in the repository that owns the behavior.
Protocol changes belong here. Implementation bugs belong in the affected
reference repository. Include a minimal input and the expected canonical
bytes when reporting interoperability failures.

Contributions may use AI-assisted tools. Contributors remain responsible for
the accuracy and licensing of submitted work.

## License

The documents use the [Creative Commons Attribution-NonCommercial-
NoDerivatives 4.0 International license](https://creativecommons.org/licenses/by-nc-nd/4.0/).
See [LICENSE](LICENSE).

## Related documents

- [Contribution guide](CONTRIBUTING.md)
- [IETF Independent Submission process](https://www.rfc-editor.org/about/independent/)
- [W3C Community Groups](https://www.w3.org/community/)
