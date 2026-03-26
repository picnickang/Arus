import { Router, type Express } from "express";
import { logger } from "../utils/logger";

export function applyApiVersioning(app: Express): void {
  app.use("/api/v1", (req, res, next) => {
    req.url = `/api${req.url}`;
    app.handle(req, res, next);
  });

  app.use((_req, res, next) => {
    res.setHeader("X-API-Version", "v1");
    next();
  });

  logger.info("ApiVersioning", "Versioned routes mounted at /api/v1/*");
}
