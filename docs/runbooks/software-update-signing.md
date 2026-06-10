# Runbook — Cutting & signing a software-update package

The patch applicator (`server/services/patch-applicator.ts`) **fails closed**: in production an
update is refused unless `UPDATE_SIGNING_PUBLIC_KEY` is set and the manifest signature verifies
(Ed25519). This runbook produces a signed manifest the applicator will accept.

## 1. One-time: generate the signing keypair

```js
// gen-keys.mjs — run once, store the private key in your secrets manager.
import crypto from "node:crypto";
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const pubDerHex = publicKey.export({ format: "der", type: "spki" }).toString("hex");
const privPem = privateKey.export({ format: "pem", type: "pkcs8" });
console.log("UPDATE_SIGNING_PUBLIC_KEY=", pubDerHex); // → server env
console.log(privPem); // → secrets manager (NEVER commit)
```

Set `UPDATE_SIGNING_PUBLIC_KEY` (the DER/spki **hex**) in the server environment. Keep the PKCS8
private key offline.

## 2. Build the package & compute the manifest

The manifest carries `{ version, fromVersion, changes, checksumSha256, signature }`. The signature
covers a deterministic JSON of the **first four** fields only (must match
`UpdateChecker.verifySignature`):

```js
const message = JSON.stringify({
  version: manifest.version,
  fromVersion: manifest.fromVersion,
  changes: manifest.changes, // the FileChange[] array
  checksumSha256: manifest.checksumSha256, // sha256 of the .tar.gz payload
});
```

`changes[].path` must stay inside the app dir, and the archive must contain only regular files and
directories — symlinks/hardlinks/devices and `../` escapes are rejected by `assertSafeArchive`.

## 3. Sign

```js
import crypto from "node:crypto";
const privateKey = crypto.createPrivateKey(process.env.UPDATE_SIGNING_PRIVATE_PEM);
const signature = crypto.sign(null, Buffer.from(message), privateKey).toString("base64");
manifest.signature = signature; // base64 — store in the manifest
```

## 4. Verify before shipping

Confirm `crypto.verify(null, Buffer.from(message), publicKey, Buffer.from(signature,"base64"))` is
`true` with the **public** key. Ship the manifest + `.tar.gz` together.

## Dev escape hatch

Only outside production: `NODE_ENV!==production` **and** `ALLOW_UNSIGNED_PATCHES=true` lets an
unsigned package apply (logged loudly). Production always enforces.
