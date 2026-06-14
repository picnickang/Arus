/**
 * SQLite Modular Initialization - Aggregator
 *
 * Composes all domain-specific table and index definitions for SQLite initialization.
 * Each domain module exports getXxxTablesSql() and getXxxIndexesSql() functions.
 */
import type { SQL } from "drizzle-orm";

import { getCoreTablesSql, getCoreIndexesSql } from "./core-tables.js";
import { getVesselTablesSql, getVesselIndexesSql } from "./vessel-tables.js";
import { getWorkOrderTablesSql, getWorkOrderIndexesSql } from "./workorder-tables.js";
import { getMaintenanceTablesSql, getMaintenanceIndexesSql } from "./maintenance-tables.js";
import { getInventoryTablesSql, getInventoryIndexesSql } from "./inventory-tables.js";
import { getCrewTablesSql, getCrewIndexesSql } from "./crew-tables.js";
import { getAlertTablesSql, getAlertIndexesSql } from "./alert-tables.js";
import { getMlTablesSql, getMlIndexesSql } from "./ml-tables.js";
import { getSensorTablesSql, getSensorIndexesSql } from "./sensor-tables.js";
import { getTelemetryTablesSql, getTelemetryIndexesSql } from "./telemetry-tables.js";
import { getInsightsTablesSql, getInsightsIndexesSql } from "./insights-tables.js";
import { getSystemTablesSql, getSystemIndexesSql } from "./system-tables.js";
import {
  getConditionMonitoringTablesSql,
  getConditionMonitoringIndexesSql,
} from "./condition-monitoring-tables.js";
import { getDtcTablesSql, getDtcIndexesSql } from "./dtc-tables.js";
import { getDigitalTwinTablesSql, getDigitalTwinIndexesSql } from "./digital-twin-tables.js";
import { getSyncTablesSql, getSyncIndexesSql } from "./sync-tables.js";
import { getOptimizationTablesSql, getOptimizationIndexesSql } from "./optimization-tables.js";
import { getLogbookTablesSql, getLogbookIndexesSql } from "./logbook-tables.js";
import { getRagTablesSql, getRagIndexesSql } from "./rag-tables.js";
import { getComplianceTablesSql, getComplianceIndexesSql } from "./compliance-tables.js";
import { getPermissionTablesSql, getPermissionIndexesSql } from "./permission-tables.js";
import { getAgentTablesSql, getAgentIndexesSql } from "./agent-tables.js";
import { getImportTablesSql, getImportIndexesSql } from "./import-tables.js";

export function getAllTablesSql(): SQL[] {
  return [
    ...getCoreTablesSql(),
    ...getVesselTablesSql(),
    ...getWorkOrderTablesSql(),
    ...getMaintenanceTablesSql(),
    ...getInventoryTablesSql(),
    ...getCrewTablesSql(),
    ...getAlertTablesSql(),
    ...getMlTablesSql(),
    ...getSensorTablesSql(),
    ...getTelemetryTablesSql(),
    ...getInsightsTablesSql(),
    ...getSystemTablesSql(),
    ...getConditionMonitoringTablesSql(),
    ...getDtcTablesSql(),
    ...getDigitalTwinTablesSql(),
    ...getSyncTablesSql(),
    ...getOptimizationTablesSql(),
    ...getLogbookTablesSql(),
    ...getRagTablesSql(),
    ...getComplianceTablesSql(),
    ...getPermissionTablesSql(),
    ...getAgentTablesSql(),
    ...getImportTablesSql(),
  ];
}

export function getAllIndexesSql(): SQL[] {
  return [
    ...getCoreIndexesSql(),
    ...getVesselIndexesSql(),
    ...getWorkOrderIndexesSql(),
    ...getMaintenanceIndexesSql(),
    ...getInventoryIndexesSql(),
    ...getCrewIndexesSql(),
    ...getAlertIndexesSql(),
    ...getMlIndexesSql(),
    ...getSensorIndexesSql(),
    ...getTelemetryIndexesSql(),
    ...getInsightsIndexesSql(),
    ...getSystemIndexesSql(),
    ...getConditionMonitoringIndexesSql(),
    ...getDtcIndexesSql(),
    ...getDigitalTwinIndexesSql(),
    ...getSyncIndexesSql(),
    ...getOptimizationIndexesSql(),
    ...getLogbookIndexesSql(),
    ...getRagIndexesSql(),
    ...getComplianceIndexesSql(),
    ...getPermissionIndexesSql(),
    ...getAgentIndexesSql(),
    ...getImportIndexesSql(),
  ];
}

// Per-domain getXxxTablesSql()/getXxxIndexesSql() builders are composed into
// getAllTablesSql()/getAllIndexesSql() above. They are intentionally not
// re-exported individually; import them directly from their ./*-tables module
// if a single domain's DDL is ever needed.
