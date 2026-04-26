import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const LOG_CTX = "Idempotency";

const processedKeys = new Map<
  string,
  {
    statusCode: number;
    body: unknown;
    processedAt: number;
  }
>();

const KEY_TTL_MS = 24 * 60 * 60 * 1000;

setInterval(
  () => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of processedKeys) {
      if (now - entry.processedAt > KEY_TTL_MS) {
        processedKeys.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug?.(LOG_CTX, `Cleaned ${cleaned} expired idempotency keys`);
    }
  },
  10 * 60 * 1000
);

export function idempotencyMiddleware(options?: { required?: boolean }) {
  const required = options?.required ?? false;

  return (req: Request, res: Response, next: NextFunction): void => {
    const idempotencyKey = req.headers["idempotency-key"] as string;

    if (!idempotencyKey) {
      if (required) {
        res.status(400).json({
          error: {
            code: "IDEMPOTENCY_KEY_REQUIRED",
            message: "Idempotency-Key header is required for this endpoint",
          },
        });
        return;
      }
      return next();
    }

    const orgId = (req as any).orgId || DEFAULT_ORG_ID;
    const fullKey = `${orgId}:${req.method}:${req.path}:${idempotencyKey}`;

    const existing = processedKeys.get(fullKey);
    if (existing) {
      logger.info(
        LOG_CTX,
        `Returning cached response for idempotency key: ${idempotencyKey.substring(0, 8)}...`
      );
      res.status(existing.statusCode).json(existing.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        processedKeys.set(fullKey, {
          statusCode: res.statusCode,
          body,
          processedAt: Date.now(),
        });
      }
      return originalJson(body);
    };

    next();
  };
}

export default idempotencyMiddleware;
