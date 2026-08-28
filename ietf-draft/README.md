# HTMLTrust IETF Internet-Draft

| Field | Value |
|---|---|
| Status | Working Internet-Draft `-00` |
| Updated | 2026-08-27 |
| Author | Jason Grey |
| Primary readers | Protocol implementers and IETF reviewers |
| Reading time | 4 minutes |

This directory contains the IETF Internet-Draft for the HTMLTrust wire
protocol: canonicalization, signing payload, hash and signature
encoding, the trust-directory HTTP API, and the endorsement document
format. The companion W3C Community Group Report covering the
`<signed-section>` HTML element, its DOM interface, and user-agent
processing model lives in `../w3c-cg/`.

## Files

- `draft-grey-htmltrust-00.md` — the I-D, in kramdown-rfc markdown.
- `vectors/endorsement-01.json` — a reproducible RFC 8785/Ed25519 endorsement vector.
- `vectors/claims-escaping.json` — an injective claim-record escaping vector.
- `vectors/parser-profile.json` — portable parser-profile acceptance cases.
- `vectors/attribute-records.json` — signed-attribute framing and escaping cases.
- `vectors/nested-section.json` — nested signed-section boundary behavior.
- `vectors/origin-serialization.json` — tuple-origin serialization and rejection cases.
- `vectors/signing-profile-v1.json`: the versioned signing object, URL scope,
  timestamp, safe-URL, key, and Ed25519 signature vector.
- `README.md` — this file.

## Before submitting

The frontmatter `date:` field records the date of this working revision in
ISO 8601 form. Update it when preparing a later submission revision.

## Render and validate the draft

The I-D is written in [kramdown-rfc](https://github.com/cabo/kramdown-rfc)
Markdown. From the repository root, run:

```sh
make check
make ietf
```

On a clean workstation, the script can use Docker for kramdown-rfc and `uvx`
for xml2rfc. It pins the container digest and package versions. To install the
generators directly instead, use:

```sh
gem install kramdown-rfc --version 1.7.43
python3 -m pip install xml2rfc==3.34.0
```

Output files:

- `draft-grey-htmltrust-00.xml` — RFC XMLv3 source (this is what the
  datatracker accepts).
- `draft-grey-htmltrust-00.html` — human-readable HTML rendering.
- `draft-grey-htmltrust-00.txt` — plain-text rendering (still the
  canonical form for many IETF tools).

CI regenerates these artifacts and rejects an uncommitted diff. Commit the
Markdown source and all three outputs together.

## Submitting to the IETF datatracker

The IETF Internet-Draft submission flow:

1. Render to XMLv3 and TXT per the section above. The datatracker
   accepts XMLv3 directly and renders HTML/TXT itself; uploading
   `.xml` is sufficient and preferred.
2. Visit <https://datatracker.ietf.org/submit/>.
3. Sign in with a Datatracker account or create one.
4. Upload the `.xml` (and optionally the `.txt` for redundancy).
5. The system parses the document and presents a confirmation page
   with metadata extracted from the frontmatter. Verify author,
   abstract, stream, and category.
6. The submission is held briefly for a confirmation email sent to
   the listed author addresses. Confirm via the link in that
   email.
7. The draft will appear at
   <https://datatracker.ietf.org/doc/draft-grey-htmltrust/>.

## Independent Submission stream

The `submissiontype: independent` line in the frontmatter targets
the Independent Submission Stream (ISE), which is the appropriate
route for an Experimental RFC produced outside any IETF Working
Group. Once the draft has matured (one or more revisions, community
feedback addressed), the next step is to email the ISE Editor
following the process at
<https://www.rfc-editor.org/about/independent/>. The ISE will
arrange independent review and, if accepted, advance the document
to the RFC Editor queue.

Independent Submissions are explicitly not IETF consensus
documents (note `consensus: false` in the frontmatter). They
represent the author's view and are reviewed for technical
quality and non-conflict with IETF work, not for community
agreement.

## Versioning

Each revision increments the `-NN` suffix in the filename and in
`docname:`. So this document, when superseded, becomes
`draft-grey-htmltrust-01.md` with `docname: draft-grey-htmltrust-01`
and so on. The Datatracker keeps the full history under the
`draft-grey-htmltrust` stem.

## Style conventions

- BCP 14 keywords (MUST, SHOULD, MAY) in capitals.
- Cross-references to the companion W3C document use `[HTMLTRUST-W3C]`.
- Open design questions are marked "Open Issues" or with explicit
  "Editor's Note:" callouts; these are expected and welcome in an
  Internet-Draft.
- Sections are numbered automatically by kramdown-rfc.

## Companion documents

- W3C CG Report (HTML/DOM integration): `../w3c-cg/index.html`.
- Whitepaper: `../paper/htmltrust.tex`.
- Canonicalization reference implementations and test vectors:
  `../../htmltrust-canonicalization/`.
- Repository-wide build guide: `../README.md`.
