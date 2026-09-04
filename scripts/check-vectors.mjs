import {
  createHash,
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

// Spec §9.7: `revoked` is matched by publicKeyHash against the resolved
// key's own SPKI hash, not by the keyid string. `superseded` is matched by
// keyid (no alternate key material exists for the fictional identities in
// this vector, so the keyid form is exercised here; alias immunity for the
// hash-based match is exercised in revocation-02.json instead).
const revocationByKeyid = new Map(
  revocation.document.revocations.map((entry) => [entry.keyid, entry]),
);
const revocationByHash = new Map(
  revocation.document.revocations
    .filter((e) => e.status === "revoked" && e.publicKeyHash)
    .map((e) => [e.publicKeyHash, e]),
);
for (const check of revocation.revocationChecks) {
  const hashMatch = check.resolvedPublicKeyHash ? revocationByHash.get(check.resolvedPublicKeyHash) : undefined;
  const keyidMatch = revocationByKeyid.get(check.keyid);
  const status = hashMatch ? "revoked" : "not-revoked";
  if (status !== check.expected) {
    throw new Error(`revocation-01 status mismatch for ${check.keyid}`);
  }
  const superseded = !hashMatch && keyidMatch?.status === "superseded";
  if (Boolean(check.superseded) !== superseded) {
    throw new Error(`revocation-01 superseded mismatch for ${check.keyid}`);
  }
  if (superseded && keyidMatch.supersededBy !== check.supersededBy) {
    throw new Error(`revocation-01 supersededBy mismatch for ${check.keyid}`);
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
