/**
 * Job Processors Module - Public API
 */

export { processEquipmentAnalysis, processFleetAnalysis } from "./ai-processors";
export {
  processPDFGeneration,
  processCSVGeneration,
  processHTMLGeneration,
} from "./report-processors";
export { processCrewScheduling, processMaintenanceScheduling } from "./scheduling-processors";
export { processInsightsSnapshotGeneration } from "./insights-processor";
export { processTelemetryProcessing } from "./telemetry-processor";
export { registerJobProcessors, startBackgroundJobs } from "./registry";
