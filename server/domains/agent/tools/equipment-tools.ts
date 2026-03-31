import { db } from "../../../db";
import { eq, and } from "drizzle-orm";
import { equipment, vessels } from "@shared/schema";
import { registerTool } from "./registry";

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
  async execute(input: { equipmentId: string }, ctx) {
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
  async execute(input: { vesselId?: string }, ctx) {
    if (input.vesselId) {
      const [vessel] = await db.select().from(vessels)
        .where(and(eq(vessels.id, input.vesselId), eq(vessels.orgId, ctx.orgId)));
      if (!vessel) return { error: "Vessel not found" };
      const equip = await db.select({ id: equipment.id }).from(equipment)
        .where(and(eq(equipment.vesselId, input.vesselId), eq(equipment.orgId, ctx.orgId)));
      return {
        id: vessel.id, name: vessel.name, type: vessel.vesselType,
        imo: vessel.imo, active: vessel.active, equipmentCount: equip.length,
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
  async execute(input: { limit?: number; vesselId?: string }, ctx) {
    const conditions = [eq(equipment.orgId, ctx.orgId)];
    if (input.vesselId) conditions.push(eq(equipment.vesselId, input.vesselId));

    const equip = await db.select().from(equipment)
      .where(and(...conditions))
      .orderBy(equipment.name);

    const criticalityScore: Record<string, number> = {
      critical: 4, high: 3, medium: 2, low: 1,
    };

    const scored = equip.map(e => ({
      id: e.id, name: e.name, type: e.type,
      vesselId: e.vesselId, vesselName: e.vesselName,
      criticalityLevel: e.criticalityLevel,
      riskScore: criticalityScore[e.criticalityLevel || "medium"] || 2,
      isActive: e.isActive,
    }));

    scored.sort((a, b) => b.riskScore - a.riskScore);
    return { equipment: scored.slice(0, input.limit || 5) };
  },
});
