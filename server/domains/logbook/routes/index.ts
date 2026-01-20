/**
 * Logbook Domain Routes - Aggregator
 * 
 * Re-exports all logbook route modules and provides the main registration function.
 * 
 * Module structure (1,150 lines → 8 modules):
 * - types.ts (~45 lines): Shared types
 * - deck-log-daily-routes.ts (~215 lines): Daily deck log CRUD
 * - deck-log-entries-routes.ts (~220 lines): Hourly, watches, events
 * - engine-log-daily-routes.ts (~235 lines): Daily engine log CRUD
 * - engine-log-entries-routes.ts (~280 lines): Hourly, generators, watches, events
 * - autofill-routes.ts (~165 lines): Auto-fill & anomaly detection
 * - index.ts (~50 lines): This aggregator
 */

import type { Express } from "express";
import type { RateLimiters } from "./types";
import { registerDeckLogDailyRoutes } from "./deck-log-daily-routes";
import { registerDeckLogEntriesRoutes } from "./deck-log-entries-routes";
import { registerEngineLogDailyRoutes } from "./engine-log-daily-routes";
import { registerEngineLogEntriesRoutes } from "./engine-log-entries-routes";
import { registerAutofillRoutes } from "./autofill-routes";
import { logger } from "../../../utils/logger.js";

export * from "./types";
export { registerDeckLogDailyRoutes } from "./deck-log-daily-routes";
export { registerDeckLogEntriesRoutes } from "./deck-log-entries-routes";
export { registerEngineLogDailyRoutes } from "./engine-log-daily-routes";
export { registerEngineLogEntriesRoutes } from "./engine-log-entries-routes";
export { registerAutofillRoutes } from "./autofill-routes";

/**
 * Register all logbook routes
 * 
 * This is the main entry point for logbook route registration.
 * It composes all sub-modules and provides backward compatibility.
 */
export function registerLogbookRoutes(
  app: Express,
  rateLimit: RateLimiters
) {
  const deckDailyCount = registerDeckLogDailyRoutes(app, rateLimit);
  const deckEntriesCount = registerDeckLogEntriesRoutes(app, rateLimit);
  const engineDailyCount = registerEngineLogDailyRoutes(app, rateLimit);
  const engineEntriesCount = registerEngineLogEntriesRoutes(app, rateLimit);
  const autofillCount = registerAutofillRoutes(app, rateLimit);

  const deckTotal = deckDailyCount + deckEntriesCount;
  const engineTotal = engineDailyCount + engineEntriesCount + autofillCount;

  logger.info("LogbookRoutes", `All logbook routes registered (deck: ${deckTotal}, engine: ${engineTotal})`);
}
