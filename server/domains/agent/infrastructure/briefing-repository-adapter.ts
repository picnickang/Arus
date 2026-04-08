import { db } from "../../../db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { agentBriefings } from "@shared/schema";
import type { AgentBriefing, InsertAgentBriefing } from "@shared/schema";
import type { BriefingRepositoryPort } from "../domain/briefing-types";

export class BriefingRepositoryAdapter implements BriefingRepositoryPort {
  async create(data: InsertAgentBriefing): Promise<AgentBriefing> {
    const [briefing] = await db.insert(agentBriefings).values(data).returning();
    return briefing;
  }

  async getById(id: string, orgId: string): Promise<AgentBriefing | null> {
    const [briefing] = await db.select().from(agentBriefings)
      .where(and(eq(agentBriefings.id, id), eq(agentBriefings.orgId, orgId)));
    return briefing || null;
  }

  async getLatest(orgId: string): Promise<AgentBriefing | null> {
    const [briefing] = await db.select().from(agentBriefings)
      .where(and(eq(agentBriefings.orgId, orgId), eq(agentBriefings.status, "ready")))
      .orderBy(desc(agentBriefings.generatedAt))
      .limit(1);
    return briefing || null;
  }

  async list(orgId: string, limit = 30): Promise<AgentBriefing[]> {
    return db.select().from(agentBriefings)
      .where(eq(agentBriefings.orgId, orgId))
      .orderBy(desc(agentBriefings.generatedAt))
      .limit(limit);
  }

  async listByDate(orgId: string, date: Date): Promise<AgentBriefing[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return db.select().from(agentBriefings)
      .where(and(
        eq(agentBriefings.orgId, orgId),
        gte(agentBriefings.generatedAt, dayStart),
        lte(agentBriefings.generatedAt, dayEnd),
      ))
      .orderBy(desc(agentBriefings.generatedAt));
  }

  async update(id: string, data: Partial<AgentBriefing>): Promise<AgentBriefing> {
    const [briefing] = await db.update(agentBriefings)
      .set(data)
      .where(eq(agentBriefings.id, id))
      .returning();
    return briefing;
  }
}
