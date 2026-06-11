import { describe, it, expect, jest } from "@jest/globals";

import { IngestTelemetryBatch } from "../../telemetry/application/ingest-batch";
import type { IngestBatchResult } from "../../telemetry/ports/inbound";
import type { IDeadLetterQueue } from "../../telemetry/ports/outbound";
import type { TelemetryBatchReading } from "../../telemetry-batch-writer";
import type { RawTelemetryArchiveAdapter } from "../../telemetry/adapters/raw-archive";
import type { TelemetryBatchAckAdapter } from "../../telemetry/adapters/batch-ack";
import { BridgeProcessor } from "../../services/sqlite-bridge/bridgeProcessor";

// EquipmentHeartbeatAdapter has a private field, so no object literal can
// satisfy its type. Mock the module (never calling into the real adapter's
// db-config import chain) and instantiate the stubbed class instead.
jest.unstable_mockModule("../../telemetry/adapters/equipment-heartbeat", () => ({
  __esModule: true,
  EquipmentHeartbeatAdapter: class StubEquipmentHeartbeatAdapter {},
}));
const { EquipmentHeartbeatAdapter } = await import("../../telemetry/adapters/equipment-heartbeat");

type DlqPayload = { readings: TelemetryBatchReading[]; frameIds: number[] };

