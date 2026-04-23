import { Router } from "express";
import { beastModeManager, DEFAULT_ORG_ID } from "../beast-mode-config.js";
import { enhancedTrendsAnalyzer } from "../enhanced-trends.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Beast:TrendsRoutes");
const router = Router();

router.post("/trends/analyze/:equipmentId/:sensorType", async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const { equipmentId, sensorType } = req.params;
    const { hours = 168 } = req.body;
    if (typeof hours !== "number" || hours < 1 || hours > 8760) {
      return res.status(400).json({ success: false, error: "Hours must be between 1 and 8760" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "enhanced_trends");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Enhanced trends analysis feature is disabled for this organization",
          feature: "enhanced_trends",
          enabled: false,
        });
    }
    logger.info(`[Beast Mode API] Enhanced trends analysis for ${equipmentId}:${sensorType} over ${hours}h`);
    const analysis = await enhancedTrendsAnalyzer.analyzeEquipmentTrends(
      orgId,
      equipmentId,
      sensorType,
      hours
    );
    res.json({
      success: true,
      equipmentId,
      sensorType,
      orgId,
      timeRange: analysis.timeRange,
      analysis: {
        statisticalSummary: {
          count: analysis.statisticalSummary.count,
          mean: analysis.statisticalSummary.mean,
          standardDeviation: analysis.statisticalSummary.standardDeviation,
          trend: analysis.statisticalSummary.trend,
          distribution: analysis.statisticalSummary.distribution,
        },
        anomalyDetection: {
          method: analysis.anomalyDetection.method,
          totalAnomalies: analysis.anomalyDetection.summary.totalAnomalies,
          anomalyRate: analysis.anomalyDetection.summary.anomalyRate,
          severity: analysis.anomalyDetection.summary.severity,
          recommendation: analysis.anomalyDetection.summary.recommendation,
          recentAnomalies: analysis.anomalyDetection.anomalies.slice(-5),
        },
        forecasting: {
          method: analysis.forecasting.method,
          confidence: analysis.forecasting.confidence,
          horizon: analysis.forecasting.horizon,
          nextValues: analysis.forecasting.predictions.slice(0, 24),
          recommendation: analysis.forecasting.recommendation,
        },
        seasonality: analysis.seasonality,
        correlations: analysis.correlations.slice(0, 5),
      },
      message: "Enhanced trends analysis completed successfully",
    });
  } catch (error: any) {
    logger.error(`[Beast Mode API] Error in enhanced trends analysis:`, undefined, error);
    if (error.message && error.message.includes("Insufficient data")) {
      return res
        .status(400)
        .json({
          success: false,
          error: error.message,
          hint: "Equipment needs at least 10 telemetry data points for statistical analysis",
        });
    }
    res.status(500).json({ success: false, error: "Failed to perform enhanced trends analysis" });
  }
});

router.post("/trends/fleet-analyze", async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const { equipmentIds, hours = 168 } = req.body;
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
          error: "Maximum 20 equipment units can be analyzed in fleet analysis",
        });
    }

    if (typeof hours !== "number" || hours < 1 || hours > 8760) {
      return res.status(400).json({ success: false, error: "Hours must be between 1 and 8760" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "enhanced_trends");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Enhanced trends analysis feature is disabled for this organization",
          feature: "enhanced_trends",
          enabled: false,
        });
    }
    logger.info(`[Beast Mode API] Fleet trends analysis for ${equipmentIds.length} units over ${hours}h`);
    const fleetAnalysis = await enhancedTrendsAnalyzer.analyzeFleetTrends(
      orgId,
      equipmentIds,
      hours
    );
    res.json({
      success: true,
      fleetId: fleetAnalysis.fleetId,
      equipmentCount: fleetAnalysis.equipmentCount,
      orgId,
      timeRange: fleetAnalysis.timeRange,
      analysis: {
        aggregatedMetrics: fleetAnalysis.aggregatedMetrics,
        equipmentRankings: fleetAnalysis.equipmentRankings.slice(0, 10),
        recommendations: fleetAnalysis.recommendations,
        sensorTypes: fleetAnalysis.sensorTypes,
      },
      message: "Fleet trends analysis completed successfully",
    });
  } catch (error: any) {
    logger.error(`[Beast Mode API] Error in fleet trends analysis:`, undefined, error);
    res.status(500).json({ success: false, error: "Failed to perform fleet trends analysis" });
  }
});

