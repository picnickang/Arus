/**
 * Job Processor Registry
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("JobProcessors:Registry");
import { jobQueue, JOB_TYPES } from "../background-jobs";
import { processEquipmentAnalysis, processFleetAnalysis } from "./ai-processors";
import {
  processPDFGeneration,
  processCSVGeneration,
  processHTMLGeneration,
} from "./report-processors";
import { processCrewScheduling, processMaintenanceScheduling } from "./scheduling-processors";
import { processInsightsSnapshotGeneration } from "./insights-processor";
import { processTelemetryProcessing } from "./telemetry-processor";

export function registerJobProcessors(): void {
  jobQueue.registerProcessor(JOB_TYPES.AI_EQUIPMENT_ANALYSIS, processEquipmentAnalysis);
  jobQueue.registerProcessor(JOB_TYPES.AI_FLEET_ANALYSIS, processFleetAnalysis);

  jobQueue.registerProcessor(JOB_TYPES.REPORT_GENERATION_PDF, processPDFGeneration);
  jobQueue.registerProcessor(JOB_TYPES.REPORT_GENERATION_CSV, processCSVGeneration);
  jobQueue.registerProcessor(JOB_TYPES.REPORT_GENERATION_HTML, processHTMLGeneration);

  jobQueue.registerProcessor(JOB_TYPES.CREW_SCHEDULING, processCrewScheduling);
  jobQueue.registerProcessor(JOB_TYPES.MAINTENANCE_SCHEDULING, processMaintenanceScheduling);

  jobQueue.registerProcessor(JOB_TYPES.TELEMETRY_PROCESSING, processTelemetryProcessing);

  jobQueue.registerProcessor(
    JOB_TYPES.INSIGHTS_SNAPSHOT_GENERATION,
    processInsightsSnapshotGeneration
  );

  logger.info("[Background Jobs] All processors registered successfully");
}

export function startBackgroundJobs(): void {
  registerJobProcessors();
  jobQueue.start();
  logger.info("[Background Jobs] Job queue started");
}
