import { db } from "../../../db";
import { eq, desc, and } from "drizzle-orm";
import { maintenanceSchedules } from "@shared/schema";
import { z } from "zod";
import { registerTool } from "./registry";

registerTool({
  name: "getMaintenanceHistory",
  category: "maintenance",
  riskLevel: "read",
  description:
    "Get maintenance schedule history for equipment. Shows upcoming, overdue, and completed maintenance tasks.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "Optional equipment ID to filter by" },
      status: {
        type: "string",
        description: "Optional status filter: scheduled, in_progress, completed, overdue",
      },
      limit: { type: "number", description: "Max results (default 20)" },
    },
    required: [],
  },
  inputSchema: z.object({
    equipmentId: z.string().optional(),
    status: z.string().optional(),
    limit: z.number().optional(),
  }),
  requiresApproval: false,
  async execute(input: { equipmentId?: string; status?: string; limit?: number }, ctx) {
    const conditions = [eq(maintenanceSchedules.orgId, ctx.orgId)];
    if (input.equipmentId) {
      conditions.push(eq(maintenanceSchedules.equipmentId, input.equipmentId));
    }
    if (input.status) {
      conditions.push(eq(maintenanceSchedules.status, input.status));
    }

    const schedules = await db
      .select()
      .from(maintenanceSchedules)
      .where(and(...conditions))
      .orderBy(desc(maintenanceSchedules.nextScheduledDate))
      .limit(input.limit || 20);

    return {
      total: schedules.length,
      items: schedules.map((s) => ({
        id: s.id,
        equipmentId: s.equipmentId,
        description: s.description,
        status: s.status,
        priority: s.priority,
        scheduledDate: s.nextScheduledDate,
        maintenanceType: s.maintenanceType,
        assignedTo: s.assignedTo,
        pdmScore: s.pdmScore,
      })),
    };
  },
});
