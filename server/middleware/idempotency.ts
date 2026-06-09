import type { Request, Response, NextFunction } from "express";
import { authenticatedRequest } from "./auth";
import { logger } from "../utils/logger";

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

function cleanupExpiredKeys(): number {
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
  return cleaned;
}

let cleanupInterval: NodeJS.Timeout | undefined;
if (process.env["DISABLE_SECURITY_TIMERS"] !== "true" && process.env["NODE_ENV"] !== "test") {
  cleanupInterval = setInterval(cleanupExpiredKeys, 10 * 60 * 1000);
  cleanupInterval.unref?.();
}

export function idempotencyMiddleware(options?: { required?: boolean }) {
  const required = options?.required ?? false;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Wave 2.5: accept Idempotency-Key header OR a `clientMutationId`
    // in the request body. The offline-outbox queues mutations with a
    // clientMutationId already; this lets every replay land at the same
    // cached response without the queue code having to add a second
    // header.
    let idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (!idempotencyKey && req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      const fromBody = (req.body as Record<string, unknown>)["clientMutationId"];
      if (typeof fromBody === "string" && fromBody.length > 0 && fromBody.length <= 128) {
        idempotencyKey = fromBody;
      }
    }

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

    const orgId = authenticatedRequest(req).orgId;
    if (!orgId) {
      res.status(401).json({
        error: {
          code: "ORG_CONTEXT_REQUIRED",
          message: "Organization context is required for idempotent mutations",
        },
      });
      return;
    }
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
    res.json = function (body: unknown) {
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

export const _internals = {
  cleanupExpiredKeys,
  stopCleanupInterval() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = undefined;
    }
  },
};
