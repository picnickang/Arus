/**
 * Equipment Service - Health Operations
 */

import type { Equipment } from "@shared/schema";
import type { EquipmentHealth } from "../../../db/equipment/types.js";
import { equipmentRepository } from "../repository";
import { recordPdmScore, updateEquipmentHealthStatus } from "../../../observability";
import { DualWriteAdapter } from "../../../infrastructure/DualWriteAdapter";
import { TenantRepositoryFactory } from "../../../infrastructure/TenantScopedRepository";

function transformHealthMetrics(
  metrics: Array<{
    equipment: Equipment;
    latestScore: { score?: number; failureProbability?: number } | null | undefined;
  }>
): EquipmentHealth[] {
  return metrics.map(({ equipment, latestScore }) => {
    const equipmentRow = equipment as Equipment & { healthIndex?: number };
    const healthIndex = latestScore?.score ?? equipmentRow.healthIndex ?? 0;
    const status = healthIndex >= 75 ? "healthy" : healthIndex >= 50 ? "warning" : "critical";

    return {
      id: equipment.id,
      vessel: equipment.vesselId ?? "unknown",
      ...(equipment.vesselId != null && { vesselId: equipment.vesselId }),
      name: equipment.name,
      type: equipment.type,
      healthIndex,
      predictedDueDays: latestScore?.failureProbability
        ? Math.round((1 - latestScore.failureProbability) * 30)
        : 30,
      status,
    };
  });
}

export async function getEquipmentHealth(
  adapter: DualWriteAdapter,
  orgId: string,
  vesselId?: string,
  equipmentId?: string
): Promise<EquipmentHealth[]> {
  const health = await adapter.execute<EquipmentHealth[]>({
    operation: "getHealth",
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.equipment(orgId) as object as {
        getHealthMetrics: (
          vesselId?: string,
          equipmentId?: string
        ) => Promise<Parameters<typeof transformHealthMetrics>[0]>;
      };
      const metrics = await repo.getHealthMetrics(vesselId, equipmentId);
      return transformHealthMetrics(metrics);
    },
    legacyFn: async () => equipmentRepository.getHealth(orgId, vesselId as string, equipmentId),
  });

  const vesselHealthCounts: Record<string, Record<string, number>> = {};

  health.forEach((equipment) => {
    const vesselIdKey = equipment.vessel || "unknown";
    const status =
      equipment.healthIndex >= 75
        ? "healthy"
        : equipment.healthIndex >= 50
          ? "warning"
          : "critical";

    const bucket: Record<string, number> = (vesselHealthCounts[vesselIdKey] ??= {
      healthy: 0,
      warning: 0,
      critical: 0,
    });
    const key = status as "healthy" | "warning" | "critical";
    bucket[key] = (bucket[key] ?? 0) + 1;
    recordPdmScore(equipment.id, equipment.vessel ?? "", equipment.healthIndex);
  });

  Object.entries(vesselHealthCounts).forEach(([vesselId, counts]) => {
    updateEquipmentHealthStatus("healthy", counts["healthy"] ?? 0, vesselId);
    updateEquipmentHealthStatus("warning", counts["warning"] ?? 0, vesselId);
    updateEquipmentHealthStatus("critical", counts["critical"] ?? 0, vesselId);
  });

  return health;
}

export async function getEquipmentWithSensorIssues(
  adapter: DualWriteAdapter,
  orgId: string
): Promise<Equipment[]> {
  return adapter.execute({
    operation: "getEquipmentWithSensorIssues",
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.equipment(orgId);
      const sensorRepo = TenantRepositoryFactory.sensorConfiguration(orgId);
      const allEquipment = await repo.getAll();
      const equipmentWithIssues: Equipment[] = [];

      for (const equipment of allEquipment) {
        const sensors = await sensorRepo.getAll({ equipmentId: equipment.id });
        const hasSensors = sensors.length > 0;
        const allDisabled = sensors.every((s) => !s.enabled);
        const criticalDisabled = sensors.some(
          (s) => (s as { isCritical?: boolean }).isCritical && !s.enabled
        );

        if (!hasSensors || allDisabled || criticalDisabled) {
          equipmentWithIssues.push(equipment);
        }
      }
      return equipmentWithIssues;
    },
    legacyFn: () => equipmentRepository.getEquipmentWithSensorIssues(orgId),
  });
}
