/**
 * Equipment Service - Parts Operations
 */

import { equipmentRepository } from "../repository";
import { DualWriteAdapter } from "../../../infrastructure/DualWriteAdapter";
import { TenantRepositoryFactory } from "../../../infrastructure/TenantScopedRepository";
import { equipmentPartsProvider } from "../../../composition/equipment-cross-domain-data";

export async function getCompatibleParts(
  adapter: DualWriteAdapter,
  equipmentId: string,
  orgId: string
) {
  return adapter.execute({
    operation: "getCompatibleParts",
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.parts(orgId);
      return repo.getCompatibleParts(equipmentId);
    },
    legacyFn: () => equipmentRepository.getCompatibleParts(equipmentId, orgId, equipmentPartsProvider),
  });
}

export async function getSuggestedParts(
  adapter: DualWriteAdapter,
  equipmentId: string,
  orgId: string
) {
  return adapter.execute({
    operation: "getSuggestedParts",
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.parts(orgId);
      return repo.getSuggestedParts(equipmentId);
    },
    legacyFn: () => equipmentRepository.getSuggestedParts(equipmentId, orgId, equipmentPartsProvider),
  });
}
