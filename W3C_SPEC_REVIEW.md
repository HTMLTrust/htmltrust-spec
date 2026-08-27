# HTMLTrust W3C Community Group Spec Review

Review target: `htmltrust-spec/w3c-cg/index.html`

Review stance: critical security/browser-researcher review of the W3C HTML/DOM integration document, compared against the current browser extension, browser client, canonicalization, CMS, Hugo, and e2e prototype behavior. This report intentionally proposes edits but does not apply them.

## 1. Executive Summary and Top Risks

The draft has the right high-level split between cryptographic verification and user trust policy, but it is not yet precise enough to be implementable by browsers or safely matched to the existing prototypes.

Top risks:

1. **Verification input is not stable or securely bound to the rendered content.** The W3C draft says verification operates on the live DOM and invalidates on mutation, while the browser extension fetches the original page HTML and verifies "pristine" regex-extracted sections when possible. That can produce a "valid" indicator adjacent to content that no longer matches the verified bytes.
2. **The element/interface model is not Web-platform coherent.** The draft mixes a hyphenated autonomous-custom-element name with a native `HTMLSignedSectionElement` interface and `[HTMLConstructor]`. Browsers, extensions, polyfills, and conformance tests will not converge until the spec chooses a built-in HTML element path or a custom-element/polyfill path.
3. **Text-only signing is currently too weak for user-facing provenance UI.** The draft acknowledges `href` rewriting, but the attack surface is larger: links, forms, images/media, `srcset`, `aria-label`, `hidden`, CSS classes, event-bearing surrounding markup, and layout context can all alter user meaning without invalidating the signature.
4. **Protocol fields are inconsistent across W3C, IETF, and code.** Base64 vs base64url vs hex, host vs origin, claim serialization, claim inclusion, failure reason strings, and directory endpoint shapes differ. These are not cosmetic; they decide whether independently produced signatures verify.
5. **Network and privacy behavior is underspecified.** Key resolution, directory queries, CSP, CORS, service workers, credentials, referrer policy, mixed content, cache, user opt-in, and page-provided directory URLs need browser-grade rules.

Overall recommendation: before expanding UI guidance, resolve the core contract: exact element model, verification input source, canonical payload fields, network model, and minimum semantic coverage. Treat the existing extension as a useful prototype, not yet as a conforming browser model.

## 2. Scope Reviewed and Files Consulted

Primary W3C scope:

- `htmltrust-spec/w3c-cg/README.md`: scope reminder says this document covers HTML/DOM integration of `<signed-section>`, DOM interface, and user-agent processing model.
- `htmltrust-spec/w3c-cg/index.html`: element, DOM interface, processing model, UI, security/privacy, accessibility, open issues, conformance summary.

Cross-document consistency:

- `htmltrust-spec/ietf-draft/draft-grey-htmltrust-00.md`: canonicalization, signing payload, encoding, key resolution, verification procedure, privacy/security.

Browser extension and client:

- `htmltrust-browser-reference/src/content-scripts/index.ts`
- `htmltrust-browser-reference/src/content-scripts/auto-verify.test.ts`
- `htmltrust-browser-reference/src/core/content/content-processor.ts`
- `htmltrust-browser-reference/src/core/api/content-signing-client.ts`
- `htmltrust-browser-reference/src/core/api/content-signing-client.test.ts`
- `htmltrust-browser-reference/src/core/common/types.ts`
- `htmltrust-browser-reference/src/background/index.ts`
- `htmltrust-browser-reference/src/ui/popup/index.tsx`
- `htmltrust-browser-reference/src/ui/components/VerificationStatus.tsx`
- `htmltrust-browser-reference/src/assets/content.css`
- `htmltrust-browser-reference/src/platforms/chromium/manifest.json`
- `htmltrust-browser-client/src/index.ts`
- `htmltrust-browser-client/src/verify.ts`
- `htmltrust-browser-client/src/policy.ts`
- `htmltrust-browser-client/src/resolver.ts`
- `htmltrust-browser-client/src/endorsements.ts`
- `htmltrust-browser-client/test/verify.test.js`
- `htmltrust-browser-client/test/extract.test.js`

Canonicalization:

