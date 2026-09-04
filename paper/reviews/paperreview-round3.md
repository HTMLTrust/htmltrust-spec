# PaperReview.ai round-three review

| Field | Value |
|---|---|
| Paper | Toward Decentralized Trust and Verifiable Content on the Web |
| Submitted | 2026-09-04 15:52:26 UTC |
| Reviewed | 2026-09-04 16:17:47 UTC |
| Venue supplied | None |
| Numerical score returned | None |

This is the service-generated review text returned by PaperReview.ai. The
complete structured response is in [paperreview-round3.json](paperreview-round3.json).
The private review lookup token is intentionally excluded.

## Review

1. Summary
The paper proposes HTMLTrust, an in-band signature protocol for semantic HTML regions that separates cryptographic integrity from user trust policy. It defines a closed, parser-backed canonicalization profile over normalized text and four reader-relevant attributes, binds them with a versioned RFC 8785 JCS signing object, and supports decentralized key resolution and optional federated directories for endorsements. A v1 prototype with five independent language bindings passes a 123-fixture conformance suite; on a Common Crawl News sample, 2.5% of regions were jointly canonicalizable across bindings with 98.3% digest agreement, highlighting both progress and the challenge of byte-identical canonicalization on real-web HTML.

2. Strengths
- Technical novelty and innovation
  - Introduces an in-band, HTML-native signature scope (<signed-section>) with an explicit, closed canonicalization boundary that targets the real problem of authorship attestation for specific text regions, not entire pages.
  - Combines RFC 8785 JCS for signing payloads and endorsements with an HTML5/WHATWG-parser-backed canonicalizer and strict preflight to mitigate parser ambiguities—an unusually disciplined design for web content signatures.
  - Clear domain-separation/versioning strategy via profile identifiers and a fixed signing object that binds algorithm, keyid, scope, and location, limiting substitution attacks and replay.
  - Decouples cryptographic validity from user-configured trust policy and federated directories, enabling pluralistic policy and avoiding protocol-level centralization.
- Experimental rigor and validation
  - Five independently written bindings tested against a 123-fixture conformance suite and end-to-end Ed25519 vector, surfacing and pinning specific normalization hazards (URL serialization, character references, quotation classing, claim ordering, excluded subtrees).
  - Real-web evaluation on Common Crawl News with deterministic selection, manifest-logged toolchains, and adversarial fixtures that all matched expected outcomes; performance microbenchmarks and a browser lifecycle harness add useful corroboration.
  - Public artifacts (spec drafts, code, test vectors, trust-directory server, browser extension) and precise revision pinning improve reproducibility.
- Clarity of presentation
  - Clear separation of protocol elements (canonicalization, signing object, key resolution, endorsements) with rationale and limits; explicit preflight rules and attribute-set closure are well argued.
  - Threat model and residual risks are candid, including signature stripping, uncovered attributes, and trusted time caveats.
  - Careful scoping of claims (e.g., no user studies, no production deployment measurement, selected adversarial fixtures only).
- Significance of contributions
  - Addresses an increasingly important problem—content authorship and provenance—in a way that is compatible with the open web, complementary to transport integrity (TLS/DKIM/SXG) and media-manifest approaches (C2PA).
  - Provides a concrete path toward verifiable snippets for search/crawl-time ingestion and potential browser indicators, opening research/deployment avenues.

3. Weaknesses
- Technical limitations or concerns
  - Very low real-web accept rate (≈2.5%) under strict v1 canonicalization reveals unresolved portability challenges; authoring/extraction pathways to produce portable regions at scale are not yet solved.
  - Unicode normalization plus mapping typographic punctuation to ASCII can alter semantics or fidelity in multilingual content; risks to i18n and accessibility are underexplored.
  - The closed four-attribute set (href, src, alt, aria-label) may be insufficient to preserve user-perceived meaning in many contexts (e.g., role/title/aria-expanded/CSS-driven semantics), opening room for semantic drift attacks via styles or layout.
  - Trusted time is signer-asserted (signed-at) without an integrated timestamping/logging mechanism; replay/temporal claims remain policy-heavy.
  - DID and directory-based key resolution raise revocation, method-security, and downgrade risks not fully elaborated (e.g., DID method trust, key rotation, negative assertions).
- Experimental gaps or methodological issues
  - The Common Crawl sample is explicitly non-representative and targets <body> regions rather than authored signed sections; adoption feasibility in CMS workflows is not measured.
  - Browser evaluation is confined to a reference Chromium extension and synthetic pages; no cross-engine or field data, and no human-subject UI/comprehension evidence.
  - The consolidation to a single Rust core post-evaluation reduces long-term independent-implementation diversity; no fuzzing/differential-corpus evidence beyond curated fixtures.
