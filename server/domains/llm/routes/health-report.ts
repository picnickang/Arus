/**
 * Health Report Routes
 * 
 * Fleet health report generation endpoint.
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { analyzeFleetHealth } from "../../../openai";
import { withErrorHandling } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";
import { dbEquipmentStorage, dbTelemetryStorage, dbAlertStorage, workOrderService } from "../../../repositories";

export function registerHealthReportRoutes(
  app: Express,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit } = rateLimiters;

  app.post("/api/report/health", generalApiRateLimit,
    withErrorHandling("generate health report", async (req, res) => {
      const { vesselId, equipmentId, lookbackHours = 24 } = req.body;

      const equipmentHealth = await dbEquipmentStorage.getEquipmentHealth();
      const filteredEquipmentHealth = vesselId
        ? equipmentHealth.filter((eq) => eq.vessel === vesselId)
        : equipmentId
          ? equipmentHealth.filter((eq) => eq.id === equipmentId)
          : equipmentHealth;

      const telemetryData = equipmentId
        ? await dbTelemetryStorage.getTelemetryTrends(equipmentId, lookbackHours)
        : await dbTelemetryStorage.getTelemetryTrends("", lookbackHours);

      let fleetAnalysis: any;
      try {
        const analysisPromise = analyzeFleetHealth(filteredEquipmentHealth, telemetryData);
        fleetAnalysis = await Promise.race([
          analysisPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AI analysis timeout")), 10000)
          ),
        ]);
      } catch (error) {
        logger.warn("HealthReport", "Fleet analysis failed, using fallback", error);
        fleetAnalysis = {
          totalEquipment: filteredEquipmentHealth.length,
          healthyEquipment: filteredEquipmentHealth.filter((eq) => eq.healthIndex > 70).length,
          equipmentAtRisk: filteredEquipmentHealth.filter(
            (eq) => eq.healthIndex >= 30 && eq.healthIndex <= 70
          ).length,
          criticalEquipment: filteredEquipmentHealth.filter((eq) => eq.healthIndex < 30).length,
          topRecommendations: [
            "Schedule maintenance for equipment with health scores below 70%",
            "Monitor critical equipment closely for deteriorating conditions",
            "Review recent alert patterns for early warning signs",
          ],
          costEstimate: filteredEquipmentHealth.length * 2500,
          summary: "Fleet analysis completed using fallback mode due to AI service timeout",
          riskMatrix: [],
          prioritizedActions: [],
          systemIntegration: {
            linkedWorkOrders: 0,
            pendingComplianceItems: 0,
            scheduledMaintenanceOverlap: 0,
          },
          fleetBenchmarks: {
            fleetAverage: { healthIndex: 0, predictedDueDays: 0, maintenanceFrequency: 0 },
            performancePercentiles: { top10Percent: 0, median: 0, bottom10Percent: 0 },
            bestPerformers: [],
            worstPerformers: [],
          },
          equipmentComparisons: [],
        };
      }

      const [workOrders, alerts] = await Promise.all([
        workOrderService.getWorkOrdersWithDetails(),
        dbAlertStorage.getAlertNotifications(),
      ]);

      const filteredWorkOrders = equipmentId
        ? workOrders.filter((wo) => wo.equipmentId === equipmentId)
        : workOrders;

      res.json({
        metadata: {
          title: "Fleet Health Report",
          generatedAt: new Date().toISOString(),
          reportType: "health",
          equipmentFilter: equipmentId || vesselId || "all",
        },
        sections: {
          summary: {
            totalEquipment: fleetAnalysis.totalEquipment,
            healthyEquipment: fleetAnalysis.healthyEquipment,
            criticalEquipment: fleetAnalysis.criticalEquipment,
            openWorkOrders: filteredWorkOrders.filter((wo) => wo.status === "open").length,
          },
          analysis: fleetAnalysis,
          equipmentHealth: filteredEquipmentHealth,
          workOrders: filteredWorkOrders.slice(0, 20),
          alerts: alerts.slice(0, 10),
        },
      });
    })
  );
}