- `htmltrust-canonicalization/spec.md`
- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-canonicalization/javascript/test.js`
- `htmltrust-canonicalization/python/htmltrust_canonicalization/_extract.py`
- `htmltrust-canonicalization/go/canonicalize.go`
- `htmltrust-canonicalization/conformance/README.md`

CMS, Hugo, and e2e:

- `htmltrust-cms-reference/wordpress/public/class-content-signing-public.php`
- `htmltrust-cms-reference/wordpress/public/class-content-signing-display.php`
- `htmltrust-cms-reference/wordpress/includes/class-content-signing-signing-service.php`
- `htmltrust-cms-reference/hugo/layouts/partials/htmltrust-signed-section.html`
- `htmltrust-cms-reference/hugo/scripts/sign-site.mjs`
- `htmltrust-hugo/layouts/partials/htmltrust-signed-section.html`
- `htmltrust-hugo/cmd/htmltrust-sign/sign.go`
- `htmltrust-hugo/cmd/htmltrust-sign/sign_test.go`
- `htmltrust-e2e/src/lib/playwright-session.ts`
- `htmltrust-e2e/src/phases/researcher.ts`
- `htmltrust-e2e/Dockerfile.wordpress`

## 3. Findings Ordered by Severity

### F-01: Verification Can Be Detached From the Rendered DOM

Severity: Critical

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Verification lifecycle" says verification starts after parser completion and cached results are invalidated when descendants are inserted, removed, or text-mutated. "Open Issues / Issue 3" acknowledges static signing versus runtime mutation.

Code location: `htmltrust-browser-reference/src/content-scripts/index.ts` fetches `window.location.href`, extracts signed-section slices from the fetched HTML, position-pairs them with live DOM sections, and verifies the pristine slice. It falls back to live DOM only when pristine fetch fails or counts differ. `htmltrust-browser-client/src/verify.ts` supports string-section verification for this path.

Issue: The spec says the live element's verification result is invalidated by descendant mutation. The extension deliberately verifies a separately fetched copy of the page to avoid runtime mutation failures. If page script mutates visible text, links, or ordering after load while the fetched source remains valid, the extension can display a valid indicator next to content that was not the verified input.

Security/interoperability impact: This is a direct integrity/UI binding problem. A malicious publisher origin, compromised script, or service worker can present altered user-visible content while the verifier attests original source bytes. Different UAs may choose live DOM, fetched source, parser snapshot, or serialized outerHTML and disagree on the same page.

Recommendation: Define one normative verification input model. Preferred browser-grade shape:

- A verification result MUST identify the exact snapshot used: parser DOM snapshot, live DOM snapshot at time T, or original response bytes.
- A UI indicator MUST NOT imply the currently rendered DOM is verified unless the visible text/semantic-covered fields still match the verified snapshot.
- If a verifier uses response-byte or parser snapshots to tolerate benign mutation, the DOM API should expose a state such as `stale`, `snapshotValidButRenderedContentChanged`, or `validForSourceOnly`.
- Specify mutation observation requirements and whether attributes, shadow roots, template contents, slot assignments, and text nodes trigger invalidation.
- Add conformance tests that mutate signed content after verification and require the result to become stale/invalid or explicitly source-only.

Fix: Both. The W3C spec must settle the input model; the extension should not show a simple valid badge for a pristine-source result unless it also checks the visible DOM against the verified canonical text.

### F-02: The Element/DOM Interface Model Is Not Web-Platform Coherent

Severity: Critical

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Goals" says "custom-element semantics"; "Parsing" says it may be backed by a custom-element definition or treated as `HTMLElement`; "DOM Interface" requires `HTMLSignedSectionElement : HTMLElement` with `[HTMLConstructor]`, reflected attributes, `verification`, and `verify()`.

Code location: Current code treats `signed-section` as an unknown/custom element via selectors and attributes. No implementation defines `customElements.define("signed-section", ...)`, no `HTMLSignedSectionElement` exists, and tests only assert selector and library behavior.

Issue: A hyphenated tag name is an autonomous custom-element name. Native HTML element interfaces typically do not use hyphenated tag names, and an autonomous custom element cannot be both "maybe HTMLElement with attribute APIs only" and normatively expose a built-in `HTMLSignedSectionElement` interface. `[HTMLConstructor]`, `[CEReactions]`, and custom-element upgrade semantics are not enough to make this coherent.

Security/interoperability impact: Page scripts will see different objects across browsers/extensions/polyfills. A page could define or preempt `customElements.define("signed-section", ...)`, shadow the expected behavior, or detect extension/native support. Conformance tests cannot assert `element.verify()` if extension implementations only provide out-of-band content-script verification.

Recommendation:

- Choose one model:
  - **Native element track:** define a real HTML element in the HTML namespace with a non-custom-element processing model and a stable `HTMLSignedSectionElement` interface. Then remove language suggesting arbitrary custom-element fallback as conforming UA behavior.
  - **Custom-element/polyfill track:** define the markup contract and a JavaScript API separately; do not require native `HTMLSignedSectionElement` on unknown elements. Define how page-authored custom elements are prevented from spoofing UA verification, or state that browser-grade verification is extension/chrome-only.
- Specify whether page script can call `verify()` and read trust results, or whether only cryptographic status is exposed to page script while trust policy remains chrome-private.

Fix: Spec.

### F-03: Text-Only Signing Leaves User-Meaningful Semantics Unsigned

Severity: High

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Attributes" says global attributes are not covered. "Open Issues / Issue 2" says text-only signing lets an adversary rewrap text or alter `href` values without invalidating the signature.

Code location: `htmltrust-canonicalization/javascript/index.js` strips markup and attributes; `htmltrust-canonicalization/spec.md` is text-normalization focused; `htmltrust-browser-client/src/verify.ts` verifies only the content hash and claims hash. Existing CMS/Hugo signing follows the same model.

Issue: The open issue understates the attack. Text-only coverage allows alteration of:

- `href`, `target`, `rel`, `download`, `ping` on links.
- `src`, `srcset`, `poster`, `alt`, `title`, `aria-label`, `aria-describedby`.
- `form action`, `method`, button labels versus form destinations.
- `dir`, `lang`, `hidden`, `inert`, and CSS classes that change visibility/order.
- surrounding markup and media that changes context.

Security/interoperability impact: A user-facing "Signature valid" badge can be abused for phishing and context forgery. For example, signed text "download the patch" can point to an attacker URL; "Alice recommends this" can be visually attached to a different image or product; ARIA text can diverge from visible text.

Recommendation:

- Do not leave this as a broad open issue if the spec is meant for user-agent UI. Define a minimal semantic attribute allowlist before promoting "valid" UI.
- At minimum cover anchor destinations and accessible names for interactive controls inside signed content: `a[href]`, `area[href]`, `form[action]`, media `src`/`srcset` if media is treated as part of the signed region, and `aria-label`/`alt` where it changes the text assistive technologies consume.
- Define whether covered URLs are resolved absolute against document base URL, whether fragments are included, how URL normalization works, and whether `target=_blank`/`rel` is covered.
- If the group intentionally keeps text-only signing, require UI language such as "text signature valid" and prohibit implying whole-region integrity.

Fix: Spec first; code once the semantic coverage contract is chosen.

### F-04: W3C, IETF, and Code Disagree on Core Wire Fields

Severity: High

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Attributes", "In-band claim metadata", "Layer 1", "Issue 1". `htmltrust-spec/ietf-draft/draft-grey-htmltrust-00.md`, Sections 4.6, 5, 6, and 11.

Code location: `htmltrust-browser-client/src/verify.ts`, `htmltrust-canonicalization/javascript/index.js`, `htmltrust-hugo/cmd/htmltrust-sign/sign.go`, `htmltrust-cms-reference/wordpress/includes/class-content-signing-signing-service.php`, `htmltrust-cms-reference/hugo/scripts/sign-site.mjs`.

Issue: Several byte-level contracts diverge:

- W3C Issue 1 says the IETF draft uses unpadded Base64; current IETF text says unpadded base64url.
- Browser client hashing uses browser `btoa` standard Base64 for default hashes; Hugo CLI uses `base64.RawStdEncoding`; IETF examples use base64url; older WordPress and CMS-Hugo paths use hex.
- W3C defines `signed-at` as a meta claim that participates in the signing payload; code parses `signed-at` separately and excludes it from `claims`.
- IETF canonical claims serialize `name:content`; the JS canonicalization implementation serializes `name=value`.
- Code strips `claim:` prefixes and ignores `author`; IETF example canonical claims include `author`, `claim:License`, and `signed-at`.
- Failure reason strings differ: W3C uses hyphenated `"content-hash-mismatch"` and `"key-resolution-failed"`; code returns `"content hash mismatch"`, `"key not resolvable"`, `"signature invalid"`, and `"missing required attributes"`.

Security/interoperability impact: Independent signers and verifiers will not interoperate. More seriously, ambiguous claim inclusion means two implementations can believe they verified the same signature while binding different metadata. Encoding drift also breaks content-hash addressing and directory lookup.

Recommendation:

- Make W3C defer all byte-level encodings to IETF but accurately summarize the current choice.
- Pick one encoding now. For browser and URL path compatibility, base64url is preferable if the IETF draft keeps it; update code and examples accordingly.
- Define the canonical claims set precisely: whether it includes `author`, `signed-at`, `claim:*`, and unknown `name`s; whether names include the `claim:` prefix; delimiter and escaping; duplicate-name behavior.
- Standardize a closed failure-reason enum across W3C, IETF, and client libraries.
- Add cross-repo fixtures containing complete signed sections, not just text normalization fixtures.

Fix: Both.

### F-05: Domain Binding Uses Hostname in Code but Origin in the Protocol

Severity: High

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Security and Privacy Considerations / Republication and domain binding". `htmltrust-spec/ietf-draft/draft-grey-htmltrust-00.md`, "Signing Payload Binding / domain" defines scheme, host, and non-default port.

Code location: `htmltrust-browser-client/src/verify.ts` defaults to `window.location.hostname`; `htmltrust-browser-reference/src/content-scripts/index.ts` passes `window.location.hostname`; `htmltrust-browser-reference/src/background/index.ts` passes `new URL(url).hostname`; WordPress signing uses `parse_url(get_site_url(), PHP_URL_HOST)`.

Issue: The W3C text says "origin" in security rationale but code signs/verifies only hostname. The IETF draft requires scheme and non-default port. Current code therefore treats `http://example.com`, `https://example.com`, and `https://example.com:8443` as the same domain.

