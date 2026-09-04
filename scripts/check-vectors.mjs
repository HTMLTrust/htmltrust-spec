import {
  createHash,
  createHmac,
  hkdfSync,
  createPrivateKey,
  createPublicKey,
  verify,
} from "node:crypto";
import { readFileSync } from "node:fs";

const load = (name) => JSON.parse(
  readFileSync(new URL(`../ietf-draft/vectors/${name}`, import.meta.url), "utf8"),
);

const assertUnicodeScalarString = (value) => {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new Error("JCS input contains an unpaired high surrogate");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new Error("JCS input contains an unpaired low surrogate");
    }
  }
};

const canonicalizeJcs = (value) => {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    assertUnicodeScalarString(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JCS numbers must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJcs).join(",")}]`;
  }
  if (typeof value === "object") {
    const names = Object.keys(value).sort((left, right) => (
      left < right ? -1 : left > right ? 1 : 0
    ));
    return `{${names.map((name) => {
      assertUnicodeScalarString(name);
      return `${JSON.stringify(name)}:${canonicalizeJcs(value[name])}`;
    }).join(",")}}`;
  }
  throw new Error(`JCS does not support ${typeof value}`);
};

const privateKeyFromSeed = (seedHex) => {
  const seed = Buffer.from(seedHex, "hex");
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  return createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, seed]),
    format: "der",
    type: "pkcs8",
  });
};

const unpaddedBase64 = (buffer) => buffer.toString("base64").replace(/=+$/, "");

const SIGNING_V1 = Object.freeze({
  signature: "htmltrust-signature-v1",
  canonicalization: "htmltrust-c14n-v1",
  attributes: "htmltrust-attrs-v1",
  url: "htmltrust-safe-url-v1",
  context: "https://htmltrust.org/protocol/signed-section",
});

const parsePrefixedHash = (value) => {
  const match = /^(sha256|sha384|sha512):([A-Za-z0-9+/]+)$/.exec(value);
  if (!match) throw new Error(`invalid prefixed hash ${value}`);
  const [, algorithm, encoded] = match;
  const bytes = Buffer.from(encoded, "base64");
  const expectedLength = { sha256: 32, sha384: 48, sha512: 64 }[algorithm];
  if (bytes.length !== expectedLength || unpaddedBase64(bytes) !== encoded) {
    throw new Error(`non-canonical prefixed hash ${value}`);
  }
  return { algorithm, bytes };
};

const parseEd25519Signature = (value) => {
  if (!/^[A-Za-z0-9+/]+$/.test(value)) throw new Error("invalid-encoding");
  const bytes = Buffer.from(value, "base64");
  if (unpaddedBase64(bytes) !== value) throw new Error("invalid-encoding");
  if (bytes.length !== 64) throw new Error("malformed-signature");
  return bytes;
};

const escapeClaimField = (value) => value
  .replaceAll("\\", "\\\\")
  .replaceAll(":", "\\:")
  .replaceAll("\n", "\\n");

const serializeNormalizedClaims = (claims) => {
  if (!Array.isArray(claims)) throw new Error("normalized claims must be an array");
  const seen = new Set();
  const records = claims.map(({ name, content }) => {
    if (typeof name !== "string" || typeof content !== "string" || name.length === 0) {
      throw new Error("normalized claim is malformed");
    }
    assertUnicodeScalarString(name);
    assertUnicodeScalarString(content);
    if (seen.has(name)) throw new Error(`duplicate normalized claim ${name}`);
    seen.add(name);
    return { name, content };
  });
  records.sort((left, right) => Buffer.compare(
    Buffer.from(left.name, "utf8"),
    Buffer.from(right.name, "utf8"),
  ));
  return records.map(({ name, content }) => (
    `${escapeClaimField(name)}:${escapeClaimField(content)}\n`
  )).join("");
};

const endorsement = load("endorsement-01.json");
const { signature: endorsementSignature, ...unsignedEndorsement } = endorsement.document;
const endorsementJcs = canonicalizeJcs(unsignedEndorsement);
if (endorsementJcs !== endorsement.jcsWithoutSignature) {
  throw new Error("endorsement-01 JCS serialization does not match");
}
const payload = Buffer.from(endorsementJcs, "utf8");
const digest = createHash("sha256").update(payload).digest("base64").replace(/=+$/, "");
if (`sha256:${digest}` !== endorsement.jcsSha256) {
  throw new Error("endorsement-01 JCS hash does not match");
}

const privateKey = privateKeyFromSeed(endorsement.key.seedHex);
const publicKey = createPublicKey(privateKey);
const publicKeyRaw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
if (publicKeyRaw.toString("hex") !== endorsement.key.publicKeyRawHex) {
  throw new Error("endorsement-01 public key does not match the seed");
}
if (!verify(
  null,
  payload,
  publicKey,
  Buffer.from(endorsementSignature, "base64"),
)) {
  throw new Error("endorsement-01 signature does not verify");
}

const revocation = load("revocation-01.json");
const { signature: revocationSignature, ...unsignedRevocation } = revocation.document;
const revocationJcs = canonicalizeJcs(unsignedRevocation);
if (revocationJcs !== revocation.jcsWithoutSignature) {
  throw new Error("revocation-01 JCS serialization does not match");
}
const revocationSignerPrivateKey = privateKeyFromSeed(revocation.signerKey.seedHex);
const revocationSignerPublicKey = createPublicKey(revocationSignerPrivateKey);
const revocationSignerPublicKeyRaw = revocationSignerPublicKey.export({ format: "der", type: "spki" }).subarray(-32);
if (revocationSignerPublicKeyRaw.toString("hex") !== revocation.signerKey.publicKeyRawHex) {
  throw new Error("revocation-01 signer public key does not match the seed");
}
if (!verify(
  null,
  Buffer.from(revocationJcs, "utf8"),
  revocationSignerPublicKey,
  Buffer.from(revocationSignature, "base64"),
)) {
  throw new Error("revocation-01 signature does not verify");
}

// The revoked entry's publicKeyHash must actually be the SHA-256 SPKI-DER
// hash of the real compromised key material, not an arbitrary string --
// otherwise this vector would not demonstrate anything about hash-based
// matching.
const revokedPrivateKey = privateKeyFromSeed(revocation.revokedKey.seedHex);
const revokedPublicKey = createPublicKey(revokedPrivateKey);
const revokedSpkiDer = revokedPublicKey.export({ format: "der", type: "spki" });
if (revokedSpkiDer.subarray(-32).toString("hex") !== revocation.revokedKey.publicKeyRawHex) {
  throw new Error("revocation-01 revoked key does not match its seed");
}
const revokedPublicKeyHash = unpaddedBase64(createHash("sha256").update(revokedSpkiDer).digest());
if (revokedPublicKeyHash !== revocation.revokedKey.publicKeyHash) {
  throw new Error("revocation-01 revokedKey.publicKeyHash does not match its own seed");
}
const revokedEntry = revocation.document.revocations.find((e) => e.status === "revoked");
if (!revokedEntry || revokedEntry.publicKeyHash !== revocation.revokedKey.publicKeyHash) {
  throw new Error("revocation-01 revoked entry's publicKeyHash does not match revokedKey");
}

// Spec §9.7/§9.6: `revoked` is matched by publicKeyHash against the
// resolved key's own SPKI hash, not by the keyid string, and a `revoked`
// match anywhere in the array wins over a `superseded` match for the same
// key regardless of order (§9.6's duplicate-entry precedence rule). This
// scans every entry rather than deduping into a Map keyed by `keyid`: a
// Map would silently let a later duplicate-keyid entry overwrite an
// earlier one, which is exactly the fail-open bug §9.6 now forbids.
function resolveRevocationEntries(entries, resolvedPublicKeyHash) {
  for (const entry of entries) {
    if (entry.status === "revoked" && entry.publicKeyHash && entry.publicKeyHash === resolvedPublicKeyHash) {
      return { status: "revoked", entry };
    }
  }
  return { status: "not-revoked", entry: undefined };
}

const revocationByHash = new Map();
for (const entry of revocation.document.revocations) {
  if (entry.status === "revoked" && entry.publicKeyHash) {
    if (!revocationByHash.has(entry.publicKeyHash)) revocationByHash.set(entry.publicKeyHash, []);
    revocationByHash.get(entry.publicKeyHash).push(entry);
  }
}
for (const check of revocation.revocationChecks) {
  const hashMatches = check.resolvedPublicKeyHash ? revocationByHash.get(check.resolvedPublicKeyHash) : undefined;
  const status = hashMatches && hashMatches.length > 0 ? "revoked" : "not-revoked";
  if (status !== check.expected) {
    throw new Error(`revocation-01 status mismatch for ${check.keyid}`);
  }
  // superseded lookup: keyid-based, since no matching-key entry exists for
  // these fictional identities' superseded case.
  const keyidMatches = revocation.document.revocations.filter((e) => e.keyid === check.keyid);
  const supersededEntry = status === "not-revoked" ? keyidMatches.find((e) => e.status === "superseded") : undefined;
  const superseded = Boolean(supersededEntry);
  if (Boolean(check.superseded) !== superseded) {
    throw new Error(`revocation-01 superseded mismatch for ${check.keyid}`);
  }
  if (superseded && supersededEntry.supersededBy !== check.supersededBy) {
    throw new Error(`revocation-01 supersededBy mismatch for ${check.keyid}`);
  }
}

// Spec §9.6: a "revoked" entry MUST win over a "superseded" entry for the
// same key, regardless of array order -- checked here with a synthetic
// pair of entries sharing the target's publicKeyHash, superseded listed
// first, to prove the checker (and by extension the matching rule it
// mirrors) does not depend on array order.
{
  const targetHash = revocation.revokedKey.publicKeyHash;
  const synthetic = [
    { keyid: "https://keys.example/order-test.json", status: "superseded", supersededBy: "https://keys.example/newer.json", publicKeyHash: targetHash },
    { keyid: "https://keys.example/order-test.json", status: "revoked", publicKeyHash: targetHash },
  ];
  const result = resolveRevocationEntries(synthetic, targetHash);
  if (result.status !== "revoked") {
    throw new Error("duplicate-entry precedence: a revoked entry must win regardless of array order");
  }
}

// revocation-03.json: cross-origin signer rejection.
const revocationCrossOrigin = load("revocation-03.json");
{
  const { signature: crossOriginSignature, ...unsignedCrossOrigin } = revocationCrossOrigin.document;
  const crossOriginJcs = canonicalizeJcs(unsignedCrossOrigin);
  if (crossOriginJcs !== revocationCrossOrigin.jcsWithoutSignature) {
    throw new Error("revocation-03 JCS serialization does not match");
  }
  const hostilePrivateKey = privateKeyFromSeed(revocationCrossOrigin.key.seedHex);
  const hostilePublicKey = createPublicKey(hostilePrivateKey);
  if (hostilePublicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex") !== revocationCrossOrigin.key.publicKeyRawHex) {
    throw new Error("revocation-03 key does not match its seed");
  }
  // The signature genuinely verifies -- that is the point of this vector:
  // a valid signature is not sufficient when the signer is hosted at a
  // different origin than the list itself.
  if (!verify(null, Buffer.from(crossOriginJcs, "utf8"), hostilePublicKey, Buffer.from(crossOriginSignature, "base64"))) {
    throw new Error("revocation-03 signature does not verify (it must, to demonstrate origin rejection catches what signature checking alone would not)");
  }
  const signerOrigin = new URL(revocationCrossOrigin.document.signer).origin;
  if (signerOrigin === revocationCrossOrigin.listServedFromOrigin) {
    throw new Error("revocation-03 signer origin must differ from the list's serving origin to demonstrate the rejection");
  }
}

// revocation-04.json: cross-host identifier binding (kid/id equality).
const revocationHostAlias = load("revocation-04.json");
{
  if (revocationHostAlias.keyDocument.kid !== revocationHostAlias.canonicalKeyid) {
    throw new Error("revocation-04 keyDocument.kid must equal canonicalKeyid");
  }
  const canonicalOrigin = new URL(revocationHostAlias.canonicalKeyid).origin;
  for (const alias of revocationHostAlias.crossHostAliasKeyids) {
    if (alias === revocationHostAlias.canonicalKeyid) {
      throw new Error(`revocation-04 alias ${alias} must differ textually from canonicalKeyid`);
    }
    const aliasOrigin = new URL(alias).origin;
    if (aliasOrigin === canonicalOrigin) {
      throw new Error(`revocation-04 alias ${alias} must be a genuinely different origin, not a within-origin alias (that case is revocation-02)`);
    }
    // The alias keyid must not equal the key document's own kid: this is
    // exactly the mismatch that makes resolution fail.
    if (alias === revocationHostAlias.keyDocument.kid) {
      throw new Error(`revocation-04 alias ${alias} must not equal the key document's kid`);
    }
  }
  const { canonical: didCanonical, alias: didAlias } = revocationHostAlias.didWebHostVariant;
  if (didCanonical === didAlias) {
    throw new Error("revocation-04 did:web host variant must differ textually from the canonical form");
  }
  if (didCanonical.toLowerCase() !== didAlias.toLowerCase()) {
    throw new Error("revocation-04 did:web host variant does not collapse under lowercasing (so would not even share a DID document)");
  }
}

