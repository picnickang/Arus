/**
 * Centralized Query Keys for TanStack Query
 *
 * This module provides type-safe, hierarchical query keys for all API endpoints.
 * Using consistent query key patterns ensures proper cache invalidation and prevents stale data.
 *
 * Pattern: [domain, ...hierarchy, params]
 * Example: ['equipment', 'list', { page: 1, type: 'main_engine' }]
 *
 * Benefits:
 * - Type safety: TypeScript ensures correct usage
 * - Consistency: All queries use same structure
 * - Invalidation: Easy to invalidate related queries
 * - Debugging: Clear cache keys in React Query DevTools
 */

export interface EquipmentFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  status?: "active" | "inactive" | "all";
  vesselId?: string;
  manufacturer?: string;
}

export interface SensorFilters {
  equipmentId?: string;
  sensorType?: string;
  enabled?: boolean;
}

export interface VesselFilters {
  active?: boolean;
  vesselType?: string;
}

export interface TelemetryFilters {
  equipmentId?: string;
  sensorType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Equipment-related query keys
 */
export const equipmentKeys = {
  all: ["equipment"] as const,

  lists: () => [...equipmentKeys.all, "list"] as const,
  list: (filters?: EquipmentFilters) => [...equipmentKeys.lists(), filters ?? {}] as const,

  details: () => [...equipmentKeys.all, "detail"] as const,
  detail: (id: string) => [...equipmentKeys.details(), id] as const,

  health: () => [...equipmentKeys.all, "health"] as const,
  healthByVessel: (vesselId?: string) => [...equipmentKeys.health(), { vesselId }] as const,

  sensorCoverage: (id: string) => [...equipmentKeys.detail(id), "sensor-coverage"] as const,

  compatibleParts: (id: string) => [...equipmentKeys.detail(id), "compatible-parts"] as const,

  suggestedParts: (id: string) => [...equipmentKeys.detail(id), "suggested-parts"] as const,

  rul: (id: string) => [...equipmentKeys.detail(id), "rul"] as const,

  decommissioned: () => [...equipmentKeys.all, "decommissioned"] as const,

  history: (id: string) => [...equipmentKeys.detail(id), "history"] as const,
} as const;

/**
 * Sensor configuration query keys
 */
export const sensorKeys = {
  all: ["sensors"] as const,

  lists: () => [...sensorKeys.all, "list"] as const,
  list: (filters?: SensorFilters) => [...sensorKeys.lists(), filters ?? {}] as const,

  byEquipment: (equipmentId: string) => [...sensorKeys.all, "equipment", equipmentId] as const,

  status: (equipmentId?: string) => [...sensorKeys.all, "status", equipmentId || "all"] as const,

  details: () => [...sensorKeys.all, "detail"] as const,
  detail: (id: string) => [...sensorKeys.details(), id] as const,
} as const;

/**
 * Sensor template query keys
 */
export const sensorTemplateKeys = {
  all: ["sensor-templates"] as const,

  lists: () => [...sensorTemplateKeys.all, "list"] as const,
  list: (equipmentType?: string) =>
    [...sensorTemplateKeys.lists(), { equipmentType: equipmentType || "all" }] as const,

  details: () => [...sensorTemplateKeys.all, "detail"] as const,
  detail: (id: string) => [...sensorTemplateKeys.details(), id] as const,
} as const;

/**
 * Vessel-related query keys
 */
export const vesselKeys = {
  all: ["vessels"] as const,

  lists: () => [...vesselKeys.all, "list"] as const,
  list: (filters?: VesselFilters) => [...vesselKeys.lists(), filters ?? {}] as const,

  details: () => [...vesselKeys.all, "detail"] as const,
  detail: (id: string) => [...vesselKeys.details(), id] as const,

  equipment: (id: string) => [...vesselKeys.detail(id), "equipment"] as const,
} as const;

/**
 * Telemetry query keys
 */
export const telemetryKeys = {
  all: ["telemetry"] as const,

  latest: (filters?: TelemetryFilters) => [...telemetryKeys.all, "latest", filters ?? {}] as const,

  byEquipment: (equipmentId: string, filters?: TelemetryFilters) =>
    [...telemetryKeys.all, "equipment", equipmentId, filters ?? {}] as const,

  bySensor: (equipmentId: string, sensorType: string) =>
    [...telemetryKeys.all, "sensor", equipmentId, sensorType] as const,
} as const;

/**
 * Operating parameters query keys
 */
export const operatingParamKeys = {
  all: ["operating-parameters"] as const,

  byEquipmentType: (equipmentType: string) =>
    [...operatingParamKeys.all, "type", equipmentType] as const,
} as const;

/**
 * Alert-related query keys
 */
export const alertKeys = {
  all: ["alerts"] as const,

  operatingCondition: (equipmentId?: string, acknowledged?: boolean) =>
    [...alertKeys.all, "operating-condition", { equipmentId, acknowledged }] as const,

  configurations: (equipmentId?: string) =>
    [...alertKeys.all, "configurations", equipmentId || "all"] as const,
} as const;

/**
 * Work order query keys
 */
export const workOrderKeys = {
  all: ["work-orders"] as const,

  lists: () => [...workOrderKeys.all, "list"] as const,
  list: (filters?: { status?: string; equipmentId?: string }) =>
    [...workOrderKeys.lists(), filters ?? {}] as const,

  details: () => [...workOrderKeys.all, "detail"] as const,
  detail: (id: string) => [...workOrderKeys.details(), id] as const,
} as const;

/**
 * Inventory query keys
 */
export const inventoryKeys = {
  all: ["inventory"] as const,

  parts: () => [...inventoryKeys.all, "parts"] as const,
  part: (id: string) => [...inventoryKeys.parts(), id] as const,

  stock: () => [...inventoryKeys.all, "stock"] as const,
} as const;

/**
 * Analytics query keys
 */
export const analyticsKeys = {
  all: ["analytics"] as const,

  dashboard: () => [...analyticsKeys.all, "dashboard"] as const,

  insights: () => [...analyticsKeys.all, "insights"] as const,
  latestSnapshot: () => [...analyticsKeys.insights(), "latest"] as const,

  jobs: () => [...analyticsKeys.all, "jobs"] as const,
  jobStats: () => [...analyticsKeys.jobs(), "stats"] as const,
} as const;

/**
 * DTC (Diagnostic Trouble Code) query keys
 */
export const dtcKeys = {
  all: ["dtc"] as const,

  dashboard: () => [...dtcKeys.all, "dashboard-stats"] as const,

  active: (equipmentId?: string) => [...dtcKeys.all, "active", equipmentId || "all"] as const,
} as const;

/**
 * Utility function to invalidate all queries for a specific domain
 */
export const invalidateDomain = {
  equipment: () => equipmentKeys.all,
  sensors: () => sensorKeys.all,
  sensorTemplates: () => sensorTemplateKeys.all,
  vessels: () => vesselKeys.all,
  telemetry: () => telemetryKeys.all,
  alerts: () => alertKeys.all,
  workOrders: () => workOrderKeys.all,
  inventory: () => inventoryKeys.all,
  analytics: () => analyticsKeys.all,
  dtc: () => dtcKeys.all,
} as const;

/**
 * Helper to get all query keys that should be invalidated after equipment mutation
 */
export function getEquipmentMutationInvalidations(equipmentId?: string) {
  const keys: unknown[][] = [
    [...equipmentKeys.all],
    [...analyticsKeys.dashboard()],
    [...dtcKeys.dashboard()],
  ];

  if (equipmentId) {
    keys.push(
      [...equipmentKeys.detail(equipmentId)],
      [...sensorKeys.byEquipment(equipmentId)],
      [...sensorKeys.status(equipmentId)]
    );
  }

  return keys;
}

/**
 * Helper to get all query keys that should be invalidated after sensor mutation
 */
export function getSensorMutationInvalidations(equipmentId?: string) {
  const keys: unknown[][] = [[...sensorKeys.all]];

  if (equipmentId) {
    keys.push(
      [...sensorKeys.byEquipment(equipmentId)],
      [...sensorKeys.status(equipmentId)],
      [...equipmentKeys.sensorCoverage(equipmentId)]
    );
  }

  return keys;
}
