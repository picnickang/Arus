import type { PdmRepositoryPort } from "../ports/pdm-repository.port";
import type { RiskQueueItem } from "../domain/types";

export interface GetRiskQueueInput {
  orgId: string;
  status?: "new" | "active" | "resolved";
}

export interface GetRiskQueueUseCase {
  execute(input: GetRiskQueueInput): Promise<RiskQueueItem[]>;
}

export function createGetRiskQueueUseCase(repository: PdmRepositoryPort): GetRiskQueueUseCase {
  return {
    async execute(input: GetRiskQueueInput): Promise<RiskQueueItem[]> {
      return repository.getRiskQueue(input.orgId, input.status);
    },
  };
}
