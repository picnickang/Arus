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
import { processModelRetrain } from "./ml-retraining-processor";
import { processStaleModelCheck } from "./ml-stale-model-processor";
import { processTelemetryWarehouseExport } from "./telemetry-warehouse-processor";
import { processTelemetryRollup } from "./telemetry-rollup-processor";
import { processTelemetryRetention } from "./telemetry-retention-processor";
import { processTelemetryPartitionMaintenance } from "./telemetry-partition-processor";

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

  // Task #105: these two are genuinely fleet-wide cron jobs. The weekly
  // retrain orchestrator fans out per-org internally (see
  // ml-retraining-processor.ts) and the stale-model sweeper scans across
  // every (orgId, equipmentType) pair. Both are scheduled with an empty
  // payload by background-jobs.ts and therefore intentionally carry no
  // orgId — mark them so the worker doesn't reject them under
  // REQUIRE_TENANT_AUTH=true.
  jobQueue.registerProcessor(JOB_TYPES.MODEL_RETRAIN, processModelRetrain, {
    tenantScope: "fleet-wide",
  });
  jobQueue.registerProcessor(JOB_TYPES.ML_STALE_MODEL_CHECK, processStaleModelCheck, {
    tenantScope: "fleet-wide",
  });
  // Task #95: daily telemetry warehouse export — fleet-wide sweep that
  // enumerates orgs from telemetry_aggregated and exports one Parquet
  // file per (orgId, date). Scheduled with empty payload, no orgId.
  jobQueue.registerProcessor(
    JOB_TYPES.TELEMETRY_WAREHOUSE_EXPORT,
    processTelemetryWarehouseExport,
    { tenantScope: "fleet-wide" }
  );

  // Telemetry lifecycle cron sweeps (scheduled with empty payloads by
  // background-jobs.ts, hence no orgId). The rollup and retention
  // orchestrators fan out per-org under withTenantContext internally;
  // partition maintenance is pure DDL and not subject to RLS.
  jobQueue.registerProcessor(JOB_TYPES.TELEMETRY_ROLLUP_HOURLY, processTelemetryRollup, {
    tenantScope: "fleet-wide",
  });
  jobQueue.registerProcessor(JOB_TYPES.TELEMETRY_RETENTION, processTelemetryRetention, {
    tenantScope: "fleet-wide",
  });
  jobQueue.registerProcessor(
    JOB_TYPES.TELEMETRY_PARTITION_MAINTENANCE,
    processTelemetryPartitionMaintenance,
    { tenantScope: "fleet-wide" }
  );

  logger.info("[Background Jobs] All processors registered successfully");
}

export async function startBackgroundJobs(): Promise<void> {
  registerJobProcessors();
  await jobQueue.start();
  logger.info("[Background Jobs] Job queue started");
}
