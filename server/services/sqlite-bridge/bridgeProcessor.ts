import type { RawFrame, DecodeContext } from "../../telemetry/decode/types";
import type { TelemetryBatchReading } from "../../telemetry-batch-writer";
import { decodeFrame } from "../../telemetry/decode";
import { validateReading } from "../../telemetry/decode/validation";
import { logger } from "../../utils/logger";
import client from "prom-client";

const bridgeFramesRead = new client.Counter({
  name: "arus_ingest_pipeline_stage_total",
  help: "Telemetry ingestion pipeline stage counts",
  labelNames: ["stage"],
});

export interface BridgeProcessorConfig extends DecodeContext {
  defaultOrgId?: string;
}

export class BridgeProcessor {
  private decodeContext: DecodeContext;
  private defaultOrgId: string;

  constructor(config: BridgeProcessorConfig = {}) {
    const { defaultOrgId, ...decodeContext } = config;
    this.decodeContext = {
      defaultEquipmentId: "unknown",
      ...decodeContext,
    };
    this.defaultOrgId = defaultOrgId || "default-org-id";
  }

  process(frames: RawFrame[]): TelemetryBatchReading[] {
    const readings: TelemetryBatchReading[] = [];
    let decodedCount = 0;

    bridgeFramesRead.inc({ stage: "bridge_frames_read" }, frames.length);

    for (const frame of frames) {
      const decoded = decodeFrame(frame, this.decodeContext);

      for (const reading of decoded) {
        if (validateReading(reading)) {
          const readingWithContext = {
            ...reading,
            orgId: reading.orgId || this.defaultOrgId,
            metadata: {
              ...reading.metadata,
              idempotencyKey: `raw:${frame.source}:${frame.protocol}:${frame.id}`,
            },
          };
          readings.push(readingWithContext);
          decodedCount++;
        }
      }
    }

    bridgeFramesRead.inc({ stage: "bridge_readings_decoded" }, decodedCount);

    if (frames.length > 0) {
      logger.debug(
        "BridgeProcessor",
        `Processed ${frames.length} frames into ${readings.length} readings`
      );
    }

    return readings;
  }
}
