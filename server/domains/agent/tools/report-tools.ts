import { db } from "../../../db";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import {
  equipment, vessels, maintenanceSchedules,
  alertNotifications, failurePredictions,
} from "@shared/schema";
import { z } from "zod";
import { registerTool } from "./registry";

registerTool({
  name: "generateFleetReport",
  category: "analytics",
  riskLevel: "read",
  description: "Generate a comprehensive fleet health report. Aggregates equipment status, active alerts, upcoming maintenance, and failure predictions into a summary.",
  parameters: {
    type: "object",
    properties: {
      vesselId: { type: "string", description: "Optional vessel ID to scope the report" },
      period: { type: "string", enum: ["24h", "7d", "30d"], description: "Lookback period (default 7d)" },
    },
    required: [],
  },
  inputSchema: z.object({ vesselId: z.string().optional(), period: z.enum(["24h", "7d", "30d"]).optional() }),
  requiresApproval: false,
  async execute(input: { vesselId?: string; period?: string }, ctx) {
    const periodMs: Record<string, number> = {
      "24h": 86400000, "7d": 604800000, "30d": 2592000000,
    };
    const lookback = new Date(Date.now() - (periodMs[input.period || "7d"] || 604800000));

    const eqConditions = [eq(equipment.orgId, ctx.orgId)];
    if (input.vesselId) eqConditions.push(eq(equipment.vesselId, input.vesselId));

    const [allEquipment, activeAlerts, upcomingMaint, recentPredictions] = await Promise.all([
      db.select({
        id: equipment.id, name: equipment.name, type: equipment.type,
        criticalityLevel: equipment.criticalityLevel, isActive: equipment.isActive,
        vesselName: equipment.vesselName,
      }).from(equipment).where(and(...eqConditions)),

      db.select({
        id: alertNotifications.id, equipmentId: alertNotifications.equipmentId,
        alertType: alertNotifications.alertType, message: alertNotifications.message,
        createdAt: alertNotifications.createdAt,
      }).from(alertNotifications)
        .where(and(
          eq(alertNotifications.orgId, ctx.orgId),
          gte(alertNotifications.createdAt, lookback),
        ))
        .orderBy(desc(alertNotifications.createdAt))
        .limit(50),

      db.select({
        id: maintenanceSchedules.id, equipmentId: maintenanceSchedules.equipmentId,
        maintenanceType: maintenanceSchedules.maintenanceType,
        status: maintenanceSchedules.status,
        scheduledDate: maintenanceSchedules.scheduledDate,
        priority: maintenanceSchedules.priority,
      }).from(maintenanceSchedules)
        .where(and(
          eq(maintenanceSchedules.orgId, ctx.orgId),
          eq(maintenanceSchedules.status, "scheduled"),
        ))
        .orderBy(maintenanceSchedules.scheduledDate)
        .limit(30),

      db.select({
        equipmentId: failurePredictions.equipmentId,
        riskLevel: failurePredictions.riskLevel,
        failureProbability: failurePredictions.failureProbability,
        failureMode: failurePredictions.failureMode,
        predictedFailureDate: failurePredictions.predictedFailureDate,
      }).from(failurePredictions)
        .where(and(
          eq(failurePredictions.orgId, ctx.orgId),
          gte(failurePredictions.predictionTimestamp, lookback),
        ))
        .orderBy(desc(failurePredictions.failureProbability))
        .limit(20),
    ]);

    const criticalCount = allEquipment.filter(e => e.criticalityLevel === "critical").length;
    const highRiskPredictions = recentPredictions.filter(p => p.riskLevel === "high" || p.riskLevel === "critical");

    return {
      reportType: "fleet_health",
      period: input.period || "7d",
      generatedAt: new Date().toISOString(),
      summary: {
        totalEquipment: allEquipment.length,
        criticalEquipment: criticalCount,
        activeAlerts: activeAlerts.length,
        upcomingMaintenance: upcomingMaint.length,
        highRiskPredictions: highRiskPredictions.length,
      },
      alerts: activeAlerts.slice(0, 10),
      maintenanceDue: upcomingMaint.slice(0, 10),
      topRisks: highRiskPredictions.slice(0, 5),
    };
  },
});