// Malformed-entry and extensibility synthetic checks (§9.6): a document
// containing one malformed entry alongside otherwise well-formed ones must
// be rejected as a whole, while an entry carrying only an unrecognized
// extra field remains well-formed.
function isWellFormedRevocationEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (typeof entry.keyid !== "string" || entry.keyid === "") return false;
  if (entry.status !== "revoked" && entry.status !== "superseded") return false;
  if (entry.publicKeyHash !== undefined && typeof entry.publicKeyHash !== "string") return false;
  if (entry.revokedAt !== undefined && typeof entry.revokedAt !== "string") return false;
  if (entry.supersededBy !== undefined && typeof entry.supersededBy !== "string") return false;
  return true;
}
{
  const withMalformedEntry = [
    { keyid: "https://keys.example/ok.json", status: "revoked" },
    { keyid: "https://keys.example/bad.json", status: "not-a-real-status" },
  ];
  if (withMalformedEntry.every(isWellFormedRevocationEntry)) {
    throw new Error("malformed-entry check: the synthetic bad entry should not have validated as well-formed");
  }
  const withUnknownField = [
    { keyid: "https://keys.example/ok.json", status: "revoked", fromPeriod: 3 },
  ];
  if (!withUnknownField.every(isWellFormedRevocationEntry)) {
    throw new Error("extensibility check: an entry with only an unrecognized extra field must remain well-formed");
  }
}

