# HTMLTrust IETF Draft Security and Interoperability Review

Review target: `htmltrust-spec/ietf-draft/draft-grey-htmltrust-00.md`

Review scope was taken from `htmltrust-spec/ietf-draft/README.md`: wire protocol, canonicalization, signing payload, hash/signature encoding, trust-directory HTTP API, and endorsement format.

## 1. Executive Summary and Top Risks

The draft is not yet interoperable with the checked-in reference implementations. The highest-risk drift is not cosmetic: deployed signers and verifiers would compute different signature payloads, accept different encodings, bind different origins, resolve different keys, and verify different endorsement bytes.

Top risks:

1. **Wire-format split between spec and code.** The draft requires unpadded base64url hashes/signatures and `https://host[:port]` origin binding. The code commonly emits standard base64 or hex, and signs bare hostnames.
2. **Claims hash is underspecified relative to actual implementations.** The draft signs all direct child `<meta name content>` pairs as `name:content\n`, including `signed-at`; the browser/e2e path signs only `claim:*` metadata with the prefix removed, uses `name=value`, and excludes `signed-at` and `author`.
3. **Trust directory API in the draft is not the implemented API.** The draft defines root-level `/content/{hash}`, `/keys/{id}`, `/signers/{id}/reputation`, `/.well-known/htmltrust`, and HTTP Message Signatures. The reference server exposes `/api/directory/content`, `/api/endorsements?content-hash=...`, author-key endpoints, and API-key auth.
4. **Endorsement format is a different protocol.** The draft uses RFC 8785 JCS over the full endorsement document with `signature` omitted. The code signs `{contentHash}:{timestamp}`, stores `contentHash` instead of `endorsement`, and may store unverifiable endorsements.
5. **Canonicalization has several testable mismatches.** Draft block boundaries are LF-based; conformance fixtures and code use a single space. Draft excludes `template` and `iframe`; code does not. Draft treats `br` as LF; JS/Go strip it to space and Python treats it as no separator.
6. **Browser privacy and threat model gaps remain.** The browser reference fetches pristine page HTML, performs network key resolution, logs detailed canonical text on failures, and relies on CORS/fetch behavior that the draft does not specify.

Recommendation: before submitting a next draft, freeze one normative wire profile and make the reference implementations pass it. The likely fastest path is to make the draft match the current conformance suite where that suite is intentional, then open explicit implementation-fix issues for base64url, origin binding, key documents, directory API shape, and endorsements.

## 2. Scope Reviewed and Files Consulted

Draft and scope:

- `htmltrust-spec/ietf-draft/README.md`
- `htmltrust-spec/ietf-draft/draft-grey-htmltrust-00.md`

Canonicalization:

