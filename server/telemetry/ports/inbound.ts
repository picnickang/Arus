import type { RawFrame } from "../decode/types";
import type { TelemetryBatchReading } from "../../telemetry-batch-writer";

export interface IngestBatchResult {
  framesProcessed: number;
  readingsDecoded: number;
  readingsPersisted: number;
  duplicatesSkipped: number;
  failedToDeadLetter: number;
  archiveId?: string | undefined;
  batchId?: string | undefined;
}

export interface ITelemetryIngestionPort {
  ingestBatch(frames: RawFrame[]): Promise<IngestBatchResult>;
  replayDeadLetter(entryId: string): Promise<{ success: boolean; error?: string }>;
  getBacklog(): number;
  isCircuitOpen(): boolean;
}

export interface ITelemetryDecoder {
  decode(frames: RawFrame[]): TelemetryBatchReading[];
}

export interface IBatchProcessor {
  process(frames: RawFrame[]): TelemetryBatchReading[];
}