Security/interoperability impact: Cross-scheme and cross-port replay remain possible in implementations that bind only host. This is especially problematic for staging, local dev, alternate ports, and mixed HTTP/HTTPS deployments.

Recommendation:

- In W3C, use "origin" consistently and define it by URL Standard origin serialization. Avoid the term "domain" unless deliberately host-only.
- Require IDNA canonicalization, default-port handling, and opaque-origin failure behavior.
- Update implementations to pass serialized origin, not hostname, into the signing payload.
- Add tests proving signatures fail across scheme and non-default port boundaries.

Fix: Both.

### F-06: Network, CSP, CORS, Credentials, and Service-Worker Semantics Conflict

Severity: High

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Content Security Policy interactions" says key resolution and directory queries are subject to CSP and Fetch rules for user-initiated subresource requests, but also says a page must not suppress or redirect key-resolution requests via CSP. "Fingerprinting" says directories must be user-enabled.

Code location: `htmltrust-browser-reference/src/platforms/chromium/manifest.json` grants `<all_urls>` host permissions; `htmltrust-browser-reference/src/content-scripts/index.ts` fetches `window.location.href` with `credentials: "same-origin"`; key resolution happens from content/background/library contexts; e2e runs Node-side to avoid CORS/SubtleCrypto problems.

Issue: Browser-grade network behavior is underspecified and internally contradictory. If CSP applies, a page can block `connect-src`; if CSP cannot suppress key resolution, then the fetch is UA-initiated and not a normal subresource. The spec also does not say whether service workers can intercept the pristine fetch or key fetch, whether cookies/referrers are sent, whether mixed content is allowed, whether CORS is enforced, or how page-supplied `verify({ directories })` URLs are constrained.

Security/interoperability impact: Implementations can leak reading behavior to signer-controlled key hosts, allow page-triggered network probes, disagree under CSP/CORS, or verify different bytes if a service worker intercepts the source re-fetch. Page-supplied directory URLs can become a fingerprinting and request-forgery vector.

Recommendation:

- Define key and directory requests as a distinct "HTMLTrust verification fetch" with explicit settings: credentials, referrer, cache mode, redirect mode, CORS mode, service-worker interception, mixed-content blocking, timeout, and error mapping.
- Require `https` for direct URL and directory key resolution in browser UAs, matching the IETF draft, unless a local-dev exception is explicitly non-conforming.
- Page-provided `directories` should be ignored unless user-configured, permission-gated, or same-origin and HTTPS.
- State whether CSP can block verification fetches. If not, say they are not controlled by page CSP and justify the security model.
- Add privacy guidance for key-resolution traffic, not only directory traffic.

Fix: Spec first; extension should align once the fetch mode is defined.

### F-07: In-Band Claim Metadata Uses `<meta>` in Body Without a Full HTML Conformance Story

Severity: Medium

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Categories and content model" and "In-band claim metadata" require direct child `<meta name=... content=...>` elements before flow content.

Code location: All implementations emit direct child `<meta>` elements inside `<signed-section>`.

Issue: Plain `<meta name=...>` is metadata content normally associated with `head`; body usage has narrow HTML rules. The spec defines a custom content model for a new element, but it does not explain parser, validator, DOM, accessibility tree, and authoring-conformance consequences of `meta` in body.

Security/interoperability impact: CMS filters, sanitizers, validators, and frameworks may strip or move body `meta` tags. If claims are silently removed, signatures fail or metadata binding changes. Existing WordPress/e2e notes already show HTML filters can break signed-section structure.

Recommendation:

- Add a normative "body-scoped claim metadata" subsection that explicitly makes these `meta` children conforming only as direct children of `signed-section`.
- Define parser behavior if content appears before claim meta, duplicate names appear, malformed meta appears, or sanitizers reorder meta.
- Consider `script type="application/htmltrust+json"` or attributes if body `meta` proves too fragile, but only if canonicalization/testability remains simple.

Fix: Spec.

### F-08: Nested `<signed-section>` Semantics Are Underspecified and Regex Extraction Breaks Them

Severity: Medium

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Categories and content model" allows nesting and says nested sections verify independently. IETF draft says an inner section contributes canonical content to the outer as a transparent block-producing element.

Code location: `htmltrust-browser-client/src/verify.ts` uses non-greedy regex extraction for string sections; `htmltrust-browser-reference/src/content-scripts/index.ts` position-pairs extracted strings to DOM sections by order.

Issue: The W3C draft does not define whether an outer section's content hash includes inner claims, inner visible text, inner signature attributes, or only the inner canonical content. The string extractor cannot correctly extract nested same-name elements; it will stop at the first inner closing tag.

Security/interoperability impact: Nested sections can verify differently across DOM and string implementations, and pristine-source verification can become mispaired. Attackers can use nested sections to create parser/extractor discrepancies.

Recommendation:

- Define nested behavior in W3C, not only IETF: whether outer canonicalization includes inner visible text, excludes inner claim metadata, and how mutation of inner sections invalidates outer results.
- Require DOM/parser-based extraction for nested signed sections. If regex extraction is kept for prototype code, mark nested sections unsupported and return a distinct failure.
- Add nested conformance fixtures.

Fix: Both.

### F-09: Trust Results Exposed to Page Script Create Fingerprinting and Policy Leakage

Severity: Medium

Spec location: `htmltrust-spec/w3c-cg/index.html`, "DOM Interface" exposes `verification`, `trust`, `score`, `tier`, contributors, and `verify(options)`. "Fingerprinting" discusses directory IP leakage but not page-script observation of user policy.

Code location: The extension stores per-section trust results in content script state and exposes them to the extension popup, not to page JS. The browser client `evaluateTrustPolicy` is a library API, not a native DOM API.

Issue: A native DOM API that exposes trust score and contributors to page scripts leaks user-specific trust lists, configured directories, reputation subscriptions, and possibly browsing-security posture. `verify(options.directories)` also lets a page request computation using chosen directory URLs, subject only to vague user policy.

Security/interoperability impact: Sites can fingerprint users by probing known signed sections and observing trust tiers, contributor lists, timing, and network side effects. This contradicts the privacy intent that directories must be user-enabled.

Recommendation:

