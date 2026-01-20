/**
 * Encryption utilities for sensitive data at rest
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET or SESSION_SECRET must be set for encryption');
  }
  return crypto.scryptSync(secret, 'arus-salt', 32);
}

/**
 * Encrypt a plaintext string
 * Returns base64 encoded: iv:tag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  
  return Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]).toString('base64');
}

/**
 * Decrypt an encrypted string
 * Expects base64 encoded: iv:tag:ciphertext
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedData, 'base64');
  
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

/**
 * Generate a secure device token for fleet status reporting
 * Includes org ID for proper multi-tenant isolation
 */
export function generateDeviceToken(deviceId: string, expiresInHours: number = 24 * 365, orgId?: string): string {
  const expiry = Date.now() + (expiresInHours * 60 * 60 * 1000);
  const issuedAt = Date.now();
  const payload = JSON.stringify({ 
    deviceId, 
    orgId: orgId || null,
    iat: issuedAt,
    exp: expiry,
    version: 2,
  });
  return encrypt(payload);
}

/**
 * Verify and decode a device token
 * Returns deviceId and orgId if valid, null if expired, invalid, or legacy token
 * SECURITY: Rejects legacy tokens (version < 2) that don't include orgId
 */
export function verifyDeviceToken(token: string): { deviceId: string; orgId: string } | null {
  try {
    const payload = JSON.parse(decrypt(token));
    
    // Reject expired tokens
    if (payload.exp && payload.exp < Date.now()) {
      console.warn("[DeviceToken] Token expired");
      return null;
    }
    
    // SECURITY: Reject legacy tokens without orgId (version < 2)
    // This prevents cross-tenant impersonation via legacy tokens
    if (!payload.orgId || payload.version < 2) {
      console.warn("[DeviceToken] Legacy token rejected - missing orgId or invalid version", {
        hasOrgId: !!payload.orgId,
        version: payload.version,
        deviceId: payload.deviceId,
      });
      return null;
    }
    
    return { 
      deviceId: payload.deviceId,
      orgId: payload.orgId,
    };
  } catch (error) {
    console.warn("[DeviceToken] Token verification failed:", error);
    return null;
  }
}

/**
 * Hash a value for comparison (one-way)
 */
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Check if a string is encrypted (basic check for base64 format)
 */
export function isEncrypted(value: string): boolean {
  if (!value) { return false; }
  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.length >= IV_LENGTH + TAG_LENGTH;
  } catch {
    return false;
  }
}
