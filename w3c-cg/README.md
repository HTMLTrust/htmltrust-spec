# HTMLTrust W3C Community Group Report

| Field | Value |
|---|---|
| Status | Unofficial draft prepared for Community Group review |
| Updated | 2026-08-27 |
| Author | Jason Grey |
| Primary readers | Browser implementers and Web-platform reviewers |
| Reading time | 3 minutes |

This directory contains the W3C Community Group Report for HTMLTrust, authored using [ReSpec](https://respec.org/).

## Files

- `index.html` — the report itself. ReSpec is loaded from `https://www.w3.org/Tools/respec/respec-w3c` and renders the document client-side; the HTML source is the canonical text.
- `README.md` — this file.

## Previewing locally

ReSpec runs entirely in the browser, but it requires the document to be served over HTTP (not `file://`) because it fetches reference databases and external resources.

From the repository root:

```sh
make w3c
```

Then open <http://localhost:8000/> in a browser. ReSpec will render the document with the W3C house style, generate the table of contents, resolve `[[REF]]` citations, and emit RFC 2119 styling.

Before committing, run `make w3c-check` from the repository root. It uses
pinned ReSpec 37.3.5 and fails on any ReSpec error or warning. The HTML source
is the canonical draft, so no generated snapshot is committed.

## Exporting a snapshot

ReSpec can produce a fully static HTML snapshot (all citations and structure baked in) via its built-in "Export" tool in the ReSpec menu in the top-right of the rendered document. Use that snapshot when publishing a dated version of the report.

## Conventions

- Use `<section>` with `<h2>`/`<h3>` for structure; ReSpec auto-numbers them.
- Define terms with `<dfn>` and cross-reference them with `{{TermName}}` or `[=term=]`.
- Cite other specs with `[[SPEC-ID]]`; ReSpec resolves these from SpecRef. Specs not in SpecRef (currently just the companion IETF I-D) are listed in `respecConfig.localBiblio`.
- Use `<p class="issue" title="…">` for open design questions; ReSpec collects them into an "Issues" list.
- Write RFC 2119 keywords (MUST, SHOULD, MAY) in all caps inside `<em class="rfc2119">`; ReSpec styles them automatically.

## Scope reminder

This document covers the **HTML and DOM integration** of HTMLTrust. The wire protocol (canonicalization, signing payload, directory API, endorsement format) lives in the companion IETF Internet-Draft at `../ietf-draft/` and is cited here as `[[I-D.grey-htmltrust]]`.

The browser extension and JavaScript library are protocol prototypes. They do
not yet implement the native `HTMLSignedSectionElement` interface or
browser-owned navigation-response capture in this draft.
