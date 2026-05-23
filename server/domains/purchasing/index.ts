import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Domains:Purchasing:Index");
import type { Express } from "express";
import { pipelineRouter } from "./interfaces/pipeline-routes";

export function registerPurchasingPipelineRoutes(app: Express, _deps: Record<string, unknown>) {
  app.use("/api", pipelineRouter);
  logger.info("  ✓ Purchasing Pipeline routes registered");
}