- `htmltrust-canonicalization/spec.md`
- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-canonicalization/python/htmltrust_canonicalization/_normalize.py`
- `htmltrust-canonicalization/python/htmltrust_canonicalization/_extract.py`
- `htmltrust-canonicalization/python/htmltrust_canonicalization/_claims.py`
- `htmltrust-canonicalization/go/canonicalize.go`
- `htmltrust-canonicalization/go/extract.go`
- `htmltrust-canonicalization/go/signature.go`
- `htmltrust-canonicalization/go/endorsement.go`
- `htmltrust-canonicalization/conformance/README.md`
- `htmltrust-canonicalization/conformance/fixtures/{normalize,extract,claims}/*.json`

Directory/server:

- `htmltrust-server-reference/openapi.yaml`
- `htmltrust-server-reference/src/server.js`
- `htmltrust-server-reference/src/routes/content.js`
- `htmltrust-server-reference/src/routes/directory.js`
- `htmltrust-server-reference/src/controllers/contentController.js`
- `htmltrust-server-reference/src/controllers/endorsementController.js`
- `htmltrust-server-reference/src/middleware/auth.js`
- `htmltrust-server-reference/src/utils/crypto.js`
- `htmltrust-server-reference/src/models/{Key,ContentSignature,Endorsement}.js`

CMS/browser/e2e:

- `htmltrust-cms-reference/shared/openapi.yaml`
- `htmltrust-cms-reference/wordpress/includes/class-content-signing-api-client.php`
- `htmltrust-cms-reference/wordpress/includes/class-content-signing-signing-service.php`
- `htmltrust-cms-reference/wordpress/public/class-content-signing-display.php`
- `htmltrust-cms-reference/wordpress/public/js/content-signing-public.js`
- `htmltrust-browser-client/src/{verify,resolver,endorsements,types}.ts`
- `htmltrust-browser-reference/README.md`
- `htmltrust-browser-reference/src/content-scripts/index.ts`
- `htmltrust-e2e/src/phases/publish.ts`
- `htmltrust-e2e/src/lib/playwright-session.ts`
- `htmltrust-e2e/src/lib/hugo-publisher.ts`

## 3. Findings Ordered by Severity

### Finding 1: Hash and Signature Encoding Is Not Interoperable

Severity: Critical

Spec location: `draft-grey-htmltrust-00.md`, "Hash and Signature Encoding", "Content hash and claims hash", "Signature"; test-vector placeholders in "Test Vectors".

Code location:

- `htmltrust-server-reference/src/utils/crypto.js`
- `htmltrust-browser-client/src/verify.ts`
- `htmltrust-e2e/src/phases/publish.ts`
- `htmltrust-cms-reference/wordpress/includes/class-content-signing-signing-service.php`
- `htmltrust-server-reference/openapi.yaml`

Issue: The draft requires unpadded base64url. The code mostly uses standard base64 or hex:

- Server `signContent()` returns `toString("base64")`; `hashContent()` returns base64 without translating `+` and `/` to `-` and `_`.
- Browser `bytesToUnpaddedBase64()` uses `btoa(...).replace(/=+$/, "")`, again standard base64.
- E2E publish hashes with Node `digest("base64")`.
- WordPress signing service uses `hash('sha256', $content)`, which is hex.
- OpenAPI examples contain hex hashes and standard base64 signatures.

Security/interoperability impact: A verifier following the draft will reject existing signed content. A verifier following the code will accept non-draft encodings. The path parameter argument for `/content/{hash}` is also wrong if hashes can contain `/` under standard base64. This directly breaks content-hash comparison and signature payload construction.

Recommendation: Choose one wire encoding and make it canonical everywhere. If the draft's base64url decision stands, update all signing, hashing, examples, fixtures, OpenAPI schemas, and tests to use raw URL-safe base64 without padding. Verifiers should reject non-canonical encodings in signed attributes rather than silently accepting standard base64, whitespace, or padding.

Fix: Both, but primarily code and conformance once the draft decision is final.

### Finding 2: Origin Binding Differs Between Draft and Prototype

Severity: Critical

Spec location: `draft-grey-htmltrust-00.md`, "Signing Payload Binding" / `domain`; "Why the publisher origin"; "Verification Procedure" Step 4.

Code location:

- `htmltrust-browser-client/src/verify.ts`
- `htmltrust-browser-reference/src/content-scripts/index.ts`
- `htmltrust-e2e/src/phases/publish.ts`
- `htmltrust-cms-reference/wordpress/includes/class-content-signing-signing-service.php`
- `htmltrust-server-reference/src/controllers/contentController.js`

Issue: The draft signs an HTTPS origin serialized as `https://example.org` with non-default ports included. The implementation signs hostnames only:

- Browser default domain is `window.location.hostname`.
- Browser reference passes `window.location.hostname`.
- E2E signs `author.domain`.
- WordPress uses `parse_url(get_site_url(), PHP_URL_HOST)`.
- Server signs whatever `domain` string the caller sends.

Security/interoperability impact: Signed content can verify across `http`/`https` and across ports if the verifier uses the code profile. Conversely, draft-conforming signers will not interoperate with code-conforming verifiers. Same-host, different-scheme replay is especially relevant because e2e uses HTTP while the draft says HTTPS only.

Recommendation: Define the field as `origin`, not `domain`, and use the URL Standard origin serialization: scheme, host A-label, and non-default port. Include exact handling for `http` in local/dev contexts if permitted, or explicitly forbid non-HTTPS signed sections. Update APIs and DB fields to `origin` or state that `domain` is historically named but contains a full origin string.

Fix: Both.

### Finding 3: Claims Hash Computation Is a Different Protocol

Severity: Critical

Spec location: `draft-grey-htmltrust-00.md`, "Canonical claims"; "Signing Payload Binding" / `claims-hash`; "Verification Procedure" Steps 3-4; "Test Vectors" / "Canonical claims example".

Code location:

- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-canonicalization/python/htmltrust_canonicalization/_claims.py`
- `htmltrust-canonicalization/go/extract.go`
- `htmltrust-canonicalization/conformance/fixtures/claims/*.json`
- `htmltrust-browser-client/src/verify.ts`
- `htmltrust-e2e/src/phases/publish.ts`

Issue: The draft says every direct child claim `<meta>` with `name` and `content` serializes as `name:content\n`, sorted by normalized name. The code and conformance suite serialize maps as `name=value` joined by LF with no trailing LF. The browser client also:

- excludes `signed-at` from the claims hash,
- excludes `<meta name="author">`,
- includes only `claim:*` entries,
- strips the `claim:` prefix before canonicalizing/signing.

The draft example includes `author`, `claim:License`, and `signed-at`, and uses colons.

Security/interoperability impact: Signatures created by the implementation will fail under the draft. More importantly, the implementation does not cryptographically bind the same visible metadata the draft appears to bind. A page could alter `author` metadata without changing the current implementation's claims hash if trust/UI code ever displays that field from the DOM.

Recommendation: Decide the claims contract. A defensible profile is: only `meta[name="signed-at"]` is special and separately bound; all `meta[name^="claim:"]` entries are claims; claim names are the substring after `claim:`; serialize as `name=value\n?` exactly as conformance currently does. If `author` is a protocol claim, require `claim:author`, not bare `author`. Put this in the draft and add conformance vectors for DOM extraction of direct-child meta elements, duplicate claim names after normalization, and prefix handling.

Fix: Both, with the draft likely changing to match the conformance suite if that was intentional.

### Finding 4: Trust Directory API Does Not Match the Reference Server

Severity: Critical

Spec location: `draft-grey-htmltrust-00.md`, "Trust Directory HTTP API"; "Authentication"; "Errors"; "IANA Considerations".

Code location:

- `htmltrust-server-reference/openapi.yaml`
- `htmltrust-server-reference/src/server.js`
- `htmltrust-server-reference/src/routes/directory.js`
- `htmltrust-server-reference/src/routes/content.js`
- `htmltrust-server-reference/src/routes/endorsements.js`
- `htmltrust-server-reference/src/middleware/auth.js`
- `htmltrust-browser-client/src/endorsements.ts`

Issue: The draft defines a root-level directory API:

- `GET /.well-known/htmltrust`
- `GET /content/{hash}`
- `POST /content`
- `GET /content/{hash}/endorsements`
- `POST /endorsements`
- `GET /keys/{id}`
- `GET /signers/{id}/reputation`

The server exposes:

- `/api/directory/content` search, not `GET /content/{hash}`
- no `POST /content` equivalent
- `/api/endorsements?content-hash=...`, not `/content/{hash}/endorsements`
- no `/.well-known/htmltrust`
- no `GET /keys/{id}` returning the draft key document
- `/api/directory/keys/{keyId}/reputation`, keyed by DB key ID, not signer keyid
- API-key auth, not HTTP Message Signatures
- `{code,message}` errors, not `application/problem+json`

Security/interoperability impact: A draft-conforming browser cannot discover or use the checked-in directory. Endorsement and reputation semantics will fragment by implementation. POST authentication is also materially weaker/different: bearer API keys are not the non-replayable request-bound signatures described in the draft.

Recommendation: Either update the draft to document the current `/api/...` API as a non-normative legacy/reference API, or update the server to expose the draft API in parallel. For IETF text, prefer the latter: add well-known discovery, root-level endpoints, content-addressed lookup, key documents, problem-details errors, and HTTP Message Signature auth for mutating endpoints.

Fix: Both, depending on which API is intended to be normative.

### Finding 5: Endorsement Signing Format Is Not the Draft Format

Severity: Critical

Spec location: `draft-grey-htmltrust-00.md`, "Endorsement Format", especially "Document shape" and "Canonicalization for signing".

Code location:

- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-canonicalization/go/endorsement.go`
- `htmltrust-server-reference/src/controllers/endorsementController.js`
- `htmltrust-server-reference/src/models/Endorsement.js`
- `htmltrust-server-reference/openapi.yaml`
- `htmltrust-browser-client/src/endorsements.ts`

Issue: The draft requires signing RFC 8785 JCS serialization of the endorsement document with `signature` omitted. The implementation signs only `{contentHash}:{timestamp}`. The server schema uses `contentHash` while the draft uses `endorsement`. The code has `rawBlob` but the verifier libraries ignore it. The server may store endorsements that fail opportunistic verification. The draft fields `claim`, `expires`, and `revokedBy` are not implemented; the server deduplicates to one endorsement per `(contentHash, endorser)`.

Security/interoperability impact: Additional endorsement fields are unsigned in the implementation. A directory can alter `algorithm`, free-text rationale, expiry, revocation metadata, and any future fields without invalidating the code's endorsement signature. Draft-conforming endorsements will not verify in existing clients.

Recommendation: Implement RFC 8785 JCS in the libraries and server, or change the draft to the simple `{contentHash}:{timestamp}` binding and explicitly state that all other fields are unsigned directory metadata. The draft's current stronger design is preferable. If kept, remove `rawBlob` as a verifier requirement, require deterministic JCS verification from structured JSON, and reject invalid endorsements at POST.

Fix: Code, unless the project deliberately wants weaker endorsements.

### Finding 6: Key Resolution and Key Document Format Are Not Implemented as Specified

Severity: High

Spec location: `draft-grey-htmltrust-00.md`, "Key Resolution"; "Direct HTTPS URL"; "Trust directory reference"; "Acceptance policy".

Code location:

- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-canonicalization/go/resolver.go`
- `htmltrust-browser-client/src/resolver.ts`
- `htmltrust-server-reference/openapi.yaml`
- `htmltrust-server-reference/src/models/Key.js`
- `htmltrust-cms-reference/wordpress/public/class-content-signing-display.php`
- `htmltrust-e2e/src/phases/publish.ts`

Issue: The draft says direct keyids must be absolute HTTPS URLs returning `application/htmltrust-key+json` with `publicKey` as base64url public-key bytes, or JWK. The code accepts `http://`, raw PEM, `application/json`, `publicKeyPem`, and server-specific author-public-key JSON. WordPress emits the actual PEM as the `keyid` attribute, which is neither opaque key identifier nor URL. E2E emits `http://trust-server:3000/api/authors/{id}/public-key`.

Security/interoperability impact: Keyid parsing becomes a source of SSRF, CORS surprises, non-portable signatures, and centralized server coupling. Embedding a PEM in `keyid` bypasses the resolution model and creates large, brittle attributes. Accepting HTTP key URLs allows key substitution on active networks outside an extension's privileged environment.

Recommendation: Define one key document format and enforce it. For direct URLs, require HTTPS, `application/htmltrust-key+json` or JWK, and reject raw PEM in the verifier unless explicitly marked legacy. For `did:web`, define exact `verificationMethod` selection, `assertionMethod` handling, and supported public-key material. Add a separate local/test profile if HTTP is necessary for e2e.

Fix: Both.

### Finding 7: Algorithm Identifiers and Curves Do Not Match

Severity: High

Spec location: `draft-grey-htmltrust-00.md`, "Algorithm Registry"; "Verification Procedure" Steps 5-6.

Code location:

- `htmltrust-server-reference/src/utils/crypto.js`
- `htmltrust-server-reference/src/models/Key.js`
- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-canonicalization/go/signature.go`

Issue: The draft registers `ed25519`, `ecdsa-p256`, `ecdsa-p384`, `rsa-pss-sha256`, and `rsa-pkcs1-sha256`. The code uses `ED25519`, `ECDSA`, and `RSA`; JS aliases generic `ecdsa` and `rsa`; Go verifies generic `ecdsa` and `rsa`; server `ECDSA` uses `secp256k1`, not P-256.

Security/interoperability impact: Generic algorithm names hide security-critical parameters. ECDSA curve mismatch will cause verification failures. RSA-PSS and RSA-PKCS1 are not interchangeable and need separate identifiers.

Recommendation: Make algorithm identifiers exact, lowercase, and draft-aligned in all public APIs and key documents. If `secp256k1` support is desired, register `ecdsa-secp256k1-sha256` separately and specify signature encoding and low-S handling. Deprecate generic `RSA` and `ECDSA`.

Fix: Both.

### Finding 8: Canonicalization Block Boundary and Element Rules Diverge

Severity: High

Spec location: `draft-grey-htmltrust-00.md`, "Walk and text extraction", "Element categories", "Block structure".

Code location:

- `htmltrust-canonicalization/conformance/fixtures/extract/*.json`
- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-canonicalization/python/htmltrust_canonicalization/_extract.py`
- `htmltrust-canonicalization/go/extract.go`

Issue: The draft says boundary-producing elements emit LF and final output collapses repeated LF. The conformance suite says adjacent blocks produce a single space (`<p>A</p><p>B</p>` -> `A B`). Code implements spaces. Element sets differ:

- Draft excludes `script`, `style`, `template`, `noscript`, `iframe`, comments, opt-out marker, and claim meta.
- Code excludes `script`, `style`, `meta`, `link`, `head`, `noscript`; not `template` or `iframe`.
- Code block elements include `canvas`, `dd`, `dt`, `output`, `tfoot`, `thead`, `video`; draft does not.
- Draft block elements include `details`, `dialog`, `hgroup`; code does not.
- Draft says `br` emits LF; JS/Go strip void `br` to space, Python currently treats `br` as inline/no separator.

Security/interoperability impact: Different conforming implementations can hash different bytes for common HTML. This is a direct signature failure and creates room for markup-level confusion attacks where a verifier and signer disagree over what text was signed.

Recommendation: Treat `htmltrust-canonicalization/conformance/fixtures/extract` as the current source of truth or replace it with draft-conforming LF fixtures. In the draft, include an explicit element table with exact behavior: excluded-with-subtree, transparent inline, boundary-space or boundary-LF, void soft-break. Add fixtures for every listed element category, nested signed sections, `template`, `iframe`, `br`, `pre`, and `data-htmltrust-ignore`.

Fix: Both.

### Finding 9: `<pre>` Handling Is Not Actually Per-Element

Severity: High

Spec location: `draft-grey-htmltrust-00.md`, "Whitespace".

Code location:

- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-canonicalization/python/htmltrust_canonicalization/_extract.py`
- `htmltrust-canonicalization/go/extract.go`

Issue: The draft says whitespace inside `<pre>` is preserved except CRLF/CR normalization. The implementation exposes a global `preserveWhitespace` option, but extraction does not automatically switch modes per `<pre>` subtree. JS/Go regex extraction strips `<pre>` tags and then normalizes the whole string. Python passes one global option through extraction.

Security/interoperability impact: Any signed code block or preformatted content may verify differently from the draft. If authors rely on spacing as semantic content, the current code signs a different text than readers see.

Recommendation: Either remove per-`pre` preservation from the draft or implement a token/tree canonicalizer that tracks whether each text node is under `<pre>`. Add conformance fixtures for mixed normal text plus nested `<pre>`.

Fix: Both.

### Finding 10: Verification Procedure Does Not Match Browser Client Behavior

Severity: High

Spec location: `draft-grey-htmltrust-00.md`, "Verification Procedure".

Code location:

- `htmltrust-browser-client/src/verify.ts`
- `htmltrust-browser-reference/src/content-scripts/index.ts`

Issue: The draft requires `algorithm` as one of four required attributes; the browser client defaults it to `ed25519`. The draft says the hash algorithm is taken from the `content-hash` prefix; the browser client always constructs `sha256:<digest>`. The draft uses the current document's origin; browser client uses hostname. The draft's failure strings differ from implementation strings.

Security/interoperability impact: Missing or maliciously omitted algorithm attributes can be accepted by the implementation. Future hash agility in the draft is not implemented. Failure-result taxonomy is not portable.

Recommendation: Make the browser client implement the draft's step order exactly, or update the draft to document defaults. Prefer rejecting missing `algorithm`, parsing the content-hash prefix, dispatching only supported hash algorithms, and using exact origin serialization.

Fix: Code.

### Finding 11: Signature Envelope Is Malleable Through Tolerated Encodings

Severity: Medium-High

Spec location: `draft-grey-htmltrust-00.md`, "Hash and Signature Encoding"; "Signing Payload Binding".

Code location:

- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-canonicalization/go/signature.go`
- `htmltrust-canonicalization/php/tests/SignatureTest.php`

Issue: The draft says producers must omit padding but verifiers may tolerate padding. JS base64 decoding also tolerates whitespace. The signing payload uses the literal `content-hash` attribute value. That means semantically equivalent encodings can become different signed payloads, while some verification steps may compare decoded bytes.

Security/interoperability impact: Multiple serializations of the same hash/signature complicate caching, directory indexing, duplicate detection, and audit logs. If some layers normalize and some use literals, signatures can fail unpredictably or be accepted under non-canonical envelopes.

Recommendation: For signed attributes, require canonical base64url with no padding and no whitespace, and reject all other forms. If legacy tolerance is needed, perform it only in migration tooling, not in normative verification.

Fix: Spec and code.

### Finding 12: Directory Authentication Is Not Request-Bound in the Reference Server

Severity: Medium-High

Spec location: `draft-grey-htmltrust-00.md`, "POST /content"; "Authentication".

Code location:

- `htmltrust-server-reference/src/middleware/auth.js`
- `htmltrust-server-reference/openapi.yaml`
- `htmltrust-cms-reference/wordpress/includes/class-content-signing-api-client.php`

Issue: The draft requires HTTP Message Signatures over request target, host, date, and content digest. The server and CMS client use bearer API keys in `X-API-KEY`, `X-AUTHOR-API-KEY`, and `X-ADMIN-API-KEY`.

Security/interoperability impact: Captured API keys authorize arbitrary future writes until revoked. The draft's replay and payload-substitution protections are absent. Implementations cannot interoperate on authenticated submission.

Recommendation: Add HTTP Message Signature support for draft endpoints. If API keys remain for author management, explicitly mark them outside the IETF wire protocol.

Fix: Code and OpenAPI.

### Finding 13: Browser Fetch/CORS Assumptions Are Not Specified

Severity: Medium

Spec location: `draft-grey-htmltrust-00.md`, "Key Resolution", "Trust Directory HTTP API", "Privacy Considerations".

Code location:

- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-browser-reference/src/content-scripts/index.ts`
- `htmltrust-browser-client/src/endorsements.ts`

Issue: Browser verifiers fetch key documents and directory endpoints. The draft says GET endpoints should be public, but does not require CORS headers or define behavior under extension privilege versus page script. The browser reference also refetches the current page HTML with `credentials: 'same-origin'` to avoid runtime mutation.

Security/interoperability impact: Web-page libraries will fail on otherwise public key/directory endpoints without CORS. Extension behavior may differ from ordinary browser JS. The pristine refetch can hit service workers, cookies, per-request personalization, cache races, and different signed-section counts.

Recommendation: Add a browser networking subsection: required CORS for public key and directory GETs, cache policy, redirect policy, credential mode, timeout/backoff, service-worker caveats, and normative fallback when pristine fetch and DOM disagree.

Fix: Spec, then code as needed.

### Finding 14: Debug Logging Leaks Signed Content and Key Material Fragments

Severity: Medium

Spec location: `draft-grey-htmltrust-00.md`, "Security Considerations" / "Side channels"; "Privacy Considerations".

Code location:

- `htmltrust-browser-client/src/verify.ts`
- `htmltrust-browser-reference/src/content-scripts/index.ts`

Issue: The browser client logs canonical text head/tail, inner HTML, signature, binding string, keyid, algorithm, and public key prefix when `debug` is true. The browser reference always passes `debug: true` in auto-verify.

Security/interoperability impact: Failure diagnostics can expose private or sensitive page content in browser logs, extension diagnostics, or collected telemetry. This conflicts with the draft's side-channel and privacy goals.

Recommendation: Default browser verification to no detailed logs. If diagnostics are necessary, gate them behind explicit developer settings and redact content by default. The draft should state that verifiers must not log canonical text, full signatures, or key material unless explicitly configured.

Fix: Code and spec.

### Finding 15: No Normative Resource Limits for Canonicalization or Network Work

Severity: Medium

Spec location: `draft-grey-htmltrust-00.md`, "Canonicalization", "Key Resolution", "Trust Directory HTTP API", "Security Considerations".

Code location:

- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-browser-reference/src/content-scripts/index.ts`
- `htmltrust-server-reference/src/server.js`

Issue: The draft has rate-limit advice for directories but no verifier-side limits for section size, number of signed sections, DOM depth, number of claims, key fetch timeout, endorsement count, redirect count, or DID document size. Server `express.json()` has default body limits but the draft does not specify protocol limits.

Security/interoperability impact: Malicious pages can force expensive parsing, hashing, key fetches, and directory lookups. Different verifiers will fail at different limits.

Recommendation: Specify minimum required limits and recommended defaults, for example maximum canonicalized bytes per section, maximum claims, maximum signed sections per document before lazy verification, key/directory timeout, redirect limit, and endorsement page size.

Fix: Spec.

### Finding 16: Opt-Out Marker Is Normative and Non-Normative at the Same Time

Severity: Medium

Spec location: `draft-grey-htmltrust-00.md`, "Excluded elements"; "Opt-out marker (Editor's Note)"; "Open Issues".

Code location:

- `htmltrust-canonicalization/javascript/index.js`
- `htmltrust-canonicalization/python/htmltrust_canonicalization/_extract.py`
- `htmltrust-canonicalization/go/extract.go`

Issue: The draft says excluded elements include any element marked with the opt-out marker, but later says the marker is reserved for future use and canonicalizers SHOULD exclude it. Code does not implement it.

Security/interoperability impact: A malicious or accidental `data-htmltrust-ignore="true"` can cause different verifiers to include or exclude visible content. Because it is a signing-scope control, this cannot remain ambiguous.

Recommendation: Move the marker fully to an Open Issue with no normative effect, or make it a MUST with exact attribute matching rules and tests.

Fix: Spec and code if kept.

## 4. Internal Consistency Issues in the IETF Draft

- The normative reference is named `UNICODE-NFC`, but the algorithm requires NFKC.
- "Canonical claims" says LF is stripped by Section 4.4; Section 4.4 maps LF to space outside `<pre>`, not strips it.
- The draft uses `domain` for what is actually an origin. The terminology section defines Origin as scheme, host, port; the field name invites implementers to sign only the host, which the code does.
- The claims example signs `author`, `claim:License`, and `signed-at`; the signing payload also includes `signed-at` as a separate field. This double-binds `signed-at` in the draft but not in code.
- `name:content` claim serialization is unescaped while examples use names containing `:`. This may be fine for hash-only serialization but should be stated as not parseable.
- "Direct HTTPS URL" and "Trust directory reference" overlap because a directory key URL is also an HTTPS URL. The difference has policy meaning but not protocol parsing meaning.
- "Side channels" says verifiers must not distinguish success/failure via console output visible to page scripts. Console output is not normally visible to page scripts, but logs are still a privacy/telemetry concern; the text should be reframed.
- IANA media-type "Security considerations" for key documents references Section 11, but key document risks are in Section 8 and Security Considerations.
- Test vectors are placeholders. For a canonicalization/signature draft, real vectors are not optional for useful review.
- Open issue 2 refers to "Section 11 of the security considerations"; security considerations are Section 12 in the draft's unnumbered source order and will be auto-numbered by kramdown, so use cross references rather than prose section numbers.

## 5. Mismatch Matrix Between Draft and Existing Code/Conformance

| Topic | Draft | Existing code/conformance | Risk | Fix target |
|---|---|---|---|---|
| Hash encoding | unpadded base64url | standard base64 in JS/server/e2e, hex in WP and old OpenAPI examples | Critical | Code/OpenAPI |
| Signature encoding | unpadded base64url | standard base64 | Critical | Code |
| Origin binding | `https://host[:port]` | hostname only; HTTP in e2e keyids/sites | Critical | Both |
| Claims serialization | `name:content\n`, all direct meta | `name=value`, only claim map; browser strips `claim:` and excludes `signed-at`/`author` | Critical | Both |
| Required attributes | `keyid`, `signature`, `content-hash`, `algorithm` | browser defaults missing `algorithm` to `ed25519` | High | Code or spec |
| Hash agility | sha256/384/512 registry | browser hardcodes sha256 | High | Code |
| Block boundaries | LF | single space fixtures and code | High | Spec or conformance/code |
| `br` | LF | JS/Go space; Python no separator | High | Both |
| Excluded elements | includes `template`, `iframe`; opt-out marker | code excludes `meta`, `link`, `head`; not `template`/`iframe`; no opt-out | High | Both |
| `<pre>` | per-element preserve whitespace | global option only; not automatic | High | Both |
| Key document | JWK or `application/htmltrust-key+json` with base64url public key bytes | PEM JSON/raw PEM; author-public-key endpoint | High | Both |
| Direct key URL | HTTPS only | HTTP accepted | High | Code |
| Algorithm IDs | `ed25519`, `ecdsa-p256`, etc. | `ED25519`, `ECDSA`, `RSA`, generic aliases; secp256k1 | High | Both |
| Directory discovery | `/.well-known/htmltrust` | absent | High | Code |
| Content lookup | `/content/{hash}` | `/api/directory/content?contentHash=...` | High | Both |
| Content submission | `POST /content` with HTTP Message Signature | `/api/content/sign` and `/api/content/occurrences`; API keys | High | Both |
| Endorsement lookup | `/content/{hash}/endorsements` | `/api/endorsements?content-hash=...` | High | Both |
| Endorsement signing | JCS document minus `signature` | `{contentHash}:{timestamp}` | Critical | Code or spec |
| Errors | `application/problem+json` | `{code,message}` JSON | Medium | Code/OpenAPI |
| CORS | not specified | server `cors()` allows all; key/directory CORS not normative | Medium | Spec |
| Browser mutation | live DOM before mutation, opt-out TBD | browser refetches pristine HTML and falls back to DOM | Medium | Spec |

## 6. Browser/Security Researcher Checklist

Canonicalization ambiguity:

- Not ready. Block separators, `br`, `pre`, excluded elements, opt-out marker, direct-child claim extraction, and nested signed sections need normative fixtures.

Algorithm/key agility:

- Draft has registries, but code is mostly hardcoded to sha256 and generic algorithm labels. Exact key type, curve, RSA padding, and signature encoding must be bound.

Signature envelope malleability:

- Tolerated padding/whitespace and standard-base64 acceptance create multiple encodings. Require canonical encodings in signed attributes.

Replay/domain binding:

- Cross-origin replay defense depends on full origin serialization. Code signs hostnames only, leaving scheme/port confusion.

Key resolution trust boundaries:

- HTTP key URLs, raw PEM, author-public-key endpoints, and trust-directory fallback are broader than the draft. Specify SSRF/redirect/private-network restrictions for non-browser verifiers.

Privacy/leakage:

- Directory/key queries reveal reading interests. Browser debug logging currently leaks canonical text. Pristine page refetch may produce extra origin-visible requests.

Network failure behavior:

- Need exact outcomes for key timeout, directory timeout, DID fetch failure, CORS denial, redirects, and offline mode. Code currently collapses many failures to "key not resolvable".

CORS/fetch assumptions:

- Add required `Access-Control-Allow-Origin` behavior for public key and directory GETs. Define credential mode and redirect policy.

DoS/resource limits:

- Add limits for canonicalized byte length, signed sections per page, claims per section, key document size, endorsement page size, directory pagination, redirects, and timeouts.

Extension threat model:

- The browser reference uses privileged content-script behavior and local settings. Specify which outcomes are page-visible, extension-visible, and private to the user agent.

Downgrade/confusion risks:

- Missing `algorithm` default, generic `RSA`/`ECDSA`, standard vs URL-safe base64, host vs origin, and directory-key vs direct-URL resolution all need strict failure behavior.

Internationalization/Unicode risks:

- NFKC is aggressive. The draft should explicitly acknowledge semantic loss for compatibility characters and add fixtures for RTL text, combining marks, emoji ZWJ, variation selectors, CJK punctuation, and IDNA hostnames.

Error handling:

- Define a stable machine-readable verifier error taxonomy. Align directory `application/problem+json` types with verifier outcomes where relevant.

Conformance testability:

- Real test vectors are required: canonical content bytes, claims bytes, hashes, signing payload, public/private Ed25519 keypair, signature, key document, directory records, and endorsement JCS bytes.

## 7. Concrete Next Edits Proposed

Do not apply these blindly; they are the next edits I would queue.

1. Replace `domain` with `origin` in the draft's signing payload section, or explicitly define `domain` as full serialized origin. Add examples for `https://example.org`, `https://example.org:8443`, IDNA A-labels, and reject/allow policy for HTTP.
2. Change draft claims canonicalization to match the conformance suite if that suite is the intended contract: `claim:*` only, strip prefix, `name=value`, LF-joined, no trailing LF, `signed-at` separately bound. Otherwise update all implementations and fixtures to `name:content\n`.
3. Make base64url canonical and non-tolerant for signed attributes. Add exact regex and decoded-length checks for `content-hash`, `claims-hash`, and `signature`.
4. Add a normative canonicalization element table and align it with fixtures. Decide now on LF versus space boundaries; then update either the draft or conformance suite.
5. Resolve `br`, `pre`, `template`, `iframe`, `link`, `head`, `details`, `dialog`, `hgroup`, `canvas`, `dd`, `dt`, `output`, `tfoot`, `thead`, and `video` explicitly.
6. Move `data-htmltrust-ignore` fully to non-normative open issue or make it a MUST with exact tests.
7. Define the key document as either JWK-only plus optional HTMLTrust wrapper, or PEM-compatible legacy profile. Do not leave "base64url public key bytes" underspecified for multiple algorithms.
8. Add a browser networking section covering CORS, redirects, credentials, cache, timeouts, and service-worker/pristine-fetch behavior.
9. Split the trust directory draft API from author-management/signing convenience APIs. The IETF API should not include remote signing as a cryptographic verification path.
10. Implement or remove HTTP Message Signature authentication. If kept, add canonical examples with `Content-Digest` and exact covered components.
11. Rewrite endorsements around one binding. Preferred: RFC 8785 JCS over the structured endorsement with `signature` omitted. Add an Ed25519 endorsement vector.
12. Add real test vectors to the draft and point to conformance fixtures by commit or release tag, not only repository name.
13. Add verifier resource-limit recommendations and mandatory minimum failure behavior for oversized inputs.
14. Change browser-reference auto verification to avoid `debug: true` by default, and add draft privacy text forbidding content-bearing logs by default.
15. Add a "Legacy prototype incompatibilities" appendix or implementation note so reviewers understand why current repos differ from the draft.

## Review 2: Second-Pass Findings

Review 2 is additive. Several first-pass findings above are now historical because the draft and implementations have moved toward canonical unpadded standard Base64, serialized-origin binding, all direct-child claim metadata, draft-shaped directory endpoints, structured endorsements, source-snapshot verification, and signed semantic attributes. The findings below focus on remaining issues that would still draw security or browser-reviewer pushback.

### Finding R2-1: Signature algorithms are named, but signature and key byte formats are not fully specified

Severity: Critical

Spec locations: `draft-grey-htmltrust-00.md` lines 690-699, 711-717, and 785-802.

Code locations: `htmltrust-server-reference/src/utils/crypto.js` lines 91-166; `htmltrust-server-reference/src/utils/htmltrustProtocol.js` lines 129-143; `htmltrust-canonicalization/javascript/index.js` lines 525-577; `htmltrust-canonicalization/go/signature.go` lines 73-157.

Issue: The registry names `ecdsa-p256`, `ecdsa-p384`, `rsa-pss-sha256`, and `rsa-pkcs1-sha256`, but the draft does not say exactly what signature bytes are Base64-encoded. ECDSA needs an explicit choice between ASN.1 DER and IEEE P1363 raw `r || s`; Node's `crypto.sign()` emits DER while WebCrypto ECDSA verification expects a raw signature. RSA-PSS needs an explicit salt length. The key document says `publicKey` is "Base64-encoded public key bytes" but does not say whether those bytes are SPKI DER, raw Ed25519, SEC1, JWK material, or algorithm-specific. The server emits SPKI DER with a non-normative `publicKeyEncoding: "spki-der"` plus legacy PEM, while the canonicalization libraries primarily verify PEM.

Security/interoperability impact: Independent implementations can all be "draft conforming" and still fail every ECDSA or RSA-PSS verification. Key-substitution and algorithm-confusion review will also be hard because the algorithm identifier is not tied to a unique key encoding and signature representation.

Recommendation: Specify a single wire form per algorithm. A practical profile is SPKI DER for HTMLTrust key documents; Ed25519 signature as 64 raw bytes; ECDSA signatures as either DER or P1363, explicitly one only; RSA-PSS with SHA-256, MGF1-SHA-256, and salt length equal to the digest length. Require verifiers to reject mismatched key type/algorithm pairs. Update code so JS, Go, PHP, Python, Rust, browser, and server all consume the same key document and signature bytes.

Fix: Both, with the spec first. The current code cannot safely converge until the draft chooses the exact wire bytes.

### Finding R2-2: Standard Base64 in URL path segments is still fragile across HTTP stacks

Severity: High

Spec locations: `draft-grey-htmltrust-00.md` lines 635-661 and 883-888.

Code locations: `htmltrust-server-reference/src/routes/content.js` lines 29-33; `htmltrust-server-reference/src/controllers/contentController.js` lines 435-436 and 523-527; `htmltrust-browser-client/src/endorsements.ts` uses `encodeURIComponent(contentHash)` for directory URLs.

Issue: The draft now explicitly chooses standard Base64, which includes `/`, and requires percent-encoding when a hash is placed in `/content/{hash}`. That is better than the previous encoding drift, but it still leaves a real deployment hazard: reverse proxies, routers, WAFs, static hosts, and framework middleware often normalize, reject, or decode `%2F` before route matching. The Express reference route is a single `/:contentHash` segment, so it depends on all upstream layers preserving encoded slashes until Express decodes the route parameter.

Security/interoperability impact: A valid content hash can become unretrievable or be routed as multiple path segments. Worse, different directory deployments can accept different spellings of the same resource, fragmenting endorsement lookup and cache behavior. Browser researchers will flag this as a path-confusion issue because the wire format intentionally contains a path delimiter character.

Recommendation: Keep canonical standard Base64 for signed fields if that decision is final, but make URL transport rules stricter. The draft should either move hash lookup to a query parameter (`GET /content?hash=...`) or define a separate URL-component encoding profile with mandatory `%2F` preservation requirements, examples containing both `+` and `/`, and explicit conformance tests through the reference server. The code should add route tests for hashes with `/` and `+`, including the generated `Location` header, and document required proxy settings if the path shape remains.

Fix: Both. Spec should remove ambiguity; code should prove it survives real path handling.

### Finding R2-3: The HTMLTrust key document is not actually consumable by current resolvers

Severity: High

Spec locations: `draft-grey-htmltrust-00.md` lines 777-802 and 804-809.

Code locations: `htmltrust-server-reference/src/utils/htmltrustProtocol.js` lines 129-143; `htmltrust-canonicalization/javascript/index.js` lines 667-678 and 693-708; `htmltrust-browser-client/src/resolver.ts` lines 37-55.

Issue: The server's draft key endpoint returns `publicKey` as unpadded Base64 SPKI DER, plus a compatibility `publicKeyPem`. The core JS resolver reads `data.publicKey || data.publicKeyPem || data.key` and passes that value to `verifySignature()` as PEM. Because `publicKey` is checked first, a conforming server response can hand the verifier Base64 DER where the verifier expects PEM. The resolvers also ignore `kid`, `expires`, and `revoked`, despite the draft requiring expired or revoked keys to fail.

Security/interoperability impact: A verifier can fail on the draft's preferred key field while succeeding only through legacy PEM ordering. It can also accept a revoked or expired HTMLTrust key document if the resolver ignores those fields. That undermines the key-lifecycle story in security review.

Recommendation: Make the key document schema normative enough for code: require `publicKeyEncoding: "spki-der"` or make SPKI DER implicit; define whether `kid` must match the requested `/keys/{id}` path when present; require resolvers to process `expires` and `revoked`; and prefer `publicKeyPem` only in an explicitly legacy compatibility mode. Fix the resolver implementations to decode SPKI DER into the platform's key object or to select `publicKeyPem` only when the document declares a PEM encoding.

Fix: Both. The spec needs a complete key-document contract; code needs to implement that contract instead of relying on PEM fallback.

### Finding R2-4: Endorsement canonicalization says RFC 8785, but implementations still use partial local JSON canonicalizers

Severity: High

Spec locations: `draft-grey-htmltrust-00.md` lines 1038-1076 and 1086-1098.

Code locations: `htmltrust-browser-client/src/spec.ts` lines 107-125; `htmltrust-canonicalization/javascript/index.js` lines 743-760; `htmltrust-server-reference/src/utils/htmltrustProtocol.js` lines 157-172; `htmltrust-canonicalization/go/endorsement.go` lines 11-44.

Issue: The draft's choice of JCS is the right direction, but the code does not uniformly implement RFC 8785. The JS/browser/server helpers sort object keys and call `JSON.stringify()`, which is close for common strings but is not a stated RFC 8785 implementation and does not address duplicate JSON member rejection at parse time. The Go endorsement helper is more divergent: its struct only includes `endorser`, `endorsement`, `signature`, `timestamp`, and `algorithm`, then signs a new four-field map, so it drops optional and additional fields even though the draft says all additional fields must be included in the signed payload.

Security/interoperability impact: Endorsements with `expires`, `claim`, `revokedBy`, or future fields can verify in one implementation and fail in another. In Go, fields that the draft intends to be signed are unsigned. That matters because expiry, revocation, and rationale are exactly the fields a malicious directory would want to alter.

Recommendation: Adopt a real RFC 8785 implementation in every language or define an intentionally smaller canonical JSON profile and stop calling it JCS. Add cross-language endorsement vectors that include optional fields, nested additional fields, Unicode strings, numeric values if allowed, and duplicate-key negative cases. The Go binding should preserve arbitrary JSON fields or expose an endorsement type backed by a generic map.

Fix: Both. The draft should add JCS edge-case requirements and vectors; code should replace partial canonicalizers.

### Finding R2-5: Attribute records are not domain-separated from text content

Severity: High

Spec locations: `draft-grey-htmltrust-00.md` lines 366-384 and 418-426.

Code locations: `htmltrust-canonicalization/javascript/index.js` lines 199-227; `htmltrust-canonicalization/go/extract.go` lines 202-220; `htmltrust-canonicalization/python/htmltrust_canonicalization/_extract.py` emits the same `@attr:` text record pattern.

Issue: Signed semantic attributes are serialized into the same flat UTF-8 string as normalized text using records such as `@attr:a:href:https://example.org/\n`. There is no escaping or length-prefixing that prevents ordinary text from producing the same byte sequence as an attribute record. For example, literal text beginning with `@attr:a:href:...` can collide with an actual link attribute record in the canonical byte string.

Security/interoperability impact: The content hash does not uniquely commit to whether some bytes came from text nodes or signed attributes. That creates a structural substitution class: material signed as plain visible text can be transformed into link/media semantics, or vice versa, while preserving the canonical byte string in carefully constructed cases. This is exactly the kind of semantic confusion browser reviewers will look for once attributes are signed.

Recommendation: Domain-separate record types. Use a structured canonical byte format with explicit type tags and length prefixes, or escape text so reserved record prefixes cannot collide with generated attribute records. Add negative conformance tests proving a text node that begins with `@attr:` cannot collide with an attribute record.

Fix: Both. This is a canonicalization design issue, so the spec must change and every implementation must follow.

### Finding R2-6: `href`/`src` URL canonicalization lacks a precise base-URL and serializer contract

Severity: High

Spec locations: `draft-grey-htmltrust-00.md` lines 375-384 and 287-295.

Code locations: `htmltrust-canonicalization/javascript/index.js` lines 203-207; `htmltrust-canonicalization/go/extract.go` lines 242-276; `htmltrust-canonicalization/python/htmltrust_canonicalization/_extract.py` lines 128-150; `htmltrust-canonicalization/rust/src/lib.rs` canonicalizes with the `url` crate.

Issue: The draft says to parse `href` and `src` against the signed document's base URL and serialize with the Web URL serializer. It does not define whether "base URL" is the final response URL after redirects, the document base URL after applying `<base href>`, a caller-provided verification URL, or the source snapshot URL before runtime mutations. The code varies by language: JS uses `new URL(...).href`, Go uses `net/url` and manual host normalization, Python reconstructs URLs with `urlunsplit()` and forces a `/` path, and Rust uses the `url` crate. These are not guaranteed byte-identical on IDNA, percent-encoding, empty paths, fragments, default ports, IPv6, or malformed inputs.

Security/interoperability impact: Link and media integrity is one of the major new security claims after the cleanup. If URL serialization diverges, honest signatures fail across implementations. If base URL handling is loose, an attacker can alter `<base>` or exploit redirect/context differences to make a signed relative link resolve differently.

Recommendation: Define a single base URL algorithm by reference to the HTML and URL Standards: final response URL, treatment of `<base href>`, timing relative to source snapshot creation, redirect handling, and fragment preservation/removal. Add conformance fixtures for relative paths, empty paths, IDNA, percent-encoding, query strings, fragments, default and non-default ports, IPv6, and invalid URLs. Then change non-Web URL serializers to match the Web URL serializer byte-for-byte or delegate to a conforming implementation.

Fix: Both. Spec needs normative detail; code needs cross-language URL fixtures.

### Finding R2-7: Directory `POST /content` claim hashing is underspecified and the server recomputation does not match Section 4.6

Severity: Medium

Spec locations: `draft-grey-htmltrust-00.md` lines 911-934 and 1129-1143.

Code locations: `htmltrust-server-reference/src/controllers/contentController.js` lines 41-62 and 453-468.

Issue: The draft's `POST /content` example provides `claims` but not `claimsHash`, and the example `claims` array omits `signed-at` even though Section 4.6 says `signed-at` is included in canonical claims. The server compensates by injecting `signed-at` if missing, but its recomputation does not run the Section 4.4 text normalization, does not detect duplicates after normalization, sorts complete `name:content\n` lines rather than UTF-8 names, and only computes sha256 even though the draft registry includes sha384 and sha512.

Security/interoperability impact: A directory can re-verify a valid submitted signature differently from a browser verifier. Duplicate or Unicode-equivalent claim names may be accepted by the directory and rejected by clients, or vice versa. That undercuts the directory's claim to have re-verified the submitted occurrence before indexing it.

Recommendation: Specify the submission contract exactly. Either require clients to submit `claimsHash` and treat `claims` as display/indexing metadata only, or require `claims` to include the complete direct-child claim set including `signed-at` and define the directory's recomputation as Section 4.6 byte-for-byte. The reference server should use the shared canonicalization library for claim hashing instead of local line construction.

Fix: Both.

### Finding R2-8: HTTP Message Signature authentication remains normative but unimplemented

Severity: Medium

Spec locations: `draft-grey-htmltrust-00.md` lines 931-934 and 996-1007.

Code locations: `htmltrust-server-reference/src/routes/content.js` lines 26-27; `htmltrust-server-reference/src/routes/endorsements.js` uses `protectWithGeneralApiKey`; `htmltrust-server-reference/src/middleware/auth.js` lines 6-24.

Issue: The draft requires RFC 9421 HTTP Message Signatures for POST endpoints and says the directory can resolve the signing key. The reference server still gates draft-shaped submissions with `X-API-KEY` and does not verify `Signature-Input`, `Signature`, `Date`, or `Content-Digest`.

Security/interoperability impact: This is no longer a broad API-shape mismatch, but it is still a security mismatch. API keys are bearer credentials, not request-bound signatures. They do not provide replay resistance, submitter key binding, or a usable path for federated unaffiliated submitters.

Recommendation: Implement RFC 9421 on `POST /content` and `POST /endorsements`, or downgrade the draft language to allow bearer-token profiles as non-federated deployments. If HTTP Message Signatures remain normative, add complete examples with `@method`, `@target-uri`, `host`, `date`, `content-digest`, algorithm mapping, clock-skew tolerance, replay windows, and problem-details errors.

Fix: Code if the draft is the intended target; spec only if bearer-token directories are meant to be conforming.

### Finding R2-9: Serialized origin now points in the right direction but still re-specifies parts of the URL Standard

Severity: Medium

Spec locations: `draft-grey-htmltrust-00.md` lines 591-599 and 1135-1143.

Code locations: `htmltrust-canonicalization/javascript/index.js` lines 417-429; `htmltrust-canonicalization/go/signature.go` lines 45-69; `htmltrust-server-reference/src/utils/htmltrustProtocol.js` lines 97-118.

Issue: The cleanup correctly moved from host-only binding to serialized origin semantics, but the draft still hand-defines `scheme://host[:port]` instead of normatively delegating to the URL Standard's origin serialization and then stating the allowed origin classes. Code already diverges slightly: JS uses `URL.origin`, while Go and server code rebuild the string manually and allow `http` as well as `https`. The draft examples are HTTPS-oriented but do not clearly say whether plain HTTP, localhost, opaque origins, `blob:`, `data:`, `file:`, IPv6 literals, or IDNA edge cases are allowed or rejected.

Security/interoperability impact: Replay protection depends on this field. Any implementation split on default ports, punycode, IPv6 brackets, or non-HTTPS origins can create cross-context verification failures or unintended acceptance.

Recommendation: Define the field as "the serialized origin produced by the URL Standard" and then explicitly restrict conforming public signatures to tuple origins with `https` scheme, with a named non-conforming or test-only exception for local HTTP if needed. Add negative tests for opaque origins and positive tests for IDNA, IPv6, and non-default ports. Update Go/server validators to delegate to a URL Standard-compatible implementation or match fixtures exactly.

Fix: Both.

### Finding R2-10: HTML parser conformance is normative, but major implementations still use non-HTML-LS parsing

Severity: Medium

Spec locations: `draft-grey-htmltrust-00.md` lines 287-295 and 303-325.

Code locations: `htmltrust-canonicalization/javascript/index.js` lines 248-305; `htmltrust-canonicalization/go/extract.go` lines 88-172; `htmltrust-canonicalization/python/htmltrust_canonicalization/_extract.py` uses BeautifulSoup with `html.parser`; `htmltrust-canonicalization/rust/src/lib.rs` uses `html5ever` via `scraper`.

Issue: The draft says canonicalization is over the HTML Living Standard parser's abstract tree. That is the right spec target, but the JS and Go implementations use regex tokenization and the Python binding uses `html.parser`, while Rust uses an HTML5 parser. These parsers will diverge on malformed markup, foster parenting in tables, foreign content, nested custom elements, entity edge cases, and `<template>` contents.

Security/interoperability impact: Attackers can search for parser differentials that verify in one implementation and render or hash differently in another. Browser reviewers will expect either a true HTML parser dependency or a constrained input profile with rejection of markup outside the safe subset.

Recommendation: Keep the spec tied to the HTML parser, but add a conformance fixture suite for parser-adversarial cases and require reference implementations to use an HTML5 parser for verification paths. If lightweight signers retain regex canonicalization, label them authoring conveniences and require verification against the parser-backed implementation.

Fix: Code primarily, plus spec test vectors.

### Finding R2-11: Resource limits and failure taxonomy are still too thin for hostile inputs

Severity: Medium

Spec locations: `draft-grey-htmltrust-00.md` lines 1175-1218 and 1332-1338.

Code locations: Browser and server implementations have finite behavior by platform defaults, but no shared limits for signed-section size, claims count, key document size, redirect count, endorsement page size, or canonicalization CPU budget.

Issue: The draft gives good provisional network privacy rules, but it does not set minimum resource-limit guidance for canonicalization, key documents, endorsements, directory pagination, redirects, timeouts, or sections per page. The verifier error taxonomy is improved but not yet complete enough to distinguish oversized input, malformed key document, revoked key, unsupported hash algorithm, invalid Base64, and network policy failures consistently.

Security/interoperability impact: A hostile page can force expensive canonicalization, key resolution, or directory fetching and cause either UI stalls or inconsistent verifier outcomes. Lack of stable failure codes makes browser UI and telemetry harder to design without leaking details to pages.

Recommendation: Add normative or strongly recommended ceilings and corresponding machine-readable failure outcomes. At minimum cover maximum signed-section bytes, maximum claims, maximum claim bytes, maximum key document bytes, maximum endorsements per page, redirect count, timeout, and maximum concurrent verifier fetches. Require failures to be non-valid and distinguishable in diagnostics without exposing signed content bytes to page scripts.

Fix: Spec first, then code to enforce the shared limits.

## 4. Disposition of the 2026-08-27 follow-up pass

The companion draft now resolves the requested specification decisions:

- `ietf-draft/draft-grey-htmltrust-00.md` has a dated revision and no
  placeholder values in its examples.
- The directory example contains reproducible RFC 9421 fields, a body
  digest, signature base, and Ed25519 signature. The legacy
  `(request-target)` name is explicitly rejected.
- Signature representations are fixed for every registered algorithm:
  Ed25519 raw bytes, fixed-width ECDSA `R || S`, and modulus-width RSA with
  an exact RSA-PSS salt profile. HTMLTrust key documents use SPKI DER and
  require algorithm-to-key parameter matching.
- Endorsements require RFC 8785 JCS, duplicate-member rejection, complete
  preservation of optional and unknown members, and have a checked-in
  Ed25519 vector at `ietf-draft/vectors/endorsement-01.json`.
- Attribute and text records escape U+0040 before emission, so literal text
  cannot be confused with the reserved `@attr:` record prefix.
- `ietf-draft/vectors/parser-profile.json` defines the portable parser
  profile and its malformed-input rejection cases.
- `ietf-draft/vectors/attribute-records.json`, `nested-section.json`, and
  `origin-serialization.json` cover record framing, nested boundaries, and
  tuple-origin behavior.
- Resource ceilings and the closed failure vocabulary are normative in the
  draft.
- Directory content submissions carry the complete direct-child claim set,
  including `signed-at`, and directories recompute the claims hash exactly
  as the canonicalization section specifies.

The code-side work remains a separate integration task: each canonicalizer
must implement the new U+0040 escaping rule, parser-profile rejection, and
resource ceilings, while each JSON implementation must use a complete RFC
8785 implementation. This review remains an audit record and is not a claim
that those downstream changes have already landed.
