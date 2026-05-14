# HTMLTrust Specification

**Toward Decentralized Trust and Verifiable Content on the Web**

HTMLTrust is a decentralized, standards-aligned framework for embedding cryptographic trust directly into HTML content. Using a proposed `<signed-section>` element, content creators and publishing platforms can sign semantically meaningful regions of web pages and include identity-linked metadata in-band.

This repository contains the scholarly paper and technical specification that defines the HTMLTrust system.

## What Is HTMLTrust?

The web lacks a standardized mechanism for proving who wrote a given piece of content. TLS certifies the domain, but not the author. As AI-generated and republished material becomes ubiquitous, users face increasing difficulty determining what content is trustworthy.

HTMLTrust addresses this by allowing authors to **cryptographically sign blocks of HTML content**, with signatures validated using public key infrastructure (such as [DIDs](https://www.w3.org/TR/did-core/)) and optionally enhanced by third-party endorsements via federated trust directories.

Unlike blockchain-based or DRM-centric systems, HTMLTrust is **lightweight, browser-compatible, and web-native** — designed to scale across publishing workflows, civic media, and knowledge networks.

## Repository Contents

```
paper/
├── htmltrust.tex          # The paper/specification (LaTeX)
├── references.bib         # Bibliography
└── images/
    └── architecture1.png  # System architecture diagram
diagrams/
└── architecture1.md       # Mermaid source for the architecture diagram
```

## Building the Paper

Requires a LaTeX distribution with `biblatex` and `biber` (e.g., [TeX Live](https://tug.org/texlive/) or [MacTeX](https://tug.org/mactex/)).

```sh
cd paper
pdflatex htmltrust.tex
biber htmltrust
pdflatex htmltrust.tex
pdflatex htmltrust.tex
```

The compiled PDF will be output as `paper/htmltrust.pdf`.

## Known Issue: Runtime DOM Mutation Breaks Verification

HTMLTrust signs the **static HTML** that leaves the publishing pipeline. Browser verifiers, however, read the **live DOM** — the state of the page after every script on the page has finished running. If anything inside a `<signed-section>` is mutated between page load and verification, the verifier's recomputed `content-hash` will not match the signed one, and the signature will be reported as invalid even though it is cryptographically correct.

### Concrete cases we have observed

- **Hugo Blox docs theme** injects a `<button class="copy-button">Copy</button>` into every `<pre>` block at runtime. When a signed page contains a code block, the verifier sees an extra `Copy` token inside the signed region that the signer never saw.
- Any **client-side syntax-highlighting** library (Prism, highlight.js) that rewrites a code block's inner HTML at load time has the same effect.
- **Analytics, lazy-loading, or social-share injection** libraries that add nodes inside content containers will break verification if they touch a signed region.

### Mitigations available today

| Mitigation | Trade-off |
|---|---|
| Ensure no client-side script writes into `<signed-section>` descendants | Simplest, but constrains theme/framework choice |
| Pre-render any decoration server-side (e.g., emit the "Copy" button into the static HTML so the signer hashes it) | Works, but every page-template change requires a re-bake |
| Move runtime-injected decoration **outside** the `<signed-section>` (sibling, not child) | Often the cleanest fix when you control the script |
| Read `outerHTML` from a pristine fetch instead of `element.innerHTML` for verification | Requires a verifier-side change; doesn't help current extensions |

### Open spec question

This is a real, general challenge for any content-signing protocol that targets browser-side verification. The spec needs to give implementations explicit guidance — likely a combination of:

1. **Stage 1 canonicalization** SHOULD define a "skip-on-mutation-marker" mechanism (e.g., `data-htmltrust-ignore="true"` on a subtree) so themes can mark decoration that must be excluded from the hash.
2. **Authoring guidance** SHOULD warn against injecting nodes inside signed regions at runtime.
3. **Verifier guidance** MAY recommend fetching the original document and verifying against that, treating DOM-state verification as a separate, optional capability.

This is tracked as an active open design question (see also [open design questions on the implementation page](https://www.htmltrust.org/implementation/#open-design-questions)). Community input is welcome.

## Companion Repositories

| Repository | Description |
|---|---|
| [htmltrust-browser-reference](https://github.com/HTMLTrust/htmltrust-browser-reference) | Reference browser extension for client-side signature validation |
| [htmltrust-server-reference](https://github.com/HTMLTrust/htmltrust-server-reference) | Reference trust directory API server |
| [htmltrust-cms-reference](https://github.com/HTMLTrust/htmltrust-cms-reference) | Reference CMS plugin (WordPress) for content signing |
| [htmltrust-website](https://github.com/HTMLTrust/htmltrust-website) | Project website |

## Author

**Jason Grey** — [jason@jason-grey.com](mailto:jason@jason-grey.com)

## License


This work is licensed under [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)](https://creativecommons.org/licenses/by-nc-nd/4.0/).

## Origin & Contributions

HTMLTrust is an idea I (Jason Grey) have been chewing on since 2024. I'm not an academic — I'm an engineer with a day job and a family — so the spec, the reference implementations, and most of this prose have been written with significant help from AI tools acting as research assistant, technical writer, and pair programmer. I wrote the original architectural sketches and reviewed every line; the assistants filled in the gaps and saved me from re-typing the same explanation for the hundredth time.

**Contributions are welcome — human or AI-assisted, doesn't matter to me.** What matters is whether the code, the spec text, or the conformance vectors move the project forward. Open a PR.

What this project is **not** a forum for:

- Debates about whether AI should be used to write code or specifications.
- Opinions on who is or isn't trustworthy on the web.
- Politics, religion, professional practice, or personal philosophy.

HTMLTrust is a mechanism — a way for *anyone* to sign content they publish and for *anyone* to decide whom they trust, on their own terms. The project takes no position on what the right answers are; it just provides the tools. If you want to debate the answers, there are entire continents of the internet better suited to it.

If this work is useful to you and you'd like to support it, see [GitHub Sponsors](https://github.com/sponsors/jt55401) or the other channels in [`.github/FUNDING.yml`](.github/FUNDING.yml).
