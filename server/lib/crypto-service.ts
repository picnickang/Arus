/**
 * Crypto Service for ARUS Alert Settings
 *
 * Provides AES-256-GCM encryption/decryption for sensitive credentials
 * like SMTP passwords and API keys stored in the database.
 *
 * Security:
 * - Prefers dedicated ENCRYPTION_KEY env variable (32+ bytes hex)
 * - Falls back to deriving key from SESSION_SECRET via scrypt KDF
 * - Uses per-encryption random IV (16 bytes)
 * - Includes GCM authentication tag for integrity
 * - Only development mode allows weak fallback keys
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from "node:crypto";
import { createLogger } from "./structured-logger";
const logger = createLogger("Lib:CryptoService");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SCRYPT_SALT_PREFIX = "arus-creds-v1-";
const MIN_KEY_STRENGTH = 32;

let encryptionKeyCache: Buffer | null = null;
let keySourceLogged = false;

function getEncryptionKey(): Buffer {
  if (encryptionKeyCache) {
    return encryptionKeyCache;
  }

  const isProduction = process.env["NODE_ENV"] === "production";

  const dedicatedKey = process.env["ENCRYPTION_KEY"];
  if (dedicatedKey) {
    if (dedicatedKey.length < MIN_KEY_STRENGTH) {
      if (isProduction) {
        throw new Error("ENCRYPTION_KEY must be at least 32 characters in production");
      }
      logger.warn("[CryptoService] ENCRYPTION_KEY is weak (< 32 chars) - acceptable for dev only");
    }

    const keyHash = createHash("sha256").update(dedicatedKey).digest();
    encryptionKeyCache = keyHash;

    if (!keySourceLogged) {
      logger.info("[CryptoService] Using dedicated ENCRYPTION_KEY");
      keySourceLogged = true;
    }
    return encryptionKeyCache;
  }

  const sessionSecret = process.env["SESSION_SECRET"];
  if (!sessionSecret) {
    if (isProduction) {
      throw new Error("Either ENCRYPTION_KEY or SESSION_SECRET must be set in production");
    }
    const devKey = Buffer.alloc(32, 0);
    devKey.write("dev-only-encryption-key");
    encryptionKeyCache = devKey;
    logger.warn("[CryptoService] Using development-only encryption key - NOT FOR PRODUCTION");
    return encryptionKeyCache;
  }

  if (sessionSecret.length < MIN_KEY_STRENGTH && isProduction) {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters when used for encryption in production"
    );
  }

  const salt =
    SCRYPT_SALT_PREFIX + createHash("sha256").update(sessionSecret).digest("hex").substring(0, 16);
  encryptionKeyCache = scryptSync(sessionSecret, salt, 32, { N: 16384, r: 8, p: 1 });

  if (!keySourceLogged) {
    logger.info("[CryptoService] Deriving encryption key from SESSION_SECRET via scrypt");
    keySourceLogged = true;
  }

  return encryptionKeyCache;
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) {
    return "";
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  // Pin authTagLength to prevent attacker-controlled short-tag attacks on the
  // decrypt side (GCM forgery resistance is 2^(8 * authTagLength); if the
  // decryptor accepts a 4-byte tag it drops from 2^128 to 2^32).
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptSecret(encryptedValue: string): string {
  if (!encryptedValue) {
    return "";
  }

  const parts = encryptedValue.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format");
  }

  const [ivHex = "", authTagHex = "", encrypted = ""] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  // Reject any tag whose length differs from what we ourselves write. Without
  // this, an attacker with control over the stored ciphertext could supply a
  // shorter (e.g. 4-byte) tag and weaken GCM forgery resistance dramatically.
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid authentication tag length");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function maskSecret(secret: string | null | undefined): string {
  if (!secret) {
    return "";
  }
  if (secret.length <= 4) {
    return "****";
  }
  return `${secret.substring(0, 2)}${"*".repeat(Math.min(secret.length - 4, 8))}${secret.substring(secret.length - 2)}`;
}

export function isEncrypted(value: string): boolean {
  if (!value) {
    return false;
  }
  const parts = value.split(":");
  return parts.length === 3 && (parts[0]?.length ?? 0) === IV_LENGTH * 2;
}

export interface EncryptedCredential {
  encrypted: string;
  masked: string;
}

export function encryptCredential(plaintext: string): EncryptedCredential {
  const encrypted = encryptSecret(plaintext);
  const masked = maskSecret(plaintext);
  return { encrypted, masked };
}
