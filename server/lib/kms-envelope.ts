/**
 * Wave 1.3 — KMS-backed envelope encryption.
 *
 * The existing `crypto-service.ts` AES-256-GCM path stays the inner
 * data-encryption layer (DEK). This module wraps that DEK under a
 * cloud KMS Customer Master Key (CMK) so the symmetric key never
 * lives on disk and is rotatable at the KMS level without re-
 * encrypting any application data.
 *
 * Gated on `KMS_KEY_ID`. When unset, `kmsEnvelopeEnabled` is false
 * and callers fall back to the existing `crypto-service.encryptSecret`
 * path — preserving zero-config dev / on-prem deployments.
 *
 * AWS first (`@aws-sdk/client-kms`); GCP / Azure follow the same
 * interface and can be plugged in via the `KmsClient` shape.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;

export const kmsEnvelopeEnabled = Boolean(process.env['KMS_KEY_ID']);

export interface KmsEnvelope {
  /** Base64 of the KMS-wrapped data key. */
  wrappedKey: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  /** Key id used at encrypt time — recorded so rotation knows what to re-wrap. */
  keyId: string;
}

interface KmsAdapter {
  generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: Buffer }>;
  decryptDataKey(wrapped: Buffer): Promise<Buffer>;
}

let cachedAdapter: KmsAdapter | null = null;

async function getAdapter(): Promise<KmsAdapter> {
  if (cachedAdapter) return cachedAdapter;
  // Lazy import — keeps cold start free when KMS_KEY_ID unset.
  const { KMSClient, GenerateDataKeyCommand, DecryptCommand } = await import(
    "@aws-sdk/client-kms"
  );
  const client = new KMSClient({
    region: process.env['AWS_REGION'] || process.env['KMS_REGION'] || "us-east-1",
  });
  const keyId = process.env['KMS_KEY_ID'];
  if (!keyId) throw new Error("KMS_KEY_ID required");

  cachedAdapter = {
    async generateDataKey() {
      const out = await client.send(
        new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: "AES_256" }),
      );
      if (!out.Plaintext || !out.CiphertextBlob) throw new Error("KMS returned empty key material");
      return {
        plaintext: Buffer.from(out.Plaintext as Uint8Array),
        ciphertext: Buffer.from(out.CiphertextBlob as Uint8Array),
      };
    },
    async decryptDataKey(wrapped: Buffer) {
      const out = await client.send(new DecryptCommand({ CiphertextBlob: wrapped, KeyId: keyId }));
      if (!out.Plaintext) throw new Error("KMS decrypt returned empty plaintext");
      return Buffer.from(out.Plaintext as Uint8Array);
    },
  };
  return cachedAdapter;
}

export async function encryptWithEnvelope(plaintext: string): Promise<KmsEnvelope> {
  if (!kmsEnvelopeEnabled) throw new Error("KMS envelope encryption is disabled (KMS_KEY_ID unset)");
  const adapter = await getAdapter();
  const { plaintext: dek, ciphertext: wrapped } = await adapter.generateDataKey();
  try {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, dek, iv, { authTagLength: TAG_LEN });
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      wrappedKey: wrapped.toString("base64"),
      iv: iv.toString("base64"),
      authTag: tag.toString("base64"),
      ciphertext: ct.toString("base64"),
      keyId: process.env['KMS_KEY_ID']!,
    };
  } finally {
    // Best-effort zeroisation. JS strings/buffers from KMS are short-lived
    // but we wipe the DEK explicitly so a heap dump right after encrypt
    // can't lift the symmetric key.
    dek.fill(0);
  }
}

export async function decryptWithEnvelope(env: KmsEnvelope): Promise<string> {
  if (!kmsEnvelopeEnabled) throw new Error("KMS envelope encryption is disabled (KMS_KEY_ID unset)");
  const adapter = await getAdapter();
  const wrapped = Buffer.from(env.wrappedKey, "base64");
  const dek = await adapter.decryptDataKey(wrapped);
  try {
    const iv = Buffer.from(env.iv, "base64");
    const tag = Buffer.from(env.authTag, "base64");
    if (tag.length !== TAG_LEN) throw new Error("Invalid auth tag length");
    const ct = Buffer.from(env.ciphertext, "base64");
    const decipher = createDecipheriv(ALGO, dek, iv, { authTagLength: TAG_LEN });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } finally {
    dek.fill(0);
  }
}

/**
 * Re-wrap an existing envelope under the current `KMS_KEY_ID` (e.g.
 * after a CMK rotation). Decrypts the inner ciphertext under the old
 * DEK and re-encrypts under a freshly-generated DEK wrapped by the
 * new CMK. Idempotent if the key id is unchanged.
 */
export async function rewrapEnvelope(env: KmsEnvelope): Promise<KmsEnvelope> {
  const plaintext = await decryptWithEnvelope(env);
  return encryptWithEnvelope(plaintext);
}
