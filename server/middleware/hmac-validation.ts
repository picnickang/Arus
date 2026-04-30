import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Middleware:HmacValidation");
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { dbSystemAdminStorage, dbDevicesStorage } from "../repositories";

const HMAC_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const HMAC_NONCE_TTL_MS = 10 * 60 * 1000;
const seenNonces = new Map<string, number>();

function pruneSeenNonces(now = Date.now()): void {
  for (const [nonce, expiresAt] of seenNonces.entries()) {
    if (expiresAt <= now) {
      seenNonces.delete(nonce);
    }
  }
}

function normalizeSignature(signature: unknown): string | undefined {
  if (typeof signature !== "string") {
    return undefined;
  }
  const normalized = signature.toLowerCase().replace(/^hmac\s+/i, "").replace(/^sha256=/, "");
  return /^[0-9a-f]{64}$/.test(normalized) ? normalized : undefined;
}

function rawPayload(req: Request): string {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (Buffer.isBuffer(rawBody)) {
    return rawBody.toString("utf8");
  }
  return JSON.stringify(req.body ?? {});
}

function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function signaturesMatch(expectedSignature: string, providedSignature: string): boolean {
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const providedBuffer = Buffer.from(providedSignature, "hex");
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function validateReplayHeaders(req: Request, equipmentId: string): { ok: true } | { ok: false; status: number; error: string; code: string } {
  const timestampHeader = req.headers["x-hmac-timestamp"];
  const nonceHeader = req.headers["x-hmac-nonce"];

  if (typeof timestampHeader !== "string" || typeof nonceHeader !== "string") {
    return {
      ok: false,
      status: 401,
      error: "HMAC timestamp and nonce headers are required",
      code: "HMAC_REPLAY_HEADERS_REQUIRED",
    };
  }

  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, status: 401, error: "Invalid HMAC timestamp", code: "INVALID_HMAC_TIMESTAMP" };
  }

  const now = Date.now();
  const timestampMs = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  if (Math.abs(now - timestampMs) > HMAC_MAX_CLOCK_SKEW_MS) {
    return { ok: false, status: 401, error: "HMAC timestamp is outside the accepted window", code: "STALE_HMAC_TIMESTAMP" };
  }

  if (!/^[A-Za-z0-9._:-]{12,128}$/.test(nonceHeader)) {
    return { ok: false, status: 401, error: "Invalid HMAC nonce", code: "INVALID_HMAC_NONCE" };
  }

  pruneSeenNonces(now);
  const nonceKey = `${equipmentId}:${nonceHeader}`;
  if (seenNonces.has(nonceKey)) {
    return { ok: false, status: 401, error: "HMAC nonce has already been used", code: "REPLAYED_HMAC_NONCE" };
  }
  seenNonces.set(nonceKey, now + HMAC_NONCE_TTL_MS);

  return { ok: true };
}

export async function validateHMAC(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await dbSystemAdminStorage.getSettings();
    if (!settings.hmacRequired) {
      return next();
    }

    let equipmentId = req.body?.equipmentId || req.headers["x-equipment-id"];

    if (
      !equipmentId &&
      req.body?.rows &&
      Array.isArray(req.body.rows) &&
      req.body.rows.length > 0
    ) {
      equipmentId = req.body.rows[0]?.src;
    }

    if (!equipmentId && req.body?.csvData && typeof req.body.csvData === "string") {
      const csvLines = req.body.csvData.trim().split("\n");
      if (csvLines.length > 1) {
        const headerLine = csvLines[0];
        const dataLine = csvLines[1];
        const headers = headerLine.split(",").map((h: string) => h.trim());
        const values = dataLine.split(",").map((v: string) => v.trim());
        const srcIndex = headers.indexOf("src");
        if (srcIndex >= 0 && values[srcIndex]) {
          equipmentId = values[srcIndex];
        }
      }
    }

    if (!equipmentId || typeof equipmentId !== "string") {
      return res.status(400).json({
        error: "Equipment ID required for HMAC validation",
        code: "MISSING_EQUIPMENT_ID",
      });
    }

    const device = await dbDevicesStorage.getDevice(equipmentId);
    if (!device || !device.hmacKey) {
      return res.status(401).json({
        error: "Device not found or HMAC key not configured",
        code: "HMAC_KEY_MISSING",
      });
    }

    const providedSignature = normalizeSignature(
      req.headers["x-hmac-signature"] ||
        (typeof req.headers["authorization"] === "string"
          ? req.headers["authorization"].replace("HMAC ", "")
          : undefined)
    );
    if (!providedSignature) {
      return res.status(401).json({
        error: "Valid HMAC signature required in X-HMAC-Signature header or Authorization header",
        code: "MISSING_HMAC_SIGNATURE",
      });
    }

    const replayValidation = validateReplayHeaders(req, equipmentId);
    if (!replayValidation.ok) {
      return res.status(replayValidation.status).json({
        error: replayValidation.error,
        code: replayValidation.code,
      });
    }

    const timestamp = String(req.headers["x-hmac-timestamp"]);
    const nonce = String(req.headers["x-hmac-nonce"]);
    const canonicalPayload = `${timestamp}.${nonce}.${rawPayload(req)}`;
    const expectedSignature = signPayload(device.hmacKey, canonicalPayload);

    let isValid = signaturesMatch(expectedSignature, providedSignature);

    if (!isValid && process.env.ALLOW_LEGACY_HMAC === "true") {
      const legacySignature = signPayload(device.hmacKey, JSON.stringify(req.body ?? {}));
      isValid = signaturesMatch(legacySignature, providedSignature);
      if (isValid) {
        logger.warn("Accepted legacy JSON-stringified HMAC signature; rotate clients to raw-body timestamp/nonce signing");
      }
    }

    if (!isValid) {
      return res.status(401).json({
        error: "Invalid HMAC signature",
        code: "INVALID_HMAC_SIGNATURE",
      });
    }

    next();
  } catch (error) {
    logger.error("HMAC validation error:", undefined, error);
    res.status(500).json({
      error: "HMAC validation failed",
      code: "HMAC_VALIDATION_ERROR",
    });
  }
}
