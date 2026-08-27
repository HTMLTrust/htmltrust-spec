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

const endorsement = load("endorsement-01.json");
const payload = Buffer.from(endorsement.jcsWithoutSignature, "utf8");
const digest = createHash("sha256").update(payload).digest("base64").replace(/=+$/, "");
if (`sha256:${digest}` !== endorsement.jcsSha256) {
  throw new Error("endorsement-01 JCS hash does not match");
}

const seed = Buffer.from(endorsement.key.seedHex, "hex");
const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
const privateKey = createPrivateKey({
  key: Buffer.concat([pkcs8Prefix, seed]),
  format: "der",
  type: "pkcs8",
});
const publicKey = createPublicKey(privateKey);
const publicKeyRaw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
if (publicKeyRaw.toString("hex") !== endorsement.key.publicKeyRawHex) {
  throw new Error("endorsement-01 public key does not match the seed");
}
if (!verify(
  null,
  payload,
  publicKey,
  Buffer.from(endorsement.document.signature, "base64"),
)) {
  throw new Error("endorsement-01 signature does not verify");
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
