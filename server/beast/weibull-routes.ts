import { Router } from "express";
import { beastModeManager, DEFAULT_ORG_ID } from "../beast-mode-config.js";
import { WeibullRULAnalyzer } from "../weibull-rul.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Beast:WeibullRoutes");

const router = Router();

router.post("/weibull/analyze/:equipmentId", async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const orgId = DEFAULT_ORG_ID;
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "weibull_rul");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Weibull RUL analysis feature is disabled for this organization",
          feature: "weibull_rul",
          enabled: false,
        });
    }
    const analyzer = new WeibullRULAnalyzer();
    const prediction = await analyzer.analyzeEquipmentRUL(equipmentId, orgId);
    res.json({
      success: true,
      prediction: {
        equipmentId: prediction.equipmentId,
        currentAge: prediction.currentAge,
        predictedRUL: prediction.predictedRUL,
        reliability: prediction.reliability,
        recommendation: prediction.maintenanceRecommendation,
        confidenceInterval: prediction.confidenceInterval,
        failureProbability: prediction.failureProbability,
        weibullParams: prediction.weibullParams,
      },
      message: `RUL analysis: ${Math.round(prediction.predictedRUL)}h remaining, ${(prediction.reliability * 100).toFixed(1)}% reliable, ${prediction.maintenanceRecommendation} maintenance`,
    });
  } catch (error: any) {
    logger.error(`[Beast Mode API] Error analyzing RUL for ${req.params.equipmentId}:`, undefined, error);
    res
      .status(400)
      .json({ success: false, error: error.message, equipmentId: req.params.equipmentId });
  }
});

router.get("/weibull/history/:equipmentId", async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const orgId = DEFAULT_ORG_ID;
    const limit = Number.parseInt(req.query.limit as string) || 50;
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "weibull_rul");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Weibull RUL analysis feature is disabled for this organization",
          feature: "weibull_rul",
          enabled: false,
        });
    }
    const analyzer = new WeibullRULAnalyzer();
    const history = await analyzer.getRULHistory(equipmentId, orgId, limit);
    res.json({
      success: true,
      equipmentId,
      orgId,
      count: history.length,
      history: history.map((pred) => ({
        id: pred.id,
        timestamp: pred.createdAt,
        currentAge: pred.currentAge,
        predictedRUL: pred.predictedRUL,
        reliability: pred.reliability,
        recommendation: pred.recommendation,
        failureProb30d: pred.failureProb30d,
        failureProb90d: pred.failureProb90d,
      })),
    });
  } catch (error) {
    logger.error(`[Beast Mode API] Error getting Weibull history for ${req.params.equipmentId}:`, undefined, error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to retrieve Weibull RUL history",
        equipmentId: req.params.equipmentId,
      });
  }
});

router.post("/weibull/batch-analyze", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const { equipmentIds } = req.body;
    if (!Array.isArray(equipmentIds) || equipmentIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "equipmentIds must be a non-empty array" });
    }

    if (equipmentIds.length > 20) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Maximum 20 equipment units can be analyzed in a single batch",
        });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "weibull_rul");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Weibull RUL analysis feature is disabled for this organization",
          feature: "weibull_rul",
          enabled: false,
        });
    }
    const analyzer = new WeibullRULAnalyzer();
    const results = await analyzer.batchAnalyzeRUL(equipmentIds, orgId);
    const summary = {
      total: equipmentIds.length,
      successful: results.success.length,
      failed: results.failed.length,
      avgRUL:
        results.success.length > 0
          ? Math.round(
              results.success.reduce((sum, r) => sum + r.predictedRUL, 0) / results.success.length
            )
          : 0,
      avgReliability:
        results.success.length > 0
          ? Math.round(
              (results.success.reduce((sum, r) => sum + r.reliability, 0) /
                results.success.length) *
                100
            )
          : 0,
      immediateAction: results.success.filter((r) => r.maintenanceRecommendation === "immediate")
        .length,
      urgentAction: results.success.filter((r) => r.maintenanceRecommendation === "urgent").length,
    };
    res.json({
      success: true,
      orgId,
      summary,
      results: results.success.map((prediction) => ({
        equipmentId: prediction.equipmentId,
        currentAge: prediction.currentAge,
        predictedRUL: prediction.predictedRUL,
        reliability: prediction.reliability,
        recommendation: prediction.maintenanceRecommendation,
        failureProb30d: prediction.failureProbability.next30days,
        failureProb90d: prediction.failureProbability.next90days,
      })),
      failed: results.failed,
    });
  } catch (error: any) {
    logger.error(`[Beast Mode API] Error in batch Weibull RUL analysis:`, undefined, error);
    res.status(500).json({ success: false, error: "Failed to perform batch Weibull RUL analysis" });
  }
});

export { router as beastWeibullRouter };
