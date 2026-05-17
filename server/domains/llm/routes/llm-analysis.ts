/**
 * LLM Analysis Routes
 *
 * Equipment and fleet analysis endpoints using AI.
 */

import { Express } from "express";
import { z } from "zod";
import { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";
import {
  dbEquipmentStorage,
  dbTelemetryStorage,
  dbDevicesStorage,
  dbAlertStorage,
  vesselService,
} from "../../../repositories";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export function registerLlmAnalysisRoutes(
  app: Express,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
    reportGenerationRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit, reportGenerationRateLimit } = rateLimiters;

  app.post(
    "/api/llm/equipment/analyze",
    reportGenerationRateLimit,
    withErrorHandling("analyze equipment health", async (req, res) => {
      const { equipmentId, sensorType, hours = 24, equipmentType } = req.body;

      if (!equipmentId || !sensorType) {
        return res.status(400).json({
          message: "Equipment ID and sensor type are required",
        });
      }

      const { analyzeEquipmentHealth } = await import("../../../openai");
      const telemetryData = await dbTelemetryStorage.getTelemetryHistory(
        equipmentId,
        sensorType,
        hours
      );

      if (telemetryData.length === 0) {
        return res.status(404).json({
          message: "No telemetry data found for equipment",
          equipmentId,
          sensorType,
        });
      }

      const analysis = await analyzeEquipmentHealth(telemetryData, equipmentId, equipmentType);
      res.json(analysis);
    })
  );

  app.post(
    "/api/llm/fleet/analyze",
    reportGenerationRateLimit,
    withErrorHandling("analyze fleet health", async (req, res) => {
      const { hours = 24 } = req.body;
      const { analyzeFleetHealth } = await import("../../../openai");

      const [equipmentHealth, telemetryTrends] = await Promise.all([
        dbEquipmentStorage.getEquipmentHealth(DEFAULT_ORG_ID),
        dbTelemetryStorage.getTelemetryTrends(undefined, hours),
      ]);

      if (equipmentHealth.length === 0) {
        return res.status(404).json({
          message: "No equipment health data available for fleet analysis",
        });
      }

      const fleetAnalysis = await analyzeFleetHealth(equipmentHealth, telemetryTrends);
      res.json(fleetAnalysis);
    })
  );

  app.post(
    "/api/llm/maintenance/recommend",
    generalApiRateLimit,
    withErrorHandling("generate maintenance recommendations", async (req, res) => {
      const { alertType, equipmentId, sensorData, equipmentType } = req.body;

      if (!alertType || !equipmentId) {
        return res.status(400).json({
          message: "Alert type and equipment ID are required",
        });
      }

      const { generateMaintenanceRecommendations } = await import("../../../openai");
      const recommendations = await generateMaintenanceRecommendations(
        alertType,
        equipmentId,
        sensorData,
        equipmentType
      );

      res.json(recommendations);
    })
  );

  app.get(
    "/api/llm/equipment/:equipmentId/insights",
    generalApiRateLimit,
    withErrorHandling("generate equipment insights", async (req, res) => {
      const { equipmentId } = req.params;
      const { includeRecommendations = "true", hours = "24" } = req.query;

      const { analyzeEquipmentHealth, generateMaintenanceRecommendations } = await import(
        "../../../openai"
      );

      const [device, equipmentHealth, alerts, telemetryTrends, pdmScore] = await Promise.all([
        dbDevicesStorage.getDevice(equipmentId),
        dbEquipmentStorage.getEquipmentHealth(DEFAULT_ORG_ID),
        dbAlertStorage.getAlertNotifications(),
        dbTelemetryStorage.getTelemetryTrends(equipmentId, Number.parseInt(hours as string)),
        dbDevicesStorage.getLatestPdmScore(equipmentId),
      ]);

      const recentAlerts = alerts.filter((alert) => alert.equipmentId === equipmentId).slice(0, 10);
      const equipmentHealthData = equipmentHealth.find((h) => h.equipmentId === equipmentId);

      if (telemetryTrends.length === 0) {
        return res.status(404).json({
          message: "No telemetry data found for equipment",
          equipmentId,
        });
      }

      const analysis = await analyzeEquipmentHealth(telemetryTrends, equipmentId, device?.deviceType ?? undefined);

      let alertRecommendations: any[] = [];
      if (includeRecommendations === "true" && recentAlerts.length > 0) {
        try {
          const combinedAlertContext = recentAlerts.slice(0, 3).map((alert) => ({
            alertType: alert.alertType,
            sensorType: alert.sensorType,
            // alert_notifications has no severity column; fall back to alertType.
            severity: alert.alertType || "medium",
            timestamp: alert.createdAt,
          }));

          const combinedRecommendation = await generateMaintenanceRecommendations(
            "combined_analysis",
            equipmentId,
            { recentAlerts: combinedAlertContext },
            device?.deviceType ?? undefined
          );
          alertRecommendations = [combinedRecommendation];
        } catch (error) {
          logger.warn(
            "LlmAnalysis",
            "Failed to generate combined recommendations, skipping",
            error
          );
          alertRecommendations = [];
        }
      }

      res.json({
        equipment: {
          device,
          health: equipmentHealthData,
          pdmScore,
        },
        analysis,
        alerts: recentAlerts,
        alertRecommendations,
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.get(
    "/api/llm/vessel/:vesselId/intelligence",
    generalApiRateLimit,
    withErrorHandling("load vessel intelligence", async (req, res) => {
      const paramsSchema = z.object({
        vesselId: z.string().uuid("Invalid vessel ID format"),
      });
      const querySchema = z.object({
        lookbackDays: z.string().regex(/^\d+$/).optional().default("365"),
      });

      const { vesselId } = paramsSchema.parse(req.params);
      const { lookbackDays } = querySchema.parse(req.query);

      const vessel = await vesselService.getVessel(vesselId);
      if (!vessel) {
        return res.status(404).json({
          success: false,
          error: "Vessel not found",
        });
      }

      const [equipment, alerts, telemetry, pdmScores] = await Promise.all([
        dbEquipmentStorage
          .getEquipmentHealth(DEFAULT_ORG_ID)
          .then((all) => all.filter((e) => (e as unknown as { vessel?: string }).vessel === vesselId)),
        // alert_notifications has no vessel_id; scope by equipment owned by the vessel.
        dbAlertStorage
          .getAlertNotifications()
          .then(async (all) => {
            const vesselEquipment = await dbEquipmentStorage.getEquipmentHealth(DEFAULT_ORG_ID);
            const vesselEquipmentIds = new Set(
              vesselEquipment
                .filter((e) => (e as unknown as { vessel?: string }).vessel === vesselId)
                .map((e) => e.id)
            );
            return all.filter((a) => vesselEquipmentIds.has(a.equipmentId)).slice(0, 20);
          }),
        dbTelemetryStorage.getLatestTelemetryReadings(undefined, 500, vesselId).catch(() => []),
        dbDevicesStorage
          .getPdmScores()
          .then((scores) => scores.filter((s) => (s as unknown as { vessel?: string }).vessel === vesselId)),
      ]);

      const vesselExtra = vessel as unknown as { type?: string; operational_status?: string };
      // alert_notifications canonical shape: alertType is the severity discriminator,
      // `acknowledged` is the resolution flag. Pre-reconcile this used non-existent
      // `severity` / `status` columns and silently returned defaults.
      const alertsExtra = alerts;
      const pdmExtra = pdmScores as unknown as Array<{ anomalyScore?: number; failureProbability?: number }>;
      const intelligence = {
        vesselName: vessel.name,
        vesselId: vessel.id,
        vesselType: vesselExtra.type ?? vessel.vesselType,
        operationalStatus: vesselExtra.operational_status || "active",
        totalEquipment: equipment.length,
        healthyEquipment: equipment.filter((e) => (e.healthIndex || 0) > 70).length,
        atRiskEquipment: equipment.filter((e) => {
          const health = e.healthIndex || 0;
          return health >= 30 && health <= 70;
        }).length,
        criticalEquipment: equipment.filter((e) => (e.healthIndex || 0) < 30).length,
        totalAlerts: alerts.length,
        // alert_notifications has no `severity` or `status` columns; alertType is
        // the severity discriminator and `acknowledged` is the resolution flag.
        criticalAlerts: alertsExtra.filter((a) => a.alertType === "critical").length,
        unresolvedAlerts: alertsExtra.filter((a) => !a.acknowledged).length,
        averagePdmScore:
          pdmScores.length > 0
            ? pdmExtra.reduce((sum, s) => sum + (s.anomalyScore || 0), 0) / pdmScores.length
            : null,
        failurePredictions: pdmExtra.filter((s) => (s.failureProbability || 0) > 0.5).length,
        recentTelemetryPoints: telemetry.length,
        dataFreshness:
          telemetry.length > 0 && telemetry[0].ts
            ? new Date(telemetry[0].ts).toISOString()
            : null,
        topIssues: alertsExtra
          .filter((a) => !a.acknowledged)
          .sort((a, b) => {
            // alertType is the severity discriminator; unknown values sort last.
            const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
            return (
              (severityOrder[a.alertType] ?? 4) -
              (severityOrder[b.alertType] ?? 4)
            );
          })
          .slice(0, 5)
          .map((a) => ({
            alertType: a.alertType,
            severity: a.alertType,
            equipmentId: a.equipmentId,
            createdAt: a.createdAt,
          })),
        analysisTimestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        intelligence,
      });
    })
  );
}