- Split DOM exposure into `crypto` and `trust` surfaces. Page script should at most receive deterministic cryptographic status; user trust policy should be chrome/extension/assistive-tech mediated unless the user grants access.
- Remove or severely constrain `VerifyOptions.directories` from the page-callable API.
- Define privacy budget, permission policy, or user activation requirements if trust contributors are exposed.

Fix: Spec.

### F-10: UI Guidance Conflicts With Extension Reality and Spoofing Risks

Severity: Medium

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Default rendering" says UAs must not apply chrome-level decoration to the element box. "UI Guidance" says indicators should be chrome and not spoofable.

Code location: `htmltrust-browser-reference/src/content-scripts/index.ts` mutates page DOM, adds classes, sets `title`, inserts badge containers, and vote buttons. `htmltrust-browser-reference/src/assets/content.css` styles page-injected badges with normal CSS classes and z-index.

Issue: The spec's "chrome, not spoofable" model is not what the reference extension implements. Content-script DOM injection is visible page content; pages can remove, cover, imitate, restyle, or clickjack it. The extension also modifies the signed element's own box via outlines, despite the draft's no-decoration language.

Security/interoperability impact: Users may learn to trust page-DOM badges that pages can spoof. Attackers can create identical `cs-verification-badges` UI or hide invalid indicators. This is a browser security problem, not just UX polish.

Recommendation:

- Distinguish native-UA chrome indicators from extension/content-script indicators.
- For native UAs, prohibit page DOM mutation for security indicators and require an unspoofable surface.
- For extension reference code, present page badges as convenience cues only and make the popup/browser-action the authoritative surface.
- Add anti-spoofing guidance: origin-independent iconography, click target outside page DOM, accessible relationship to section, and spoof-detection language.

Fix: Spec and browser-reference UI.

### F-11: Failure Reporting and Side-Channel Requirements Are Unrealistic as Written

Severity: Medium

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Errors" and "Side channels" say user agents must not throw, log, visibly fail, or expose observable side channels; verification failure must be reported only through `SignedSectionVerificationResult`.

Code location: `htmltrust-browser-client/src/verify.ts` logs debug warnings when enabled; `htmltrust-browser-reference/src/content-scripts/index.ts` logs errors/warnings and inserts invalid/error badges; tests assert invalid badges are inserted.

Issue: The draft says failure is only visible through the DOM result, but the API itself is page-visible and intentionally reports failure. It also does not separate side channels visible to page JS from DevTools, accessibility APIs, extension UI, network timing, or user-visible chrome.

Security/interoperability impact: A strict reading would make useful invalid indicators non-conforming. A loose reading makes the side-channel rule meaningless. Timing differences from key resolution and directory queries are especially observable if page script can call `verify()`.

Recommendation:

- Rewrite side-channel requirements narrowly: page script must not be able to distinguish unsigned from failed except through the explicit API it is allowed to call.
- Define whether user-visible invalid indicators are allowed and in which surface.
- Require generic timing/error bucketing for page-callable verification, or do not make networked verification page-callable.

Fix: Spec.

### F-12: Shadow DOM, Templates, Iframes, and Slots Are Not Sufficiently Defined

Severity: Medium

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Parsing", "Verification lifecycle", and "Open Issues / Issue 3". IETF draft excludes `template` and `iframe`; W3C does not surface these HTML/DOM integration details.

Code location: `htmltrust-canonicalization/javascript/index.js` excludes `script`, `style`, `meta`, `link`, `head`, `noscript`, and some void elements, but not `template` or `iframe`; Python extractor excludes the same limited set. The extension verifies `innerHTML` or regex fragments, not composed trees.

Issue: Browser integration must define whether canonicalization uses light DOM, shadow-including tree, composed tree, assigned slots, declarative shadow DOM, `template.content`, iframe documents, and adopted nodes. Current W3C text is silent, and implementations do not match the IETF exclusion set.

Security/interoperability impact: Browser and crawler verifiers can hash different text for the same rendered content. Shadow DOM or templates can hide or reveal text that one implementation signs and another ignores.

Recommendation:

- State that canonicalization operates on the light DOM subtree rooted at `signed-section`, excluding shadow roots and nested browsing contexts unless explicitly included by a future version.
- Exclude `template` and `iframe` consistently in W3C and canonicalization implementations.
- Define slot behavior if `signed-section` can appear inside a shadow tree or contain slots.
- Add conformance fixtures for `template`, `iframe`, declarative shadow DOM, and slots.

Fix: Both.

### F-13: Auto-Verification Timing Requirement Is Not Testable for Extensions

Severity: Low

Spec location: `htmltrust-spec/w3c-cg/index.html`, "Verification lifecycle" says a UA should verify after parser completion and before the element becomes the target of script access to `verification`.

Code location: The extension content script runs around DOMContentLoaded/document idle and cannot prevent page scripts from accessing elements first. No `verification` DOM property exists.

Issue: This timing target may be plausible for native browsers but not for extension implementations, despite extensions being listed as conforming user agents.

Security/interoperability impact: Extensions cannot conform. Page scripts can race or detect verification availability.

Recommendation:

- Separate conformance for native UAs and extensions/polyfills.
- For native UAs, define pending state and getter behavior before verification completes.
- For extensions, define a best-effort model that does not expose `HTMLSignedSectionElement.verification`.

Fix: Spec.

### F-14: Existing WordPress Public Rendering Does Not Wrap Signed Content

Severity: Low for W3C, High for WordPress interoperability

Spec location: `htmltrust-spec/w3c-cg/index.html`, "The signed-section Element" requires the element to represent a region of flow content whose canonicalized text was signed.

Code location: `htmltrust-cms-reference/wordpress/public/class-content-signing-display.php` appends a `signed-section` containing only metadata after the signature details, not around the signed post content. WordPress signing hashes stripped `post_content`. The browser extension then verifies the empty signed-section content, not the post body.

Issue: This is primarily an implementation mismatch, but it demonstrates the spec should be explicit that a detached signature block is not a signed region unless a separate association mechanism is defined.

Security/interoperability impact: Users may see signature controls for a post while the actual post DOM is outside the signed region.

Recommendation:

- W3C should explicitly say detached/accompanying signature blocks are non-conforming unless the W3C document defines a `for`/IDREF or hash-addressed association model.
- WordPress should wrap the rendered content or move to a clearly non-W3C legacy display.

Fix: Code, with clarifying spec note.

## 4. Internal Consistency Issues in the W3C Document

