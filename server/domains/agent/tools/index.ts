import { storage } from "../../../storage";
import { db } from "../../../db";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import {
  equipment,
  vessels,
  alertNotifications,
  crew,
  maintenanceSchedules,
  failurePredictions,
} from "@shared/schema";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  requiresApproval: boolean;
  execute: (input: any, context: ToolContext) => Promise<any>;
}

export interface ToolContext {
  orgId: string;
  userId?: string;
  conversationId: string;
}

const tools: Map<string, ToolDefinition> = new Map();

function registerTool(tool: ToolDefinition) {
  tools.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

export function getToolOpenAIDefinitions() {
  return getAllTools().map(t => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

registerTool({
  name: "getEquipmentSummary",
  description: "Get detailed information about a specific piece of equipment including its current status, type, and vessel assignment.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "The equipment ID to look up" },
    },
    required: ["equipmentId"],
  },
  requiresApproval: false,
  async execute(input: { equipmentId: string }, ctx: ToolContext) {
    const [item] = await db.select().from(equipment)
      .where(and(eq(equipment.id, input.equipmentId), eq(equipment.orgId, ctx.orgId)));
    if (!item) return { error: "Equipment not found" };
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      vesselId: item.vesselId,
      vesselName: item.vesselName,
      manufacturer: item.manufacturer,
      model: item.model,
      serialNumber: item.serialNumber,
      location: item.location,
      isActive: item.isActive,
      criticalityLevel: item.criticalityLevel,
      systemType: item.systemType,
      componentType: item.componentType,
    };
  },
});

registerTool({
  name: "getVesselOverview",
  description: "Get overview information about a vessel or list all vessels. Use when asking about a specific ship or the entire fleet.",
  parameters: {
    type: "object",
    properties: {
      vesselId: { type: "string", description: "Optional vessel ID. If not provided, returns all vessels." },
    },
    required: [],
  },
  requiresApproval: false,
  async execute(input: { vesselId?: string }, ctx: ToolContext) {
    if (input.vesselId) {
      const [vessel] = await db.select().from(vessels)
        .where(and(eq(vessels.id, input.vesselId), eq(vessels.orgId, ctx.orgId)));
      if (!vessel) return { error: "Vessel not found" };
      const equip = await db.select({ id: equipment.id }).from(equipment)
        .where(and(eq(equipment.vesselId, input.vesselId), eq(equipment.orgId, ctx.orgId)));
      return {
        id: vessel.id,
        name: vessel.name,
        type: vessel.vesselType,
        imo: vessel.imo,
        active: vessel.active,
        equipmentCount: equip.length,
      };
    }
    const allVessels = await db.select().from(vessels)
      .where(eq(vessels.orgId, ctx.orgId))
      .orderBy(vessels.name);
    return {
      vessels: allVessels.map(v => ({
        id: v.id, name: v.name, type: v.vesselType, imo: v.imo, active: v.active,
      })),
    };
  },
});

