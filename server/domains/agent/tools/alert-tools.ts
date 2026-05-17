import { db } from "../../../db";
import { eq, desc, and } from "drizzle-orm";
import { alertNotifications, failurePredictions, equipment } from "@shared/schema";
import { z } from "zod";
import { registerTool } from "./registry";

registerTool({
  name: "getOpenAlerts",
  category: "alerts",
  riskLevel: "read",
  description:
    "Get active alert notifications. Shows current issues and threshold breaches requiring attention.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "Optional equipment ID to filter alerts" },
      limit: { type: "number", description: "Max results (default 20)" },
    },
    required: [],
  },
  inputSchema: z.object({ equipmentId: z.string().optional(), limit: z.number().optional() }),
  requiresApproval: false,
  async execute(input: any, ctx: any) {
    const conditions = [eq(alertNotifications.orgId, ctx.orgId)];
    if (input.equipmentId) {
      conditions.push(eq(alertNotifications.equipmentId, input.equipmentId));
    }

    const alerts = await db
      .select()
      .from(alertNotifications)
      .where(and(...conditions))
      .orderBy(desc(alertNotifications.createdAt))
      .limit(input.limit || 20);

    return {
      total: alerts.length,
      alerts: alerts.map((a) => ({
        id: a.id,
        equipmentId: a.equipmentId,
        sensorType: a.sensorType,
        alertType: a.alertType,
        message: a.message,
        value: a.value,
        threshold: a.threshold,
        acknowledged: a.acknowledged,
        createdAt: a.createdAt,
      })),
    };
  },
});

registerTool({
  name: "explainPdmAlert",
  category: "alerts",
  riskLevel: "read",
  description:
    "Explain a predictive maintenance alert in detail. Provides context about the alert, related predictions, equipment info, and recommended actions.",
  parameters: {
    type: "object",
    properties: {
      alertId: { type: "string", description: "The alert ID to explain" },
    },
    required: ["alertId"],
  },
  inputSchema: z.object({ alertId: z.string().min(1) }),
  requiresApproval: false,
  async execute(input: any, ctx: any) {
    const [alert] = await db
      .select()
      .from(alertNotifications)
      .where(
        and(eq(alertNotifications.id, input.alertId), eq(alertNotifications.orgId, ctx.orgId))
      );

    if (!alert) {
      return { error: "Alert not found" };
    }

    const equipInfo = alert.equipmentId
      ? await db
          .select()
          .from(equipment)
          .where(and(eq(equipment.id, alert.equipmentId), eq(equipment.orgId, ctx.orgId)))
      : [];

    const relatedPredictions = alert.equipmentId
      ? await db
          .select()
          .from(failurePredictions)
          .where(
            and(
              eq(failurePredictions.equipmentId, alert.equipmentId),
              eq(failurePredictions.orgId, ctx.orgId)
            )
          )
          .orderBy(desc(failurePredictions.predictionTimestamp))
          .limit(5)
      : [];

    const eq1 = equipInfo[0];

    return {
      alert: {
        id: alert.id,
        equipmentId: alert.equipmentId,
        sensorType: alert.sensorType,
        alertType: alert.alertType,
        message: alert.message,
        value: alert.value,
        threshold: alert.threshold,
        acknowledged: alert.acknowledged,
        createdAt: alert.createdAt,
      },
      equipment: eq1
        ? {
            name: eq1.name,
            systemType: eq1.systemType,
            componentType: eq1.componentType,
            criticalityLevel: eq1.criticalityLevel,
            vesselName: eq1.vesselName,
          }
        : null,
      relatedPredictions: relatedPredictions.map((p) => {
        const prob = Number(p.failureProbability) || 0;
        const confidenceLevel = prob >= 0.8 ? "high" : prob >= 0.6 ? "medium" : "low";
        return {
          failureMode: p.failureMode,
          failureProbability: p.failureProbability,
          riskLevel: p.riskLevel,
          remainingUsefulLife: p.remainingUsefulLife,
          predictedFailureDate: p.predictedFailureDate,
          confidence: {
            level: confidenceLevel,
            warning:
              confidenceLevel === "low"
                ? "Low confidence prediction — verify with manual inspection"
                : undefined,
          },
        };
      }),
      explanation: buildAlertExplanation(alert, eq1, relatedPredictions),
    };
  },
});

function buildAlertExplanation(
  alert: typeof alertNotifications.$inferSelect,
  equip: typeof equipment.$inferSelect | undefined,
  predictions: (typeof failurePredictions.$inferSelect)[]
): string {
  const parts: string[] = [];
  parts.push(
    `Alert type: ${alert.alertType || "threshold breach"} on sensor: ${alert.sensorType || "unknown"}.`
  );
  if (alert.value != null && alert.threshold != null) {
    parts.push(`Current value ${alert.value} exceeded threshold ${alert.threshold}.`);
  }
  if (equip) {
    parts.push(
      `Equipment: ${equip.name} (${equip.systemType || "unknown system"}, criticality: ${equip.criticalityLevel || "standard"}).`
    );
  }
  if (predictions.length > 0) {
    const highRisk = predictions.filter(
      (p) => p.riskLevel === "high" || p.riskLevel === "critical"
    );
    if (highRisk.length > 0) {
      parts.push(
        `WARNING: ${highRisk.length} high/critical risk prediction(s) for this equipment. Immediate action recommended.`
      );
    }
    const nearest = predictions[0];
    if (nearest?.remainingUsefulLife) {
      parts.push(`Estimated remaining useful life: ${nearest.remainingUsefulLife} hours.`);
    }
  }
  return parts.join(" ");
}
