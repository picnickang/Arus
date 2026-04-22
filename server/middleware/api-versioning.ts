import type { Express } from "express";
import { logger } from "../utils/logger";

export function applyApiVersioning(app: Express): void {
  app.use("/api/v1", (req, res, next) => {
    if (req.headers["x-version-rewritten"]) {return next();}
    req.headers["x-version-rewritten"] = "true";
    req.url = `/api${req.url}`;
    app.handle(req, res, next);
  });

  app.use("/api", (_req, res, next) => {
    res.setHeader("X-API-Version", "v1");
    next();
  });

  logger.info("ApiVersioning", "Versioned routes mounted at /api/v1/*");
}