1. **Custom element versus built-in interface:** Goals and parsing suggest custom-element semantics; DOM section requires a native `HTMLSignedSectionElement`.
2. **"No trust directory MUST be contacted" should be "MUST NOT":** In Layer 1, the sentence says "no trust directory MUST be contacted", which means "is not required" rather than "is prohibited." The intended requirement appears to be "MUST NOT".
3. **CSP contradiction:** "Key resolution is subject to CSP" conflicts with "a page MUST NOT be able to suppress or redirect key-resolution requests via CSP."
4. **Default rendering versus custom element reality:** The draft says transparent block container equivalent to `div`, but unknown custom elements default inline unless styled. Existing code emits `style="display: block;"`.
5. **Trust tier vocabulary mismatch:** DOM IDL uses `"trusted" | "neutral" | "untrusted" | "unknown"`, while current code uses green/yellow/red and trusted/untrusted/unknown mappings.
6. **Open Issue 1 is stale against IETF:** W3C says IETF uses unpadded Base64; the IETF draft says unpadded base64url.
7. **Claim metadata semantics are split:** `author` is informative, `signed-at` participates in signing payload, `claim:*` values are claims, but the DOM/result model does not say which claims are bound in `claims-hash`.
8. **Domain versus origin:** W3C says "domain binding" but uses origin rationale; IETF defines origin including scheme and port.
9. **Failure states are under-enumerated:** The W3C examples name only a few reasons, while IETF includes incomplete, claim-missing, algorithm-mismatch, key-revoked, malformed signature, etc.
10. **Conformance summary omits several normative requirements:** It does not mention mutation invalidation, network privacy/user opt-in, CSP/fetch behavior, or accessibility indicator requirements.

## 5. Mismatch Matrix Between W3C Spec and Existing Code

| Topic | W3C draft | Existing code | Impact | Fix |
|---|---|---|---|---|
| DOM interface | Requires `HTMLSignedSectionElement.verification` and `verify()` | No native/custom DOM API; extension/library APIs only | Non-conforming prototypes; unclear browser path | Spec |
| Verification input | Live DOM lifecycle and mutation invalidation | Extension prefers pristine re-fetch and regex slices | Valid badge can detach from rendered DOM | Both |
| Encoding | W3C mentions unpadded Base64 via IETF; IETF says base64url | Browser/Hugo use raw standard Base64; old CMS paths use hex | Cross-implementation verification failure | Both |
| Domain binding | W3C says origin/domain mismatch is crypto failure | Code binds hostname only | Replay across scheme/port | Both |
| Claims hash | W3C/IETF imply direct meta claims and signed-at binding | Browser client hashes only `claim:*`, strips prefix, excludes `author` and `signed-at`; JS uses `name=value` | Metadata not consistently bound | Both |
| Failure reasons | Hyphenated W3C reasons | Space-separated/freeform code reasons | DOM/test mismatch | Both |
| Key resolution | At least one method; SHOULD DIDs | Default chain did:web, direct URL, directories; direct URL accepts `http` | Security and interop drift | Both |
| Directory reputation | W3C allows user-selected directories | Browser client expects `/keys/{keyid}/reputation`; e2e uses `/api/directory/keys/{keyId}/reputation`; extension disables directory subscriptions | Trust layer not interoperable | Code/IETF alignment |
| UI surface | Chrome, not spoofable; no element-box decoration | Content script injects page DOM badges and outlines | Spoofable indicators | Both |
| `<meta>` children | Required direct children before flow | CMS/Hugo emit them | Potential HTML validator/sanitizer problems | Spec |
| Nested sections | Allowed, independent | Regex extractor cannot handle nesting reliably | Parser differential | Both |
| Excluded elements | W3C delegates to IETF; IETF excludes template/iframe | JS/Python extraction do not exclude template/iframe | Canonicalization drift | Code/spec tests |
| WordPress rendering | Signed-section should contain signed region | WordPress appends empty signed-section after content | Signature not attached to content | Code |
| Hugo reference | W3C requires all four attrs for verification | Old CMS-Hugo partial emits only content-hash; newer `htmltrust-hugo` placeholder emits empty attrs for CLI | Placeholder states need spec guidance | Spec/code docs |
| CSP/fetch | Ambiguous and contradictory | Extension has broad host permissions and fetches as content/background script | Browser-specific privacy/security behavior | Spec |

## 6. Browser/Security Researcher Checklist

Parser/DOM ambiguity:

- Define native element versus custom element.
- Define parser behavior, validator conformance, namespace, and unknown-element fallback.
- Add tests for malformed tags, uppercase closing tags, duplicate attributes, omitted/invalid attributes, sanitizer-reordered meta, comments, entities, and nested sections.

Custom element semantics:

- Decide whether page-authored custom element definitions can coexist.
- If custom element path is kept, define upgrade timing and whether `verify()` is polyfillable or UA-only.
- Prevent page script from spoofing trusted UA results.

Shadow DOM/templates/iframes:

- Define light DOM versus composed/shadow-including tree.
- Exclude or include `template.content`, declarative shadow DOM, slots, and iframe documents explicitly.
- Align W3C and canonicalization implementations on `template` and `iframe`.

Mutation timing:

- Define parser snapshot, live DOM snapshot, or response-byte snapshot.
- Require stale/invalid state on post-verification changes to covered content.
- Do not show a valid rendered-content indicator for a source-only verification.

Script/style exclusion:

- Exclude script/style/noscript/template/iframe consistently.
- Define whether hidden text, CSS-generated text, and ARIA-only text are in scope.

Accessibility/semantics:

- Define whether accessible names (`alt`, `aria-label`) are covered.
- Tie trust indicators to regions with accessible relationships.
- Avoid body `meta` claims leaking or being exposed oddly to AT.

Extension threat model:

- Separate native UA conformance from extension/polyfill conformance.
- Treat content-script badges as spoofable hints, not authoritative chrome.
- Define extension limitations around timing, CSP, host permissions, and page-script races.

Network/privacy behavior:

- Define key-resolution and directory-fetch modes: credentials, referrer, cache, redirects, timeout, service worker, CORS, mixed content.
- Require user opt-in for directories.
- Consider privacy-preserving key resolution or caching guidance.

UI spoofing/clickjacking/social engineering:

- Require unspoofable chrome for authoritative trust indicators.
- Prohibit page DOM from creating indistinguishable indicators.
- Use careful wording: "text signature valid" versus "content verified" if only text is covered.

Mixed-content/CORS/fetch assumptions:

- Browser UAs should reject non-HTTPS direct key URLs and directories except explicit local-dev/test modes.
- Decide whether `did:web` always resolves over HTTPS.
- Define CORS behavior for key documents and directories.

CSP/SRI interaction:

- Resolve the CSP contradiction.
- State whether HTMLTrust fetches are controlled by page CSP or privileged UA fetches.
- Clarify that SRI and HTMLTrust cover different objects and do not substitute for one another.

Unicode/canonicalization boundary:

- W3C should cite exact IETF/canonicalization sections and not duplicate stale summaries.
- Add complete signed-section test vectors with non-ASCII, bidi controls, ZWJ/ZWNJ, URLs, and claims.
- Verify implementations agree on NFKC, whitespace, `<pre>`, `br`, block boundaries, entity decoding, and claim serialization.

Failure states:

- Define a closed enum: `incomplete`, `content-hash-mismatch`, `claim-missing`, `key-resolution-failed`, `key-revoked`, `algorithm-not-supported`, `algorithm-mismatch`, `malformed-signature`, `signature-invalid`, `domain-mismatch`, `aborted`, `network-error`, `stale`.
- Define which failures are crypto failures versus trust failures.

Conformance testability:

