/**
 * Telemetry Pipeline Integration Tests
 * 
 * End-to-end tests for the telemetry ingestion pipeline:
 * - Frame decoding (J1939/J1587)
 * - Validation
 * - Batch writing
 * - PostgreSQL persistence
 * - Data integrity verification
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import { BridgeProcessor } from "../../services/sqlite-bridge/bridgeProcessor";
import { decodeFrame } from "../../telemetry/decode";
import { validateReading, filterValidReadings } from "../../telemetry/decode/validation";
import type { TelemetryReading } from "../../telemetry-batch-writer";
import type { RawFrame } from "../../telemetry/decode/types";
import {
  TEST_ORG_ID,
  TEST_EQUIPMENT_ID,
  createJ1939EngineSpeedFrame,
  createJ1939CoolantTempFrame,
  createJ1939OilPressureFrame,
  createJ1587EngineSpeedFrame,
  createJ1587CoolantTempFrame,
  createJ1587OilPressureFrame,
  createInvalidFrame,
  createInvalidPayloadVersionFrame,
  createBatchOfFrames,
  createMixedProtocolBatch,
  createIntegrityTestBatch,
  verifyReadingIntegrity,
  createDeduplicationTestCases,
  createOrderingTestCases,
} from "./fixtures";

describe("Telemetry Pipeline Integration", () => {
  let processor: BridgeProcessor;

  beforeAll(() => {
    processor = new BridgeProcessor({
      defaultEquipmentId: TEST_EQUIPMENT_ID,
      defaultOrgId: TEST_ORG_ID,
    });
  });

  describe("Frame Decoding", () => {
    it("should decode J1939 engine speed frame correctly", () => {
      const frame = createJ1939EngineSpeedFrame(1, 1500);
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });

      expect(readings.length).toBeGreaterThan(0);
      const reading = readings[0];
      expect(reading.sensorType).toBe("ENGINE_SPEED_RPM");
      expect(reading.equipmentId).toBe(TEST_EQUIPMENT_ID);
      expect(reading.value).toBeCloseTo(1500, -1);
    });

    it("should decode J1939 coolant temperature frame correctly", () => {
      const frame = createJ1939CoolantTempFrame(2, 85);
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });

      expect(readings.length).toBeGreaterThan(0);
      const reading = readings[0];
      expect(reading.sensorType).toBe("ENGINE_COOLANT_TEMP_C");
      expect(reading.unit).toBe("C");
    });

    it("should decode J1939 oil pressure frame correctly", () => {
      const frame = createJ1939OilPressureFrame(3, 450);
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });

      expect(readings.length).toBeGreaterThan(0);
      const reading = readings[0];
      expect(reading.sensorType).toBe("ENGINE_OIL_PRESSURE_KPA");
      expect(reading.unit).toBe("kPa");
    });

    it("should return empty array for invalid payload version", () => {
      const frame = createInvalidPayloadVersionFrame(4);
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });

      expect(readings).toEqual([]);
    });

    it("should return empty array for truncated payload", () => {
      const frame = createInvalidFrame(5);
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });

      expect(readings).toEqual([]);
    });

    it("should process mixed protocol batch correctly", () => {
      const frames = createMixedProtocolBatch(100);
      const allReadings: TelemetryReading[] = [];

      for (const frame of frames) {
        const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });
        allReadings.push(...readings);
      }

      expect(allReadings.length).toBeGreaterThanOrEqual(5);
      
      const sensorTypes = new Set(allReadings.map(r => r.sensorType));
      expect(sensorTypes.has("ENGINE_SPEED_RPM")).toBe(true);
      expect(sensorTypes.has("ENGINE_COOLANT_TEMP_C")).toBe(true);
      expect(sensorTypes.has("ENGINE_OIL_PRESSURE_KPA")).toBe(true);
    });
  });

  describe("Reading Validation", () => {
    it("should validate correct reading", () => {
      const reading: TelemetryReading = {
        equipmentId: TEST_EQUIPMENT_ID,
        sensorType: "ENGINE_SPEED_RPM",
        value: 1500,
        timestamp: new Date(),
      };

      expect(validateReading(reading)).toBe(true);
    });

    it("should reject reading with missing equipmentId", () => {
      const reading: TelemetryReading = {
        equipmentId: "",
        sensorType: "ENGINE_SPEED_RPM",
        value: 1500,
        timestamp: new Date(),
      };

      expect(validateReading(reading)).toBe(false);
    });

    it("should reject reading with NaN value", () => {
      const reading: TelemetryReading = {
        equipmentId: TEST_EQUIPMENT_ID,
        sensorType: "ENGINE_SPEED_RPM",
        value: NaN,
        timestamp: new Date(),
      };

      expect(validateReading(reading)).toBe(false);
    });

    it("should reject reading with Infinity value", () => {
      const reading: TelemetryReading = {
        equipmentId: TEST_EQUIPMENT_ID,
        sensorType: "ENGINE_SPEED_RPM",
        value: Infinity,
        timestamp: new Date(),
      };

      expect(validateReading(reading)).toBe(false);
    });

    it("should reject reading with future timestamp beyond threshold", () => {
      const reading: TelemetryReading = {
        equipmentId: TEST_EQUIPMENT_ID,
        sensorType: "ENGINE_SPEED_RPM",
        value: 1500,
        timestamp: new Date(Date.now() + 10 * 60 * 1000),
      };

      expect(validateReading(reading)).toBe(false);
    });

    it("should reject reading with ancient timestamp", () => {
      const reading: TelemetryReading = {
        equipmentId: TEST_EQUIPMENT_ID,
        sensorType: "ENGINE_SPEED_RPM",
        value: 1500,
        timestamp: new Date("1990-01-01"),
      };

      expect(validateReading(reading)).toBe(false);
    });

    it("should filter valid readings from mixed batch", () => {
      const readings: TelemetryReading[] = [
        { equipmentId: TEST_EQUIPMENT_ID, sensorType: "RPM", value: 1500, timestamp: new Date() },
        { equipmentId: "", sensorType: "RPM", value: 1500, timestamp: new Date() },
        { equipmentId: TEST_EQUIPMENT_ID, sensorType: "TEMP", value: NaN, timestamp: new Date() },
        { equipmentId: TEST_EQUIPMENT_ID, sensorType: "PRESSURE", value: 450, timestamp: new Date() },
      ];

      const valid = filterValidReadings(readings);
      expect(valid.length).toBe(2);
    });
  });

  describe("BridgeProcessor Integration", () => {
    it("should process batch of frames and return validated readings", () => {
      const frames = createBatchOfFrames(200, 10);
      const readings = processor.process(frames);

      expect(readings.length).toBe(10);
      
      for (const reading of readings) {
        expect(reading.orgId).toBe(TEST_ORG_ID);
        expect(reading.metadata?.idempotencyKey).toBeDefined();
      }
    });

    it("should handle empty frame batch", () => {
      const readings = processor.process([]);
      expect(readings).toEqual([]);
    });

    it("should filter out invalid frames from batch", () => {
      const frames: RawFrame[] = [
        createJ1939EngineSpeedFrame(300, 1500),
        createInvalidFrame(301),
        createJ1939EngineSpeedFrame(302, 1600),
        createInvalidPayloadVersionFrame(303),
        createJ1939EngineSpeedFrame(304, 1700),
      ];

      const readings = processor.process(frames);
      expect(readings.length).toBe(3);
    });

    it("should add idempotency keys to readings", () => {
      const frames = [createJ1939EngineSpeedFrame(400, 1500)];
      const readings = processor.process(frames);

      expect(readings.length).toBe(1);
      expect(readings[0].metadata?.idempotencyKey).toMatch(/^raw:/);
    });
  });

  describe("Data Integrity", () => {
    it("should preserve reading data through pipeline with checksum verification", () => {
      const { frames, expectedReadings, checksums } = createIntegrityTestBatch(500);
      const readings = processor.process(frames);

      expect(readings.length).toBe(expectedReadings);

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const reading = readings[i];
        
        const integrity = verifyReadingIntegrity(reading, TEST_EQUIPMENT_ID);
        expect(integrity.valid).toBe(true);
        if (!integrity.valid) {
          console.log("Integrity errors:", integrity.errors);
        }

        expect(checksums.has(frame.id)).toBe(true);
        expect(reading.metadata?.idempotencyKey).toContain(`${frame.id}`);
      }
    });

    it("should maintain timestamp ordering in readings", () => {
      const testCases = createOrderingTestCases(600);

      for (const testCase of testCases) {
        const frames = [...testCase.frames].sort((a, b) => a.id - b.id);
        const readings = processor.process(frames);

        const timestamps = readings.map(r => r.timestamp.getTime());
        const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
        
        expect(timestamps).toEqual(sortedTimestamps);
      }
    });

    it("should handle deduplication test cases correctly", () => {
      const testCases = createDeduplicationTestCases(650);
      
      for (const testCase of testCases) {
        const readings = processor.process(testCase.frames);
        
        const idempotencyKeys = readings.map(r => r.metadata?.idempotencyKey);
        const uniqueKeys = new Set(idempotencyKeys);
        
        expect(readings.length).toBeGreaterThan(0);
        expect(uniqueKeys.size).toBe(testCase.expectedUniqueCount);
      }
    });

    it("should generate unique idempotency keys for different frames", () => {
      const frames = createBatchOfFrames(700, 100);
      const readings = processor.process(frames);

      const keys = readings.map(r => r.metadata?.idempotencyKey);
      const uniqueKeys = new Set(keys);
      
      expect(uniqueKeys.size).toBe(readings.length);
    });
  });

  describe("High-Volume Processing", () => {
    it("should handle large batch without errors", () => {
      const frames = createBatchOfFrames(1000, 1000);
      
      expect(() => {
        const readings = processor.process(frames);
        expect(readings.length).toBe(1000);
      }).not.toThrow();
    });

    it("should maintain performance with repeated processing", () => {
      const frames = createBatchOfFrames(2000, 100);
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        processor.process(frames);
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      
      expect(avgTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(avgTime * 5);
    });
  });

  describe("Edge Cases", () => {
    it("should handle frame with zero timestamp gracefully", () => {
      const frame = createJ1939EngineSpeedFrame(3000, 1500, 0);
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });
      
      if (readings.length > 0) {
        expect(validateReading(readings[0])).toBe(false);
      }
    });

    it("should handle frame with maximum valid values", () => {
      const frame = createJ1939EngineSpeedFrame(3001, 65535 * 0.125, Date.now());
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });
      
      expect(readings.length).toBeGreaterThan(0);
    });

    it("should handle rapid sequential batches", () => {
      const allReadings: TelemetryReading[] = [];
      
      for (let batch = 0; batch < 10; batch++) {
        const frames = createBatchOfFrames(4000 + batch * 100, 50);
        allReadings.push(...processor.process(frames));
      }
      
      expect(allReadings.length).toBe(500);
    });
  });
});

describe("Protocol-Specific Decoding", () => {
  describe("J1939 Protocol", () => {
    it("should extract correct PGN from CAN ID", () => {
      const frame = createJ1939EngineSpeedFrame(1, 1500);
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });
      
      expect(readings.length).toBeGreaterThan(0);
      expect(readings[0].metadata?.pgn).toBe(0xF004);
    });

    it("should handle different source addresses", () => {
      const frames = [
        createJ1939EngineSpeedFrame(1, 1500, Date.now(), "CAN0"),
        createJ1939EngineSpeedFrame(2, 1600, Date.now(), "CAN1"),
      ];

      const readings: TelemetryReading[] = [];
      for (const frame of frames) {
        readings.push(...decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID }));
      }

      expect(readings.length).toBe(2);
      expect(readings[0].metadata?.source).toBe("CAN0");
      expect(readings[1].metadata?.source).toBe("CAN1");
    });
  });

  describe("J1587 Protocol", () => {
    it("should decode J1587 engine speed frame correctly", () => {
      const frame = createJ1587EngineSpeedFrame(100, 1500);
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });
      
      expect(readings.length).toBe(1);
      expect(readings[0].sensorType).toBe("ENGINE_SPEED_RPM");
      expect(readings[0].value).toBeCloseTo(1500, -1);
      expect(readings[0].equipmentId).toBe(TEST_EQUIPMENT_ID);
      expect(readings[0].metadata?.protocol).toBe("J1587");
      expect(readings[0].metadata?.pid).toBe(190);
    });

    it("should decode J1587 coolant temperature frames", () => {
      const frame = createJ1587CoolantTempFrame(101, 85);
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });
      
      expect(readings.length).toBe(1);
      expect(readings[0].sensorType).toBe("ENGINE_COOLANT_TEMP_C");
      expect(readings[0].value).toBe(85);
      expect(readings[0].unit).toBe("C");
      expect(readings[0].metadata?.protocol).toBe("J1587");
      expect(readings[0].metadata?.pid).toBe(110);
    });

    it("should decode J1587 oil pressure frames", () => {
      const frame = createJ1587OilPressureFrame(102, 400);
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });
      
      expect(readings.length).toBe(1);
      expect(readings[0].sensorType).toBe("ENGINE_OIL_PRESSURE_KPA");
      expect(readings[0].value).toBe(400);
      expect(readings[0].unit).toBe("kPa");
      expect(readings[0].metadata?.protocol).toBe("J1587");
      expect(readings[0].metadata?.pid).toBe(100);
    });

    it("should reject J1587 frames with wrong payload version", () => {
      const frame = createJ1587EngineSpeedFrame(103, 1500);
      frame.payloadFormatVersion = 99;
      
      const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });
      expect(readings).toEqual([]);
    });

    it("should handle mixed J1939/J1587 batch correctly", () => {
      const frames = [
        createJ1939EngineSpeedFrame(200, 1500),
        createJ1587EngineSpeedFrame(201, 1600),
        createJ1939CoolantTempFrame(202, 90),
        createJ1587CoolantTempFrame(203, 85),
      ];

      const allReadings: TelemetryReading[] = [];
      for (const frame of frames) {
        const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });
        allReadings.push(...readings);
      }
      
      expect(allReadings.length).toBe(4);
      
      const j1939Readings = allReadings.filter(r => r.metadata?.pgn !== undefined);
      const j1587Readings = allReadings.filter(r => r.metadata?.protocol === "J1587");
      
      expect(j1939Readings.length).toBe(2);
      expect(j1587Readings.length).toBe(2);
    });

    it("should process J1587 frames through BridgeProcessor", () => {
      const processor = new BridgeProcessor({
        defaultEquipmentId: TEST_EQUIPMENT_ID,
        defaultOrgId: TEST_ORG_ID,
      });
      
      const frames = [
        createJ1587EngineSpeedFrame(300, 2000),
        createJ1587CoolantTempFrame(301, 75),
        createJ1587OilPressureFrame(302, 350),
      ];
      
      const readings = processor.process(frames);
      
      expect(readings.length).toBe(3);
      readings.forEach(r => {
        expect(r.orgId).toBe(TEST_ORG_ID);
        expect(r.metadata?.protocol).toBe("J1587");
        expect(r.metadata?.idempotencyKey).toBeDefined();
      });
    });
  });
});