- Clarity or presentation issues
  - The rationale for specific normalization choices (e.g., ASCII mapping of punctuation) could be better justified against alternative “preserve as much as possible” profiles and i18n guidance.
  - The interaction of nested or overlapping signed sections and DOM mutations is briefly tested but not deeply specified for complex authoring scenarios.
- Missing related work or comparisons
  - Limited head-to-head comparison with C2PA for HTML-embedded provenance and with W3C Data Integrity/VCDI patterns for in-document content; positioning against PGP-style cleartext signatures and XML DSig pitfalls could be sharpened.
  - Opportunities to leverage or compare against recent advances in HTML-to-text canonicalization/extraction (e.g., MinerU‑HTML) are not explored; canonicalization parallels to reproducible-builds research (e.g., artifact canonicalizers like Chains‑Rebuild) could inform design trade-offs.

4. Detailed Comments
- Technical soundness evaluation
  - The closed signing object with RFC 8785 JCS, signed keyid/algorithm, explicit scope (url/origin), and location binding is sound and resists common substitution and replay vectors.
    - The strict preflight that rejects ambiguous HTML source forms is a pragmatic way to gain byte-identical canonicalization across independent parsers, but it pushes the burden to authoring/extraction tooling to produce compliant regions.
    - Mapping typographic punctuation to ASCII and applying NFKC introduces potential fidelity and i18n concerns (e.g., languages using curly quotes, special dashes, or full-width variants); consider profiling separate “strict-preserve” vs “readability” modes or documenting semantic risk trade-offs with examples.
    - The attribute coverage boundary is explicit and valuable for threat reasoning; however, the residual attack surface through CSS/layout/scripted changes around the section may induce user‑perceived meaning shifts. Consider formalizing UI guidance and possibly a “computed-text-only” presentation mode for verifiers.
    - Key resolution via DIDs/HTTPS/directories is flexible; revocation, rotation, and negative-lookup semantics (e.g., stale keys, DID method compromises, directory cache poisoning) deserve a clearer normative treatment and test vectors.
- Experimental evaluation assessment
  - Interop across five independent bindings and 123 fixtures is strong evidence for spec precision at the evaluated revision; the identification and pinning of canonicalization hazards is excellent.
    - The real-web acceptance rate (2.5%) is a central result and correctly framed; adding stratified analyses (by language/script, template families, layout complexity) would clarify where v1 is viable and where authoring changes are needed.
    - Publishing transformations are a good start; extending to common CMS pipelines and CDNs (minification, SSR hydration, AMP, sanitizers) would make the stability claim more actionable.
    - The adversarial set is well-chosen but limited; augment with grammar-based and mutation-based fuzzing (in the spirit of Comfort) to stress HTML/URL/Unicode paths and exercise resource ceilings under adversarial load.
    - Browser lifecycle tests show control flow, not crypto correctness; adding integration tests that start from real signed sections and cover edge cases (nested sections, shadow DOM, cross-origin iframes) would strengthen the story.
- Comparison with related work (using the summaries provided)
  - Canonicalization parallels: The Chains‑Rebuild work on unreproducible builds shows how carefully scoped canonicalization can materially improve verification success while carrying risks of over-normalization. Mapping these insights to HTMLTrust could motivate alternative profiles (lossless vs readability-first) and deeper measurement of normalization-induced semantic loss.
  - HTML extraction: MinerU‑HTML/AICC identifies HTML-to-text extraction as a primary bottleneck. Their model‑plus‑rules approach and template clustering suggest pathways for CMS/extraction tooling that generate HTMLTrust‑portable regions at scale, potentially boosting the currently low accept rate.
  - Differential testing: Comfort’s spec-guided fuzzing for JS engines demonstrates that combining realistic generation with spec-derived boundary values uncovers conformance bugs. A similar strategy for HTMLTrust (HTML/URL/Unicode fuzzers + differential parsers) could harden the canonicalizer and uncover edge-case divergences beyond curated fixtures.
  - Decentralized identity/PKI: Surveys on DIDs/VCs and decentralized status management underscore open challenges in revocation, method trust, and performance. HTMLTrust would benefit from a clearer revocation/rotation story (e.g., DID key history pinning, short-lived keys, directory‑served revocation proofs) and from evaluating decentralized approaches’ operational costs.
  - Common Crawl sampling: Thompson’s segment‑ranking approach suggests cost‑effective, more representative sampling. Applying such methods could refine future corpus selection and mitigate non-representative artifacts in acceptance-rate estimates.