- Add Web Platform Test-style DOM tests for element/interface behavior.
- Add browser-client vectors for network-denied, CSP-blocked, CORS-blocked, service-worker-intercepted, and mutation cases.
- Add CMS output fixtures proving generated HTML verifies in browser and crawler implementations.

## 7. Concrete Next Edits Proposed

1. Rewrite the W3C "Parsing" and "DOM Interface" sections to choose either native HTML element or autonomous custom element. Do this before refining IDL.
2. Add a normative "Verification input and snapshot" section. State exactly whether a verifier hashes live DOM, parser snapshot, or response bytes, and define stale behavior.
3. Replace "domain" with "origin" throughout W3C where the signing payload is meant, and reference URL origin serialization including scheme and port.
4. Update W3C Issue 1 to match the IETF encoding choice, then align examples and code on either base64url or standard Base64.
5. Add a W3C subsection for "Claim metadata processing" that states exactly which `meta` children are claims, how `signed-at` is handled, duplicate behavior, order, and malformed cases.
6. Add a "Page script exposure and privacy" subsection that separates cryptographic DOM exposure from user trust policy exposure.
7. Rewrite the CSP section to define a dedicated HTMLTrust fetch mode instead of mixing page CSP and UA-privileged fetch semantics.
8. Promote text-only signing from a generic open issue into a security requirement: either cover minimum semantic attributes or constrain UI wording to text-only provenance.
9. Add explicit handling for `template`, `iframe`, shadow DOM, slots, and nested `signed-section`.
10. Replace the Layer 1 wording "no trust directory MUST be contacted" with "trust directories MUST NOT be contacted for trust decisions during Layer 1; a directory MAY be contacted only when it is the selected key-resolution method for `keyid`."
11. Add an informative "extension implementation note" explaining that content-script badges are spoofable page DOM and are not equivalent to native browser chrome.
12. Add a conformance appendix listing required test cases for parser behavior, mutation, network policy, canonicalization, claims, encoding, and full signed-section round trips.

## Review 2: Second-Pass Findings

This Review 2 section is additive. The first-pass findings above are intentionally left intact for audit history; several of them are now historical because the draft and code have since moved toward canonical unpadded standard Base64, direct-child claim hashing, source-snapshot verification, origin binding, and the provisional signed semantic attribute list. The findings below focus on issues that still remain, or that became clearer after the cleanup.

### R2-W3C-01: Page-Exposed DOM Verification and Trust Results Are Too Powerful

Severity: High

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:323-418`, `422-428`, `560-568`, `724-732`
- Code: `htmltrust-browser-client/src/verify.ts:32-79`, `htmltrust-browser-reference/src/content-scripts/index.ts:604-617`, `htmltrust-browser-reference/src/background/index.ts:240-329`

Issue: The draft requires every conforming user agent to expose `HTMLSignedSectionElement.verification` and `verify()` to `Window`, with both cryptographic and trust outcomes. That exposes user trust policy, directory contributors, failure reasons, timing, and potentially key-resolution behavior to page script. The current implementation does not implement the native DOM interface at all; it provides a library API, a content-script UI, and a popup/background verification path.

Security/interoperability impact: A hostile page could probe whether a user trusts a signer, which directories are enabled, whether a key is cached, or which failure mode occurred. This creates fingerprinting and policy-oracle risk. It also makes extension implementations non-conforming because content scripts cannot safely install a browser-owned, unspoofable DOM interface on the page's global object.

Recommendation: Split the model into a browser-owned/user-facing verification surface and a deliberately limited page-visible API. Page-visible results should be coarse and privacy-preserving, likely cryptographic-only by default, with trust policy details available only to browser chrome, extension UI, assistive technology integrations acting with user authority, or permission-gated callers. Add a separate extension/polyfill conformance profile that does not require `HTMLSignedSectionElement`.

Fix: Spec first. Code should continue avoiding a page-owned native-looking interface unless the spec defines a safe, limited API.

### R2-W3C-02: Source Snapshot Semantics Still Need a Precise Browser Contract

Severity: High

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:434-490`, `520-556`, `611-658`
- Code: `htmltrust-browser-reference/src/content-scripts/index.ts:305-337`, `432-469`, `478-496`; `htmltrust-browser-client/src/verify.ts:315-325`

Issue: The draft now says verification is over server HTML before extensions and page scripts, with a re-request fallback. That is the right direction, but it still does not define the exact browser object being verified: navigation response bytes, decoded HTML source, post-parser tree, cache entry, service-worker response, or same-origin refetch response. The reference extension refetches `window.location.href` with `cache: 'force-cache'`, allows same-origin credentials, can be intercepted by a same-origin service worker, and falls back to rendered-DOM verification if the refetch fails or the section count differs.

Security/interoperability impact: A source refetch is not necessarily the original server response, and service workers can serve different bytes from the network server. Falling back to live DOM can turn an extension/security limitation into a user-visible verification state that looks stronger than it is. Different browsers or extensions will disagree on whether a section is `source-only`, `rendered-match`, or `stale`.

Recommendation: Define a small set of normative verification inputs: captured navigation response, same-origin source refetch, and live/rendered DOM. For each, define cache mode, redirect handling, service-worker handling, credentials, base URL, and whether the result may be presented as verification of rendered content. A live DOM fallback should be a distinct, lower-confidence state and should not satisfy the "server HTML before extensions" requirement. If service-worker-controlled responses are accepted, say that the "server" snapshot means the browser navigation response after service-worker interception, not the origin server's network response.

Fix: Both. The spec should pin the model; the extension should stop treating rendered-DOM fallback as equivalent to source verification and should expose the weaker state clearly.

### R2-W3C-03: Native Element, Autonomous Custom Element, and Extension Polyfill Models Are Mixed

Severity: High

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:166-180`, `295-305`, `323-371`, `876-882`
- Code: `htmltrust-browser-reference/src/content-scripts/index.ts:421`, `783`; `htmltrust-browser-client/src/verify.ts:93-98`

Issue: The draft defines a new element with an `HTMLSignedSectionElement` interface, but the parsing section says implementations may back it with a custom-element definition or otherwise treat it as `HTMLElement`. Those are materially different Web platform contracts. A native HTML element can have browser-owned IDL and parser/content-model changes; an autonomous custom element can be defined by page script and cannot be trusted as a browser security surface. The code currently treats `signed-section` as an ordinary DOM tag selected by CSS, with no custom element definition and no native IDL.

Security/interoperability impact: Browser researchers will flag this as a security-boundary ambiguity. If page script can define or monkey-patch the custom element, it can spoof `verify()` or `verification`. If the intent is a native element, extensions and libraries cannot conform. The direct-child `meta` content model also depends on whether HTML itself is being extended or whether this is merely an autonomous custom element used in existing HTML parsing.

Recommendation: Choose one normative path. If HTMLTrust is a native HTML element, specify it as a browser-owned element and remove the custom-element fallback from the conformance surface. If HTMLTrust is an autonomous custom element, remove the native-looking `HTMLSignedSectionElement` requirement and treat page DOM as untrusted input to a separate verifier. Add an explicit extension/polyfill note.

Fix: Spec. Code is consistent with the polyfill/library path, but would need substantial work if the spec chooses the native-element path.

### R2-W3C-04: Mutation Invalidation Omits Signed Attribute and Claim Attribute Changes

Severity: High

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:230-237`, `244-278`, `520-547`
- Code: `htmltrust-browser-client/src/verify.ts:293-325`; `htmltrust-browser-reference/src/content-scripts/index.ts:546-617`

