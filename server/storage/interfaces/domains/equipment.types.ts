import type { WidenPartial } from "../../../lib/widen-partial";
/**
 * Equipment Storage Interface - Equipment Registry, Lifecycle, Operating Parameters
 * Part of IStorage modularization for improved maintainability
 */

import type { EquipmentHealth } from "../../../db/equipment/types.js";
import type {
  Equipment,
  InsertEquipment,
  EquipmentLifecycle,
  InsertEquipmentLifecycle,
  PerformanceMetric,
  InsertPerformanceMetric,
  OperatingParameter,
  InsertOperatingParameter,
  OperatingConditionAlert,
  InsertOperatingConditionAlert,
} from "@shared/schema";

/**
 * Equipment storage operations for registry, lifecycle, and performance
 */
export interface IEquipmentStorage {
  // Equipment Registry
  getEquipment(orgId: string, equipmentId: string): Promise<Equipment | undefined>;
  getEquipmentRegistry(orgId?: string): Promise<Equipment[]>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(
    id: string,
    equipment: WidenPartial<InsertEquipment>,
    orgId?: string
  ): Promise<Equipment>;
  deleteEquipment(id: string, orgId?: string): Promise<void>;
  getEquipmentByVessel(vesselId: string, orgId: string): Promise<Equipment[]>;
  associateEquipmentToVessel(
    equipmentId: string,
    vesselId: string,
    orgId: string
  ): Promise<Equipment>;
  disassociateEquipmentFromVessel(equipmentId: string, orgId: string): Promise<void>;
  getEquipmentHealth(orgId: string, vesselId?: string): Promise<EquipmentHealth[]>;
  getRelatedEquipment(equipmentId: string, orgId?: string): Promise<Equipment[]>;
  getEquipmentSensorTypes(orgId: string, equipmentId: string): Promise<string[]>;

  // Equipment Lifecycle
  getEquipmentLifecycle(equipmentId?: string): Promise<EquipmentLifecycle[]>;
  upsertEquipmentLifecycle(lifecycle: InsertEquipmentLifecycle): Promise<EquipmentLifecycle>;
  updateEquipmentLifecycle(
    id: string,
    lifecycle: WidenPartial<InsertEquipmentLifecycle>
  ): Promise<EquipmentLifecycle>;
  getReplacementRecommendations(): Promise<EquipmentLifecycle[]>;

  // Performance Metrics
  getPerformanceMetrics(
    equipmentId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<PerformanceMetric[]>;
  createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric>;
  getFleetPerformanceOverview(): Promise<
    {
      equipmentId: string;
      equipmentName: string;
      averageScore: number;
      reliability: number;
      availability: number;
      efficiency: number;
    }[]
  >;
  getPerformanceTrends(
    equipmentId: string,
    months?: number
  ): Promise<
    { month: string; performanceScore: number; availability: number; efficiency: number }[]
  >;

  // Operating Parameters
  getOperatingParameters(
    orgId?: string,
    equipmentType?: string,
    manufacturer?: string
  ): Promise<OperatingParameter[]>;
  getOperatingParameter(id: string, orgId?: string): Promise<OperatingParameter | undefined>;
  createOperatingParameter(parameter: InsertOperatingParameter): Promise<OperatingParameter>;
  updateOperatingParameter(
    id: string,
    parameter: WidenPartial<InsertOperatingParameter>,
    orgId?: string
  ): Promise<OperatingParameter>;
  deleteOperatingParameter(id: string, orgId?: string): Promise<void>;
  bulkCreateOperatingParameters(
    parameters: InsertOperatingParameter[]
  ): Promise<OperatingParameter[]>;

  // Operating Condition Alerts
  getOperatingConditionAlerts(
    orgId?: string,
    equipmentId?: string,
    acknowledged?: boolean
  ): Promise<OperatingConditionAlert[]>;
  getOperatingConditionAlert(
    id: string,
    orgId?: string
  ): Promise<OperatingConditionAlert | undefined>;
  createOperatingConditionAlert(
    alert: InsertOperatingConditionAlert
  ): Promise<OperatingConditionAlert>;
  updateOperatingConditionAlert(
    id: string,
    alert: WidenPartial<InsertOperatingConditionAlert>,
    orgId?: string
  ): Promise<OperatingConditionAlert>;
  acknowledgeOperatingConditionAlert(
    id: string,
    acknowledgedBy: string,
    notes?: string,
    orgId?: string
  ): Promise<OperatingConditionAlert>;
  resolveOperatingConditionAlert(
    id: string,
    notes?: string,
    orgId?: string
  ): Promise<OperatingConditionAlert>;
  getActiveOperatingAlerts(equipmentId: string, orgId?: string): Promise<OperatingConditionAlert[]>;
  checkOperatingConditions(
    equipmentId: string,
    telemetry?: { sensorType: string; value: number }[],
    orgId?: string
  ): Promise<{
    violations: Array<{
      parameterId: string;
      parameterName: string;
      currentValue: number;
      thresholdType: "below_optimal" | "above_optimal" | "below_critical" | "above_critical";
      severity: "info" | "warning" | "critical";
      lifeImpact?: string;
      recommendedAction?: string;
    }>;
    alertsCreated: number;
  }>;

  // Context
  getVesselContext(
    vesselId: string,
    orgId?: string
  ): Promise<{
    vessel: Record<string, unknown> | null;
    ageYears: number;
    operatingConditions: string[];
    environmentalFactors: string[];
    maintenanceHistory: Record<string, unknown>[];
    fleetPosition?: { lat: number; lng: number };
  }>;
  getMaintenanceHistory(
    equipmentId: string,
    days?: number,
    orgId?: string
  ): Promise<Record<string, unknown>[]>;
}
