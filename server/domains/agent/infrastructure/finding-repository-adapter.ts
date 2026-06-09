import { db } from "../../../db";
import { eq, desc, and, count } from "drizzle-orm";
import { agentFindings } from "@shared/schema";
import type { AgentFinding, InsertAgentFinding } from "@shared/schema";
import type {
  AgentFindingRepositoryPort,
  AgentFindingFilter,
} from "../domain/finding-domain-types";
import { withGeneratedInsertDefaults } from "./generated-id";

export class AgentFindingRepositoryAdapter implements AgentFindingRepositoryPort {
  async create(data: InsertAgentFinding): Promise<AgentFinding> {
    const [finding] = await db
      .insert(agentFindings)
      .values(withGeneratedInsertDefaults(data, ["createdAt", "updatedAt"]))
      .returning();
    if (!finding) {
      throw new Error("Failed to create agent finding");
    }
    return finding;
  }

  async getById(id: string, orgId: string): Promise<AgentFinding | null> {
    const [finding] = await db
      .select()
      .from(agentFindings)
      .where(and(eq(agentFindings.id, id), eq(agentFindings.orgId, orgId)));
    return finding ?? null;
  }

  async list(orgId: string, filter?: AgentFindingFilter): Promise<AgentFinding[]> {
    const conditions = [eq(agentFindings.orgId, orgId)];
    if (filter?.findingType) {
      conditions.push(eq(agentFindings.findingType, filter.findingType));
    }
    if (filter?.severity) {
      conditions.push(eq(agentFindings.severity, filter.severity));
    }
    if (filter?.status) {
      conditions.push(eq(agentFindings.status, filter.status));
    }
    if (filter?.taskId) {
      conditions.push(eq(agentFindings.taskId, filter.taskId));
    }
    if (filter?.equipmentId) {
      conditions.push(eq(agentFindings.equipmentId, filter.equipmentId));
    }

    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;

    return db
      .select()
      .from(agentFindings)
      .where(and(...conditions))
      .orderBy(desc(agentFindings.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async update(id: string, data: Partial<AgentFinding>): Promise<AgentFinding> {
    const [finding] = await db
      .update(agentFindings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentFindings.id, id))
      .returning();
    if (!finding) {
      throw new Error(`Failed to update agent finding ${id}`);
    }
    return finding;
  }

  async listByTask(taskId: string, orgId: string): Promise<AgentFinding[]> {
    return db
      .select()
      .from(agentFindings)
      .where(and(eq(agentFindings.orgId, orgId), eq(agentFindings.taskId, taskId)))
      .orderBy(desc(agentFindings.createdAt));
  }

  async countByStatus(orgId: string): Promise<Record<string, number>> {
    const rows = await db
      .select({
        status: agentFindings.status,
        cnt: count(),
      })
      .from(agentFindings)
      .where(eq(agentFindings.orgId, orgId))
      .groupBy(agentFindings.status);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.status] = row.cnt;
    }
    return result;
  }
}
