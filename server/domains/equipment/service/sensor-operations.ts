/**
 * Equipment Service - Sensor Operations
 */

import { equipmentRepository } from '../repository';
import { DualWriteAdapter } from '../../../infrastructure/DualWriteAdapter';
import { TenantRepositoryFactory } from '../../../infrastructure/TenantScopedRepository';
import { DEFAULT_SENSORS, type SensorCoverageResult, type SensorSetupResult } from './types.js';

export async function getSensorCoverage(adapter: DualWriteAdapter, equipmentId: string, orgId: string): Promise<SensorCoverageResult> {
  return adapter.execute({
    operation: 'getSensorCoverage',
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.sensorConfiguration(orgId);
      const sensors = await repo.getAll({ equipmentId });

      const totalSensors = sensors.length;
      const enabledSensors = sensors.filter(s => s.enabled).length;
      const criticalSensors = sensors.filter(s => s.isCritical).length;
      const criticalEnabled = sensors.filter(s => s.isCritical && s.enabled).length;

      return {
        equipmentId, totalSensors, enabledSensors, criticalSensors, criticalEnabled,
        coveragePercentage: totalSensors > 0 ? (enabledSensors / totalSensors) * 100 : 0,
        criticalCoveragePercentage: criticalSensors > 0 ? (criticalEnabled / criticalSensors) * 100 : 0,
        sensors: sensors.map(s => ({ sensorType: s.sensorType, enabled: s.enabled, isCritical: s.isCritical, minValue: s.minValue, maxValue: s.maxValue })),
      };
    },
    legacyFn: () => equipmentRepository.getSensorCoverage(equipmentId, orgId),
  });
}

export async function setupSensors(adapter: DualWriteAdapter, equipmentId: string, orgId: string): Promise<SensorSetupResult> {
  return adapter.execute({
    operation: 'setupSensors',
    repositoryFn: async () => {
      const equipRepo = TenantRepositoryFactory.equipment(orgId);
      const equipment = await equipRepo.getById(equipmentId);
      if (!equipment) {throw new Error('Equipment not found');}

      const sensorsToCreate = DEFAULT_SENSORS[equipment.type] || DEFAULT_SENSORS.default;
      const sensorRepo = TenantRepositoryFactory.sensorConfiguration(orgId);
      const existing = await sensorRepo.getAll({ equipmentId });
      const existingTypes = new Set(existing.map(s => s.sensorType));

      const created = [];
      for (const sensor of sensorsToCreate) {
        if (!existingTypes.has(sensor.type)) {
          const newSensor = await sensorRepo.create({ equipmentId, sensorType: sensor.type, enabled: true, isCritical: sensor.critical, minValue: sensor.min, maxValue: sensor.max });
          created.push(newSensor);
        }
      }

      return {
        equipmentId,
        equipmentType: equipment.type,
        sensorsCreated: created.length,
        sensorsSkipped: sensorsToCreate.length - created.length,
        totalSensors: existing.length + created.length,
        sensors: created.map(s => ({ sensorType: s.sensorType, enabled: s.enabled, isCritical: s.isCritical })),
      };
    },
    legacyFn: () => equipmentRepository.setupSensors(equipmentId, orgId),
  });
}
