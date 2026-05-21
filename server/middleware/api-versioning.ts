import type { Express, Request } from "express";
import { logger } from "../utils/logger";

/**
 * Sunset date for the unversioned `/api/*` surface.
 * Clients should migrate to `/api/v1/*` before this date.
 * RFC 8594 (Sunset HTTP header) format — IMF-fixdate.
 */
const SUNSET_DATE = "Wed, 18 Nov 2026 00:00:00 GMT";
const SUNSET_HUMAN = "2026-11-18";

/**
 * Internal sentinel — symbol-keyed property on the Request object so a
 * malicious client cannot spoof it via an HTTP header. Survives the
 * app.handle() re-dispatch because the same Request instance is reused.
 */
const VERSION_REWRITTEN = Symbol.for("arus.apiVersioning.rewritten");

type MarkedRequest = Request & { [VERSION_REWRITTEN]?: true };

export function applyApiVersioning(app: Express): void {
  app.use("/api/v1", (req, res, next) => {
    const r = req as MarkedRequest;
    if (r[VERSION_REWRITTEN]) {
      return next();
    }
    r[VERSION_REWRITTEN] = true;
    res.setHeader("X-API-Version", "v1");
    req.url = `/api${req.url}`;
    (app as Express & { handle: (req: unknown, res: unknown, next: unknown) => void }).handle(req, res, next);
  });

  app.use("/api", (req, res, next) => {
    const r = req as MarkedRequest;
    if (r[VERSION_REWRITTEN]) {
      return next();
    }
    res.setHeader("X-API-Version", "v1");
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", SUNSET_DATE);
    res.setHeader("Link", '</api/v1>; rel="successor-version"');
    res.setHeader(
      "Warning",
      `299 - "Unversioned /api/* is deprecated. Migrate to /api/v1/* before ${SUNSET_HUMAN}"`
    );
    next();
  });

  logger.info(
    "ApiVersioning",
    `Versioned routes mounted at /api/v1/* (legacy /api/* deprecated, sunset ${SUNSET_HUMAN})`
  );
}
