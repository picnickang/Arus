/**
 * Telemetry Pipeline Resilience Tests
 *
 * Tests for circuit breaker behavior, dead-letter queue,
 * and error recovery scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { CircuitBreaker } from "../../services/circuit-breaker/circuitBreaker";
import { DeadLetterQueue } from "../../services/dead-letter-queue";
import type { TelemetryReading } from "../../telemetry-batch-writer";
import {
  TEST_ORG_ID,
  TEST_EQUIPMENT_ID,
  createJ1939EngineSpeedFrame,
  createBatchOfFrames,
} from "./fixtures";
import { BridgeProcessor } from "../../services/sqlite-bridge/bridgeProcessor";

describe("Circuit Breaker Resilience", () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 2,
      name: "test-telemetry-cb",
    });
  });

  afterEach(() => {
    circuitBreaker.destroy();
  });

  describe("State Transitions", () => {
    it("should start in closed state", () => {
      expect(circuitBreaker.getState()).toBe("CLOSED");
    });

    it("should open after failure threshold is reached via execute", async () => {
      const failingFn = () => Promise.reject(new Error("Test failure"));

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch {}
      }

      expect(circuitBreaker.getState()).toBe("OPEN");
    });

    it("should allow requests when closed", () => {
      expect(circuitBreaker.isClosed()).toBe(true);
    });

    it("should block requests when open", async () => {
      const failingFn = () => Promise.reject(new Error("Test failure"));

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch {}
      }

      expect(circuitBreaker.isOpen()).toBe(true);

      await expect(circuitBreaker.execute(() => Promise.resolve("test"))).rejects.toThrow(
        "Circuit breaker 'test-telemetry-cb' is OPEN"
      );
    });

    it("should transition to half-open after timeout", async () => {
      const failingFn = () => Promise.reject(new Error("Test failure"));

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch {}
      }

      expect(circuitBreaker.getState()).toBe("OPEN");

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(circuitBreaker.getState()).toBe("HALF_OPEN");
    });

    it("should close after success threshold in half-open", async () => {
      const failingFn = () => Promise.reject(new Error("Test failure"));

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch {}
      }

      await new Promise((resolve) => setTimeout(resolve, 1100));

      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(() => Promise.resolve("success"));
      }

      expect(circuitBreaker.getState()).toBe("CLOSED");
    });

    it("should re-open on failure in half-open state", async () => {
      const failingFn = () => Promise.reject(new Error("Test failure"));

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch {}
      }

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(circuitBreaker.getState()).toBe("HALF_OPEN");

      try {
        await circuitBreaker.execute(failingFn);
      } catch {}

      expect(circuitBreaker.getState()).toBe("OPEN");
    });
  });

  describe("Metrics", () => {
    it("should track failure count", async () => {
      const failingFn = () => Promise.reject(new Error("Test failure"));

      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch {}
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(2);
      expect(metrics.totalFailures).toBe(2);
    });

    it("should reset failure count on success", async () => {
      const failingFn = () => Promise.reject(new Error("Test failure"));

      try {
        await circuitBreaker.execute(failingFn);
      } catch {}

      await circuitBreaker.execute(() => Promise.resolve("success"));

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(0);
    });

    it("should track total requests", async () => {
      await circuitBreaker.execute(() => Promise.resolve("test"));
      await circuitBreaker.execute(() => Promise.resolve("test"));

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(2);
    });
  });

  describe("Reset Functionality", () => {
    it("should reset circuit to closed state", async () => {
      const failingFn = () => Promise.reject(new Error("Test failure"));

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch {}
      }

      expect(circuitBreaker.getState()).toBe("OPEN");

      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe("CLOSED");
      expect(circuitBreaker.getMetrics().failureCount).toBe(0);
    });
  });
});

describe("Dead Letter Queue", () => {
  let dlq: DeadLetterQueue<TelemetryReading>;

  beforeEach(() => {
    dlq = new DeadLetterQueue<TelemetryReading>({
      maxEntries: 100,
      retentionDays: 7,
      name: "test-telemetry-dlq",
    });
    dlq.clear();
  });

  afterEach(() => {
    dlq.clear();
  });

  describe("Add Operations", () => {
    it("should add failed readings", () => {
      const reading: TelemetryReading = {
        equipmentId: TEST_EQUIPMENT_ID,
        sensorType: "ENGINE_SPEED_RPM",
        value: 1500,
        timestamp: new Date(),
      };

      const entry = dlq.add(reading, "DB connection failed", "telemetry-writer");

      expect(entry.id).toBeDefined();
      expect(entry.error).toBe("DB connection failed");
    });

    it("should preserve reading data in DLQ", () => {
      const reading: TelemetryReading = {
        equipmentId: TEST_EQUIPMENT_ID,
        sensorType: "ENGINE_SPEED_RPM",
        value: 1500,
        timestamp: new Date(),
        orgId: TEST_ORG_ID,
        metadata: { source: "CAN0" },
      };

      dlq.add(reading, "Test error", "telemetry-writer");

      const entries = dlq.list({ limit: 1 });
      expect(entries.length).toBe(1);
      expect(entries[0].payload.equipmentId).toBe(TEST_EQUIPMENT_ID);
      expect(entries[0].payload.value).toBe(1500);
      expect(entries[0].payload.orgId).toBe(TEST_ORG_ID);
    });

    it("should track error message", () => {
      const reading: TelemetryReading = {
        equipmentId: TEST_EQUIPMENT_ID,
        sensorType: "ENGINE_SPEED_RPM",
        value: 1500,
        timestamp: new Date(),
      };

      dlq.add(reading, "Connection timeout", "telemetry-writer");

      const entries = dlq.list({ limit: 1 });
      expect(entries[0].error).toBe("Connection timeout");
    });

    it("should track source of failure", () => {
      const reading: TelemetryReading = {
        equipmentId: TEST_EQUIPMENT_ID,
        sensorType: "ENGINE_SPEED_RPM",
        value: 1500,
        timestamp: new Date(),
      };

      dlq.add(reading, "Error", "batch-writer");

      const entries = dlq.list({ limit: 1 });
      expect(entries[0].source).toBe("batch-writer");
    });
  });

  describe("Get Operations", () => {
    it("should return undefined for non-existent entry", () => {
      expect(dlq.get("non-existent-id")).toBeUndefined();
    });

    it("should retrieve entry by ID", () => {
      const reading: TelemetryReading = {
        equipmentId: TEST_EQUIPMENT_ID,
        sensorType: "ENGINE_SPEED_RPM",
        value: 1500,
        timestamp: new Date(),
      };

      const entry = dlq.add(reading, "Test error", "telemetry-writer");
      const retrieved = dlq.get(entry.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(entry.id);
    });
  });

  describe("List Operations", () => {
    it("should list entries with limit", () => {
      for (let i = 0; i < 10; i++) {
        dlq.add(
          { equipmentId: `eq${i}`, sensorType: "RPM", value: i, timestamp: new Date() },
          "Test error",
          "test-source"
        );
      }

      const entries = dlq.list({ limit: 5 });
      expect(entries.length).toBe(5);
    });

    it("should filter entries by source", () => {
      dlq.add(
        { equipmentId: "eq1", sensorType: "RPM", value: 100, timestamp: new Date() },
        "Error",
        "source-a"
      );
      dlq.add(
        { equipmentId: "eq2", sensorType: "RPM", value: 200, timestamp: new Date() },
        "Error",
        "source-b"
      );
      dlq.add(
        { equipmentId: "eq3", sensorType: "RPM", value: 300, timestamp: new Date() },
        "Error",
        "source-a"
      );

      const entries = dlq.list({ source: "source-a" });
      expect(entries.length).toBe(2);
    });
  });

  describe("Capacity Management", () => {
    it("should respect max entries limit", () => {
      const smallDlq = new DeadLetterQueue<TelemetryReading>({
        maxEntries: 5,
        retentionDays: 7,
        name: "test-small-dlq",
      });
      smallDlq.clear();

      for (let i = 0; i < 10; i++) {
        smallDlq.add(
          { equipmentId: `eq${i}`, sensorType: "RPM", value: i, timestamp: new Date() },
          "Test error",
          "test-source"
        );
      }

      const entries = smallDlq.list();
      expect(entries.length).toBeLessThanOrEqual(5);

      smallDlq.clear();
    });
  });

  describe("Clear Operations", () => {
    it("should clear all entries", () => {
      for (let i = 0; i < 5; i++) {
        dlq.add(
          { equipmentId: `eq${i}`, sensorType: "RPM", value: i, timestamp: new Date() },
          "Test error",
          "test-source"
        );
      }

      const clearedCount = dlq.clear();
      expect(clearedCount).toBe(5);
      expect(dlq.list().length).toBe(0);
    });
  });

  describe("Metrics", () => {
    it("should provide queue metrics", () => {
      for (let i = 0; i < 3; i++) {
        dlq.add(
          { equipmentId: `eq${i}`, sensorType: "RPM", value: i, timestamp: new Date() },
          "Test error",
          "test-source"
        );
      }

      const metrics = dlq.getMetrics();
      expect(metrics.totalEntries).toBe(3);
    });
  });
});

describe("Error Recovery Scenarios", () => {
  let processor: BridgeProcessor;

  beforeEach(() => {
    processor = new BridgeProcessor({
      defaultEquipmentId: TEST_EQUIPMENT_ID,
      defaultOrgId: TEST_ORG_ID,
    });
  });

  describe("Graceful Degradation", () => {
    it("should continue processing valid frames after invalid ones", () => {
      const frames = [
        createJ1939EngineSpeedFrame(1, 1500),
        {
          id: 2,
          ts: Date.now(),
          source: "CAN0",
          protocol: "UNKNOWN",
          payload: Buffer.alloc(1),
          payloadFormatVersion: 1,
        },
        createJ1939EngineSpeedFrame(3, 1700),
      ];

      const readings = processor.process(frames);
      expect(readings.length).toBe(2);
    });

    it("should process partial batches on decode errors", () => {
      const frames = createBatchOfFrames(100, 10);

      frames[3].payload = Buffer.alloc(2);
      frames[7].payloadFormatVersion = 99;

      const readings = processor.process(frames);
      expect(readings.length).toBe(8);
    });
  });

  describe("Recovery After Failures", () => {
    it("should process normally after handling corrupted frames", () => {
      const corruptedFrames = [
        {
          id: 200,
          ts: 0,
          source: "",
          protocol: "",
          payload: Buffer.alloc(0),
          payloadFormatVersion: 0,
        },
      ];

      processor.process(corruptedFrames);

      const validFrames = createBatchOfFrames(300, 5);
      const readings = processor.process(validFrames);

      expect(readings.length).toBe(5);
    });

    it("should maintain state isolation between batches", () => {
      const batch1 = createBatchOfFrames(400, 50);
      const batch2 = createBatchOfFrames(450, 50);

      const readings1 = processor.process(batch1);
      const readings2 = processor.process(batch2);

      expect(readings1.length).toBe(50);
      expect(readings2.length).toBe(50);

      const allKeys = new Set([
        ...readings1.map((r) => r.metadata?.idempotencyKey),
        ...readings2.map((r) => r.metadata?.idempotencyKey),
      ]);
      expect(allKeys.size).toBe(100);
    });
  });

  describe("Integration with Circuit Breaker Pattern", () => {
    it("should process frames independently of circuit state", () => {
      const frames = createBatchOfFrames(500, 20);
      const readings = processor.process(frames);

      expect(readings.length).toBe(20);

      for (const reading of readings) {
        expect(reading.equipmentId).toBe(TEST_EQUIPMENT_ID);
        expect(reading.orgId).toBe(TEST_ORG_ID);
      }
    });
  });
});
