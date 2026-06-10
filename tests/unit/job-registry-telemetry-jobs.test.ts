/**
 * Job registry — telemetry lifecycle job registration.
 *
 * Asserts the three telemetry lifecycle cron jobs (hourly rollup, daily
 * retention, daily partition maintenance) are registered with
 * tenantScope "fleet-wide": they are scheduled with empty payloads (no
 * orgId), so under REQUIRE_TENANT_AUTH=true a "required" scope would
 * reject every scheduled run. Processor modules are stubbed — this test
 * covers wiring, not processor behavior.
 */

import { jest, describe, it, expect, beforeAll } from "@jest/globals";

const registerProcessorMock = jest.fn();

// Mirrors the literal values in server/background-jobs.ts JOB_TYPES; the
// assertions below use the raw strings so a drift in either file fails here.
const JOB_TYPES = {
  PROCESS_TELEMETRY: "process-telemetry",
  GENERATE_REPORT: "generate-report",
  SYNC_DATA: "sync-data",
  AI_EQUIPMENT_ANALYSIS: "ai-equipment-analysis",
  AI_FLEET_ANALYSIS: "ai-fleet-analysis",
  REPORT_GENERATION_PDF: "report-generation-pdf",
  REPORT_GENERATION_CSV: "report-generation-csv",
  REPORT_GENERATION_HTML: "report-generation-html",
  CREW_SCHEDULING: "crew-scheduling",
  MAINTENANCE_SCHEDULING: "maintenance-scheduling",
  TELEMETRY_PROCESSING: "telemetry-processing",
  INVENTORY_OPTIMIZATION: "inventory-optimization",
  INSIGHTS_SNAPSHOT_GENERATION: "insights-snapshot-generation",
  MODEL_RETRAIN: "model-retrain-weekly",
  ML_STALE_MODEL_CHECK: "ml-stale-model-check-daily",
  TELEMETRY_WAREHOUSE_EXPORT: "telemetry-warehouse-export-daily",
  TELEMETRY_ROLLUP_HOURLY: "telemetry-rollup-hourly",
  TELEMETRY_RETENTION: "telemetry-retention-daily",
  TELEMETRY_PARTITION_MAINTENANCE: "telemetry-partition-maintenance-daily",
} as const;

let registerJobProcessors: (typeof import("../../server/job-processors/registry"))["registerJobProcessors"];

beforeAll(async () => {
  jest.unstable_mockModule("../../server/background-jobs", () => ({
    __esModule: true,
    JOB_TYPES,
    jobQueue: { registerProcessor: registerProcessorMock },
  }));
  const stub = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()])) as Record<string, unknown>;
  jest.unstable_mockModule("../../server/job-processors/ai-processors", () => ({
    __esModule: true,
    ...stub("processEquipmentAnalysis", "processFleetAnalysis"),
  }));
  jest.unstable_mockModule("../../server/job-processors/report-processors", () => ({
    __esModule: true,
    ...stub("processPDFGeneration", "processCSVGeneration", "processHTMLGeneration"),
  }));
  jest.unstable_mockModule("../../server/job-processors/scheduling-processors", () => ({
    __esModule: true,
    ...stub("processCrewScheduling", "processMaintenanceScheduling"),
  }));
  jest.unstable_mockModule("../../server/job-processors/insights-processor", () => ({
    __esModule: true,
    ...stub("processInsightsSnapshotGeneration"),
  }));
  jest.unstable_mockModule("../../server/job-processors/telemetry-processor", () => ({
    __esModule: true,
    ...stub("processTelemetryProcessing"),
  }));
  jest.unstable_mockModule("../../server/job-processors/ml-retraining-processor", () => ({
    __esModule: true,
    ...stub("processModelRetrain"),
  }));
  jest.unstable_mockModule("../../server/job-processors/ml-stale-model-processor", () => ({
    __esModule: true,
    ...stub("processStaleModelCheck"),
  }));
  jest.unstable_mockModule("../../server/job-processors/telemetry-warehouse-processor", () => ({
    __esModule: true,
    ...stub("processTelemetryWarehouseExport"),
  }));
  jest.unstable_mockModule("../../server/job-processors/telemetry-rollup-processor", () => ({
    __esModule: true,
    ...stub("processTelemetryRollup"),
  }));
  jest.unstable_mockModule("../../server/job-processors/telemetry-retention-processor", () => ({
    __esModule: true,
    ...stub("processTelemetryRetention"),
  }));
  jest.unstable_mockModule("../../server/job-processors/telemetry-partition-processor", () => ({
    __esModule: true,
    ...stub("processTelemetryPartitionMaintenance"),
  }));

  ({ registerJobProcessors } = await import("../../server/job-processors/registry"));
});

describe("registerJobProcessors — telemetry lifecycle jobs", () => {
  it("registers rollup, retention, and partition maintenance as fleet-wide", () => {
    registerJobProcessors();

    const byType = new Map(
      registerProcessorMock.mock.calls.map((call) => [call[0], call] as const)
    );

    for (const type of [
      "telemetry-rollup-hourly",
      "telemetry-retention-daily",
      "telemetry-partition-maintenance-daily",
    ]) {
      const call = byType.get(type);
      expect(call).toBeDefined();
      expect(typeof call?.[1]).toBe("function");
      expect(call?.[2]).toEqual({ tenantScope: "fleet-wide" });
    }

    // The pre-existing fleet-wide sweeps are untouched.
    expect(byType.get("telemetry-warehouse-export-daily")?.[2]).toEqual({
      tenantScope: "fleet-wide",
    });
  });
});
