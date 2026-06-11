import type { Request, Response, NextFunction } from "express";
import { authenticatedRequest } from "./auth";
import { logger } from "../utils/logger";
import {
  deleteExpiredResponses,
  getStoredResponse,
  hashIdempotentRequest,
  storeResponse,
} from "../storage/idempotency-repository";

const LOG_CTX = "Idempotency";

const processedKeys = new Map<
  string,
  {
    statusCode: number;
    body: unknown;
    processedAt: number;
    requestHash: string;
  }
>();

const KEY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Marks requests already claimed by an idempotency middleware instance, so the
 * broad per-family mounts (bootstrap) and the older per-route mounts compose:
 * whichever runs first with a key present wins; the second becomes a no-op.
 * A `required: true` instance still enforces key presence because the marker
 * is only set when a key was found.
 */
const IDEMPOTENCY_CLAIMED: unique symbol = Symbol("idempotencyClaimed");

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
  cleanupInterval = setInterval(
    () => {
      cleanupExpiredKeys();
      deleteExpiredResponses().catch((error) => {
        logger.warn(LOG_CTX, `Durable idempotency cleanup failed: ${String(error)}`);
      });
    },
    10 * 60 * 1000
  );
  cleanupInterval.unref?.();
}

function sendKeyReused(res: Response): void {
  res.status(409).json({
    error: {
      code: "IDEMPOTENCY_KEY_REUSED",
      message:
        "This Idempotency-Key was already used with a different request body. Use a fresh key for new work.",
    },
  });
}

export function idempotencyMiddleware(options?: { required?: boolean }) {
  const required = options?.required ?? false;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if ((req as Request & { [IDEMPOTENCY_CLAIMED]?: boolean })[IDEMPOTENCY_CLAIMED]) {
      return next();
    }

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

    (req as Request & { [IDEMPOTENCY_CLAIMED]?: boolean })[IDEMPOTENCY_CLAIMED] = true;

    // baseUrl + path makes the key absolute, so per-family mounts (bootstrap)
    // and per-route mounts produce the same key for the same URL.
    const requestPath = `${req.baseUrl}${req.path}`;
    const fullKey = `${orgId}:${req.method}:${requestPath}:${idempotencyKey}`;
    const requestHash = hashIdempotentRequest(fullKey, req.body);

    const existing = processedKeys.get(fullKey);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        sendKeyReused(res);
        return;
      }
      logger.info(
        LOG_CTX,
        `Returning cached response for idempotency key: ${idempotencyKey.substring(0, 8)}...`
      );
      res.status(existing.statusCode).json(existing.body);
      return;
    }

    // L2: durable store survives restarts — the common case on vessels, where
    // the outbox replays after the sidecar comes back up. Lookup failures fall
    // through to normal processing (availability over strictness).
    try {
      const stored = await getStoredResponse(fullKey);
      if (stored) {
        if (stored.requestHash !== undefined && stored.requestHash !== requestHash) {
          sendKeyReused(res);
          return;
        }
        processedKeys.set(fullKey, {
          statusCode: stored.statusCode,
          body: stored.body,
          processedAt: Date.now(),
          requestHash,
        });
        logger.info(
          LOG_CTX,
          `Returning durable cached response for idempotency key: ${idempotencyKey.substring(0, 8)}...`
        );
        res.status(stored.statusCode).json(stored.body);
        return;
      }
    } catch (error) {
      logger.warn(LOG_CTX, `Durable idempotency lookup failed, proceeding: ${String(error)}`);
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        processedKeys.set(fullKey, {
          statusCode: res.statusCode,
          body,
          processedAt: Date.now(),
          requestHash,
        });
        storeResponse({
          fullKey,
          orgId,
          idempotencyKey,
          requestHash,
          statusCode: res.statusCode,
          body,
          ttlMs: KEY_TTL_MS,
        }).catch((error) => {
          logger.warn(LOG_CTX, `Failed to persist idempotency record: ${String(error)}`);
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
  processedKeys,
  stopCleanupInterval() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = undefined;
    }
  },
};
