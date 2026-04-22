/**
 * LLM Routes Index
 *
 * Register all LLM API route modules.
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { registerLlmAnalysisRoutes } from "./llm-analysis.js";
import { registerHealthReportRoutes } from "./health-report.js";
import { registerMaintenanceReportRoutes } from "./maintenance-report.js";
import { registerComplianceReportRoutes } from "./compliance-report.js";
import { registerFleetSummaryRoutes } from "./fleet-summary.js";
import { logger } from "../../../utils/logger.js";

export function registerLlmRoutesModular(
  app: Express,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
    reportGenerationRateLimit: RateLimitRequestHandler;
  }
) {
  logger.info("LLMRoutes", "Registering LLM API endpoints");

  registerLlmAnalysisRoutes(app, rateLimiters);
  registerHealthReportRoutes(app, rateLimiters);
  registerMaintenanceReportRoutes(app, rateLimiters);
  registerComplianceReportRoutes(app, rateLimiters);
  registerFleetSummaryRoutes(app, rateLimiters);

  logger.info("LLMRoutes", "Registered (llm: 5, reports: 5)");
}