// revocation-02.json: alias immunity. These assertions are the machine-
// checked form of the worked example in the IETF draft's "Revocation list
// keyid-alias immunity" appendix.
const revocationAlias = load("revocation-02.json");
const canonicalUrl = new URL(revocationAlias.canonicalKeyid);
for (const alias of revocationAlias.urlAliasesResolvingToSameOrigin) {
  if (alias === revocationAlias.canonicalKeyid) {
    throw new Error(`revocation-02 alias ${alias} must differ textually from canonicalKeyid`);
  }
  if (new URL(alias).href !== canonicalUrl.href) {
    throw new Error(`revocation-02 alias ${alias} does not resolve to the canonical keyid's origin`);
  }
}
for (const forbidden of revocationAlias.keyidFormsForbiddenBySection5_1) {
  if (!/[?#]/.test(forbidden)) {
    throw new Error(`revocation-02 forbidden form ${forbidden} does not contain a query or fragment`);
  }
}
const { canonical: didCanonical, alias: didAlias } = revocationAlias.didWebCaseVariant;
if (didCanonical === didAlias) {
  throw new Error("revocation-02 did:web case variant must differ textually from the canonical form");
}
if (didCanonical.toLowerCase() !== didAlias.toLowerCase()) {
  throw new Error("revocation-02 did:web case variant does not collapse under lowercasing");
}

const escapeClaimToken = (value) => value
  .replaceAll("\\", "\\\\")
  .replaceAll(":", "\\:")
  .replaceAll("\n", "\\n");

const claims = load("claims-escaping.json");
const canonicalClaims = Object.entries(claims.claims)
  .sort(([left], [right]) => Buffer.from(left).compare(Buffer.from(right)))
  .map(([name, content]) => `${escapeClaimToken(name)}:${escapeClaimToken(content)}\n`)
  .join("");
if (canonicalClaims !== claims.canonicalClaims) {
  throw new Error("claims-escaping canonical output does not match");
}

for (const testCase of load("origin-serialization.json").cases) {
  const origin = new URL(testCase.inputURL).origin;
  if ("origin" in testCase && origin !== testCase.origin) {
    throw new Error(`origin serialization does not match for ${testCase.inputURL}`);
  }
  if ("failure" in testCase && origin !== "null") {
    throw new Error(`opaque origin was accepted for ${testCase.inputURL}`);
  }
}

const strictTimestamp = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
};

