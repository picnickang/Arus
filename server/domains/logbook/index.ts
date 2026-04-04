/**
 * Logbook Domain
 * Handles digital logbook operations for deck, engine, fuel, vessel tracking, and condition monitoring
 */

import type { Express } from "express";
import { logbookCorrectionRouter } from "./correction-routes";

export { registerLogbookRoutes } from "./routes";
export { logbookCorrectionRouter } from "./correction-routes";

export function registerLogbookCorrectionRoutes(app: Express) {
  app.use("/api/logbook", logbookCorrectionRouter);
}