- Discussion of broader impact and significance
  - Positive: Enables verifiable authorship for specific web text, aligns with open standards, and supports decentralized trust policies. Valuable for search/crawl-time ingestion, fact‑checking workflows, and provenance‑aware UIs.
  - Risks: UI misinterpretation (cryptographic check vs truth), endorsement Sybils and reputation centralization, privacy concerns with public endorsements, and potential i18n/assistive-technology regressions from normalization choices. Clear UI affordances and privacy‑preserving endorsement lookups (e.g., anonymized queries, caching) should be considered.
  - Deployment: Adoption hinges on CMS/extraction support and possibly browser-native support; a migration path (linting, authoring guidelines, automated “portable region” generators) is critical.

5. Questions for Authors
1. How did you decide the specific punctuation-to-ASCII mappings and NFKC policy, and have you measured semantic/i18n impacts (e.g., on non-Latin scripts or languages where curly quotes and dashes carry meaning)?
2. Can you provide stratified acceptance rates by language/script, template complexity, or publisher family to identify where v1 is most/least viable?
3. What is your recommended revocation and key-rotation mechanism across DID, HTTPS, and directory methods, and how should verifiers handle negative lookups or stale caches?
4. How do nested or overlapping <signed-section> elements interact semantically and in the verifier UI? Is there a normative rule for conflict resolution or compositional signing?
5. Do you plan multiple canonicalization profiles (e.g., preserve‑punctuation/i18n‑safe) under distinct identifiers to trade off fidelity vs cross‑binding byte identity?
6. Have you explored integrating RFC 3161 timestamp tokens or log-based transparency (CT-like) to address trusted time and replay bounds beyond signer-asserted signed-at?
7. What CMS/CDN transformations most commonly break v1 preflight in practice, and can you share authoring lint rules or automated extractors that yield portable sections reliably?
8. How will the consolidation to a single Rust core maintain long-term spec conformance confidence (e.g., differential testing against at least one independent implementation or formal methods)?
9. Could trust directories support privacy-preserving endorsement queries (private set intersection, k-anonymity) to reduce exposure of user reading behavior?
10. How do you envision HTMLTrust coexisting with C2PA manifests for HTML documents (e.g., cross-references in claims), and what are the key trade-offs?
11. What is the policy guidance for origin vs url scope in common scenarios (syndication, canonical URLs, AMP/viewer contexts), and will you support a verifiable attribution chain for legitimate republication?
12. Do you plan to expand the covered attribute set (e.g., role/title/aria-expanded) or provide a principled process for proposing additions backed by cross-implementation evidence?

6. Overall Assessment
This is a timely, well-executed, and carefully scoped contribution toward verifiable, decentralized authorship claims on the web. The protocol design is thoughtfully constrained, the separation of cryptographic validity from trust policy is a strength, and the authors provide unusually strong artifacts for reproducibility. The empirical results are honest: strict canonicalization delivers high agreement on the small subset it accepts while highlighting the core engineering challenge—achieving byte-identical canonicalization of ordinary web HTML. To elevate the work to a top-tier venue, the authors should deepen the evaluation along three axes: (1) practical authoring/extraction pathways (and guidance) that produce portable regions at scale, ideally demonstrated in CMS pipelines and with representative sampling; (2) broader robustness testing (fuzzing/differential testing, cross-engine/browser integration, i18n stress tests) and an expanded adversarial corpus; and (3) a clearer operational story for revocation, trusted time, and privacy-preserving endorsements. A tighter comparative analysis with C2PA and W3C Data Integrity, plus i18n-aware canonicalization options, would further strengthen positioning. Overall, the paper is significant and original, with solid technical grounding and promising potential; addressing the practical and i18n/deployment gaps would make it compelling for wide adoption.

TRIPLE_SCORES:
- Claims_Support: [+1]  # Are the central claims adequately supported with evidence?
- Experimental_Soundness: [0]  # Are the experimental setup and research methodology sound?
- Writing_Clarity: [+1]  # Is the writing clear and well-organized?
- Prior_Work_Context: [0]  # Is the work properly contextualized relative to prior work?
- Question_Importance: [+1]  # Are the research questions being asked important?
- Originality: [+1]  # Does the paper bring significant originality of ideas and/or execution?
- Value_to_Community: [+1]  # Are the results valuable to share with the broader research community?