Issue: The verification lifecycle invalidates on required attribute changes, descendant insertion/removal, and descendant text mutation. It does not explicitly invalidate on descendant changes to signed semantic attributes (`href`, `src`, `alt`, `aria-label`) or direct child claim attributes (`name`, `content`). Those attributes are now signed inputs. The browser client can detect source/rendered mismatch when it is given both inputs, but direct element verification returns `rendered-match`, and the extension marks a section decorated without installing a mutation observer that would clear or downgrade the indicator.

Security/interoperability impact: A page script can change a signed link target, image source, alt text, or claim content after verification while stale UI remains. This is especially important for phishing and accessibility attacks because `href`, `src`, `alt`, and `aria-label` are precisely the attributes added to cover non-text semantics.

Recommendation: Add all signed-input mutations to the lifecycle: required attributes, direct claim `name`/`content`, descendant signed semantic attributes, text nodes, child list, and relevant base-URL changes. Define whether any descendant attribute mutation outside the signed set must invalidate defensively. Require cached rendered-content results to become `stale` or `null` when these changes occur.

Fix: Both. The spec should state the trigger set; the extension/reference client should add mutation invalidation or avoid long-lived rendered-valid UI.

### R2-W3C-05: The Semantic Attribute Allowlist Is a Good Start but UI Claims Must Stay Narrow

Severity: Medium-High

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:230-237`, `847-854`, `756-783`
- Code: `htmltrust-browser-client/src/spec.ts:3-8`; `htmltrust-canonicalization/javascript/index.js:125`, `199-218`; `htmltrust-e2e/tests/lib/publish.test.ts:57-74`

Issue: The draft signs `href`, `src`, `alt`, and `aria-label`, and leaves expansion open for community feedback. That list covers the first obvious risks, but it does not cover several browser-visible or accessibility-visible semantics such as `srcset`, `poster`, `cite`, `action`, `formaction`, `title`, `aria-labelledby`, `aria-describedby`, `target`, `download`, `rel`, or element-specific text alternatives. Current UI text in code still risks saying "Rendered content verified" when only text and four attributes are protected.

Security/interoperability impact: Attackers can preserve a valid signature while changing unsigned semantics that users, assistive technologies, or navigation flows rely on. The narrow list is acceptable for a draft only if the UI and conformance language do not overclaim structural or full accessibility integrity.

Recommendation: Keep the list provisional, but add a normative UI constraint: implementations MUST describe the protection as covering canonical text plus the listed signed attributes, not the full rendered subtree. Add a registry or explicit extension process for signed attributes, and prioritize `srcset`, `poster`, `aria-labelledby`, `aria-describedby`, `title`, `cite`, `action`, and `formaction` for the next review.

Fix: Both. The spec should constrain wording and define expansion mechanics; code should avoid "rendered content verified" unless the protected surface is made clear.

### R2-W3C-06: Page-Provided Directory Inputs Conflict with User Opt-In and Current Code

Severity: Medium-High

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:346-412`, `494-517`, `634-638`
- Code: `htmltrust-browser-client/src/policy.ts:60-80`, `155-198`; `htmltrust-browser-reference/src/content-scripts/index.ts:487-499`; `htmltrust-e2e/src/lib/playwright-session.ts:51-65`, `254-262`; `htmltrust-server-reference/src/controllers/directoryController.js:179-202`

Issue: `VerifyOptions.directories` lets page script suggest directories for `verify()`, while the security section says directory consultation must be user opt-in. The implementation is split: the browser client can query `<directory>/keys/<keyid>/reputation`, the browser extension intentionally disables directory subscriptions because the server shape is not aligned, and the e2e harness uses a custom `/api/directory/keys/{keyId}/reputation` path.

Security/interoperability impact: If page-provided directories are honored, pages can cause verifier network traffic to attacker-chosen directories, bias trust results, and learn policy/timing behavior. If they are ignored, the DOM API is misleading and non-interoperable. The codebase also lacks a single directory reputation shape.

Recommendation: Treat page-supplied directories as non-authoritative hints that require explicit user/admin policy before any network request, or remove them from the page-visible DOM API. Align the server/e2e/reference code to the spec's directory API or change the spec, but do not keep both. The W3C spec should point to the IETF directory API and define only the browser consent and exposure rules.

Fix: Both. Spec should change the DOM option and consent language; code should align directory reputation endpoints and stop carrying divergent paths.

### R2-W3C-07: Network, CSP, Fetch, and Service-Worker Model Is Still Too Provisional for Browsers

Severity: Medium

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:611-687`
- Code: `htmltrust-browser-client/src/spec.ts:128-154`; `htmltrust-browser-reference/src/content-scripts/index.ts:289-303`, `317-324`; `htmltrust-browser-reference/src/platforms/HOST_PERMISSIONS.md:1-7`; `htmltrust-browser-reference/src/platforms/chromium/manifest.json:29-30`

Issue: The draft distinguishes Web JavaScript verifiers from native/extension verifiers, but it does not define a Fetch integration point: request mode, destination, credentials mode, cache mode, redirect policy, referrer, CORS behavior, mixed-content handling, service-worker interception, timeout, or partitioning. Current code rejects non-HTTPS verifier fetches, rejects redirects in the extension, uses `force-cache` for source refetch, and grants both `http://*/*` and `https://*/*` host permissions for extension development. `HOST_PERMISSIONS.md` says the protocol does not require HTTPS, which conflicts with the W3C and IETF network model for production verifier fetches.

Security/interoperability impact: Browser, extension, crawler, and page-JS verifiers will make different network requests for the same document. That affects privacy, cache behavior, CORS deployment requirements, CSP expectations, and whether a hostile page or service worker can suppress or alter verification.

Recommendation: Define named fetch classes: key/document resolution fetch, directory fetch, endorsement fetch, and source snapshot/refetch. For each, specify HTTPS requirements, credential mode, referrer policy, cache mode, redirect handling, service-worker behavior, CORS/CSP applicability, and failure mapping. Update extension docs to say HTTP is a local-dev/e2e exception, not a production protocol property.

Fix: Both. Spec needs a sharper model; code/docs should match it.

### R2-W3C-08: Failure Reasons Are Not a Closed WebIDL Contract and Leak More Than Needed

