import { describe, it, expect, jest } from "@jest/globals";

import { IngestTelemetryBatch } from "../../telemetry/application/ingest-batch";
import type { IngestBatchResult } from "../../telemetry/ports/inbound";
import { BridgeProcessor } from "../../services/sqlite-bridge/bridgeProcessor";

describe("Telemetry Ingestion Architecture", () => {
  describe("IngestBatchResult Interface", () => {
    it("should include archiveId and batchId fields in result type", async () => {
      const mockPersistence = {
        writeBatch: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        checkIdempotency: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        markIdempotent: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      };

      const mockDLQ = {
        add: jest.fn().mockReturnValue({ id: "test" }),
        get: jest.fn(),
        list: jest.fn().mockReturnValue([]),
        replay: jest.fn(),
        replayAll: jest.fn(),
        prune: jest.fn().mockReturnValue(0),
        clear: jest.fn().mockReturnValue(0),
        getMetrics: jest
          .fn<
            () => {
              totalEntries: number;
              totalAdded: number;
              totalReplayed: number;
              totalFailed: number;
              oldestEntryAge: number | null;
            }
          >()
          .mockReturnValue({
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

      const mockDLQ = {
        add: jest.fn().mockReturnValue({ id: "test" }),
        get: jest.fn(),
        list: jest.fn().mockReturnValue([]),
        replay: jest.fn(),
        replayAll: jest.fn(),
        prune: jest.fn().mockReturnValue(0),
        clear: jest.fn().mockReturnValue(0),
        getMetrics: jest
          .fn<
            () => {
              totalEntries: number;
              totalAdded: number;
              totalReplayed: number;
              totalFailed: number;
              oldestEntryAge: number | null;
            }
          >()
          .mockReturnValue({
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

      const mockDLQ = {
        add: jest.fn().mockReturnValue({ id: "test" }),
        get: jest.fn(),
        list: jest.fn().mockReturnValue([]),
        replay: jest.fn(),
        replayAll: jest.fn(),
        prune: jest.fn().mockReturnValue(0),
        clear: jest.fn().mockReturnValue(0),
        getMetrics: jest
          .fn<
            () => {
              totalEntries: number;
              totalAdded: number;
              totalReplayed: number;
              totalFailed: number;
              oldestEntryAge: number | null;
            }
          >()
          .mockReturnValue({
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

      const mockRawArchive = {
        archiveRawPayload: jest
          .fn<() => Promise<{ archiveId: string; isDuplicate: boolean }>>()
          .mockResolvedValue({ archiveId: "archive-123", isDuplicate: false }),
        markDecoded: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        getPendingArchives: jest.fn(),
        getFailedArchives: jest.fn(),
        retryFailed: jest.fn(),
        pruneOldArchives: jest.fn(),
        getMetrics: jest.fn(),
        parseRawPayload: jest.fn(),
      };

      const mockHeartbeat = {
        updateHeartbeat: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        batchUpdateHeartbeats: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        getHeartbeat: jest.fn(),
        getOnlineEquipment: jest.fn(),
        getOfflineEquipment: jest.fn(),
        updateOnlineStatus: jest.fn(),
        getMetricsByOrg: jest.fn(),
      };

      const mockBatchAck = {
        receiveBatch: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        acknowledgeBatch: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        markFailed: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        getBatch: jest.fn(),
        getUnacknowledgedBatches: jest.fn(),
        getFailedBatches: jest.fn(),
        getRecentBatches: jest.fn(),
        retryBatch: jest.fn(),
        pruneOldBatches: jest.fn(),
        getMetrics: jest.fn(),
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
