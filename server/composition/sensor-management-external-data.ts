/**
 * Composition - Sensor Management External Reads Providers
 *
 * The sensor-management routes read equipment (bulk-config validation), ML
 * threshold optimizations, and telemetry history — all cross-domain. These
 * adapters live in the composition layer (outside server/domains/) so the
 * sensor-management domain stays free of those storages; they are injected into
 * the routes via the domain-router registry.
 */

import type {
  ISensorEquipmentPort,
  ISensorThresholdOptimizationPort,
  ISensorTelemetryHistoryPort,
} from "../domains/sensor-management/domain/ports";
import { dbEquipmentStorage } from "../db/equipment/index.js";
import { dbMlAnalyticsStorage } from "../db/ml-analytics/index.js";
import { dbTelemetryStorage } from "../db/telemetry/index.js";

export const sensorEquipmentProvider: ISensorEquipmentPort = {
  getEquipment: (orgId, equipmentId) => dbEquipmentStorage.getEquipment(orgId, equipmentId),
};

export const sensorThresholdOptimizationProvider: ISensorThresholdOptimizationPort = {
  getThresholdOptimizations: (orgId, equipmentId, sensorType) =>
    dbMlAnalyticsStorage.getThresholdOptimizations(orgId, equipmentId, sensorType),
  getThresholdOptimization: (id, orgId) =>
    dbMlAnalyticsStorage.getThresholdOptimization(id, orgId),
  applyThresholdOptimization: (id, orgId) =>
    dbMlAnalyticsStorage.applyThresholdOptimization(id, orgId),
  rejectThresholdOptimization: (id, reason, orgId) =>
    dbMlAnalyticsStorage.rejectThresholdOptimization(id, reason, orgId),
};

export const sensorTelemetryHistoryProvider: ISensorTelemetryHistoryPort = {
  getTelemetryHistory: (equipmentId, sensorType, limit) =>
    dbTelemetryStorage.getTelemetryHistory(equipmentId, sensorType, limit),
};
