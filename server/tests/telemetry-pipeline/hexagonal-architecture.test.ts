import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { TelemetryReading } from '../../telemetry-batch-writer';
import type { RawFrame } from '../../telemetry/decode/types';
import type { ITelemetryPersistence, IDeadLetterQueue, IMetricsEmitter, DeadLetterEntry } from '../../telemetry/ports/outbound';
import { IngestTelemetryBatch } from '../../telemetry/application/ingest-batch';
import { BridgeProcessor } from '../../services/sqlite-bridge/bridgeProcessor';

describe('Telemetry Hexagonal Architecture', () => {
  let mockPersistence: ITelemetryPersistence;
  let mockDLQ: IDeadLetterQueue<{ readings: TelemetryReading[]; frameIds: number[] }>;
  let mockMetrics: IMetricsEmitter;
  let processor: BridgeProcessor;
  let idempotencyStore: Set<string>;
  let dlqEntries: DeadLetterEntry<{ readings: TelemetryReading[]; frameIds: number[] }>[];

  beforeEach(() => {
    idempotencyStore = new Set();
    dlqEntries = [];

    mockPersistence = {
      writeBatch: jest.fn<(readings: TelemetryReading[]) => Promise<void>>().mockResolvedValue(undefined),
      checkIdempotency: jest.fn<(key: string) => Promise<boolean>>().mockImplementation((key: string) => {
        return Promise.resolve(idempotencyStore.has(key));
      }),
      markIdempotent: jest.fn<(key: string) => Promise<void>>().mockImplementation((key: string) => {
        idempotencyStore.add(key);
        return Promise.resolve();
      }),
    };

    mockDLQ = {
      add: jest.fn<(payload: any, error: string, source: string) => DeadLetterEntry<any>>().mockImplementation((payload, error, source) => {
        const entry: DeadLetterEntry<any> = {
          id: `dlq-${Date.now()}`,
          payload,
          error,
          source,
          retryCount: 0,
          createdAt: new Date(),
        };
        dlqEntries.push(entry);
        return entry;
      }),
      get: jest.fn<(id: string) => DeadLetterEntry<any> | undefined>().mockImplementation((id: string) => {
        return dlqEntries.find(e => e.id === id);
      }),
      list: jest.fn<() => DeadLetterEntry<any>[]>().mockImplementation(() => dlqEntries),
      replay: jest.fn<(id: string) => Promise<{ success: boolean; entryId: string; error?: string }>>().mockResolvedValue({ success: true, entryId: 'test' }),
      replayAll: jest.fn<() => Promise<{ success: boolean; entryId: string; error?: string }[]>>().mockResolvedValue([]),
      prune: jest.fn<() => number>().mockReturnValue(0),
      clear: jest.fn<() => number>().mockReturnValue(0),
      getMetrics: jest.fn<() => { totalEntries: number; totalAdded: number; totalReplayed: number; totalFailed: number; oldestEntryAge: number | null }>().mockReturnValue({ totalEntries: 0, totalAdded: 0, totalReplayed: 0, totalFailed: 0, oldestEntryAge: null }),
    };

    mockMetrics = {
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

    processor = new BridgeProcessor({ defaultEquipmentId: 'test-equipment' });
  });

  function createTestFrame(id: number, protocol: 'J1939' | 'J1587' = 'J1939'): RawFrame {
    const payload = Buffer.alloc(13);
    if (protocol === 'J1939') {
      payload.writeUInt32LE(0x0CF00400, 0);
      payload.writeUInt8(8, 4);
      payload.writeUInt16LE(2000, 5);
    } else {
      payload.writeUInt8(0x80, 0);
      payload.writeUInt8(0xBE, 1);
      payload.writeUInt8(1, 2);
      payload.writeUInt8(0x64, 3);
    }

    return {
      id,
      ts: Date.now(),
      source: 'CAN0',
      protocol,
      payload,
      qualityFlags: 0,
      payloadFormatVersion: 1,
    };
  }

  describe('IngestTelemetryBatch Use Case', () => {
    it('should process frames and persist readings', async () => {
      const useCase = new IngestTelemetryBatch({
        persistence: mockPersistence,
        deadLetterQueue: mockDLQ,
        metrics: mockMetrics,
        processor,
      });

      const frames = [createTestFrame(1), createTestFrame(2)];
      const result = await useCase.execute(frames);

      expect(result.framesProcessed).toBe(2);
      expect(result.readingsDecoded).toBeGreaterThan(0);
      expect(mockPersistence.writeBatch).toHaveBeenCalled();
      expect(mockMetrics.incFramesRead).toHaveBeenCalledWith(2);
    });

    it('should skip duplicate readings via idempotency check', async () => {
      const useCase = new IngestTelemetryBatch({
        persistence: mockPersistence,
        deadLetterQueue: mockDLQ,
        metrics: mockMetrics,
        processor,
      });

      const frames = [createTestFrame(1)];
      
      const result1 = await useCase.execute(frames);
      expect(result1.readingsPersisted).toBeGreaterThan(0);
      expect(result1.duplicatesSkipped).toBe(0);

      const result2 = await useCase.execute(frames);
      expect(result2.duplicatesSkipped).toBeGreaterThan(0);
    });

    it('should send to DLQ when circuit breaker is open', async () => {
      const useCase = new IngestTelemetryBatch({
        persistence: mockPersistence,
        deadLetterQueue: mockDLQ,
        metrics: mockMetrics,
        processor,
        circuitBreaker: {
          isOpen: () => true,
          execute: async () => { throw new Error('Circuit open'); },
        },
      });

      const frames = [createTestFrame(1)];
      const result = await useCase.execute(frames);

      expect(result.failedToDeadLetter).toBeGreaterThan(0);
      expect(mockDLQ.add).toHaveBeenCalled();
      expect(mockMetrics.incDLQAdded).toHaveBeenCalledWith('circuit-open');
    });

    it('should send to DLQ on persistence failure', async () => {
      (mockPersistence.writeBatch as jest.MockedFunction<typeof mockPersistence.writeBatch>).mockRejectedValueOnce(new Error('PG connection failed'));

      const useCase = new IngestTelemetryBatch({
        persistence: mockPersistence,
        deadLetterQueue: mockDLQ,
        metrics: mockMetrics,
        processor,
      });

      const frames = [createTestFrame(1)];
      const result = await useCase.execute(frames);

      expect(result.failedToDeadLetter).toBeGreaterThan(0);
      expect(mockDLQ.add).toHaveBeenCalled();
    });

    it('should record metrics for all operations', async () => {
      const useCase = new IngestTelemetryBatch({
        persistence: mockPersistence,
        deadLetterQueue: mockDLQ,
        metrics: mockMetrics,
        processor,
      });

      const frames = [createTestFrame(1)];
      await useCase.execute(frames);

      expect(mockMetrics.incFramesRead).toHaveBeenCalled();
      expect(mockMetrics.incReadingsDecoded).toHaveBeenCalled();
      expect(mockMetrics.incBatchCommitted).toHaveBeenCalled();
      expect(mockMetrics.observeCommitLatency).toHaveBeenCalled();
    });
  });

  describe('Port Interface Contracts', () => {
    it('ITelemetryPersistence should implement required methods', () => {
      expect(mockPersistence.writeBatch).toBeDefined();
      expect(mockPersistence.checkIdempotency).toBeDefined();
      expect(mockPersistence.markIdempotent).toBeDefined();
    });

    it('IDeadLetterQueue should implement required methods', () => {
      expect(mockDLQ.add).toBeDefined();
      expect(mockDLQ.get).toBeDefined();
      expect(mockDLQ.list).toBeDefined();
      expect(mockDLQ.replay).toBeDefined();
      expect(mockDLQ.replayAll).toBeDefined();
      expect(mockDLQ.prune).toBeDefined();
      expect(mockDLQ.getMetrics).toBeDefined();
    });

    it('IMetricsEmitter should implement required methods', () => {
      expect(mockMetrics.incFramesRead).toBeDefined();
      expect(mockMetrics.incReadingsDecoded).toBeDefined();
      expect(mockMetrics.incBatchCommitted).toBeDefined();
      expect(mockMetrics.observeCommitLatency).toBeDefined();
      expect(mockMetrics.setBacklog).toBeDefined();
      expect(mockMetrics.incDLQAdded).toBeDefined();
    });
  });

  describe('BridgeProcessor Integration', () => {
    it('should generate idempotency keys for readings', () => {
      const frames = [createTestFrame(1)];
      const readings = processor.process(frames);

      expect(readings.length).toBeGreaterThan(0);
      expect(readings[0].metadata?.idempotencyKey).toBeDefined();
      expect(readings[0].metadata?.idempotencyKey).toContain('raw:');
    });

    it('should process J1939 frames correctly', () => {
      const j1939Frame = createTestFrame(1, 'J1939');
      const j1939Readings = processor.process([j1939Frame]);

      expect(j1939Readings.length).toBeGreaterThan(0);
      expect(j1939Readings[0].sensorType).toBe('ENGINE_SPEED_RPM');
    });
  });
});
