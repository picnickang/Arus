import type { PdmRepositoryPort } from '../ports/pdm-repository.port';

export interface AcknowledgeRiskInput {
  orgId: string;
  itemId: string;
  userId: string;
}

export interface AcknowledgeRiskUseCase {
  execute(input: AcknowledgeRiskInput): Promise<void>;
}

export function createAcknowledgeRiskUseCase(repository: PdmRepositoryPort): AcknowledgeRiskUseCase {
  return {
    async execute(input: AcknowledgeRiskInput): Promise<void> {
      await repository.acknowledgeRiskItem(input.orgId, input.itemId, input.userId);
    },
  };
}
