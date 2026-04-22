import type { PdmRepositoryPort } from "../ports/pdm-repository.port";
import type { AssetDetail } from "../domain/types";

export interface GetAssetDetailInput {
  orgId: string;
  equipmentId: string;
}

export interface GetAssetDetailUseCase {
  execute(input: GetAssetDetailInput): Promise<AssetDetail | null>;
}

export function createGetAssetDetailUseCase(repository: PdmRepositoryPort): GetAssetDetailUseCase {
  return {
    async execute(input: GetAssetDetailInput): Promise<AssetDetail | null> {
      return repository.getAssetDetail(input.orgId, input.equipmentId);
    },
  };
}
