import { db } from "../../../db";
import { eq, desc, and, count } from "drizzle-orm";
import { agentTasks } from "@shared/schema";
import type { AgentTask, InsertAgentTask } from "@shared/schema";
import type { AgentTaskRepositoryPort, AgentTaskFilter } from "../domain/task-types";

export class AgentTaskRepositoryAdapter implements AgentTaskRepositoryPort {
  async create(data: InsertAgentTask): Promise<AgentTask> {
    const [task] = await db.insert(agentTasks).values(data).returning();
    return task;
  }

  async getById(id: string, orgId: string): Promise<AgentTask | null> {
    const [task] = await db
      .select()
      .from(agentTasks)
      .where(and(eq(agentTasks.id, id), eq(agentTasks.orgId, orgId)));
    return task ?? null;
  }

  async list(orgId: string, filter?: AgentTaskFilter): Promise<AgentTask[]> {
    const conditions = [eq(agentTasks.orgId, orgId)];
    if (filter?.status) {
      conditions.push(eq(agentTasks.status, filter.status));
    }
    if (filter?.priority) {
      conditions.push(eq(agentTasks.priority, filter.priority));
    }
    if (filter?.source) {
      conditions.push(eq(agentTasks.source, filter.source));
    }
    if (filter?.equipmentId) {
      conditions.push(eq(agentTasks.equipmentId, filter.equipmentId));
    }
    if (filter?.vesselId) {
      conditions.push(eq(agentTasks.vesselId, filter.vesselId));
    }

    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;

    return db
      .select()
      .from(agentTasks)
      .where(and(...conditions))
      .orderBy(desc(agentTasks.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async update(id: string, data: Partial<AgentTask>): Promise<AgentTask> {
    const [task] = await db
      .update(agentTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentTasks.id, id))
      .returning();
    return task;
  }

  async countByStatus(orgId: string): Promise<Record<string, number>> {
    const rows = await db
      .select({
        status: agentTasks.status,
        cnt: count(),
      })
      .from(agentTasks)
      .where(eq(agentTasks.orgId, orgId))
      .groupBy(agentTasks.status);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.status] = row.cnt;
    }
    return result;
  }
}
