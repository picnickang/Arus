import { Router } from "express";
import { beastModeManager, DEFAULT_ORG_ID } from "../beast-mode-config.js";
import { vibrationAnalyzer } from "../vibration-analysis.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Beast:VibrationRoutes");

const router = Router();

router.post("/vibration/analyze/:equipmentId", async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "vibration_analysis");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Vibration analysis feature is disabled for this organization",
          feature: "vibration_analysis",
          enabled: false,
        });
    }
    const analysis = await vibrationAnalyzer.analyzeVibration(equipmentId, orgId);
    if (!analysis) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Unable to perform vibration analysis - insufficient data or system error",
          equipmentId,
        });
    }
    res.json({
      success: true,
      equipmentId,
      analysis: {
        id: analysis.id,
        timestamp: analysis.timestamp,
        dominantFrequency: analysis.dominantFrequency,
        dominantMagnitude: analysis.dominantMagnitude,
        anomalyScore: analysis.anomalyScore,
        anomalyType: analysis.anomalyType,
        healthScore: analysis.healthScore,
        isAnomalous: analysis.isAnomalous,
        confidence: analysis.confidence,
      },
      message: analysis.isAnomalous
        ? `ANOMALY DETECTED: ${analysis.anomalyType} (score: ${analysis.anomalyScore.toFixed(2)})`
        : `Equipment operating normally (health score: ${analysis.healthScore}%)`,
    });
  } catch (error) {
    logger.error(`[Beast Mode API] Error analyzing vibration for ${req.params.equipmentId}:`, undefined, error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to perform vibration analysis",
        equipmentId: req.params.equipmentId,
      });
  }
});

router.get("/vibration/history/:equipmentId", async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const limit = Number.parseInt(req.query.limit as string) || 50;
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "vibration_analysis");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Vibration analysis feature is disabled for this organization",
          feature: "vibration_analysis",
          enabled: false,
        });
    }
    const history = await vibrationAnalyzer.getAnalysisHistory(equipmentId, orgId, limit);
    res.json({
      success: true,
      equipmentId,
      orgId,
      count: history.length,
      history: history.map((analysis) => ({
        id: analysis.id,
        timestamp: analysis.timestamp,
        dominantFrequency: analysis.dominantFrequency,
        dominantMagnitude: analysis.dominantMagnitude,
        anomalyScore: analysis.anomalyScore,
        anomalyType: analysis.anomalyType,
        healthScore: analysis.healthScore,
        isAnomalous: analysis.isAnomalous,
        confidence: analysis.confidence,
      })),
    });
  } catch (error) {
    logger.error(`[Beast Mode API] Error getting vibration history for ${req.params.equipmentId}:`, undefined, error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to retrieve vibration analysis history",
        equipmentId: req.params.equipmentId,
      });
  }
});

router.post("/vibration/batch-analyze", async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const { equipmentIds } = req.body;
    if (!Array.isArray(equipmentIds) || equipmentIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "equipmentIds must be a non-empty array" });
    }

    if (equipmentIds.length > 10) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Maximum 10 equipment units can be analyzed in a single batch",
        });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "vibration_analysis");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Vibration analysis feature is disabled for this organization",
          feature: "vibration_analysis",
          enabled: false,
        });
    }
    const results = await vibrationAnalyzer.batchAnalyze(equipmentIds, orgId);
    const summary = {
      total: equipmentIds.length,
      analyzed: results.length,
      anomalies: results.filter((r) => r.isAnomalous).length,
      avgHealthScore:
        results.length > 0
          ? Math.round(results.reduce((sum, r) => sum + r.healthScore, 0) / results.length)
          : 0,
    };
    res.json({
      success: true,
      orgId,
      summary,
      results: results.map((analysis) => ({
        equipmentId: analysis.equipmentId,
        id: analysis.id,
        timestamp: analysis.timestamp,
        dominantFrequency: analysis.dominantFrequency,
        anomalyScore: analysis.anomalyScore,
        anomalyType: analysis.anomalyType,
        healthScore: analysis.healthScore,
        isAnomalous: analysis.isAnomalous,
        confidence: analysis.confidence,
      })),
    });
  } catch (error) {
    logger.error(`[Beast Mode API] Error in batch vibration analysis:`, undefined, error);
    res.status(500).json({ success: false, error: "Failed to perform batch vibration analysis" });
  }
});

export { router as beastVibrationRouter };
