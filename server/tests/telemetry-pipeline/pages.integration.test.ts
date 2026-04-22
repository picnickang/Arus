/**
 * Page-Level Telemetry Integration Tests
 * 
 * Tests to verify that the 12 pages consuming telemetry data
 * receive properly formatted data from the pipeline.
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import { BridgeProcessor } from "../../services/sqlite-bridge/bridgeProcessor";
import type { TelemetryReading } from "../../telemetry-batch-writer";
import {
  TEST_ORG_ID,
  TEST_EQUIPMENT_ID,
  createJ1939EngineSpeedFrame,
  createJ1939CoolantTempFrame,
  createJ1939OilPressureFrame,
  createBatchOfFrames,
  createMixedProtocolBatch,
} from "./fixtures";

interface TelemetryPageContract {
  pageName: string;
  requiredFields: (keyof TelemetryReading)[];
  optionalFields: (keyof TelemetryReading)[];
  sensorTypes?: string[];
}

const PAGE_CONTRACTS: TelemetryPageContract[] = [
  {
    pageName: "active-telemetry",
    requiredFields: ["equipmentId", "sensorType", "value", "timestamp"],
    optionalFields: ["unit", "metadata"],
    sensorTypes: ["ENGINE_SPEED_RPM", "ENGINE_COOLANT_TEMP_C", "ENGINE_OIL_PRESSURE_KPA"],
  },
  {
    pageName: "diagnostics-dashboard",
    requiredFields: ["equipmentId", "sensorType", "value", "timestamp"],
    optionalFields: ["orgId", "metadata"],
  },
  {
    pageName: "dashboard-improved",
    requiredFields: ["equipmentId", "sensorType", "value", "timestamp"],
    optionalFields: ["unit", "metadata"],
  },
  {
    pageName: "operations-hub",
    requiredFields: ["equipmentId", "sensorType", "value", "timestamp"],
    optionalFields: ["orgId", "deviceId"],
  },
  {
    pageName: "ml-training",
    requiredFields: ["equipmentId", "sensorType", "value", "timestamp"],
    optionalFields: ["metadata"],
    sensorTypes: ["ENGINE_SPEED_RPM", "ENGINE_COOLANT_TEMP_C"],
  },
  {
    pageName: "fuel-emissions-log",
    requiredFields: ["equipmentId", "sensorType", "value", "timestamp"],
    optionalFields: ["unit", "orgId"],
  },
  {
    pageName: "manual-telemetry-upload",
    requiredFields: ["equipmentId", "sensorType", "value", "timestamp"],
    optionalFields: ["deviceId", "metadata"],
  },
  {
    pageName: "vessel-management",
    requiredFields: ["equipmentId", "sensorType", "value", "timestamp"],
    optionalFields: ["orgId", "metadata"],
  },
  {
    pageName: "sensor-templates",
    requiredFields: ["sensorType", "value"],
    optionalFields: ["unit", "metadata"],
  },
  {
    pageName: "deck-logbook",
    requiredFields: ["equipmentId", "sensorType", "value", "timestamp"],
    optionalFields: ["orgId", "metadata"],
  },
  {
    pageName: "transport-settings",
    requiredFields: ["equipmentId", "sensorType", "value", "timestamp"],
    optionalFields: ["metadata"],
  },
  {
    pageName: "system-administration",
    requiredFields: ["equipmentId", "sensorType", "value", "timestamp", "orgId"],
    optionalFields: ["metadata"],
  },
];

describe("Page-Level Telemetry Integration", () => {
  let processor: BridgeProcessor;
  let sampleReadings: TelemetryReading[];

  beforeAll(() => {
    processor = new BridgeProcessor({
      defaultEquipmentId: TEST_EQUIPMENT_ID,
      defaultOrgId: TEST_ORG_ID,
    });

    const mixedFrames = createMixedProtocolBatch(1000);
    sampleReadings = processor.process(mixedFrames);
  });

  describe("Reading Contract Validation", () => {
    for (const contract of PAGE_CONTRACTS) {
      describe(`${contract.pageName} page`, () => {
        it(`should have all required fields: ${contract.requiredFields.join(", ")}`, () => {
          for (const reading of sampleReadings) {
            for (const field of contract.requiredFields) {
              const value = reading[field];
              expect(value).toBeDefined();
              
              if (field === "value") {
                expect(typeof value).toBe("number");
              } else if (field === "timestamp") {
                expect(value).toBeInstanceOf(Date);
              } else if (typeof value === "string") {
                expect(value.length).toBeGreaterThan(0);
              }
            }
          }
        });

        if (contract.sensorTypes && contract.sensorTypes.length > 0) {
          it(`should support expected sensor types: ${contract.sensorTypes.join(", ")}`, () => {
            const readingSensorTypes = new Set(sampleReadings.map(r => r.sensorType));
            
            for (const expectedType of contract.sensorTypes!) {
              expect(readingSensorTypes.has(expectedType)).toBe(true);
            }
          });
        }
      });
    }
  });

  describe("Data Format Consistency", () => {
    it("should produce JSON-serializable readings for all pages", () => {
      for (const reading of sampleReadings) {
        expect(() => JSON.stringify(reading)).not.toThrow();
      }
    });

    it("should have consistent timestamp format", () => {
      for (const reading of sampleReadings) {
        expect(reading.timestamp).toBeInstanceOf(Date);
        expect(isNaN(reading.timestamp.getTime())).toBe(false);
        
        const isoString = reading.timestamp.toISOString();
        expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });

    it("should have valid numeric values", () => {
      for (const reading of sampleReadings) {
        expect(Number.isFinite(reading.value)).toBe(true);
        expect(isNaN(reading.value)).toBe(false);
      }
    });

    it("should have consistent org ID for tenant isolation", () => {
      for (const reading of sampleReadings) {
        expect(reading.orgId).toBe(TEST_ORG_ID);
      }
    });
  });

  describe("Sensor Type Coverage", () => {
    it("should decode ENGINE_SPEED_RPM readings", () => {
      const frame = createJ1939EngineSpeedFrame(2000, 1800);
      const readings = processor.process([frame]);

      expect(readings.length).toBe(1);
      expect(readings[0].sensorType).toBe("ENGINE_SPEED_RPM");
      expect(readings[0].value).toBeCloseTo(1800, -1);
    });

    it("should decode ENGINE_COOLANT_TEMP_C readings", () => {
      const frame = createJ1939CoolantTempFrame(2001, 90);
      const readings = processor.process([frame]);

      expect(readings.length).toBe(1);
      expect(readings[0].sensorType).toBe("ENGINE_COOLANT_TEMP_C");
      expect(readings[0].unit).toBe("C");
    });

    it("should decode ENGINE_OIL_PRESSURE_KPA readings", () => {
      const frame = createJ1939OilPressureFrame(2002, 500);
      const readings = processor.process([frame]);

      expect(readings.length).toBe(1);
      expect(readings[0].sensorType).toBe("ENGINE_OIL_PRESSURE_KPA");
      expect(readings[0].unit).toBe("kPa");
    });
  });

  describe("Metadata for Traceability", () => {
    it("should include source in metadata for audit trail", () => {
      const frames = createBatchOfFrames(3000, 5);
      const readings = processor.process(frames);

      for (const reading of readings) {
        expect(reading.metadata).toBeDefined();
        expect(reading.metadata?.source).toBeDefined();
      }
    });

    it("should include idempotency key for deduplication", () => {
      const frames = createBatchOfFrames(3100, 5);
      const readings = processor.process(frames);

      for (const reading of readings) {
        expect(reading.metadata?.idempotencyKey).toBeDefined();
        expect(typeof reading.metadata?.idempotencyKey).toBe("string");
      }
    });

    it("should include PGN for protocol-specific tracing", () => {
      const frame = createJ1939EngineSpeedFrame(3200, 1500);
      const readings = processor.process([frame]);

      expect(readings[0].metadata?.pgn).toBeDefined();
      expect(typeof readings[0].metadata?.pgn).toBe("number");
    });
  });

  describe("High-Volume Page Scenarios", () => {
    it("should handle dashboard with 1000+ readings efficiently", () => {
      const frames = createBatchOfFrames(4000, 1000);
      
      const start = performance.now();
      const readings = processor.process(frames);
      const duration = performance.now() - start;

      expect(readings.length).toBe(1000);
      expect(duration).toBeLessThan(500);
    });

    it("should maintain data integrity under load", () => {
      const frames = createBatchOfFrames(5000, 500);
      const readings = processor.process(frames);

      const equipmentIds = new Set(readings.map(r => r.equipmentId));
      expect(equipmentIds.size).toBe(1);
      expect(equipmentIds.has(TEST_EQUIPMENT_ID)).toBe(true);

      const orgIds = new Set(readings.map(r => r.orgId));
      expect(orgIds.size).toBe(1);
      expect(orgIds.has(TEST_ORG_ID)).toBe(true);
    });
  });

  describe("API Response Format", () => {
    it("should produce readings suitable for REST API response", () => {
      const frames = createMixedProtocolBatch(6000);
      const readings = processor.process(frames);

      const apiResponse = {
        success: true,
        data: readings.map(r => ({
          ...r,
          timestamp: r.timestamp.toISOString(),
        })),
        meta: {
          count: readings.length,
          orgId: TEST_ORG_ID,
        },
      };

      expect(() => JSON.stringify(apiResponse)).not.toThrow();
      
      const parsed = JSON.parse(JSON.stringify(apiResponse));
      expect(parsed.success).toBe(true);
      expect(parsed.data.length).toBe(readings.length);
    });

    it("should produce readings suitable for WebSocket streaming", () => {
      const frame = createJ1939EngineSpeedFrame(7000, 2000);
      const readings = processor.process([frame]);

      const wsMessage = {
        type: "telemetry",
        payload: readings[0],
        timestamp: Date.now(),
      };

      const serialized = JSON.stringify(wsMessage);
      expect(serialized.length).toBeLessThan(1024);
      
      const parsed = JSON.parse(serialized);
      expect(parsed.type).toBe("telemetry");
      expect(parsed.payload.sensorType).toBe("ENGINE_SPEED_RPM");
    });
  });
});

describe("Equipment Resolution", () => {
  it("should use custom equipment resolver when provided", () => {
    const customResolver = (source: string): string | null => {
      if (source === "CAN0") {return "engine-main";}
      if (source === "CAN1") {return "engine-aux";}
      return null;
    };

    const processor = new BridgeProcessor({
      resolveEquipmentId: customResolver,
      defaultEquipmentId: "unknown",
      defaultOrgId: TEST_ORG_ID,
    });

    const frame = createJ1939EngineSpeedFrame(8000, 1500, Date.now(), "CAN0");
    const readings = processor.process([frame]);

    expect(readings[0].equipmentId).toBe("engine-main");
  });

  it("should fall back to default when resolver returns null", () => {
    const customResolver = (): string | null => null;

    const processor = new BridgeProcessor({
      resolveEquipmentId: customResolver,
      defaultEquipmentId: "fallback-equipment",
      defaultOrgId: TEST_ORG_ID,
    });

    const frame = createJ1939EngineSpeedFrame(8100, 1500);
    const readings = processor.process([frame]);

    expect(readings[0].equipmentId).toBe("fallback-equipment");
  });
});
