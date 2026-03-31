import { db } from "../../../db";
import { eq, and } from "drizzle-orm";
import { crew } from "@shared/schema";
import { registerTool } from "./registry";

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
  async execute(input: { vesselId?: string; limit?: number }, ctx) {
    const conditions = [eq(crew.orgId, ctx.orgId)];
    if (input.vesselId) conditions.push(eq(crew.vesselId, input.vesselId));

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
