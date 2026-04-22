import type { PdmRepositoryPort } from "../ports/pdm-repository.port";

export interface CreateWorkOrderFromRiskInput {
  orgId: string;
  itemId: string;
  userId: string;
}

export interface CreateWorkOrderFromRiskOutput {
  workOrderId: string;
}

export interface CreateWorkOrderFromRiskUseCase {
  execute(input: CreateWorkOrderFromRiskInput): Promise<CreateWorkOrderFromRiskOutput>;
}

export function createCreateWorkOrderFromRiskUseCase(
  repository: PdmRepositoryPort
): CreateWorkOrderFromRiskUseCase {
  return {
    async execute(input: CreateWorkOrderFromRiskInput): Promise<CreateWorkOrderFromRiskOutput> {
      const workOrderId = await repository.createWorkOrderFromRisk(
        input.orgId,
        input.itemId,
        input.userId
      );
      return { workOrderId };
    },
  };
}
