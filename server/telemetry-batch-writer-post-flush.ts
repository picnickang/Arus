import { withTenantContext } from "./middleware/db-context.js";
import { checkAndCreateAlerts } from "./services/telemetry-processing.js";
import { getWebSocketServer } from "./websocket-server";
import { applyConfigsToReadings, getOrgConfigMap } from "./telemetry-ingest-config";
import { logger } from "./utils/logger";
import type { TelemetryBatchReading } from "./telemetry-batch-writer-types";

export async function applyIngestConfigs(
  readings: TelemetryBatchReading[]
): Promise<TelemetryBatchReading[]> {
  try {
    const byOrg = new Map<string, TelemetryBatchReading[]>();
    for (const reading of readings) {
      const orgId = reading.orgId || "default-org-id";
      const bucket = byOrg.get(orgId);
      if (bucket) {
        bucket.push(reading);
      } else {
        byOrg.set(orgId, [reading]);
      }
    }

    const out: TelemetryBatchReading[] = [];
    let totalDroppedDisabled = 0;
    for (const [orgId, orgReadings] of byOrg) {
      const configs = await getOrgConfigMap(orgId);
      const { kept, droppedDisabled } = applyConfigsToReadings(orgReadings, configs);
      totalDroppedDisabled += droppedDisabled;
      out.push(...kept);
    }
    if (totalDroppedDisabled > 0) {
      logger.debug(
        "TelemetryBatchWriter",
        `Dropped ${totalDroppedDisabled} readings from disabled sensors`
      );
    }
    return out;
  } catch (err) {
    logger.warn("TelemetryBatchWriter", "Ingest-config application failed (pass-through)", {
      error: err instanceof Error ? err.message : String(err),
    });
    return readings;
  }
}

export function broadcastFlushedReadings(
  latest: Map<string, Map<string, TelemetryBatchReading>>
): void {
  try {
    const wsServer = getWebSocketServer();
    if (!wsServer || wsServer.getConnectedClients() === 0) {
      return;
    }

    for (const [equipmentId, sensors] of latest) {
      wsServer.queueTelemetryUpdate(equipmentId, {
        equipmentId,
        readings: Array.from(sensors.values()).map((r) => ({
          sensorType: r.sensorType,
          value: r.value,
          unit: r.unit ?? null,
          ts: r.timestamp.toISOString(),
        })),
      });
    }
  } catch (err) {
    logger.warn("TelemetryBatchWriter", "Live telemetry broadcast failed (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function evaluateAlertsForFlushedReadings(
  latest: Map<string, Map<string, TelemetryBatchReading>>
): Promise<void> {
  try {
    for (const sensors of latest.values()) {
      for (const reading of sensors.values()) {
        const orgId = reading.orgId || "default-org-id";
        await withTenantContext(orgId, () =>
          checkAndCreateAlerts({
            id: `flush-${reading.equipmentId}-${reading.sensorType}`,
            orgId,
            ts: reading.timestamp,
            equipmentId: reading.equipmentId,
            sensorType: reading.sensorType,
            value: reading.value,
            unit: reading.unit ?? null,
            threshold: null,
            status: "normal",
            idempotencyKey: null,
          })
        );
      }
    }
  } catch (err) {
    logger.warn("TelemetryBatchWriter", "Post-flush alert evaluation failed (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
