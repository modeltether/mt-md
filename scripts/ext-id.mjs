import { createHash } from "node:crypto"

// The Chrome extension id from the manifest "key": sha256 of the DER public key, first 16 bytes, written in a-p.
export function extensionId(key) {
  return [...createHash("sha256").update(Buffer.from(key, "base64")).digest().subarray(0, 16)]
    .map((b) => String.fromCharCode(97 + (b >> 4)) + String.fromCharCode(97 + (b & 15)))
    .join("")
}
