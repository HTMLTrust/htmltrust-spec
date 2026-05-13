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