describe("Telemetry Ingestion Architecture", () => {
  describe("IngestBatchResult Interface", () => {
    it("should include archiveId and batchId fields in result type", async () => {
      const mockPersistence = {
        writeBatch: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        checkIdempotency: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        markIdempotent: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      };

      const mockDLQ: IDeadLetterQueue<DlqPayload> = {
        add: jest.fn<IDeadLetterQueue<DlqPayload>["add"]>().mockReturnValue({
          id: "test",
          payload: { readings: [], frameIds: [] },
          error: "test-error",
          source: "test",
          retryCount: 0,
          createdAt: new Date(),
        }),
        get: jest.fn<IDeadLetterQueue<DlqPayload>["get"]>(),
        list: jest.fn<IDeadLetterQueue<DlqPayload>["list"]>().mockReturnValue([]),
        replay: jest.fn<IDeadLetterQueue<DlqPayload>["replay"]>(),
        replayAll: jest.fn<IDeadLetterQueue<DlqPayload>["replayAll"]>(),
        prune: jest.fn<IDeadLetterQueue<DlqPayload>["prune"]>().mockReturnValue(0),
        clear: jest.fn<IDeadLetterQueue<DlqPayload>["clear"]>().mockReturnValue(0),
        getMetrics: jest.fn<IDeadLetterQueue<DlqPayload>["getMetrics"]>().mockReturnValue({
          totalEntries: 0,
          totalAdded: 0,
          totalReplayed: 0,
          totalFailed: 0,
          oldestEntryAge: null,
        }),
      };

      const mockMetrics = {
        incFramesRead: jest.fn(),
        incReadingsDecoded: jest.fn(),
        incValidationFailed: jest.fn(),
        incBatchCommitted: jest.fn(),
        observeCommitLatency: jest.fn(),
        observeEndToEndLag: jest.fn(),
        setBacklog: jest.fn(),
        setBackoff: jest.fn(),
        incRetries: jest.fn(),
        incDLQAdded: jest.fn(),
      };

      const processor = new BridgeProcessor({ defaultEquipmentId: "test-equipment" });

      const useCase = new IngestTelemetryBatch({
        persistence: mockPersistence,
        deadLetterQueue: mockDLQ,
        metrics: mockMetrics,
        processor,
      });

      const result = await useCase.execute([], "test-batch-123");

      expect(result).toHaveProperty("archiveId");
      expect(result).toHaveProperty("batchId");
      expect(result.batchId).toBe("test-batch-123");
    });

    it("should return empty batchId when not provided", async () => {
      const mockPersistence = {
        writeBatch: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        checkIdempotency: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        markIdempotent: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      };

      const mockDLQ: IDeadLetterQueue<DlqPayload> = {
        add: jest.fn<IDeadLetterQueue<DlqPayload>["add"]>().mockReturnValue({
          id: "test",
          payload: { readings: [], frameIds: [] },
          error: "test-error",
          source: "test",
          retryCount: 0,
          createdAt: new Date(),
        }),
        get: jest.fn<IDeadLetterQueue<DlqPayload>["get"]>(),
        list: jest.fn<IDeadLetterQueue<DlqPayload>["list"]>().mockReturnValue([]),
        replay: jest.fn<IDeadLetterQueue<DlqPayload>["replay"]>(),
        replayAll: jest.fn<IDeadLetterQueue<DlqPayload>["replayAll"]>(),
        prune: jest.fn<IDeadLetterQueue<DlqPayload>["prune"]>().mockReturnValue(0),
        clear: jest.fn<IDeadLetterQueue<DlqPayload>["clear"]>().mockReturnValue(0),
        getMetrics: jest.fn<IDeadLetterQueue<DlqPayload>["getMetrics"]>().mockReturnValue({
          totalEntries: 0,
          totalAdded: 0,
          totalReplayed: 0,
          totalFailed: 0,
          oldestEntryAge: null,
        }),
      };

      const mockMetrics = {
        incFramesRead: jest.fn(),
        incReadingsDecoded: jest.fn(),
        incValidationFailed: jest.fn(),
        incBatchCommitted: jest.fn(),
        observeCommitLatency: jest.fn(),
        observeEndToEndLag: jest.fn(),
        setBacklog: jest.fn(),
        setBackoff: jest.fn(),
        incRetries: jest.fn(),
        incDLQAdded: jest.fn(),
      };

      const processor = new BridgeProcessor({ defaultEquipmentId: "test-equipment" });

      const useCase = new IngestTelemetryBatch({
        persistence: mockPersistence,
        deadLetterQueue: mockDLQ,
        metrics: mockMetrics,
        processor,
      });

      const result = await useCase.execute([]);

      expect(result.batchId).toBeUndefined();
      expect(result.archiveId).toBeUndefined();
    });
  });

  describe("IngestBatchResult with config options", () => {
    it("should support raw archive, heartbeat, and batch ack config options", async () => {
      const mockPersistence = {
        writeBatch: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        checkIdempotency: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        markIdempotent: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      };

      const mockDLQ: IDeadLetterQueue<DlqPayload> = {
        add: jest.fn<IDeadLetterQueue<DlqPayload>["add"]>().mockReturnValue({
          id: "test",
          payload: { readings: [], frameIds: [] },
          error: "test-error",
          source: "test",
          retryCount: 0,
          createdAt: new Date(),
        }),
        get: jest.fn<IDeadLetterQueue<DlqPayload>["get"]>(),
        list: jest.fn<IDeadLetterQueue<DlqPayload>["list"]>().mockReturnValue([]),
        replay: jest.fn<IDeadLetterQueue<DlqPayload>["replay"]>(),
        replayAll: jest.fn<IDeadLetterQueue<DlqPayload>["replayAll"]>(),
        prune: jest.fn<IDeadLetterQueue<DlqPayload>["prune"]>().mockReturnValue(0),
        clear: jest.fn<IDeadLetterQueue<DlqPayload>["clear"]>().mockReturnValue(0),
        getMetrics: jest.fn<IDeadLetterQueue<DlqPayload>["getMetrics"]>().mockReturnValue({
          totalEntries: 0,
          totalAdded: 0,
          totalReplayed: 0,
          totalFailed: 0,
          oldestEntryAge: null,
        }),
      };

      const mockMetrics = {
        incFramesRead: jest.fn(),
        incReadingsDecoded: jest.fn(),
        incValidationFailed: jest.fn(),
        incBatchCommitted: jest.fn(),
        observeCommitLatency: jest.fn(),
        observeEndToEndLag: jest.fn(),
        setBacklog: jest.fn(),
        setBackoff: jest.fn(),
        incRetries: jest.fn(),
        incDLQAdded: jest.fn(),
      };

      const mockRawArchive: RawTelemetryArchiveAdapter = {
        archiveRawPayload: jest
          .fn<RawTelemetryArchiveAdapter["archiveRawPayload"]>()
          .mockResolvedValue({
            archiveId: "archive-123",
            payloadHash: "hash-123",
            frameCount: 0,
            isDuplicate: false,
          }),
        markDecoded: jest
          .fn<RawTelemetryArchiveAdapter["markDecoded"]>()
          .mockResolvedValue(undefined),
        getById: jest.fn<RawTelemetryArchiveAdapter["getById"]>(),
        getPendingArchives: jest.fn<RawTelemetryArchiveAdapter["getPendingArchives"]>(),
        getFailedArchives: jest.fn<RawTelemetryArchiveAdapter["getFailedArchives"]>(),
        retryFailed: jest.fn<RawTelemetryArchiveAdapter["retryFailed"]>(),
        pruneOldArchives: jest.fn<RawTelemetryArchiveAdapter["pruneOldArchives"]>(),
        getMetrics: jest.fn<RawTelemetryArchiveAdapter["getMetrics"]>(),
        parseRawPayload: jest
          .fn<RawTelemetryArchiveAdapter["parseRawPayload"]>()
          .mockReturnValue([]),
      };

      const mockHeartbeat = new EquipmentHeartbeatAdapter();

      const mockBatchAck: TelemetryBatchAckAdapter = {
        receiveBatch: jest.fn<TelemetryBatchAckAdapter["receiveBatch"]>().mockResolvedValue({
          batchId: "batch-123",
          status: "received",
          receivedAt: new Date(),
        }),
        acknowledgeBatch: jest
          .fn<TelemetryBatchAckAdapter["acknowledgeBatch"]>()
          .mockResolvedValue(undefined),
        markFailed: jest.fn<TelemetryBatchAckAdapter["markFailed"]>().mockResolvedValue(undefined),
        getBatch: jest.fn<TelemetryBatchAckAdapter["getBatch"]>(),
        getUnacknowledgedBatches: jest.fn<TelemetryBatchAckAdapter["getUnacknowledgedBatches"]>(),
        getFailedBatches: jest.fn<TelemetryBatchAckAdapter["getFailedBatches"]>(),
        getRecentBatches: jest.fn<TelemetryBatchAckAdapter["getRecentBatches"]>(),
        retryBatch: jest.fn<TelemetryBatchAckAdapter["retryBatch"]>(),
        pruneOldBatches: jest.fn<TelemetryBatchAckAdapter["pruneOldBatches"]>(),
        getMetrics: jest.fn<TelemetryBatchAckAdapter["getMetrics"]>(),
      };

      const processor = new BridgeProcessor({ defaultEquipmentId: "test-equipment" });

      const useCase = new IngestTelemetryBatch({
        persistence: mockPersistence,
        deadLetterQueue: mockDLQ,
        metrics: mockMetrics,
        processor,
        rawArchive: mockRawArchive,
        heartbeat: mockHeartbeat,
        batchAck: mockBatchAck,
        orgId: "test-org",
      });

      expect(useCase).toBeDefined();
    });
  });

  describe("Inbound Port Interface", () => {
    it("should have archiveId and batchId in IngestBatchResult", () => {
      const result: IngestBatchResult = {
        framesProcessed: 0,
        readingsDecoded: 0,
        readingsPersisted: 0,
        duplicatesSkipped: 0,
        failedToDeadLetter: 0,
        archiveId: "test-archive-id",
        batchId: "test-batch-id",
      };

      expect(result.archiveId).toBe("test-archive-id");
      expect(result.batchId).toBe("test-batch-id");
    });
  });
});
