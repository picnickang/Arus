/**
 * Daily telemetry partition maintenance processor.
 *
 * Keeps monthly RANGE partitions of equipment_telemetry provisioned
 * three months ahead (migrations/0038). Running daily rather than
 * monthly makes the job self-healing: a stalled scheduler has ~90
 * chances to catch up before new rows would fall through to the
 * DEFAULT partition — and even then nothing is lost, the DEFAULT
 * partition absorbs them and this job carves the month back out.
 *
 * No-op (logged) while the table is not yet partitioned, so the
 * schedule can ship independently of when 0038 is applied.
 */

import { createLogger } from "../lib/structured-logger";
import {
  countDefaultPartitionRows,
  ensureFutureMonthlyPartitions,
  isEquipmentTelemetryPartitioned,
} from "../services/telemetry-partitioning/index.js";

const logger = createLogger("JobProcessors:TelemetryPartition");

export interface TelemetryPartitionJobSummary {
  partitioned: boolean;
  created: string[];
  movedFromDefault: number;
  defaultPartitionRows: number;
}

export async function processTelemetryPartitionMaintenance(): Promise<TelemetryPartitionJobSummary> {
  if (!(await isEquipmentTelemetryPartitioned())) {
    logger.info("equipment_telemetry is not partitioned — skipping partition maintenance");
    return { partitioned: false, created: [], movedFromDefault: 0, defaultPartitionRows: 0 };
  }

  const { created, movedFromDefault } = await ensureFutureMonthlyPartitions(3);
  const defaultPartitionRows = await countDefaultPartitionRows();

  if (defaultPartitionRows > 0) {
    // Rows in DEFAULT mean a partition gap existed at write time — the
    // safety net caught them (no loss), but the gap deserves attention.
    logger.warn(
      `equipment_telemetry_default holds ${defaultPartitionRows} rows — a partition gap existed`,
    );
  }

  const summary = { partitioned: true, created, movedFromDefault, defaultPartitionRows };
  logger.info("Telemetry partition maintenance finished", summary);
  return summary;
}
