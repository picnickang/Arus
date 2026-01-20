/**
 * ML Analytics - Complete ML/PDM Export Route
 * 
 * Comprehensive export of all ML/PDM data in industry-standard format.
 */

import type { Express } from "express";
import type { MlAnalyticsConfig } from "./types.js";
import { logger } from "../../../utils/logger.js";

export function registerExportCompleteRoutes(app: Express, config: MlAnalyticsConfig) {
  const { storage, adaptiveTrainingWindow } = config;

  app.get("/api/analytics/export/ml-pdm-complete", async (req, res) => {
    try {
      const { orgId, format = "json" } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId parameter is required" });
      }

      const { rawTelemetry, vessels } = await import("../../../../shared/schema.js");
      const { db } = await import("../../../db.js");
      const { eq } = await import("drizzle-orm");

      const [
        mlModels,
        failurePredictions,
        anomalyDetections,
        thresholdOptimizations,
        pdmScores,
        telemetryData,
      ] = await Promise.all([
        storage.getMlModels(orgId as string),
        storage.getFailurePredictions(orgId as string),
        storage.getAnomalyDetections(orgId as string),
        storage.getThresholdOptimizations(orgId as string),
        storage.getPdmScores(),
        db
          .select({
            id: rawTelemetry.id,
            vessel: rawTelemetry.vessel,
            ts: rawTelemetry.ts,
            src: rawTelemetry.src,
            sig: rawTelemetry.sig,
            value: rawTelemetry.value,
            unit: rawTelemetry.unit,
            createdAt: rawTelemetry.createdAt,
          })
          .from(rawTelemetry)
          .innerJoin(vessels, eq(rawTelemetry.vessel, vessels.id))
          .where(eq(vessels.orgId, orgId as string)),
      ]);

      const enrichedModels = mlModels.map((model) => {
        const hyperparams = (model.hyperparameters ?? {}) as Record<string, unknown>;
        if (hyperparams.dataQualityTier) {return model;}
        if (hyperparams.lookbackDays) {
          const { tier, confidenceMultiplier } =
            adaptiveTrainingWindow.calculateTierFromLookbackDays(hyperparams.lookbackDays);
          return {
            ...model,
            hyperparameters: {
              ...hyperparams,
              dataQualityTier: tier,
              confidenceMultiplier,
              isLegacyEnriched: true,
            },
          };
        }
        return {
          ...model,
          hyperparameters: {
            ...hyperparams,
            dataQualityTier: "bronze",
            confidenceMultiplier: 0.85,
            lookbackDays: 30,
            isLegacyEnriched: true,
            enrichmentNote: "Default Bronze tier applied - no historical lookback data available",
          },
        };
      });

      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          orgId,
          dataVersion: "1.0",
          format: "ARUS ML/PDM Export",
          compatibility:
            "Industry-standard predictive maintenance format compatible with IBM Maximo, Azure IoT, SAP PM, Oracle EAM",
          note: "Includes raw telemetry data for model training in external platforms",
        },
        mlModels: enrichedModels,
        failurePredictions,
        anomalyDetections,
        thresholdOptimizations,
        pdmScores,
        telemetry: telemetryData,
        statistics: {
          totalModels: enrichedModels.length,
          totalPredictions: failurePredictions.length,
          totalAnomalies: anomalyDetections.length,
          totalOptimizations: thresholdOptimizations.length,
          totalPdmScores: pdmScores.length,
          totalTelemetryRecords: telemetryData.length,
        },
      };

      if (format === "csv") {
        const escapeCsv = (value: unknown) => {
          if (value === null || value === undefined) {return "";}
          const str = String(value);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replaceAll('"', '""')}"`;
          }
          return str;
        };

        const csvRows = [
          [
            "ModelID", "ModelName", "ModelType", "EquipmentType", "Status", "Version",
            "Accuracy", "Precision", "Recall", "F1Score", "DataQualityTier",
            "ConfidenceMultiplier", "LookbackDays", "IsLegacyEnriched", "DeployedAt", "CreatedAt",
          ].join(","),
          ...enrichedModels.map((m) => {
            const perf = (m.performanceMetrics ?? {}) as Record<string, unknown>;
            const hyper = (m.hyperparameters ?? {}) as Record<string, unknown>;
            return [
              escapeCsv(m.id), escapeCsv(m.name), escapeCsv(m.modelType),
              escapeCsv(m.equipmentType || "all"), escapeCsv(m.status), escapeCsv(m.version),
              escapeCsv(perf.accuracy), escapeCsv(perf.precision), escapeCsv(perf.recall),
              escapeCsv(perf.f1Score), escapeCsv(hyper.dataQualityTier),
              escapeCsv(hyper.confidenceMultiplier), escapeCsv(hyper.lookbackDays),
              escapeCsv(hyper.isLegacyEnriched), escapeCsv(m.deployedAt), escapeCsv(m.createdAt),
            ].join(",");
          }),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="arus-ml-models-export-${Date.now()}.csv"`);
        res.setHeader("X-Export-Note", "CSV contains ML models only. Use JSON format for complete multi-dataset export.");
        return res.send(csvRows);
      }

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="ml-pdm-export-${Date.now()}.json"`);
      res.json(exportData);
    } catch (error) {
      logger.error("ExportComplete", "Failed to export ML/PDM data", error);
      res.status(500).json({ message: "Failed to export ML/PDM data" });
    }
  });
}