const deriveLocation = (documentURL, scope) => {
  if (scope !== "url" && scope !== "origin") {
    throw new Error("scope-unsupported");
  }
  let url;
  try {
    url = new URL(documentURL);
  } catch {
    throw new Error("origin-not-supported");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.origin === "null") {
    throw new Error("origin-not-supported");
  }
  if (scope === "origin") return url.origin;
  url.hash = "";
  return url.href;
};

const safeUrl = (value, baseURL) => {
  if (/[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error("url-policy-violation");
  }
  let url;
  try {
    url = new URL(value, baseURL);
  } catch {
    throw new Error("attribute-canonicalization-failed");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("url-policy-violation");
  }
  return url.href;
};

const signing = load("signing-profile-v1.json");
for (const [name, expected] of Object.entries(SIGNING_V1)) {
  if (signing.profile[name] !== expected) {
    throw new Error(`signing-profile-v1 ${name} constant does not match v1`);
  }
}
if (signing.input.attributes.profile !== SIGNING_V1.signature) {
  throw new Error("signing-profile-v1 wire profile does not match v1");
}
if (signing.input.attributes.algorithm !== "ed25519") {
  throw new Error("signing-profile-v1 vector requires ed25519");
}
if (!strictTimestamp(signing.input.signedAt)) {
  throw new Error("signing-profile-v1 primary timestamp is invalid");
}
if (serializeNormalizedClaims(signing.input.normalizedClaims)
    !== signing.input.canonicalClaims) {
  throw new Error("signing-profile-v1 normalized claims do not match canonical claims");
}
const signedAtClaims = signing.input.normalizedClaims
  .filter(({ name }) => name === "signed-at");
if (signedAtClaims.length !== 1 || signedAtClaims[0].content !== signing.input.signedAt) {
  throw new Error("signing-profile-v1 signed-at bindings differ");
}

const parsedContentHash = parsePrefixedHash(signing.input.attributes["content-hash"]);
const parsedClaimsHash = parsePrefixedHash(signing.claimsHash);
if (parsedContentHash.algorithm !== parsedClaimsHash.algorithm) {
  throw new Error("signing-profile-v1 content and claims algorithms differ");
}
const signingContentDigest = unpaddedBase64(
  createHash(parsedContentHash.algorithm).update(signing.input.canonicalContent, "utf8").digest(),
);
if (`${parsedContentHash.algorithm}:${signingContentDigest}`
    !== signing.input.attributes["content-hash"]) {
  throw new Error("signing-profile-v1 content hash does not match");
}
const signingClaimsDigest = unpaddedBase64(
  createHash(parsedClaimsHash.algorithm).update(signing.input.canonicalClaims, "utf8").digest(),
);
if (`${parsedClaimsHash.algorithm}:${signingClaimsDigest}` !== signing.claimsHash) {
  throw new Error("signing-profile-v1 claims hash does not match");
}

const builtSigningObject = {
  algorithm: signing.input.attributes.algorithm,
  attributeProfile: SIGNING_V1.attributes,
  canonicalizationProfile: SIGNING_V1.canonicalization,
  claimsHash: signing.claimsHash,
  contentHash: signing.input.attributes["content-hash"],
  context: SIGNING_V1.context,
  keyid: signing.input.attributes.keyid,
  location: deriveLocation(
    signing.input.documentURL,
    signing.input.attributes["signature-scope"],
  ),
  profile: SIGNING_V1.signature,
  scope: signing.input.attributes["signature-scope"],
  signedAt: signing.input.signedAt,
  urlProfile: SIGNING_V1.url,
};
if (canonicalizeJcs(builtSigningObject) !== canonicalizeJcs(signing.signingObject)) {
  throw new Error("signing-profile-v1 constructed object does not match");
}
const signingJcs = canonicalizeJcs(builtSigningObject);
if (signingJcs !== signing.jcs) {
  throw new Error("signing-profile-v1 JCS serialization does not match");
}
const signingPrivateKey = privateKeyFromSeed(signing.key.seedHex);
const signingPublicKey = createPublicKey(signingPrivateKey);
if (signingPublicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex")
    !== signing.key.publicKeyRawHex) {
  throw new Error("signing-profile-v1 public key does not match the seed");
}
const signingSignature = parseEd25519Signature(signing.signature);
if (!verify(
  null,
  Buffer.from(signingJcs, "utf8"),
  signingPublicKey,
  signingSignature,
)) {
  throw new Error("signing-profile-v1 signature does not verify");
}
for (const field of signing.tamperFields) {
  if (!(field in builtSigningObject)) {
    throw new Error(`signing-profile-v1 unknown tamper field ${field}`);
  }
  const tampered = { ...builtSigningObject, [field]: `${builtSigningObject[field]}-tampered` };
  if (verify(
    null,
    Buffer.from(canonicalizeJcs(tampered), "utf8"),
    signingPublicKey,
    signingSignature,
  )) {
    throw new Error(`signing-profile-v1 did not bind ${field}`);
  }
}

for (const testCase of signing.signatureCases) {
  try {
    const candidate = parseEd25519Signature(testCase.value);
    if (!verify(null, Buffer.from(signingJcs, "utf8"), signingPublicKey, candidate)) {
      throw new Error("signature-invalid");
    }
    if (!testCase.valid) throw new Error("unexpected valid signature");
  } catch (error) {
    if (!testCase.failure || error.message !== testCase.failure) throw error;
  }
}

for (const testCase of signing.locationCases) {
  try {
    const location = deriveLocation(testCase.documentURL, testCase.scope);
    if (testCase.failure || location !== testCase.location) {
      throw new Error(`unexpected location result for ${testCase.documentURL}`);
    }
  } catch (error) {
    if (!testCase.failure || error.message !== testCase.failure) throw error;
  }
}

for (const testCase of signing.timestampCases) {
  const valid = strictTimestamp(testCase.value);
  if (valid !== Boolean(testCase.valid)) {
    throw new Error(`unexpected timestamp result for ${testCase.value}`);
  }
}

for (const testCase of signing.urlPolicyCases) {
  try {
    const url = safeUrl(testCase.value, testCase.baseURL);
    if (testCase.failure || url !== testCase.url) {
      throw new Error(`unexpected URL-policy result for ${testCase.value}`);
    }
  } catch (error) {
    if (!testCase.failure || error.message !== testCase.failure) throw error;
  }
}

// period-keys-v1.json: HKDF-SHA-256 period-key derivation (draft Section
// 9.10). Every intermediate value in the vector is recomputed here.
const periodKeys = load("period-keys-v1.json");
{
  const master = Buffer.from(periodKeys.masterHex, "hex");
  if (master.length !== 32) throw new Error("period-keys-v1 master must be 32 bytes");
  const salt = Buffer.from(periodKeys.salt, "utf8");
  if (periodKeys.salt !== "htmltrust-period-key-v1") throw new Error("period-keys-v1 salt constant");
  const prk = createHmac("sha256", salt).update(master).digest();
  if (prk.toString("hex") !== periodKeys.prkHex) throw new Error("period-keys-v1 PRK does not match");
  for (const entry of periodKeys.periods) {
    const n = entry.period;
    if (!Number.isInteger(n) || n < 1 || n > 2147483647) throw new Error(`period-keys-v1 bad index ${n}`);
    const info = Buffer.concat([
      Buffer.from("ed25519", "utf8"), Buffer.from([0]),
      Buffer.from(periodKeys.identity, "utf8"), Buffer.from([0]),
      Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]),
    ]);
    if (info.toString("hex") !== entry.infoHex) throw new Error(`period-keys-v1 info mismatch for period ${n}`);
    const seed = Buffer.from(hkdfSync("sha256", master, salt, info, 32));
    if (seed.toString("hex") !== entry.seedHex) throw new Error(`period-keys-v1 seed mismatch for period ${n}`);
    const priv = privateKeyFromSeed(entry.seedHex);
    const pub = createPublicKey(priv);
    const spki = pub.export({ format: "der", type: "spki" });
    if (unpaddedBase64(spki) !== entry.publicKeySpkiBase64) throw new Error(`period-keys-v1 SPKI mismatch for period ${n}`);
    if (spki.subarray(-32).toString("hex") !== entry.publicKeyRawHex) throw new Error(`period-keys-v1 raw public key mismatch for period ${n}`);
    if (unpaddedBase64(priv.export({ format: "der", type: "pkcs8" })) !== entry.privateKeyPkcs8Base64) throw new Error(`period-keys-v1 PKCS#8 mismatch for period ${n}`);
    if (unpaddedBase64(createHash("sha256").update(spki).digest()) !== entry.publicKeyHash) throw new Error(`period-keys-v1 publicKeyHash mismatch for period ${n}`);
    if (entry.publicKeyPem !== `-----BEGIN PUBLIC KEY-----\n${spki.toString("base64")}\n-----END PUBLIC KEY-----`) throw new Error(`period-keys-v1 PEM mismatch for period ${n}`);
    if (entry.signatureBase64 !== undefined
        && !verify(null, Buffer.from(entry.signatureTestMessage, "utf8"), pub, Buffer.from(entry.signatureBase64, "base64"))) {
      throw new Error(`period-keys-v1 test signature does not verify for period ${n}`);
    }
  }
}

