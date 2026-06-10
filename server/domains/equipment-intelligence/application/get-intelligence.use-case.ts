import type { EquipmentIntelligenceRepository } from "../domain/ports.js";
import type { EquipmentIntelligenceData, EquipmentDetailData } from "../domain/types.js";

export function createGetIntelligenceUseCase(repo: EquipmentIntelligenceRepository) {
  return {
    async getOverview(orgId: string): Promise<EquipmentIntelligenceData> {
      const [fleet, equipment] = await Promise.all([
        repo.getFleetSummary(orgId),
        repo.getEquipmentRiskList(orgId),
      ]);

      equipment.sort((a, b) => {
        const riskOrder = { critical: 0, warning: 1, low: 2 };
        const riskDiff = riskOrder[a.risk] - riskOrder[b.risk];
        if (riskDiff !== 0) {
          return riskDiff;
        }
        // Unscored equipment (health null) sorts after scored items.
        return (a.health ?? Number.POSITIVE_INFINITY) - (b.health ?? Number.POSITIVE_INFINITY);
      });

      return { fleet, equipment };
    },

    async getDetail(orgId: string, equipmentId: string): Promise<EquipmentDetailData | null> {
      return repo.getEquipmentDetail(orgId, equipmentId);
    },
  };
}
