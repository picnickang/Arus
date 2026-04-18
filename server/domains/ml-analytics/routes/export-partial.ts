/**
 * ML Analytics - Partial Export Routes
 * 
 * Individual export routes for ML models, telemetry, and predictions.
 */

import type { Express } from "express";
import { withErrorHandling } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { dbMlAnalyticsStorage } from "../../../db/ml-analytics/index.js";
import { dbTelemetryStorage } from "../../../db/telemetry/index.js";

export function registerExportPartialRoutes(app: Express, config: MlAnalyticsConfig) {
  const { adaptiveTrainingWindow } = config;

  app.get("/api/analytics/export/ml-models",
    withErrorHandling("export ML models", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, format = "json" } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }

      const models = await dbMlAnalyticsStorage.getMlModels(orgId as string);

      const enrichedModels = models.map((model) => {
        const hyperparams = (model.hyperparameters ?? {}) as Record<string, unknown>;
        if (!hyperparams.dataQualityTier && hyperparams.lookbackDays) {
          const { tier, confidenceMultiplier } =
            adaptiveTrainingWindow.calculateTierFromLookbackDays(hyperparams.lookbackDays);
          return {
            ...model,
            hyperparameters: { ...hyperparams, dataQualityTier: tier, confidenceMultiplier },
          };
        }
        return model;
      });

      const exportData = {
        format: "ML Model Export v1.0",
        compatibility: ["TensorFlow", "PyTorch", "scikit-learn", "IBM Maximo", "Azure ML"],
        exportedAt: new Date().toISOString(),
        models: enrichedModels.map((m) => ({
          id: m.id,
          name: m.name,
          type: m.modelType,
          equipmentType: m.equipmentType,
          status: m.status,
          version: m.version,
          hyperparameters: m.hyperparameters,
          performanceMetrics: m.performanceMetrics,
          featureImportance: m.featureImportance,
          deployedAt: m.deployedOn,
          createdAt: m.createdAt,
        })),
      };

      if (format === "csv") {
        const csvData = [
          "id,name,type,equipmentType,status,version,accuracy,precision,recall,f1Score,deployedAt,createdAt",
          ...enrichedModels.map((m) => {
            const perf = (m.performanceMetrics ?? {}) as Record<string, unknown>;
            return `${m.id},${m.name},${m.modelType},${m.equipmentType || ""},${m.status},${m.version},${perf.accuracy || ""},${perf.precision || ""},${perf.recall || ""},${perf.f1Score || ""},${m.deployedAt || ""},${m.createdAt}`;
          }),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="ml-models-export-${Date.now()}.csv"`);
        return res.send(csvData);
      }

      res.json(exportData);
    })
  );

  app.get("/api/analytics/export/telemetry",
    withErrorHandling("export telemetry", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, equipmentId, startDate, endDate, format = "json" } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const telemetry = equipmentId
        ? await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(equipmentId as string, start, end)
        : await dbTelemetryStorage.getTelemetryByDateRange(start, end, orgId as string);

      const exportData = {
        format: "Telemetry Export v1.0",
        compatibility: ["Azure IoT", "AWS IoT", "Google Cloud IoT", "InfluxDB", "TimescaleDB"],
        exportedAt: new Date().toISOString(),
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        recordCount: telemetry.length,
        telemetry: telemetry.map((t) => ({
          timestamp: t.ts,
          equipmentId: t.equipmentId,
          vesselId: t.vesselId,
          sensorType: t.sensorType,
          value: t.value,
          unit: t.unit,
          status: t.status,
          threshold: t.threshold,
        })),
      };

      if (format === "csv") {
        const csvData = [
          "timestamp,equipmentId,vesselId,sensorType,value,unit,status,threshold",
          ...telemetry.map(
            (t) =>
              `${t.ts},${t.equipmentId},${t.vesselId || ""},${t.sensorType},${t.value},${t.unit},${t.status},${t.threshold || ""}`
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="telemetry-export-${Date.now()}.csv"`);
        return res.send(csvData);
      }

      res.json(exportData);
    })
  );

  app.get("/api/analytics/export/predictions",
    withErrorHandling("export predictions", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, format = "json" } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }

      const predictions = await dbMlAnalyticsStorage.getFailurePredictions(orgId as string);

      const exportData = {
        format: "Predictive Maintenance Export v1.0",
        compatibility: ["IBM Maximo", "SAP PM", "Oracle EAM", "Infor EAM"],
        exportedAt: new Date().toISOString(),
        predictions: predictions.map((p) => ({
          id: p.id,
          equipmentId: p.equipmentId,
          failureProbability: p.failureProbability,
          predictedFailureDate: p.predictedFailureDate,
          remainingUsefulLife: p.remainingUsefulLife,
          healthIndex: p.healthIndex,
          riskLevel: p.riskLevel,
          modelId: p.modelId,
          recommendations: p.recommendations,
          createdAt: p.createdAt,
        })),
      };

      if (format === "csv") {
        const csvData = [
          "id,equipmentId,failureProbability,predictedFailureDate,remainingUsefulLife,healthIndex,riskLevel,modelId,createdAt",
          ...predictions.map(
            (p) =>
              `${p.id},${p.equipmentId},${p.failureProbability},${p.predictedFailureDate || ""},${p.remainingUsefulLife || ""},${p.healthIndex},${p.riskLevel},${p.modelId || ""},${p.createdAt}`
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="predictions-export-${Date.now()}.csv"`);
        return res.send(csvData);
      }

      res.json(exportData);
    })
  );
}
