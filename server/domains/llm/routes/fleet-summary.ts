/**
 * Fleet Summary Report Routes
 *
 * Fleet summary report generation endpoint.
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { analyzeFleetHealth } from "../../../openai";
import { withErrorHandling } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";
import { authenticatedRequest } from "../../../middleware/auth";
import {
  dbEquipmentStorage,
  dbTelemetryStorage,
  dbDevicesStorage,
  workOrderService,
} from "../../../repositories";

export function registerFleetSummaryRoutes(
  app: Express,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit } = rateLimiters;

  app.post(
    "/api/report/fleet-summary",
    generalApiRateLimit,
    withErrorHandling("generate fleet summary", async (req, res) => {
      const { lookbackHours = 168 } = req.body;

      const orgId = authenticatedRequest(req).orgId;
      const [equipmentHealth, telemetryData, workOrders, pdmScores] = await Promise.all([
        dbEquipmentStorage.getEquipmentHealth(orgId),
        dbTelemetryStorage.getTelemetryTrends(orgId, lookbackHours),
        workOrderService.getWorkOrdersWithDetails(),
        dbDevicesStorage.getPdmScores(undefined, orgId),
      ]);

      let fleetAnalysis:
        | Awaited<ReturnType<typeof analyzeFleetHealth>>
        | {
            totalEquipment: number;
            healthyEquipment: number;
            equipmentAtRisk: number;
            criticalEquipment: number;
            topRecommendations: string[];
            costEstimate: number;
            summary: string;
          };
      try {
        const analysisPromise = analyzeFleetHealth(equipmentHealth, telemetryData);
        fleetAnalysis = await Promise.race([
          analysisPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("AI analysis timeout")), 10000)
          ),
        ]);
      } catch (error) {
        logger.warn("FleetSummary", "Fleet analysis failed, using fallback", error);
        fleetAnalysis = {
          totalEquipment: equipmentHealth.length,
          healthyEquipment: equipmentHealth.filter((eq) => eq.healthIndex > 70).length,
          equipmentAtRisk: equipmentHealth.filter(
            (eq) => eq.healthIndex >= 30 && eq.healthIndex <= 70
          ).length,
          criticalEquipment: equipmentHealth.filter((eq) => eq.healthIndex < 30).length,
          topRecommendations: [
            "Review equipment with declining health scores",
            "Schedule preventive maintenance for at-risk equipment",
            "Monitor critical systems for immediate attention",
          ],
          costEstimate: equipmentHealth.length * 3000,
          summary: "Fleet summary generated using fallback analysis",
        };
      }

      const criticalWorkOrders = workOrders.filter(
        (wo) => wo.priority === 1 && wo.status === "open"
      );
      const avgHealthIndex =
        equipmentHealth.length > 0
          ? equipmentHealth.reduce((sum, eq) => sum + eq.healthIndex, 0) / equipmentHealth.length
          : 0;

      res.json({
        metadata: {
          title: "Fleet Summary Report",
          generatedAt: new Date().toISOString(),
          reportType: "fleet-summary",
          lookbackHours,
        },
        sections: {
          summary: {
            ...fleetAnalysis,
            avgHealthIndex: Math.round(avgHealthIndex),
            criticalWorkOrders: criticalWorkOrders.length,
          },
          equipment: equipmentHealth,
          criticalIssues: criticalWorkOrders,
          recentPdmScores: pdmScores.slice(0, 20),
        },
      });
    })
  );
}
