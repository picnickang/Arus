/**
 * Crew Extensions Domain - Interfaces Layer
 * HTTP routes and external API adapters
 * Re-exports and orchestrates all crew extensions route modules
 */

import type { Express } from "express";
import type { CrewExtensionsRoutesConfig } from "./types.js";
import { registerCertificationsRoutes } from "./certifications-routes.js";
import { registerLeaveRoutes } from "./leave-routes.js";
import { registerDutyRoutes } from "./duty-routes.js";
import { registerSchedulerRoutes } from "./scheduler-routes.js";
import { registerShiftsRoutes } from "./shifts-routes.js";
import { registerAssignmentsRoutes } from "./assignments-routes.js";
import { initPlannerViewEventHandler } from "../infrastructure/planner-view-event-handler.js";
import { logger } from "../../../utils/logger.js";

export type { CrewExtensionsRoutesConfig, AuthenticatedRequest } from "./types.js";

export function registerCrewExtensionsRoutes(app: Express, config: CrewExtensionsRoutesConfig): void {
  logger.info("CrewExtensionsRoutes", "Registering crew extensions API endpoints");
  registerCertificationsRoutes(app, config);
  registerLeaveRoutes(app, config);
  registerDutyRoutes(app, config);
  registerSchedulerRoutes(app, config);
  registerShiftsRoutes(app, config);
  registerAssignmentsRoutes(app, config);

  initPlannerViewEventHandler();

  logger.info("CrewExtensionsRoutes", "Registered (certifications: 4, leave: 4, duty: 2, scheduler: 12, shifts: 4, assignments: 3)");
}
