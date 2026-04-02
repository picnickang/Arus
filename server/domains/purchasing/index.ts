import type { Express } from "express";
import { pipelineRouter } from "./interfaces/pipeline-routes";

export function registerPurchasingPipelineRoutes(
  app: Express,
  _deps: Record<string, any>
) {
  app.use("/api", pipelineRouter);
  console.log("  ✓ Purchasing Pipeline routes registered");
}
