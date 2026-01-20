/**
 * Report Context - Backward Compatibility Shim
 * 
 * This file re-exports all functions from the modularized report-context/ directory.
 * All functionality has been preserved in focused, maintainable modules.
 * 
 * @see server/report-context/index.ts for the modular implementation
 */

export {
  type ReportContext,
  type ContextBuilderOptions,
  getVesselEquipment,
  getVesselWorkOrders,
  getVesselTelemetry,
  getVesselMaintenanceSchedules,
  getVesselAlerts,
  getCrewCertifications,
  getCrewRestSheets,
  getComplianceLogs,
  fetchKBKnowledge,
  buildCitations,
  determinePriority,
  ReportContextBuilder,
  reportContextBuilder,
} from "./report-context/index.js";
