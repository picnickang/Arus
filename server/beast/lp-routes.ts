import { Router } from "express";
import { beastModeManager, DEFAULT_ORG_ID } from "../beast-mode-config.js";
import { LinearProgrammingOptimizer } from "../lp-optimizer.js";
import { z } from "zod";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Beast:LpRoutes");

const router = Router();

const optimizationConstraintsSchema = z.object({
  maxDailyWorkHours: z.number().min(1).max(24).default(8),
  maxConcurrentJobs: z.number().min(1).max(10).default(3),
  crewAvailability: z.array(
    z.object({
      crewMember: z.string(),
      availableDays: z.array(z.string()),
      maxHoursPerDay: z.number().min(1).max(16),
      skillLevel: z.number().min(1).max(5),
      hourlyRate: z.number().min(10).max(200),
    })
  ),
  partsBudget: z.number().min(100).max(100000).default(5000),
  timeHorizonDays: z.number().min(1).max(90).default(14),
  priorityWeights: z
    .object({
      critical: z.number().default(100),
      high: z.number().default(50),
      medium: z.number().default(20),
      low: z.number().default(10),
    })
    .default({ critical: 100, high: 50, medium: 20, low: 10 }),
});

router.post("/lp/optimize", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const config = await beastModeManager.getFeatureConfig(orgId, "lp_optimizer");
    if (!config.enabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "LP Optimizer feature is not enabled for this organization",
          feature: "lp_optimizer",
        });
    }
    logger.info(`[Beast Mode API] Starting LP optimization for org ${orgId}`);
    const constraints = optimizationConstraintsSchema.parse(req.body);
    const optimizer = new LinearProgrammingOptimizer(orgId);
    const result = await optimizer.optimizeMaintenanceSchedule(constraints);
    res.json({
      success: result.success,
      optimizationId: result.optimizationId,
      result,
      message: `Optimization completed in ${result.optimizationTime}ms - ${result.schedule.length} jobs scheduled`,
    });
  } catch (error: any) {
    logger.error("[Beast Mode API] Error running LP optimization:", undefined, error);
    res
      .status(500)
      .json({ success: false, error: error.message || "Failed to run maintenance optimization" });
  }
});

router.get("/lp/results/:resultId", async (req, res) => {
  try {
    const { resultId } = req.params;
    const orgId = DEFAULT_ORG_ID;
    const config = await beastModeManager.getFeatureConfig(orgId, "lp_optimizer");
    if (!config.enabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "LP Optimizer feature is not enabled for this organization",
        });
    }
    logger.info(`[Beast Mode API] Retrieving optimization result ${resultId} for org ${orgId}`);
    const optimizer = new LinearProgrammingOptimizer(orgId);
    const optimizationData = await optimizer.getOptimizationResults(resultId);
    res.json({
      success: true,
      resultId,
      data: optimizationData,
      message: `Retrieved optimization with ${optimizationData.totalSchedules} scheduled jobs, score: ${optimizationData.optimizationScore}/100`,
    });
  } catch (error: any) {
    logger.error(`[Beast Mode API] Error retrieving optimization result ${req.params.resultId}:`, undefined, error);
    if (error.message.includes("not found")) {
      return res
        .status(404)
        .json({
          success: false,
          error: `Optimization result ${req.params.resultId} not found`,
          resultId: req.params.resultId,
        });
    }
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to retrieve optimization results",
        resultId: req.params.resultId,
      });
  }
});

export { router as beastLPRouter };