Severity: Medium

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:358-364`, `445-464`, `560-570`, `724-733`
- Code: `htmltrust-browser-client/src/spec.ts:10-27`; `htmltrust-browser-client/src/verify.ts:362-395`; `htmltrust-browser-reference/src/content-scripts/index.ts:520-523`

Issue: The IDL exposes `DOMString? reason`, while the processing model names only a few reasons. The browser client has a richer internal union (`claim-malformed`, `attribute-canonicalization-failed`, `network-policy-blocked`, etc.). The draft also says verification failure must not throw, log, or visibly fail except through the result interface, but code can log warnings under debug and the content script logs a generic console error on exceptions.

Security/interoperability impact: Without a closed enum, implementations will diverge and tests cannot assert exact behavior. Exposing detailed reasons to page script can become a fingerprinting and policy-probing channel. Logging behavior can also create observable differences for hostile pages.

Recommendation: Define a closed `enum SignedSectionFailureReason` for interoperable crypto/network states, plus a smaller page-visible failure vocabulary if privacy requires it. Detailed diagnostics should be user-agent/extension-private unless explicitly enabled by the user for debugging. Clarify that extension debug logging is allowed only when not visible to page script or when user-enabled.

Fix: Both. Spec should define the enum and exposure level; code should map internal reasons to the chosen public/private surfaces.

### R2-W3C-09: Nested Sections and Source/Rendered Pairing Are Underspecified

Severity: Medium

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:182-188`, `481-490`
- Code: `htmltrust-browser-client/src/verify.ts:93-98`, `225-243`; `htmltrust-browser-reference/src/content-scripts/index.ts:421-447`

Issue: The draft allows nested signed sections and says they verify independently. The current source extraction and browser-client parsing use regular expressions for `<signed-section>...</signed-section>`, and the extension pairs refetched source slices with live DOM sections by document order. Nested sections, malformed tags, sanitizer rewrites, or runtime reordering can pair the wrong source slice with a live DOM element.

Security/interoperability impact: A verifier can display a result for one signed region while hashing or comparing another. Even if signatures fail in many malformed cases, the failure mode is not deterministic across HTML parsers, regex extractors, and browser DOM APIs.

Recommendation: Define how source snapshots map to live DOM elements. Options include disallowing nested signed sections for the extension/polyfill profile, requiring parser-backed extraction rather than regex, or requiring an explicit stable section identifier included in the signed payload. Add conformance cases for nested sections, adjacent sections, malformed closing tags, and runtime section reordering.

Fix: Both. The spec should define the mapping contract; code should replace regex extraction/pairing for browser-facing verification or narrow the supported profile.

### R2-W3C-10: Extension Page Markers Still Mutate the Signed Region

Severity: Medium

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:310-318`, `574-600`, `756-775`
- Code: `htmltrust-browser-reference/src/content-scripts/index.ts:550-617`, `628-690`

Issue: The draft says user agents must not apply chrome-level decoration to the rendered element itself and must prevent page content from spoofing the indicator surface. The extension now labels inline badges as page markers and points to the popup for authority, which is an improvement, but the active content-script path still adds CSS classes, a `title`, and a badge container inside the `signed-section` element itself.

Security/interoperability impact: The extension mutates the signed subtree after verification, which can make any later rendered-content comparison stale. It also affects the accessibility tree and gives pages a visual surface they can imitate or interfere with. This is acceptable only as a non-authoritative extension affordance, not as the W3C user-agent model.

Recommendation: Move extension markers outside the signed subtree or into extension-controlled UI/chrome, and keep the popup/browser UI as the authoritative surface. Add an informative implementation note saying content-script markers are advisory and cannot satisfy the W3C unspoofable UI guidance.

Fix: Code, with a clarifying spec note for extension/polyfill implementations.

### R2-W3C-11: Conformance Summary Omits Key Browser-Security Requirements

Severity: Low-Medium

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:886-915`

Issue: The conformance summary lists parsing/DOM exposure, two-layer processing, accessibility transparency, and failure reporting. It omits several normative requirements that matter for browser review: source snapshot/refetch state, mutation invalidation, directory opt-in, verifier-fetch privacy constraints, origin binding as a crypto failure, signed semantic attributes, direct-child claim behavior, and UI anti-spoofing.

Security/interoperability impact: Implementers can read the summary and miss requirements that are critical to safe behavior. Browser researchers often use conformance summaries to decide whether the spec has testable hooks.

Recommendation: Expand the conformance summary or add a separate "Security-critical conformance requirements" checklist. Tie each item to a WPT-style or implementation conformance test.

Fix: Spec.

### R2-W3C-12: Current Code Alignment Is Improved but Still Not W3C-Conformant

Severity: Low-Medium

Locations:

- Spec: `htmltrust-spec/w3c-cg/index.html:323-418`, `886-915`
- Code: `htmltrust-browser-client/src/index.ts:1-32`; `htmltrust-browser-reference/src/content-scripts/index.ts:399-544`; `htmltrust-cms-reference/wordpress/public/class-content-signing-display.php:369-385`; `htmltrust-hugo/README.md:176-194`

Issue: The code now aligns on many protocol details: canonical unpadded standard Base64, origin binding, direct-child claim hashing, and the four signed semantic attributes. It still is not a W3C-conformant user-agent implementation because there is no `HTMLSignedSectionElement`, no WebIDL `SignedSectionVerificationResult`, no closed failure enum, no browser-native snapshot capture, and no full mutation lifecycle. The CMS/Hugo outputs are closer to the element shape, but the browser behavior remains an extension/library profile.

Security/interoperability impact: This is manageable for prototypes, but the spec should not imply that the current extension validates the native browser model. Browser researchers will otherwise read the code/spec mismatch as either over-specification or a missing implementation plan.

Recommendation: Add a "Prototype implementation status" note to the W3C draft or project README that distinguishes the current extension/library profile from a future native UA implementation. Use that note to decide which mismatches are code debt versus intentional spec ambition.

Fix: Spec documentation now; code later if the project chooses to pursue native browser conformance.

## 4. Disposition of the 2026-08-27 follow-up pass

The companion draft now resolves the browser-facing specification choices
that could be closed without claiming prototype support:

- `signed-section` is a native built-in HTML element with a browser-owned
  `HTMLSignedSectionElement` interface. Autonomous custom-element emulation is
  explicitly a nonconforming prototype profile.
- Layer-1 verification requires source octets from a captured navigation
  response or a source refetch. The result distinguishes `source-only`,
  `rendered-match`, and `stale` input states.
- The captured input is the decoded navigation response passed to the HTML
  parser, after service-worker interception and before page or extension
  mutation. A later refetch is a distinct input.
- The DOM interface uses the same closed failure vocabulary as the IETF draft.
- Page script cannot select trust directories. User, administrator, or
  embedding-verifier policy controls directory access.
- Mutation invalidation covers required element attributes, claim metadata,
  signed semantic attributes, descendant text and structure, and source base
  URL changes.
- Nested signed sections contribute their canonical content and a block
  boundary to an outer section while being verified independently.

The extension and JavaScript client remain protocol prototypes. They do not
implement the native DOM interface, browser-owned navigation-response capture,
or the full mutation lifecycle. Parser-backed source mapping, signed-attribute
escaping, and the remaining native-user-agent work stay as separate
implementation tasks.
