import type { PdmRepositoryPort } from "../ports/pdm-repository.port";
import type { PdmDashboardData } from "../domain/types";

export interface GetDashboardInput {
  orgId: string;
}

export interface GetDashboardUseCase {
  execute(input: GetDashboardInput): Promise<PdmDashboardData>;
}

export function createGetDashboardUseCase(repository: PdmRepositoryPort): GetDashboardUseCase {
  return {
    async execute(input: GetDashboardInput): Promise<PdmDashboardData> {
      const [
        kpis,
        riskQueueNew,
        riskQueueActive,
        riskQueueResolved,
        telemetryCoverage,
        modelHealth,
        maintenancePipeline,
      ] = await Promise.all([
        repository.getFleetHealthKpis(input.orgId),
        repository.getRiskQueue(input.orgId, "new"),
        repository.getRiskQueue(input.orgId, "active"),
        repository.getRiskQueue(input.orgId, "resolved"),
        repository.getTelemetryCoverage(input.orgId),
        repository.getModelHealth(input.orgId),
        repository.getMaintenancePipeline(input.orgId),
      ]);

      return {
        kpis,
        riskQueue: {
          new: riskQueueNew,
          active: riskQueueActive,
          resolved: riskQueueResolved,
        },
        telemetryCoverage,
        modelHealth,
        maintenancePipeline,
      };
    },
  };
}
