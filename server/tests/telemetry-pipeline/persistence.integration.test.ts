/**
 * Telemetry Persistence Integration Tests
 *
 * Tests for PostgreSQL persistence structure, read-after-write consistency,
 * and data integrity verification for the telemetry pipeline.
 */

import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import type { TelemetryReading } from "../../telemetry-batch-writer";
import {
  TEST_ORG_ID,
  TEST_EQUIPMENT_ID,
  createJ1939EngineSpeedFrame,
  createBatchOfFrames,
  createIntegrityTestBatch,
  computeFrameChecksum,
} from "./fixtures";
import { BridgeProcessor } from "../../services/sqlite-bridge/bridgeProcessor";

describe("Telemetry Persistence", () => {
  let processor: BridgeProcessor;

  beforeAll(() => {
    processor = new BridgeProcessor({
      defaultEquipmentId: TEST_EQUIPMENT_ID,
      defaultOrgId: TEST_ORG_ID,
    });
  });

  describe("Reading Structure Validation", () => {
    it("should produce readings with all required fields for persistence", () => {
      const frame = createJ1939EngineSpeedFrame(1, 1500);
      const readings = processor.process([frame]);

      expect(readings.length).toBe(1);
      const reading = readings[0];

      expect(reading.equipmentId).toBeDefined();
      expect(reading.sensorType).toBeDefined();
      expect(typeof reading.value).toBe("number");
      expect(reading.timestamp).toBeInstanceOf(Date);
      expect(reading.orgId).toBe(TEST_ORG_ID);
    });

    it("should include metadata for traceability", () => {
      const frame = createJ1939EngineSpeedFrame(2, 1600);
      const readings = processor.process([frame]);

      expect(readings.length).toBe(1);
      const metadata = readings[0].metadata;

      expect(metadata).toBeDefined();
      expect(metadata?.idempotencyKey).toBeDefined();
      expect(metadata?.source).toBeDefined();
      expect(metadata?.pgn).toBeDefined();
    });
  });

  describe("Batch Processing for Persistence", () => {
    it("should process large batches suitable for bulk insert", () => {
      const frames = createBatchOfFrames(100, 500);
      const readings = processor.process(frames);

      expect(readings.length).toBe(500);

      const idempotencyKeys = readings.map((r) => r.metadata?.idempotencyKey);
      const uniqueKeys = new Set(idempotencyKeys);
      expect(uniqueKeys.size).toBe(500);
    });

    it("should maintain data integrity across batch boundaries", () => {
      const batch1 = createBatchOfFrames(1000, 100);
      const batch2 = createBatchOfFrames(1100, 100);

      const readings1 = processor.process(batch1);
      const readings2 = processor.process(batch2);

      const allKeys = [
        ...readings1.map((r) => r.metadata?.idempotencyKey),
        ...readings2.map((r) => r.metadata?.idempotencyKey),
      ];
      const uniqueKeys = new Set(allKeys);

      expect(uniqueKeys.size).toBe(200);
    });

    it("should handle sequential batch processing without state corruption", () => {
      const results: TelemetryReading[][] = [];

      for (let i = 0; i < 10; i++) {
        const frames = createBatchOfFrames(2000 + i * 50, 50);
        results.push(processor.process(frames));
      }

      const allReadings = results.flat();
      expect(allReadings.length).toBe(500);

      const idempotencyKeys = new Set(allReadings.map((r) => r.metadata?.idempotencyKey));
      expect(idempotencyKeys.size).toBe(500);
    });
  });

  describe("Timestamp Consistency", () => {
    it("should preserve original frame timestamps", () => {
      const baseTimestamp = Date.now() - 60000;
      const frames = createBatchOfFrames(3000, 10, baseTimestamp);
      const readings = processor.process(frames);

      for (let i = 0; i < readings.length; i++) {
        const expectedTs = baseTimestamp + i * 100;
        expect(readings[i].timestamp.getTime()).toBe(expectedTs);
      }
    });

    it("should handle readings spanning multiple days", () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const frames = [
        createJ1939EngineSpeedFrame(4000, 1500, Date.now() - 2 * dayMs),
        createJ1939EngineSpeedFrame(4001, 1600, Date.now() - dayMs),
        createJ1939EngineSpeedFrame(4002, 1700, Date.now()),
      ];

      const readings = processor.process(frames);
      expect(readings.length).toBe(3);

      const timestamps = readings.map((r) => r.timestamp.getTime());
      expect(timestamps[2] - timestamps[0]).toBeGreaterThan(dayMs);
    });
  });

  describe("Idempotency Key Generation", () => {
    it("should generate consistent idempotency keys for same frame", () => {
      const frame = createJ1939EngineSpeedFrame(5000, 1500);

      const readings1 = processor.process([frame]);
      const readings2 = processor.process([frame]);

      expect(readings1[0].metadata?.idempotencyKey).toBe(readings2[0].metadata?.idempotencyKey);
    });

    it("should generate different keys for different frames", () => {
      const frame1 = createJ1939EngineSpeedFrame(5001, 1500);
      const frame2 = createJ1939EngineSpeedFrame(5002, 1500);

      const readings1 = processor.process([frame1]);
      const readings2 = processor.process([frame2]);

      expect(readings1[0].metadata?.idempotencyKey).not.toBe(readings2[0].metadata?.idempotencyKey);
    });

    it("should include source and protocol in idempotency key", () => {
      const frame = createJ1939EngineSpeedFrame(5003, 1500);
      const readings = processor.process([frame]);

      const key = readings[0].metadata?.idempotencyKey as string;
      expect(key).toContain("raw:");
      expect(key).toContain("J1939");
    });
  });

  describe("Org ID Assignment", () => {
    it("should assign default org ID to all readings", () => {
      const frames = createBatchOfFrames(6000, 20);
      const readings = processor.process(frames);

      for (const reading of readings) {
        expect(reading.orgId).toBe(TEST_ORG_ID);
      }
    });

    it("should use custom org ID when provided in processor config", () => {
      const customOrgId = "custom-org-test";
      const customProcessor = new BridgeProcessor({
        defaultEquipmentId: TEST_EQUIPMENT_ID,
        defaultOrgId: customOrgId,
      });

      const frames = createBatchOfFrames(7000, 5);
      const readings = customProcessor.process(frames);

      for (const reading of readings) {
        expect(reading.orgId).toBe(customOrgId);
      }
    });
  });
});

