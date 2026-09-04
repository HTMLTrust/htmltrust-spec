# Choose the Python and Rust API scope for v0.3.0

| Field | Value |
|---|---|
| Status | Draft for review |
| Version | 0.1 |
| Date | 2026-08-28 |
| Author | HTMLTrust contributors |
| Decision owner | Jason Grey |
| Primary readers | HTMLTrust maintainers and binding users |
| Reading time | 7 minutes |

## Decision requested

Choose how much of the HTMLTrust protocol belongs in the Python and Rust
canonicalization packages.

The recommended choice for v0.3.0 is **Option 1: keep both packages focused on
deterministic canonicalization and document that boundary prominently**. This
preserves the tested 128-fixture release candidate. A later release can add
payload construction when a Python or Rust publisher has a concrete need and
an implementation owner.

Comment on the review pull request with `Decision: option 1`, `option 2`,
`option 3`, or `option 4`. Include any capability that must block v0.3.0.

## Understand the current API

The roadmap calls the wider JavaScript, Go, and PHP surface "signing helpers."
Those bindings stop before private-key use. They construct signing payloads,
verify signatures, and resolve public keys. None of the five canonicalization
bindings exports a private-key `sign()` API.

| Capability | JavaScript | Go | PHP | Python | Rust |
|---|:---:|:---:|:---:|:---:|:---:|
| Text, HTML, claims, and JSON canonicalization | Yes | Yes | Yes | Yes | Yes |
| v1 signing-payload construction | Yes | Yes | Yes | No | No |
| Cryptographic signature verification | Yes | Yes | Yes | No | No |
| Built-in decentralized identifier (DID), direct URL, and directory resolvers | Yes | Yes | Yes | No | No |
| Private-key signature generation | No | No | No | No | No |

The terms in this document have narrow meanings:

- A **canonicalizer** turns source content into stable protocol bytes. It has no
  file or network access.
- A **payload builder** validates profile fields and constructs the exact JSON
  bytes that a caller signs.
- A **verifier** checks a signature with a public key and applies algorithm and
  key-lifecycle rules.
- A **resolver** obtains a public key from a key identifier. Built-in remote
  resolvers own HTTP policy, response limits, caching, and timeout behavior.
- A **signer** uses private-key material to generate a signature.
- **FFI** is Rust's native foreign-function interface for callers outside Rust.

Python currently has no runtime cryptography dependency. Rust has no crypto or
HTTP dependency. The shared conformance suite covers canonical text, HTML
extraction, claims, and JSON canonicalization. It has no cross-language vectors
for signing payloads, cryptographic verification, or resolver behavior.

## Compare the options

| Option | Result for Python and Rust | Runtime and API effect | Fit for v0.3.0 |
|---|---|---|---|
| 1. Keep the canonicalizer boundary | Current deterministic APIs, with clearer package metadata and capability documentation | No new runtime dependencies or FFI functions | Strong |
| 2. Add payload construction | Profile validation and payload bytes, while callers supply crypto | New pure functions, fixtures, and an FFI scope decision | Possible after v0.3.0 |
| 3. Add local verification | Payload construction plus signature checks using caller-supplied keys | New crypto dependencies, key formats, errors, and negative tests | Weak |
| 4. Create full client packages | Separate Python and Rust clients with verification and remote key resolution | Two packages, HTTP policy, async APIs, crypto maintenance, and a larger test harness | Future project |

## Option 1: keep the canonicalizer boundary

Python and Rust continue to expose normalization, extraction, claims
canonicalization, and RFC 8785 JSON canonicalization. Documentation and package
metadata state this scope at the first point where a user chooses a binding.

Work required if approved:

- Add the capability table to the canonicalization repository.
- Give the Rust README the same explicit package-scope section as Python.
- Review Python classifiers and Rust categories for claims that imply a crypto
  implementation.
- Keep the shared conformance suite as the release gate for all five bindings.

Pros:

- v0.3.0 ships the behavior already tested across 128 fixtures.
- Python and Rust remain deterministic libraries with no network policy.
- Their runtime dependency and native FFI surfaces stay stable.
- Security review remains focused on parser behavior and exact output bytes.
- Future client packages can choose interfaces that fit each language.

Cons:

