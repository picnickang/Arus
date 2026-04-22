import type { AgentTaskRepositoryPort, TaskStatus } from "../domain/task-types";
import { isValidStatusTransition, TASK_STATUSES } from "../domain/task-types";
import type { AgentTask, InsertAgentTask } from "@shared/schema";
import type { AgentTaskFilter } from "../domain/task-types";

export class AgentTaskService {
  constructor(private readonly repo: AgentTaskRepositoryPort) {}

  async create(data: InsertAgentTask): Promise<AgentTask> {
    return this.repo.create(data);
  }

  async getById(id: string, orgId: string): Promise<AgentTask | null> {
    return this.repo.getById(id, orgId);
  }

  async list(orgId: string, filter?: AgentTaskFilter): Promise<AgentTask[]> {
    return this.repo.list(orgId, filter);
  }

  async updateStatus(
    id: string,
    orgId: string,
    newStatus: TaskStatus,
    outcome?: string
  ): Promise<AgentTask> {
    const task = await this.repo.getById(id, orgId);
    if (!task) {
      throw new Error("Task not found");
    }

    const currentStatus = task.status as TaskStatus;
    if (!TASK_STATUSES.includes(currentStatus)) {
      throw new Error(`Invalid current status: ${currentStatus}`);
    }
    if (!isValidStatusTransition(currentStatus, newStatus)) {
      throw new Error(`Cannot transition from '${currentStatus}' to '${newStatus}'`);
    }

    const updateData: Partial<AgentTask> = { status: newStatus };
    if (newStatus === "completed" || newStatus === "failed") {
      updateData.completedAt = new Date();
    }
    if (outcome) {
      updateData.outcome = outcome;
    }

    return this.repo.update(id, updateData);
  }

  async update(id: string, orgId: string, data: Partial<AgentTask>): Promise<AgentTask> {
    const task = await this.repo.getById(id, orgId);
    if (!task) {
      throw new Error("Task not found");
    }
    const { id: _, orgId: __, ...safeData } = data as Record<string, unknown>;
    return this.repo.update(id, safeData as Partial<AgentTask>);
  }

  async countByStatus(orgId: string): Promise<Record<string, number>> {
    return this.repo.countByStatus(orgId);
  }
}
