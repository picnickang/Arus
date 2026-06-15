/**
 * Crew Scheduler Routes
 * Scheduling and planning endpoints
 */

import type { Express } from "express";
import type { CrewExtensionsRoutesConfig } from "./types.js";
import { registerSchedulerComplianceRoutes } from "./scheduler-compliance-routes.js";
import { registerSchedulerGeneratorRoutes } from "./scheduler-generator-routes.js";
import { registerSchedulerPlannerRoutes } from "./scheduler-planner-routes.js";
import { registerSchedulerRunRoutes } from "./scheduler-run-routes.js";
import { registerSchedulerSuggestionRoutes } from "./scheduler-suggestion-routes.js";

export function registerSchedulerRoutes(app: Express, config: CrewExtensionsRoutesConfig): void {
  registerSchedulerRunRoutes(app, config);
  registerSchedulerSuggestionRoutes(app);
  registerSchedulerGeneratorRoutes(app, config);
  registerSchedulerComplianceRoutes(app, config);
  registerSchedulerPlannerRoutes(app, config);
}
