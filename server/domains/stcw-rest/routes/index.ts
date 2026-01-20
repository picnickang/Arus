/**
 * STCW Rest Routes - Modular Entry Point
 *
 * Orchestrates registration of all STCW hours of rest route modules.
 *
 * @see ./import.ts - Import and compliance check routes
 * @see ./data.ts - Data retrieval and export routes
 * @see ./range.ts - Range queries and planning preparation
 * @see ./fatigue.ts - Fatigue risk assessment routes
 * @see ./admin.ts - Data management operations
 */

import { Express } from "express";
import { registerImportRoutes } from "./import";
import { registerDataRoutes } from "./data";
import { registerRangeRoutes } from "./range";
import { registerFatigueRoutes } from "./fatigue";
import { registerAdminRoutes } from "./admin";
import type { StcwRestDependencies } from "./types";
import { logger } from "../../../utils/logger.js";

export function registerStcwRestRoutes(
  app: Express,
  deps: StcwRestDependencies
): void {
  registerImportRoutes(app, deps);
  registerDataRoutes(app, deps);
  registerRangeRoutes(app, deps);
  registerFatigueRoutes(app, deps);
  registerAdminRoutes(app, deps);

  logger.info("STCWRestRoutes", "Registered (import: 2, export: 2, compliance: 2, fatigue: 3, range: 3, data: 6)");
}

export type { StcwRestDependencies, RestDay } from "./types";
