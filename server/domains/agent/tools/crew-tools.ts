import { db } from "../../../db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { crew, scheduleAssignments } from "@shared/schema";
import { z } from "zod";
import { registerTool } from "./registry";

registerTool({
  name: "getCrewInfo",
  category: "crew",
  riskLevel: "read",
  description: "Get crew member information. Shows crew assignments, roles, and availability.",
  parameters: {
    type: "object",
    properties: {
      vesselId: { type: "string", description: "Optional vessel ID to filter crew" },
      limit: { type: "number", description: "Max results (default 20)" },
    },
    required: [],
  },
  inputSchema: z.object({ vesselId: z.string().optional(), limit: z.number().optional() }),
  requiresApproval: false,
  async execute(input: { vesselId?: string; limit?: number }, ctx) {
    const conditions = [eq(crew.orgId, ctx.orgId)];
    if (input.vesselId) {conditions.push(eq(crew.vesselId, input.vesselId));}

    const members = await db.select().from(crew)
      .where(and(...conditions))
      .limit(input.limit || 20);

    return {
      total: members.length,
      crew: members.map(c => ({
        id: c.id, name: c.name, rank: c.rank,
        vesselId: c.vesselId, active: c.active,
        onDuty: c.onDuty, email: c.email,
      })),
    };
  },
});

registerTool({
  name: "getCrewSchedule",
  category: "crew",
  riskLevel: "read",
  description: "Get crew scheduling information including shift assignments, duty rosters, and upcoming schedules for a vessel or specific crew member.",
  parameters: {
    type: "object",
    properties: {
      vesselId: { type: "string", description: "Vessel ID to get crew schedule for" },
      crewMemberId: { type: "string", description: "Optional specific crew member ID" },
      limit: { type: "number", description: "Max assignment results (default 20)" },
    },
    required: [],
  },
  inputSchema: z.object({ vesselId: z.string().optional(), crewMemberId: z.string().optional(), limit: z.number().optional() }),
  requiresApproval: false,
  async execute(input: { vesselId?: string; crewMemberId?: string; limit?: number }, ctx) {
    const crewConditions = [eq(crew.orgId, ctx.orgId)];
    if (input.vesselId) {crewConditions.push(eq(crew.vesselId, input.vesselId));}
    if (input.crewMemberId) {crewConditions.push(eq(crew.id, input.crewMemberId));}

    const members = await db.select().from(crew)
      .where(and(...crewConditions))
      .limit(input.limit || 20);

    const crewIds = members.map(m => m.id);

    let assignments: (typeof scheduleAssignments.$inferSelect)[] = [];
    try {
      if (crewIds.length > 0) {
        const assignConditions = [inArray(scheduleAssignments.crewId, crewIds)];
        if (input.crewMemberId) {
          assignConditions.push(eq(scheduleAssignments.crewId, input.crewMemberId));
        }

        assignments = await db.select().from(scheduleAssignments)
          .where(and(...assignConditions))
          .orderBy(desc(scheduleAssignments.date))
          .limit(input.limit || 20);
      }
    } catch (err) {
      console.warn("[Agent] Schedule assignments query failed:", err instanceof Error ? err.message : "unknown");
      assignments = [];
    }

    const onDuty = members.filter(m => m.onDuty);
    const offDuty = members.filter(m => !m.onDuty);

    return {
      totalCrew: members.length,
      onDutyCount: onDuty.length,
      offDutyCount: offDuty.length,
      crew: members.map(c => ({
        id: c.id,
        name: c.name,
        rank: c.rank,
        vesselId: c.vesselId,
        onDuty: c.onDuty,
        active: c.active,
      })),
      recentAssignments: assignments.map(a => ({
        id: a.id,
        crewId: a.crewId,
        shiftId: a.shiftId,
        assignmentType: a.assignmentType,
        date: a.date,
        score: a.score,
      })),
    };
  },
});
