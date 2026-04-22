import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

const LOG_CTX = "ReplayProtection";

const nonceStore = new Map<string, number>();
const WINDOW_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [nonce, expiry] of nonceStore) {
    if (expiry < now) {
      nonceStore.delete(nonce);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug?.(LOG_CTX, `Cleaned ${cleaned} expired nonces, ${nonceStore.size} remaining`);
  }
}, CLEANUP_INTERVAL_MS);

export function replayProtection(options?: { windowMs?: number; required?: boolean }) {
  const windowMs = options?.windowMs ?? WINDOW_MS;
  const required = options?.required ?? false;

  return (req: Request, res: Response, next: NextFunction): void => {
    const timestamp = req.headers["x-request-timestamp"] as string;
    const nonce = req.headers["x-request-nonce"] as string;

    if (!timestamp && !nonce) {
      if (required) {
        res.status(400).json({
          error: {
            code: "REPLAY_PROTECTION_REQUIRED",
            message: "X-Request-Timestamp and X-Request-Nonce headers are required",
          },
        });
        return;
      }
      return next();
    }

    if (timestamp) {
      const requestTime = new Date(timestamp).getTime();
      const now = Date.now();

      if (isNaN(requestTime)) {
        res.status(400).json({
          error: {
            code: "INVALID_TIMESTAMP",
            message: "X-Request-Timestamp must be a valid ISO 8601 date",
          },
        });
        return;
      }

      if (Math.abs(now - requestTime) > windowMs) {
        logger.warn(
          LOG_CTX,
          `Request timestamp outside window: ${timestamp} (drift: ${Math.abs(now - requestTime)}ms)`
        );
        res.status(400).json({
          error: {
            code: "REQUEST_EXPIRED",
            message: `Request timestamp must be within ${windowMs / 1000} seconds of server time`,
          },
        });
        return;
      }
    }

    if (nonce) {
      if (nonceStore.has(nonce)) {
        logger.warn(LOG_CTX, `Duplicate nonce detected: ${nonce.substring(0, 8)}...`);
        res.status(409).json({
          error: {
            code: "DUPLICATE_REQUEST",
            message: "This request has already been processed (duplicate nonce)",
          },
        });
        return;
      }

      nonceStore.set(nonce, Date.now() + windowMs);
    }

    next();
  };
}

export default replayProtection;
