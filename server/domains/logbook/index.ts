/**
 * Logbook Domain
 * Handles digital logbook operations for deck, engine, fuel, vessel tracking, and condition monitoring.
 *
 * The corrections/audit slice is converted to the hexagonal layers
 * (domain/ application/ infrastructure/ interfaces/); the deck/engine/autofill
 * route groups under routes/ remain flat support pending later conversion.
 */

import type { Express } from "express";
import { logbookCorrectionRouter } from "./interfaces";

export { registerLogbookRoutes } from "./routes";
export { logbookCorrectionRouter } from "./interfaces";

export function registerLogbookCorrectionRoutes(app: Express) {
  app.use("/api/logbook", logbookCorrectionRouter);
}