- The five bindings have intentionally different feature sets.
- Python and Rust applications must assemble payload and verification behavior
  elsewhere.
- Users may build incompatible helpers before official client packages exist.
- The boundary needs prominent documentation in package indexes and examples.

## Option 2: add payload construction

Add the pure v1 helpers to Python and Rust: signing-location derivation,
timestamp validation, canonical base64 handling, signing payload construction,
and endorsement binding. Callers continue to choose their crypto library and
key source.

Pros:

- Python and Rust publishers can create the exact bytes required by the v1
  profile.
- The new functions remain deterministic and require no network access.
- Applications can use hardware keys or an existing cryptography stack.
- The scope matches an authoring tool better than a full verification client.

Cons:

- New shared vectors and runner support are required before release.
- The native Rust FFI needs an explicit inclusion or exclusion decision.
- Payload support may be mistaken for a complete signing implementation.
- Five copies of profile validation increase coordinated maintenance.
- Applications still need separate verification and resolution code.

## Option 3: add local verification

Add Option 2 plus signature and endorsement verification. The caller supplies
public keys or implements a resolver interface. The canonicalization packages
perform no built-in HTTP requests.

Pros:

- Crawlers and local tools can verify signed content in Python or Rust.
- Caller-supplied key resolution lets applications enforce their own network
  and caching rules.
- Shared negative vectors can align algorithm and key-lifecycle behavior.
- The canonicalization packages avoid owning remote fetch policy.

Cons:

- Python gains a required crypto dependency or an optional feature with two
  supported installation modes.
- Rust gains crypto crates, feature selection, and key-format conversion work.
- Error behavior must align across language-specific crypto libraries.
- Rust FFI verification expands the application binary interface (ABI) and
  buffer-lifecycle review surface.
- Resolver interfaces differ between Python synchronous and asynchronous code
  and Rust traits.
- The test matrix must cover malformed keys, signatures, timestamps,
  revocation, expiry, and every supported algorithm.

## Option 4: create full client packages

Keep canonicalization as a dependency and publish separate Python and Rust
client packages. Each client owns payload construction, verification, resolver
chains, HTTP limits, cache policy, and endorsement processing. Private-key
signing can be designed as an optional client feature after its custody model
is approved.

Pros:

- Package names communicate the capability boundary.
- Canonicalization remains a small protocol primitive.
- Client releases can evolve without changing the byte-level package.
- Python and Rust users receive an integrated verification path.
- Network and crypto code has a dedicated security and test boundary.

Cons:

- The project must publish and maintain two more packages.
- Resolver behavior needs integration tests with controlled HTTP services.
- Python needs a documented synchronous or asynchronous API policy.
- Rust needs feature policy for TLS, async runtime, crypto, and FFI exposure.
- Release coordination grows across canonicalizer and client versions.
- This option has no identified Python or Rust consumer funding the work today.

## Keep private-key signing as a separate decision

A `sign()` API introduces key formats, hardware-provider interfaces, key
erasure behavior, algorithm selection, and failure handling around private
material. The current JavaScript, Go, and PHP canonicalization bindings do not
answer those questions. Adding private-key signing would create a new contract
for all five languages. It deserves its own decision after the current Python
and Rust scope is settled.

Open a separate design when a publishing integration needs this API. That
design should name the key provider, required algorithms, custody boundary,
and recovery behavior before choosing function signatures.

## Recommendation and trigger for revisiting it

Approve Option 1 for v0.3.0. It matches the packages that exist, keeps the
release promise limited to exact canonical bytes, and makes the current feature
split visible.

Revisit Option 2 when an issue names a Python or Rust publisher, an owner for
both language implementations, and the payload operations that application
will call. Revisit Option 3 or 4 when a verifier or crawler commits to one of
those languages and defines its key source and network policy.

## Related documents

- [HTMLTrust canonicalization overview](https://github.com/HTMLTrust/htmltrust-canonicalization#readme)
- [Python binding scope](https://github.com/HTMLTrust/htmltrust-canonicalization/tree/main/python#package-scope)
- [Rust binding API](https://github.com/HTMLTrust/htmltrust-canonicalization/tree/main/rust#profile-v1-api)
- [IETF draft signing and verification protocol](ietf-draft/draft-grey-htmltrust-00.md)