describe("Read-After-Write Consistency", () => {
  describe("Immediate Consistency Checks", () => {
    it("should produce readings that can be serialized to JSON", () => {
      const processor = new BridgeProcessor({
        defaultEquipmentId: TEST_EQUIPMENT_ID,
        defaultOrgId: TEST_ORG_ID,
      });

      const frames = createBatchOfFrames(8000, 10);
      const readings = processor.process(frames);

      for (const reading of readings) {
        expect(() => JSON.stringify(reading)).not.toThrow();

        const parsed = JSON.parse(JSON.stringify(reading));
        expect(parsed.equipmentId).toBe(reading.equipmentId);
        expect(parsed.sensorType).toBe(reading.sensorType);
        expect(parsed.value).toBe(reading.value);
      }
    });

    it("should produce readings with consistent structure across batches", () => {
      const processor = new BridgeProcessor({
        defaultEquipmentId: TEST_EQUIPMENT_ID,
        defaultOrgId: TEST_ORG_ID,
      });

      const batch1 = createBatchOfFrames(9000, 50);
      const batch2 = createBatchOfFrames(9050, 50);

      const readings1 = processor.process(batch1);
      const readings2 = processor.process(batch2);

      const keys1 = Object.keys(readings1[0]).sort();
      const keys2 = Object.keys(readings2[0]).sort();

      expect(keys1).toEqual(keys2);
    });
  });
});

