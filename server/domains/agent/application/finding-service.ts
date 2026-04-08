import type { AgentFindingRepositoryPort, AgentFindingFilter } from "../domain/finding-domain-types";
import type { AgentFinding, InsertAgentFinding } from "@shared/schema";

export class AgentFindingService {
  constructor(private readonly repo: AgentFindingRepositoryPort) {}

  async create(data: InsertAgentFinding): Promise<AgentFinding> {
    return this.repo.create(data);
  }

  async getById(id: string, orgId: string): Promise<AgentFinding | null> {
    return this.repo.getById(id, orgId);
  }

  async list(orgId: string, filter?: AgentFindingFilter): Promise<AgentFinding[]> {
    return this.repo.list(orgId, filter);
  }

  async update(id: string, orgId: string, data: Partial<AgentFinding>): Promise<AgentFinding> {
    const finding = await this.repo.getById(id, orgId);
    if (!finding) throw new Error("Finding not found");
    const { id: _, orgId: __, ...safeData } = data as Record<string, unknown>;
    return this.repo.update(id, safeData as Partial<AgentFinding>);
  }

  async listByTask(taskId: string, orgId: string): Promise<AgentFinding[]> {
    return this.repo.listByTask(taskId, orgId);
  }

  async countByStatus(orgId: string): Promise<Record<string, number>> {
    return this.repo.countByStatus(orgId);
  }
}