// period-signature-v1.json: a signature under did:web:example.com#p3 and a
// range revocation striking period 2, signed by the anchor (draft Section
// 9.10 and the appendix vector).
const periodSig = load("period-signature-v1.json");
{
  const doc = periodSig.didDocument;
  if (doc.id !== periodSig.identity) throw new Error("period-signature-v1 DID document id must equal the identity");
  const methods = new Map();
  for (const m of doc.verificationMethod) {
    const id = m.id.startsWith("#") ? `${doc.id}${m.id}` : m.id;
    if (methods.has(id)) throw new Error(`period-signature-v1 duplicate method id ${id}`);
    if (!id.startsWith(`${doc.id}#`)) throw new Error(`period-signature-v1 method ${id} is not under the identity`);
    if ("expires" in m) throw new Error("period-signature-v1 period identities never carry expires");
    methods.set(id, m);
  }
  // Ordering rule: anchors first, then period methods in ascending index order.
  const isPeriod = (id) => /^p([1-9][0-9]{0,9})$/.test(id.split("#")[1] ?? "");
  let seenPeriod = false;
  let lastIndex = 0;
  for (const id of methods.keys()) {
    if (isPeriod(id)) {
      seenPeriod = true;
      const index = Number(id.split("#p")[1]);
      if (index <= lastIndex) throw new Error("period-signature-v1 period methods must ascend");
      lastIndex = index;
    } else if (seenPeriod) {
      throw new Error("period-signature-v1 anchor methods must precede period methods");
    }
  }
  const listed = doc.assertionMethod.filter((id) => isPeriod(id));
  const present = [...methods.keys()].filter((id) => isPeriod(id));
  if (listed.join(",") !== present.join(",")) throw new Error("period-signature-v1 assertionMethod must list every period method in order");
  const pubOf = (id) => createPublicKey(methods.get(id).publicKeyPem);
  const spkiOf = (id) => pubOf(id).export({ format: "der", type: "spki" });
  const hashOf = (id) => unpaddedBase64(createHash("sha256").update(spkiOf(id)).digest());
  // Period keys are the derivation vector; the anchor is the signing-profile test key.
  for (const entry of periodKeys.periods) {
    const id = `${doc.id}#p${entry.period}`;
    if (!methods.has(id)) throw new Error(`period-signature-v1 missing method ${id}`);
    if (unpaddedBase64(spkiOf(id)) !== entry.publicKeySpkiBase64) throw new Error(`period-signature-v1 ${id} is not the derived key`);
  }
  const anchorSpki = spkiOf(`${doc.id}#key-1`);
  if (!anchorSpki.equals(createPublicKey(privateKeyFromSeed(signing.key.seedHex)).export({ format: "der", type: "spki" }))) {
    throw new Error("period-signature-v1 anchor #key-1 must be the signing-profile test key");
  }
  // The signing object differs from the signing-profile vector only in keyid.
  const expectedObject = { ...signing.signingObject, keyid: `${doc.id}#p3` };
  if (canonicalizeJcs(expectedObject) !== periodSig.jcsPayload || canonicalizeJcs(periodSig.signingObject) !== periodSig.jcsPayload) {
    throw new Error("period-signature-v1 signing payload does not match");
  }
  const payload = Buffer.from(periodSig.jcsPayload, "utf8");
  if (!verify(null, payload, pubOf(`${doc.id}#p3`), Buffer.from(periodSig.signature, "base64"))) {
    throw new Error("period-signature-v1 signature does not verify under #p3");
  }
  const mislabelled = Buffer.from(periodSig.signatureFromPeriod2Mislabelled, "base64");
  if (verify(null, payload, pubOf(`${doc.id}#p3`), mislabelled)) throw new Error("period-signature-v1 mislabelled signature must not verify under #p3");
  if (!verify(null, payload, pubOf(`${doc.id}#p2`), mislabelled)) throw new Error("period-signature-v1 mislabelled signature must be a genuine #p2 signature");
  // The range list.
  const list = periodSig.revocationList;
  const { signature: listSignature, ...unsignedList } = list;
  if (canonicalizeJcs(unsignedList) !== periodSig.revocationListJcsInput) throw new Error("period-signature-v1 list JCS does not match");
  if (isPeriod(list.signer)) throw new Error("period-signature-v1 list signer must be an anchor");
  if (!verify(null, Buffer.from(periodSig.revocationListJcsInput, "utf8"), pubOf(list.signer), Buffer.from(listSignature, "base64"))) {
    throw new Error("period-signature-v1 list signature does not verify under the anchor");
  }
  if (list.revocations.length !== 1) throw new Error("period-signature-v1 expects exactly one entry");
  const entry = list.revocations[0];
  if (entry.status !== "revoked" || entry.keyid !== `${doc.id}#p2`) throw new Error("period-signature-v1 entry shape");
  if (entry.publicKeyHash !== hashOf(`${doc.id}#p2`) || entry.publicKeyHash !== periodSig.publicKeyHash.p2) throw new Error("period-signature-v1 entry publicKeyHash must be #p2's");
  if (Buffer.from(entry.publicKeyHash, "base64").length !== 32) throw new Error("period-signature-v1 publicKeyHash must decode to 32 bytes");
  if (periodSig.publicKeyHash.p3 !== hashOf(`${doc.id}#p3`)) throw new Error("period-signature-v1 recorded #p3 hash mismatch");
  if (entry.publicKeyHash === hashOf(`${doc.id}#p3`)) throw new Error("period-signature-v1 the entry must not match #p3 by material");
  const wellFormedRange = Number.isInteger(entry["from-period"]) && entry["from-period"] >= 1
    && (entry["to-period"] === undefined || (Number.isInteger(entry["to-period"]) && entry["to-period"] > entry["from-period"]));
  if (!wellFormedRange) throw new Error("period-signature-v1 range members malformed");
  const rangeApplies = (period) => entry["from-period"] <= period && (entry["to-period"] === undefined || period < entry["to-period"]);
  if (!rangeApplies(2) || rangeApplies(1) || rangeApplies(3) || rangeApplies(0)) throw new Error("period-signature-v1 range must strike exactly period 2");
  // Every case in the vector is run through a small verifier under the
  // selection rule the case names: "section-9.10" (exact id, first
  // non-period entry for a bare keyid, range revocation), "section-8.1-exact"
  // (exact id, no range evaluation, no keyPeriod), or "legacy-first-usable"
  // (the selection rule of earlier revisions: first entry in array order
  // with usable material, skipping revoked or expired entries).
  const listEntries = list.revocations;
  const rangeStrikes = (identity, period) => listEntries.some((e) =>
    e.status === "revoked" && Number.isInteger(e["from-period"]) && e["from-period"] >= 1
    && identityOf(e) === identity && e["from-period"] <= period
    && (e["to-period"] === undefined || period < e["to-period"]));
  const identityOf = (e) => (e.keyid.startsWith("did:") ? e.keyid.split("#")[0] : e.identity);
  const materialStrikes = (spkiHash) => listEntries.some((e) => e.status === "revoked" && e.publicKeyHash === spkiHash);
  const parseKeyid = (keyid) => {
    const hash = keyid.indexOf("#");
    if (hash === -1) return { d: keyid, f: null, kind: "bare", period: 0 };
    const f = keyid.slice(hash + 1);
    const m = /^p([1-9][0-9]{0,9})$/.exec(f);
    if (m && Number(m[1]) <= 2147483647) return { d: keyid.slice(0, hash), f, kind: "period", period: Number(m[1]) };
    return { d: keyid.slice(0, hash), f, kind: "anchor", period: 0 };
  };
  const usable = (m) => typeof m.publicKeyPem === "string" && m.revoked !== true && m.expires === undefined;
  const select = (rule, keyid) => {
    const parsed = parseKeyid(keyid);
    if (rule === "legacy-first-usable") {
      const first = doc.verificationMethod.find(usable);
      return first ? { method: first, id: first.id, ...parsed } : null;
    }
    if (parsed.kind === "bare") {
      const first = [...methods.entries()].find(([id]) => !isPeriod(id));
      return first ? { method: first[1], id: first[0], ...parsed } : null;
    }
    const method = methods.get(keyid);
    return method ? { method, id: keyid, ...parsed } : null;
  };
  const run = (c) => {
    const selected = select(c.selection, c.keyid);
    if (!selected) return { result: "key-resolution-failed" };
    const key = createPublicKey(selected.method.publicKeyPem);
    if (c.selection === "section-9.10") {
      const spkiHash = unpaddedBase64(createHash("sha256").update(key.export({ format: "der", type: "spki" })).digest());
      if (selected.method.revoked === true || materialStrikes(spkiHash) || rangeStrikes(selected.d, selected.period)) {
        return { result: "key-revoked", revocationStatus: "revoked" };
      }
    }
    const casePayload = Buffer.from(canonicalizeJcs({ ...signing.signingObject, keyid: c.keyid }), "utf8");
    if (!verify(null, casePayload, key, Buffer.from(c.signature, "base64"))) return { result: "signature-invalid" };
    const out = { result: "valid" };
    if (c.selection === "section-9.10") { out.keyPeriod = selected.period; out.revocationStatus = "not-revoked"; }
    return out;
  };
  if (!Array.isArray(periodSig.cases) || periodSig.cases.length < 9) throw new Error("period-signature-v1 must carry the nine cases");
  for (const c of periodSig.cases) {
    const got = run(c);
    for (const field of ["result", "keyPeriod", "revocationStatus"]) {
      if (c[field] !== undefined && got[field] !== c[field]) {
        throw new Error(`period-signature-v1 case ${c.case}: ${field} expected ${c[field]}, got ${got[field]}`);
      }
      if (c[field] === undefined && field === "keyPeriod" && got[field] !== undefined && c.selection !== "section-9.10") {
        throw new Error(`period-signature-v1 case ${c.case}: keyPeriod must be absent under ${c.selection}`);
      }
    }
  }
  if (!methods.has(`${doc.id}#p4`) === false) throw new Error("period-signature-v1 #p4 must be unpublished");
  for (const [keyid, signature] of Object.entries(periodSig.signaturesByKeyid)) {
    const parsed = parseKeyid(keyid);
    const signer = parsed.kind === "bare"
      ? createPublicKey(privateKeyFromSeed(signing.key.seedHex))
      : createPublicKey(privateKeyFromSeed(periodKeys.periods.find((e) => e.period === parsed.period)?.seedHex
          ?? Buffer.from(hkdfSync("sha256", Buffer.from(periodKeys.masterHex, "hex"), Buffer.from(periodKeys.salt, "utf8"),
            Buffer.concat([Buffer.from("ed25519"), Buffer.from([0]), Buffer.from(periodKeys.identity, "utf8"), Buffer.from([0]), Buffer.from([0, 0, 0, parsed.period])]), 32)).toString("hex")));
    const casePayload = Buffer.from(canonicalizeJcs({ ...signing.signingObject, keyid }), "utf8");
    if (!verify(null, casePayload, signer, Buffer.from(signature, "base64"))) throw new Error(`period-signature-v1 signaturesByKeyid[${keyid}] does not verify under its own key`);
  }
}
