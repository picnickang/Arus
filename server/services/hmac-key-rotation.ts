import { logger } from "../utils/logger";

const LOG_CTX = "HmacKeyRotation";

interface HmacKeyEntry {
  keyId: string;
  secret: string;
  activatedAt: Date;
  deprecatedAt: Date | null;
  expiresAt: Date | null;
}

class HmacKeyRotationService {
  private keys: HmacKeyEntry[] = [];
  private gracePeriodMs: number;

  constructor(gracePeriodHours = 72) {
    this.gracePeriodMs = gracePeriodHours * 60 * 60 * 1000;
    this.loadKeysFromEnv();
  }

  private loadKeysFromEnv(): void {
    const currentKey = process.env.HMAC_SECRET || process.env.TELEMETRY_HMAC_KEY;
    const previousKey = process.env.HMAC_SECRET_PREVIOUS;

    if (currentKey) {
      this.keys.push({
        keyId: "current",
        secret: currentKey,
        activatedAt: new Date(),
        deprecatedAt: null,
        expiresAt: null,
      });
    }

    if (previousKey) {
      const gracePeriodEnd = new Date(Date.now() + this.gracePeriodMs);
      this.keys.push({
        keyId: "previous",
        secret: previousKey,
        activatedAt: new Date(0),
        deprecatedAt: new Date(),
        expiresAt: gracePeriodEnd,
      });
    }
  }

  async validate(
    payload: string | Buffer,
    signature: string,
    algorithm = "sha256"
  ): Promise<{ valid: boolean; keyId: string | null; isDeprecatedKey: boolean }> {
    const crypto = await import("crypto");
    const now = new Date();

    for (const key of this.keys) {
      if (key.expiresAt && key.expiresAt < now) continue;

      const expected = crypto
        .createHmac(algorithm, key.secret)
        .update(payload)
        .digest("hex");

      const sigBuf = Buffer.from(signature, "hex");
      const expBuf = Buffer.from(expected, "hex");

      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        const isDeprecated = key.deprecatedAt !== null;

        if (isDeprecated) {
          logger.warn(LOG_CTX, `Request validated with deprecated key '${key.keyId}'. Device should rotate.`);
        }

        return { valid: true, keyId: key.keyId, isDeprecatedKey: isDeprecated };
      }
    }

    return { valid: false, keyId: null, isDeprecatedKey: false };
  }

  async rotateKey(newSecret: string): Promise<{ newKeyId: string; gracePeriodEnds: Date }> {
    const now = new Date();
    const gracePeriodEnd = new Date(now.getTime() + this.gracePeriodMs);

    const currentKey = this.keys.find(k => k.keyId === "current");
    if (currentKey) {
      currentKey.keyId = "previous";
      currentKey.deprecatedAt = now;
      currentKey.expiresAt = gracePeriodEnd;
    }

    this.keys = this.keys.filter(k => k.keyId !== "previous" || k === currentKey);

    const newKeyId = `key-${Date.now()}`;
    this.keys.unshift({
      keyId: newKeyId,
      secret: newSecret,
      activatedAt: now,
      deprecatedAt: null,
      expiresAt: null,
    });

    process.env.HMAC_SECRET = newSecret;
    process.env.HMAC_SECRET_PREVIOUS = currentKey?.secret || "";

    logger.info(LOG_CTX, `Key rotated. New: ${newKeyId}, grace period ends: ${gracePeriodEnd.toISOString()}`);

    return { newKeyId, gracePeriodEnds: gracePeriodEnd };
  }

  getCurrentKey(): { keyId: string; activatedAt: Date } | null {
    const current = this.keys.find(k => !k.deprecatedAt);
    if (!current) return null;
    return { keyId: current.keyId, activatedAt: current.activatedAt };
  }

  getStatus(): {
    activeKeys: number;
    deprecatedKeys: number;
    gracePeriodEnds: Date | null;
  } {
    const now = new Date();
    const activeKeys = this.keys.filter(k => !k.deprecatedAt).length;
    const deprecatedKeys = this.keys.filter(k => k.deprecatedAt && (!k.expiresAt || k.expiresAt > now)).length;
    const gracePeriodKey = this.keys.find(k => k.expiresAt && k.expiresAt > now);

    return {
      activeKeys,
      deprecatedKeys,
      gracePeriodEnds: gracePeriodKey?.expiresAt || null,
    };
  }
}

export const hmacKeyRotation = new HmacKeyRotationService();
export default HmacKeyRotationService;