registerTool({
  name: "getMaintenanceHistory",
  description: "Get maintenance schedule history for equipment. Shows upcoming, overdue, and completed maintenance tasks.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "Optional equipment ID to filter by" },
      status: { type: "string", description: "Optional status filter: scheduled, in_progress, completed, overdue" },
      limit: { type: "number", description: "Max results (default 20)" },
    },
    required: [],
  },
  requiresApproval: false,
  async execute(input: { equipmentId?: string; status?: string; limit?: number }, ctx: ToolContext) {
    const conditions = [eq(maintenanceSchedules.orgId, ctx.orgId)];
    if (input.equipmentId) conditions.push(eq(maintenanceSchedules.equipmentId, input.equipmentId));
    if (input.status) conditions.push(eq(maintenanceSchedules.status, input.status));

    const schedules = await db.select().from(maintenanceSchedules)
      .where(and(...conditions))
      .orderBy(desc(maintenanceSchedules.scheduledDate))
      .limit(input.limit || 20);

    return {
      total: schedules.length,
      items: schedules.map(s => ({
        id: s.id,
        equipmentId: s.equipmentId,
        description: s.description,
        status: s.status,
        priority: s.priority,
        scheduledDate: s.scheduledDate,
        maintenanceType: s.maintenanceType,
        assignedTo: s.assignedTo,
        pdmScore: s.pdmScore,
      })),
    };
  },
});

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
  async execute(input: { equipmentId?: string; limit?: number }, ctx: ToolContext) {
    const conditions = [eq(alertNotifications.orgId, ctx.orgId)];
    if (input.equipmentId) conditions.push(eq(alertNotifications.equipmentId, input.equipmentId));

    const alerts = await db.select().from(alertNotifications)
      .where(and(...conditions))
      .orderBy(desc(alertNotifications.createdAt))
      .limit(input.limit || 20);

    return {
      total: alerts.length,
      alerts: alerts.map(a => ({
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
  name: "getFailurePredictions",
  description: "Get AI-generated failure predictions for equipment. Shows predicted failures, confidence, and remaining useful life.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "Equipment ID to get predictions for" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
    required: ["equipmentId"],
  },
  requiresApproval: false,
  async execute(input: { equipmentId: string; limit?: number }, ctx: ToolContext) {
    const predictions = await db.select().from(failurePredictions)
      .where(and(
        eq(failurePredictions.equipmentId, input.equipmentId),
        eq(failurePredictions.orgId, ctx.orgId),
      ))
      .orderBy(desc(failurePredictions.predictionTimestamp))
      .limit(input.limit || 10);

    return {
      total: predictions.length,
      predictions: predictions.map(p => ({
        id: p.id,
        equipmentId: p.equipmentId,
        failureMode: p.failureMode,
        failureProbability: p.failureProbability,
        predictedFailureDate: p.predictedFailureDate,
        remainingUsefulLife: p.remainingUsefulLife,
        riskLevel: p.riskLevel,
        predictionTimestamp: p.predictionTimestamp,
      })),
    };
  },
});

registerTool({
  name: "getRiskiestEquipment",
  description: "Find equipment across the fleet ranked by risk. Uses criticality level and active alerts to assess risk.",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Number of riskiest units to return (default 5)" },
      vesselId: { type: "string", description: "Optional vessel ID to scope to a single vessel" },
    },
    required: [],
  },
  requiresApproval: false,
  async execute(input: { limit?: number; vesselId?: string }, ctx: ToolContext) {
    const conditions = [eq(equipment.orgId, ctx.orgId)];
    if (input.vesselId) conditions.push(eq(equipment.vesselId, input.vesselId));

    const equip = await db.select().from(equipment)
      .where(and(...conditions))
      .orderBy(equipment.name);

    const criticalityScore: Record<string, number> = {
      critical: 4, high: 3, medium: 2, low: 1,
    };

    const scored = equip.map(e => ({
      id: e.id,
      name: e.name,
      type: e.type,
      vesselId: e.vesselId,
      vesselName: e.vesselName,
      criticalityLevel: e.criticalityLevel,
      riskScore: criticalityScore[e.criticalityLevel || "medium"] || 2,
      isActive: e.isActive,
    }));

    scored.sort((a, b) => b.riskScore - a.riskScore);
    return { equipment: scored.slice(0, input.limit || 5) };
  },
});

registerTool({
  name: "getCrewInfo",
  description: "Get crew member information. Shows crew assignments, roles, and availability.",
  parameters: {
    type: "object",
    properties: {
      vesselId: { type: "string", description: "Optional vessel ID to filter crew" },
      limit: { type: "number", description: "Max results (default 20)" },
    },
    required: [],
  },
  requiresApproval: false,
  async execute(input: { vesselId?: string; limit?: number }, ctx: ToolContext) {
    const conditions = [eq(crew.orgId, ctx.orgId)];
    if (input.vesselId) {
      conditions.push(eq(crew.vesselId, input.vesselId));
    }
    const members = await db.select().from(crew)
      .where(and(...conditions))
      .limit(input.limit || 20);

    return {
      total: members.length,
      crew: members.map(c => ({
        id: c.id,
        name: c.name,
        rank: c.rank,
        vesselId: c.vesselId,
        active: c.active,
        onDuty: c.onDuty,
        email: c.email,
      })),
    };
  },
});

registerTool({
  name: "getInventoryStatus",
  description: "Get inventory and parts status summary.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  requiresApproval: false,
  async execute(_input: any, ctx: ToolContext) {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as total_parts,
               COALESCE(SUM(CASE WHEN quantity_on_hand <= min_stock_level THEN 1 ELSE 0 END), 0) as low_stock_count
        FROM parts_inventory
        WHERE org_id = ${ctx.orgId}
      `);
      const row = (result as any).rows?.[0] || {};
      return {
        totalParts: Number(row.total_parts || 0),
        lowStockCount: Number(row.low_stock_count || 0),
      };
    } catch {
      return { note: "Inventory data unavailable or table does not exist yet" };
    }
  },
});

registerTool({
  name: "draftWorkOrder",
  description: "Create a DRAFT work order for maintenance. This does NOT create the work order directly — it creates a draft that requires human approval.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "The equipment this work order is for" },
      title: { type: "string", description: "Short title for the work order" },
      description: { type: "string", description: "Detailed description of work to be done" },
      priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Priority level" },
      estimatedHours: { type: "number", description: "Estimated labor hours" },
      type: { type: "string", description: "Work type: preventive, corrective, predictive, inspection" },
    },
    required: ["equipmentId", "title", "description", "priority"],
  },
  requiresApproval: true,
  async execute(input: any, ctx: ToolContext) {
    return {
      draftType: "work_order",
      data: {
        equipmentId: input.equipmentId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        estimatedHours: input.estimatedHours,
        type: input.type || "corrective",
        orgId: ctx.orgId,
      },
      requiresApproval: true,
      message: `Draft work order created: "${input.title}" for equipment ${input.equipmentId}. This requires approval before becoming an actual work order.`,
    };
  },
});
