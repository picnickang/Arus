/**
 * LLM Routes Index
 * 
 * Register all LLM API route modules.
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import type { IStorage } from "../../../storage";
import { registerLlmAnalysisRoutes } from "./llm-analysis.js";
import { registerHealthReportRoutes } from "./health-report.js";
import { registerMaintenanceReportRoutes } from "./maintenance-report.js";
import { registerComplianceReportRoutes } from "./compliance-report.js";
import { registerFleetSummaryRoutes } from "./fleet-summary.js";
import { logger } from "../../../utils/logger.js";

export function registerLlmRoutesModular(
  app: Express,
  storage: IStorage,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
    reportGenerationRateLimit: RateLimitRequestHandler;
  }
) {
  logger.info("LLMRoutes", "Registering LLM API endpoints");

  registerLlmAnalysisRoutes(app, storage, rateLimiters);
  registerHealthReportRoutes(app, storage, rateLimiters);
  registerMaintenanceReportRoutes(app, storage, rateLimiters);
  registerComplianceReportRoutes(app, storage, rateLimiters);
  registerFleetSummaryRoutes(app, storage, rateLimiters);

  logger.info("LLMRoutes", "Registered (llm: 5, reports: 5)");
}
