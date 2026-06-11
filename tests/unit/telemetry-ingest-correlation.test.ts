/**
 * Tier A — Telemetry Ingest Pipeline Contract (Hexagonal Unit Test)
 * --------------------------------------------------------------------
 * Critical-path test for the telemetry ingestion path defined in
 * replit.md › Telemetry Ingestion + Telemetry Resilience.
 *
 * Exercises `IngestTelemetryBatch` (the inbound port implementation) with
 * stub adapters for persistence, dead-letter queue, metrics, and the batch
 * processor. Asserts the orchestration contract:
 *
 *   1. A successful batch flows: archive → process → idempotency check
 *      → persist → metrics committed.
 *   2. Persistence failure routes the readings into the DLQ and bumps
 *      DLQ metrics — failures are NEVER silently dropped (data integrity).
 *   3. Empty input is a no-op (no port calls beyond the trivial guard).
 *
 * Placement: tests/unit/ — see cost-savings-claim-integrity.test.ts header
 * for the rationale (test:integration script is mis-wired).
 *
 * Note: this complements server/tests/telemetry-pipeline/hexagonal-architecture.test.ts
 * which already covers idempotency-skip; here we focus on the failure-routing
 * contract that protects against silent data loss in production.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { IngestTelemetryBatch } from "../../server/telemetry/application/ingest-batch";
import type { RawFrame } from "../../server/telemetry/decode/types";
import type { TelemetryBatchReading as TelemetryReading } from "../../server/telemetry-batch-writer";
import type {
  ITelemetryPersistence,
  IDeadLetterQueue,
  IMetricsEmitter,
  DeadLetterEntry,
} from "../../server/telemetry/ports/outbound";
import type { IBatchProcessor } from "../../server/telemetry/ports/inbound";

// ---------- Test fixtures ----------

const FIXED_TIMESTAMP = new Date("2026-04-24T10:00:00Z");

function makeFrame(id: number): RawFrame {
  return {
    id,
    payload: { sensorId: `s-${id}`, value: 100 + id, ts: FIXED_TIMESTAMP.toISOString() },
    protocol: "test-protocol",
    source: "test-source",
    receivedAt: FIXED_TIMESTAMP,
    payloadFormatVersion: 1,
  } as unknown as RawFrame;
}

function makeReading(frameId: number): TelemetryReading {
  return {
    equipmentId: `eq-${frameId}`,
    sensorType: "vibration",
    value: 100 + frameId,
    timestamp: FIXED_TIMESTAMP,
    orgId: "test-org",
  } as unknown as TelemetryReading;
}

// ---------- Stub builders ----------

function buildStubs(persistenceImpl?: () => Promise<void>) {
  const writeBatch = jest
    .fn<(readings: TelemetryReading[]) => Promise<void>>()
    .mockImplementation(persistenceImpl ?? (() => Promise.resolve()));

  const persistence: ITelemetryPersistence = {
    writeBatch,
    checkIdempotency: jest.fn<(key: string) => Promise<boolean>>().mockResolvedValue(false),
    markIdempotent: jest.fn<(key: string) => Promise<void>>().mockResolvedValue(undefined),
  };

  const dlqEntries: DeadLetterEntry<{ readings: TelemetryReading[]; frameIds: number[] }>[] = [];
  const dlq: IDeadLetterQueue<{ readings: TelemetryReading[]; frameIds: number[] }> = {
    add: jest.fn<IDeadLetterQueue<{ readings: TelemetryReading[]; frameIds: number[] }>["add"]>(
      (payload, error, source, metadata) => {
        const entry: DeadLetterEntry<{
          readings: TelemetryReading[];
          frameIds: number[];
        }> = {
          id: `dlq-${dlqEntries.length + 1}`,
          payload,
          error,
          source,
          retryCount: 0,
          createdAt: new Date(),
          metadata,
        };
        dlqEntries.push(entry);
        return entry;
      }
    ),
    get: jest.fn(),
    list: jest.fn().mockReturnValue([]),
    replay: jest.fn(),
    replayAll: jest.fn(),
    prune: jest.fn().mockReturnValue(0),
    clear: jest.fn().mockReturnValue(0),
    getMetrics: jest.fn().mockReturnValue({
      totalEntries: 0,
      totalAdded: 0,
      totalReplayed: 0,
      totalFailed: 0,
      oldestEntryAge: null,
    }),
  } as unknown as IDeadLetterQueue<{ readings: TelemetryReading[]; frameIds: number[] }>;

  const metrics: IMetricsEmitter = {
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

  return { persistence, dlq, dlqEntries, metrics };
}

function buildProcessor(
  readingsPerFrame: (frame: RawFrame) => TelemetryReading[]
): IBatchProcessor {
  return {
    process: jest.fn((frames: RawFrame[]) => frames.flatMap(readingsPerFrame)),
  };
}

describe("Telemetry Ingest Pipeline Contract", () => {
  let stubs: ReturnType<typeof buildStubs>;

  beforeEach(() => {
    stubs = buildStubs();
  });

  it("happy path: frames flow through processor → persistence → metrics", async () => {
    const frames = [makeFrame(1), makeFrame(2), makeFrame(3)];
    const processor = buildProcessor((f) => [makeReading((f as unknown as { id: number }).id)]);

    const ingest = new IngestTelemetryBatch({
      persistence: stubs.persistence,
      deadLetterQueue: stubs.dlq,
      metrics: stubs.metrics,
      processor,
    });

    const result = await ingest.execute(frames);

    expect(result.framesProcessed).toBe(3);
    expect(result.readingsDecoded).toBe(3);
    expect(result.readingsPersisted).toBe(3);
    expect(result.duplicatesSkipped).toBe(0);
    expect(result.failedToDeadLetter).toBe(0);

    // Metrics contract: every successful batch must report frames-in
    // and the commit latency observation.
    expect(stubs.metrics.incFramesRead).toHaveBeenCalledWith(3);
    expect(stubs.metrics.incReadingsDecoded).toHaveBeenCalledWith(3);
    expect(stubs.metrics.incBatchCommitted).toHaveBeenCalledWith(3);
    expect(stubs.metrics.observeCommitLatency).toHaveBeenCalledTimes(1);

    // Persistence was called exactly once with all decoded readings
    expect(stubs.persistence.writeBatch).toHaveBeenCalledTimes(1);
    const persisted = (stubs.persistence.writeBatch as jest.Mock).mock.calls[0][0];
    expect(Array.isArray(persisted)).toBe(true);
    expect((persisted as TelemetryReading[]).length).toBe(3);

    // DLQ untouched on success — silent-failure regression guard
    expect(stubs.dlq.add).not.toHaveBeenCalled();
    expect(stubs.metrics.incDLQAdded).not.toHaveBeenCalled();
  });

  it("persistence failure routes batch to DLQ and bumps DLQ metric (no silent loss)", async () => {
    stubs = buildStubs(() => Promise.reject(new Error("connection reset by peer")));
    const frames = [makeFrame(10), makeFrame(11)];
    const processor = buildProcessor((f) => [makeReading((f as unknown as { id: number }).id)]);

    const ingest = new IngestTelemetryBatch({
      persistence: stubs.persistence,
      deadLetterQueue: stubs.dlq,
      metrics: stubs.metrics,
      processor,
    });

    const result = await ingest.execute(frames);

    // Frames were decoded but not persisted
    expect(result.readingsDecoded).toBe(2);
    expect(result.readingsPersisted).toBe(0);
    expect(result.failedToDeadLetter).toBe(2);

    // The two readings landed in the DLQ as one entry with the originating error
    expect(stubs.dlq.add).toHaveBeenCalledTimes(1);
    expect(stubs.dlqEntries).toHaveLength(1);
    expect(stubs.dlqEntries[0].error).toContain("connection reset by peer");
    expect(stubs.dlqEntries[0].payload.readings).toHaveLength(2);

    // DLQ metric must be incremented so SRE dashboards surface the loss path
    expect(stubs.metrics.incDLQAdded).toHaveBeenCalledTimes(1);

    // Commit-success metric must NOT have been emitted on the failure path
    expect(stubs.metrics.incBatchCommitted).not.toHaveBeenCalled();
  });

  it("empty input is a no-op (zero port calls beyond the trivial guard)", async () => {
    const processor = buildProcessor(() => []);

    const ingest = new IngestTelemetryBatch({
      persistence: stubs.persistence,
      deadLetterQueue: stubs.dlq,
      metrics: stubs.metrics,
      processor,
    });

    const result = await ingest.execute([]);

    expect(result.framesProcessed).toBe(0);
    expect(result.readingsDecoded).toBe(0);
    expect(result.readingsPersisted).toBe(0);

    // Crucially: do NOT call writeBatch with empty array (avoids
    // wasted DB round-trips and false "0 readings committed" metrics)
    expect(stubs.persistence.writeBatch).not.toHaveBeenCalled();
    expect(stubs.metrics.incFramesRead).not.toHaveBeenCalled();
    expect(stubs.metrics.incBatchCommitted).not.toHaveBeenCalled();
    expect(stubs.dlq.add).not.toHaveBeenCalled();
  });

  it("processor returning zero readings still counts frames-in but skips persistence", async () => {
    const frames = [makeFrame(20), makeFrame(21)];
    const processor = buildProcessor(() => []); // all frames invalid/filtered

    const ingest = new IngestTelemetryBatch({
      persistence: stubs.persistence,
      deadLetterQueue: stubs.dlq,
      metrics: stubs.metrics,
      processor,
    });

    const result = await ingest.execute(frames);

    expect(result.framesProcessed).toBe(2);
    expect(result.readingsDecoded).toBe(0);
    expect(result.readingsPersisted).toBe(0);
    expect(result.failedToDeadLetter).toBe(0);

    // Frames-in reported (so we can detect "decoder dropped everything"
    // alerts), but persistence is correctly skipped
    expect(stubs.metrics.incFramesRead).toHaveBeenCalledWith(2);
    expect(stubs.persistence.writeBatch).not.toHaveBeenCalled();
    expect(stubs.dlq.add).not.toHaveBeenCalled();
  });
});
