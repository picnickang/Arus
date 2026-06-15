import type { Router } from "express";
import { logger } from "../utils/logger";

export function registerPdmAnalysisRoutes(router: Router): void {
  router.post("/analyze/bearing", async (req, res) => {
    try {
      const { series, vesselName, assetId, sampleRate } = req.body;
      if (!series || !Array.isArray(series) || series.length < 10) {
        return res.status(400).json({ error: "At least 10 data points required for analysis" });
      }
      const mean = series.reduce((a: number, b: number) => a + b, 0) / series.length;
      const variance =
        series.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / series.length;
      const std = Math.sqrt(variance);
      const rms = Math.sqrt(series.reduce((a: number, b: number) => a + b * b, 0) / series.length);
      const peak = Math.max(...series.map(Math.abs));
      const crestFactor = peak / rms;
      const kurtosis =
        series.reduce((a: number, b: number) => a + ((b - mean) / (std || 1)) ** 4, 0) /
        series.length;

      const scores: Record<string, number> = {
        rms: (rms - 2.5) / 1.0,
        crest_factor: (crestFactor - 3.0) / 0.5,
        kurtosis: (kurtosis - 3.0) / 1.0,
      };
      const worstZ = Math.max(...Object.values(scores).map(Math.abs));
      const severity = worstZ > 3 ? "high" : worstZ > 2 ? "warn" : "info";

      return res.json({
        analysis: {
          severity,
          worstZ,
          scores,
          features: { rms, crest_factor: crestFactor, kurtosis, peak, mean, std },
          explanation: {
            vesselName,
            assetId,
            sampleRate,
            dataPoints: series.length,
            method: "statistical_z_score",
          },
        },
      });
    } catch (error) {
      logger.error("Error analyzing bearing data:", error);
      return res.status(500).json({ error: "Failed to analyze bearing data" });
    }
  });

  router.post("/analyze/pump", async (req, res) => {
    try {
      const { flow, pressure, current, vesselName, assetId } = req.body;
      const scores: Record<string, number> = {};
      const features: Record<string, number> = {};

      const analyze = (name: string, values: number[], nominal: number) => {
        if (!values || values.length === 0) {
          return;
        }
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const deviation = Math.abs(mean - nominal) / nominal;
        scores[name] = deviation * 10;
        features[name] = mean;
      };

      if (Array.isArray(flow)) {
        analyze("flow", flow, 100);
      }
      if (Array.isArray(pressure)) {
        analyze("pressure", pressure, 4.0);
      }
      if (Array.isArray(current)) {
        analyze("current", current, 15.0);
      }

      const worstZ =
        Object.values(scores).length > 0 ? Math.max(...Object.values(scores).map(Math.abs)) : 0;
      const severity = worstZ > 3 ? "high" : worstZ > 2 ? "warn" : "info";

      return res.json({
        analysis: {
          severity,
          worstZ,
          scores,
          features,
          explanation: { vesselName, assetId, method: "pump_process_deviation" },
        },
      });
    } catch (error) {
      logger.error("Error analyzing pump data:", error);
      return res.status(500).json({ error: "Failed to analyze pump data" });
    }
  });
}
