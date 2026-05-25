/**
 * Equipment Service - Sensor Operations
 */

import { equipmentRepository } from "../repository";
import { DualWriteAdapter } from "../../../infrastructure/DualWriteAdapter";
import { TenantRepositoryFactory } from "../../../infrastructure/TenantScopedRepository";
import { DEFAULT_SENSORS, type SensorCoverageResult, type SensorSetupResult } from "./types.js";

export async function getSensorCoverage(
  adapter: DualWriteAdapter,
  equipmentId: string,
  orgId: string
): Promise<SensorCoverageResult> {
  return adapter.execute({
    operation: "getSensorCoverage",
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.sensorConfiguration(orgId);
      type SensorRow = Awaited<ReturnType<typeof repo.getAll>>[number] & {
        isCritical?: boolean | null;
        minValue?: number | null;
        maxValue?: number | null;
      };
      const sensors = (await repo.getAll({ equipmentId })) as SensorRow[];

      const totalSensors = sensors.length;
      const enabledSensors = sensors.filter((s) => s.enabled).length;
      const criticalSensors = sensors.filter((s) => s.isCritical).length;
      const criticalEnabled = sensors.filter((s) => s.isCritical && s.enabled).length;

      return {
        equipmentId,
        totalSensors,
        enabledSensors,
        criticalSensors,
        criticalEnabled,
        coveragePercentage: totalSensors > 0 ? (enabledSensors / totalSensors) * 100 : 0,
        criticalCoveragePercentage:
          criticalSensors > 0 ? (criticalEnabled / criticalSensors) * 100 : 0,
        sensors: sensors.map((s) => ({
          sensorType: s.sensorType,
          enabled: s.enabled ?? false,
          isCritical: s.isCritical ?? null,
          minValue: s.minValue,
          maxValue: s.maxValue,
        })),
      } as object as SensorCoverageResult;
    },
    legacyFn: () => Promise.resolve(equipmentRepository.getSensorCoverage(equipmentId, orgId) as object as SensorCoverageResult),
  }) as object as SensorCoverageResult;
}

export async function setupSensors(
  adapter: DualWriteAdapter,
  equipmentId: string,
  orgId: string
): Promise<SensorSetupResult> {
  return adapter.execute({
    operation: "setupSensors",
    repositoryFn: async () => {
      const equipRepo = TenantRepositoryFactory.equipment(orgId);
      const equipment = await equipRepo.getById(equipmentId);
      if (!equipment) {
        throw new Error("Equipment not found");
      }

      const sensorsToCreate = DEFAULT_SENSORS[equipment.type] || DEFAULT_SENSORS['default'];
      const sensorRepo = TenantRepositoryFactory.sensorConfiguration(orgId);
      type CreatedSensor = Awaited<ReturnType<typeof sensorRepo.create>> & {
        sensorType: string;
        enabled?: boolean | null;
        isCritical?: boolean | null;
      };
      const existing = await sensorRepo.getAll({ equipmentId });
      const existingTypes = new Set(existing.map((s) => s.sensorType));

      const created: Array<{
        sensorType: string;
        enabled?: boolean | null;
        isCritical?: boolean | null;
      }> = [];
      for (const sensor of sensorsToCreate) {
        if (!existingTypes.has(sensor.type)) {
          const newSensor = await sensorRepo.create({
            equipmentId,
            sensorType: sensor.type,
            enabled: true,
            isCritical: sensor.critical,
            minValue: sensor.min,
            maxValue: sensor.max,
          });
          const row = newSensor as CreatedSensor;
          created.push({
            sensorType: row.sensorType,
            enabled: row.enabled,
            isCritical: row.isCritical,
          });
        }
      }

      return {
        equipmentId,
        equipmentType: equipment.type,
        sensorsCreated: created.length,
        sensorsSkipped: sensorsToCreate.length - created.length,
        totalSensors: existing.length + created.length,
        sensors: created.map((s) => ({
          sensorType: s.sensorType,
          enabled: s.enabled ?? false,
          isCritical: s.isCritical ?? null,
        })),
      };
    },
    legacyFn: () => equipmentRepository.setupSensors(equipmentId, orgId),
  });
}