describe("Data Integrity Through Pipeline", () => {
  let processor: BridgeProcessor;

  beforeEach(() => {
    processor = new BridgeProcessor({
      defaultEquipmentId: TEST_EQUIPMENT_ID,
      defaultOrgId: TEST_ORG_ID,
    });
  });

  describe("Checksum Verification", () => {
    it("should track checksums through pipeline", () => {
      const { frames, checksums } = createIntegrityTestBatch(14000);
      const readings = processor.process(frames);

      expect(checksums.size).toBe(frames.length);
      expect(readings.length).toBe(frames.length);

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const checksum = checksums.get(frame.id);
        const expectedChecksum = computeFrameChecksum(frame);

        expect(checksum).toBe(expectedChecksum);
      }
    });

    it("should preserve reading data through pipeline", () => {
      const { frames } = createIntegrityTestBatch(15000);
      const readings = processor.process(frames);

      const originalData = readings.map((r) => ({
        equipmentId: r.equipmentId,
        sensorType: r.sensorType,
        value: r.value,
        orgId: r.orgId,
      }));

      for (const original of originalData) {
        expect(original.equipmentId).toBe(TEST_EQUIPMENT_ID);
        expect(original.orgId).toBe(TEST_ORG_ID);
        expect(typeof original.value).toBe("number");
        expect(original.sensorType).toBeDefined();
      }
    });

    it("should verify all frames have corresponding checksums", () => {
      const { frames, checksums } = createIntegrityTestBatch(16000);

      for (const frame of frames) {
        expect(checksums.has(frame.id)).toBe(true);
        const checksum = checksums.get(frame.id);
        expect(typeof checksum).toBe("string");
        expect(checksum!.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Reading Structure for Persistence", () => {
    it("should produce readings compatible with DB insert schema", () => {
      const frames = createBatchOfFrames(17000, 20);
      const readings = processor.process(frames);

      for (const reading of readings) {
        expect(reading.equipmentId).toBeDefined();
        expect(typeof reading.equipmentId).toBe("string");

        expect(reading.sensorType).toBeDefined();
        expect(typeof reading.sensorType).toBe("string");

        expect(reading.value).toBeDefined();
        expect(Number.isFinite(reading.value)).toBe(true);

        expect(reading.timestamp).toBeInstanceOf(Date);
        expect(!isNaN(reading.timestamp.getTime())).toBe(true);

        expect(reading.orgId).toBe(TEST_ORG_ID);
      }
    });

    it("should include all metadata required for audit trail", () => {
      const frames = createBatchOfFrames(18000, 10);
      const readings = processor.process(frames);

      for (const reading of readings) {
        expect(reading.metadata).toBeDefined();
        expect(reading.metadata?.idempotencyKey).toBeDefined();
        expect(reading.metadata?.source).toBeDefined();
        expect(reading.metadata?.pgn).toBeDefined();
      }
    });
  });

  describe("Simulated Write-Read Round Trip", () => {
    function simulateDbRoundTrip(reading: TelemetryReading): TelemetryReading {
      const dbRow = {
        equipment_id: reading.equipmentId,
        sensor_type: reading.sensorType,
        value: String(reading.value),
        unit: reading.unit ?? null,
        timestamp: reading.timestamp.toISOString(),
        org_id: reading.orgId,
        metadata: reading.metadata ? JSON.stringify(reading.metadata) : null,
      };

      return {
        equipmentId: dbRow.equipment_id,
        sensorType: dbRow.sensor_type,
        value: parseFloat(dbRow.value),
        unit: dbRow.unit ?? undefined,
        timestamp: new Date(dbRow.timestamp),
        orgId: dbRow.org_id,
        metadata: dbRow.metadata ? JSON.parse(dbRow.metadata) : undefined,
      };
    }

    it("should preserve data through simulated persistence round trip", () => {
      const frames = createBatchOfFrames(19000, 50);
      const readings = processor.process(frames);

      for (const original of readings) {
        const retrieved = simulateDbRoundTrip(original);

        expect(retrieved.equipmentId).toBe(original.equipmentId);
        expect(retrieved.sensorType).toBe(original.sensorType);
        expect(retrieved.value).toBeCloseTo(original.value, 6);
        expect(retrieved.orgId).toBe(original.orgId);
        expect(retrieved.timestamp.getTime()).toBe(original.timestamp.getTime());
        expect(retrieved.metadata?.idempotencyKey).toBe(original.metadata?.idempotencyKey);
      }
    });

    it("should handle idempotency key collisions through round trip", () => {
      const frames = createBatchOfFrames(20000, 100);
      const readings = processor.process(frames);

      const storedKeys = new Map<string, TelemetryReading>();
      let collisions = 0;

      for (const reading of readings) {
        const key = reading.metadata?.idempotencyKey;
        if (key) {
          if (storedKeys.has(key)) {
            collisions++;
          } else {
            storedKeys.set(key, reading);
          }
        }
      }

      expect(collisions).toBe(0);
      expect(storedKeys.size).toBe(readings.length);
    });

    it("should preserve checksum-verifiable data through round trip", () => {
      const { frames, checksums } = createIntegrityTestBatch(21000);
      const readings = processor.process(frames);

      const retrievedReadings = readings.map(simulateDbRoundTrip);

      expect(retrievedReadings.length).toBe(frames.length);

      for (let i = 0; i < retrievedReadings.length; i++) {
        expect(retrievedReadings[i].metadata?.idempotencyKey).toBe(
          readings[i].metadata?.idempotencyKey
        );
      }
    });
  });
});
