import { db } from "../../../db";
import { eq, desc, and } from "drizzle-orm";
import { alertNotifications } from "@shared/schema";
import { registerTool } from "./registry";

registerTool({
  name: "getOpenAlerts",
  description: "Get active alert notifications. Shows current issues and threshold breaches requiring attention.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "Optional equipment ID to filter alerts" },
      limit: { type: "number", description: "Max results (default 20)" },
    },
    required: [],
  },
  requiresApproval: false,
  async execute(input: { equipmentId?: string; limit?: number }, ctx) {
    const conditions = [eq(alertNotifications.orgId, ctx.orgId)];
    if (input.equipmentId) conditions.push(eq(alertNotifications.equipmentId, input.equipmentId));

    const alerts = await db.select().from(alertNotifications)
      .where(and(...conditions))
      .orderBy(desc(alertNotifications.createdAt))
      .limit(input.limit || 20);

    return {
      total: alerts.length,
      alerts: alerts.map(a => ({
        id: a.id, equipmentId: a.equipmentId,
        sensorType: a.sensorType, alertType: a.alertType,
        message: a.message, value: a.value,
        threshold: a.threshold, acknowledged: a.acknowledged,
        createdAt: a.createdAt,
      })),
    };
  },
});
