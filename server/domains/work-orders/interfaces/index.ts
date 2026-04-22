/**
 * Work Orders Routes - Modular Entry Point
 *
 * Orchestrates registration of all work order route modules.
 *
 * @see ./core.ts - Basic CRUD operations
 * @see ./tasks.ts - Task management
 * @see ./completion.ts - Completion workflow
 * @see ./parts.ts - Parts management
 * @see ./extended.ts - Clone, history, costs
 */

import type { Express } from "express";
import { registerCoreRoutes } from "./core";
import { registerTasksRoutes } from "./tasks";
import { registerCompletionRoutes } from "./completion";
import { registerPartsRoutes } from "./parts";
import { registerExtendedRoutes } from "./extended";
import { registerEnrichedPartsRoutes } from "./parts-enriched";
import { registerWorkOrderWorkflowRoutes } from "./workflow-routes";
import {
  WorkOrderWorkflowRepositoryAdapter,
  CostSavingsWorkflowAdapter,
  PredictionFeedbackWorkflowAdapter,
  LegacyCompletionAdapter,
  WorkOrderEventAdapter,
} from "../infrastructure/workflow-adapters";
import { WorkOrderWorkflowService } from "../application/wo-workflow-service";
import type { RateLimitMiddleware } from "./types";
import { logger } from "../../../utils/logger.js";

export function registerWorkOrderRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  registerCoreRoutes(app, rateLimit);
  registerTasksRoutes(app, rateLimit);
  registerCompletionRoutes(app, rateLimit);
  registerPartsRoutes(app, rateLimit);
  registerExtendedRoutes(app, rateLimit);
  registerEnrichedPartsRoutes(app);

  const woRepo = new WorkOrderWorkflowRepositoryAdapter();
  const savings = new CostSavingsWorkflowAdapter();
  const predictionFeedback = new PredictionFeedbackWorkflowAdapter();
  const legacyCompletion = new LegacyCompletionAdapter();
  const events = new WorkOrderEventAdapter();
  const workflowService = new WorkOrderWorkflowService(
    woRepo,
    savings,
    predictionFeedback,
    legacyCompletion,
    events
  );
  registerWorkOrderWorkflowRoutes(app, workflowService, rateLimit);

  logger.info(
    "WorkOrdersRoutes",
    "Extended routes registered (clone, history, costs, parts, completions, enriched, workflow)"
  );
}

export type { RateLimitMiddleware } from "./types";
