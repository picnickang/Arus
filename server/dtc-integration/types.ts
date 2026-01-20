/**
 * DTC Integration Service Types
 */

import type { DtcFault, DtcDefinition } from "@shared/schema-runtime";

export interface DtcWithDefinition extends DtcFault {
  definition?: DtcDefinition;
}

export interface DtcSummary {
  activeDtcCount: number;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  topDtcs: Array<{ spn: number; fmi: number; description: string; severity: number; oc: number }>;
}

export interface DtcFinancialImpact {
  totalDowntimeHours: number;
  estimatedCost: number;
  criticalDtcCount: number;
}

export interface DtcDashboardStats {
  totalActiveDtcs: number;
  criticalDtcs: number;
  equipmentWithDtcs: number;
  dtcTriggeredWorkOrders: number;
}

export const SPN_TO_SENSOR_MAP: Record<number, string> = {
  110: "engine_coolant_temp",
  190: "engine_speed",
  96: "fuel_level",
  100: "engine_oil_pressure",
};

export const DTC_STATS_CACHE_TTL_MS = 60 * 1000;