router.get("/trends/correlations/:equipmentId", async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const { equipmentId } = req.params;
    const hours = Number.parseInt(req.query.hours as string) || 168;
    const minCorrelation = Number.parseFloat(req.query.minCorrelation as string) || 0.5;
    if (hours < 1 || hours > 8760) {
      return res.status(400).json({ success: false, error: "Hours must be between 1 and 8760" });
    }

    if (minCorrelation < 0 || minCorrelation > 1) {
      return res
        .status(400)
        .json({ success: false, error: "minCorrelation must be between 0 and 1" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "enhanced_trends");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Enhanced trends analysis feature is disabled for this organization",
          feature: "enhanced_trends",
          enabled: false,
        });
    }
    logger.info(`[Beast Mode API] Sensor correlations for ${equipmentId} over ${hours}h`);
    const correlations = await enhancedTrendsAnalyzer.analyzeSensorCorrelations(
      orgId,
      equipmentId,
      hours,
      minCorrelation
    );
    res.json({
      success: true,
      equipmentId,
      orgId,
      timeRangeHours: hours,
      minCorrelationThreshold: minCorrelation,
      correlations: {
        total: correlations.length,
        positive: correlations.filter((c) => c.correlation > 0).length,
        negative: correlations.filter((c) => c.correlation < 0).length,
        pairs: correlations.map((c) => ({
          sensor1: c.sensor1,
          sensor2: c.sensor2,
          correlation: c.correlation,
          strength: c.strength,
          interpretation: c.interpretation,
        })),
      },
      message: "Sensor correlation analysis completed successfully",
    });
  } catch (error: any) {
    logger.error(`[Beast Mode API] Error in correlation analysis:`, undefined, error);
    if (error.message && error.message.includes("Insufficient data")) {
      return res
        .status(400)
        .json({
          success: false,
          error: error.message,
          hint: "Equipment needs data from multiple sensors for correlation analysis",
        });
    }
    res.status(500).json({ success: false, error: "Failed to perform correlation analysis" });
  }
});

router.get("/trends/forecast/:equipmentId/:sensorType", async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const { equipmentId, sensorType } = req.params;
    const hours = Number.parseInt(req.query.hours as string) || 168;
    const forecastHours = Number.parseInt(req.query.forecastHours as string) || 24;
    if (hours < 1 || hours > 8760) {
      return res.status(400).json({ success: false, error: "Hours must be between 1 and 8760" });
    }

    if (forecastHours < 1 || forecastHours > 168) {
      return res
        .status(400)
        .json({ success: false, error: "forecastHours must be between 1 and 168" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "enhanced_trends");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Enhanced trends analysis feature is disabled for this organization",
          feature: "enhanced_trends",
          enabled: false,
        });
    }
    logger.info(`[Beast Mode API] Forecasting ${sensorType} for ${equipmentId}, ${forecastHours}h ahead`);
    const analysis = await enhancedTrendsAnalyzer.analyzeEquipmentTrends(
      orgId,
      equipmentId,
      sensorType,
      hours
    );
    const forecast = {
      ...analysis.forecasting,
      predictions: analysis.forecasting.predictions.slice(0, forecastHours),
    };
    res.json({
      success: true,
      equipmentId,
      sensorType,
      orgId,
      historicalHours: hours,
      forecastHours,
      forecast: {
        method: forecast.method,
        confidence: forecast.confidence,
        metrics: forecast.metrics,
        predictions: forecast.predictions.map((pred) => ({
          timestamp: pred.timestamp,
          predictedValue: pred.predictedValue,
          confidenceInterval: pred.confidenceInterval,
          probability: pred.probability,
        })),
        recommendation: forecast.recommendation,
      },
      historicalContext: {
        mean: analysis.statisticalSummary.mean,
        trend: analysis.statisticalSummary.trend,
        volatility: analysis.statisticalSummary.standardDeviation,
        seasonality: analysis.seasonality.hasSeasonality,
      },
      message: "Sensor value forecasting completed successfully",
    });
  } catch (error: any) {
    logger.error(`[Beast Mode API] Error in forecasting:`, undefined, error);
    if (error.message && error.message.includes("Insufficient data")) {
      return res
        .status(400)
        .json({
          success: false,
          error: error.message,
          hint: "Equipment needs sufficient historical data for reliable forecasting",
        });
    }
    res.status(500).json({ success: false, error: "Failed to perform sensor forecasting" });
  }
});

export { router as beastTrendsRouter };
