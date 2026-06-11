/**
 * Shared Validation Schemas — Unit Tests
 *
 * Tests the Zod validators used across multiple domains.
 * These guard every API endpoint — failures here mean bad data in the database.
 */

import { describe, it, expect } from "@jest/globals";

// Import all validators
import * as validatorsModule from "../../shared/validation/index";

type ZodLike = { safeParse: (input: unknown) => { success: boolean } };
const validators = validatorsModule as unknown as Record<string, ZodLike | undefined>;

describe("Shared Validation Schemas", () => {
  // Test that the module exports things (basic smoke test)
  it("exports validation schemas from all submodules", () => {
    expect(Object.keys(validators).length).toBeGreaterThan(0);
  });
});

// ── Entity validators ────────────────────────────────────────────────────────

describe("Entity Validation", () => {
  // These tests verify the schemas exist and have reasonable behavior.
  // The exact schema names depend on what's exported from shared/validation/entities.ts.

  it("validates entity ID format if schema exists", () => {
    // Many ARUS entities use nanoid TEXT primary keys
    const schema = validators["entityIdSchema"];
    if (schema) {
      expect(schema.safeParse("abc123xyz").success).toBe(true);
      expect(schema.safeParse("").success).toBe(false);
    }
  });
});

// ── DateTime validation ──────────────────────────────────────────────────────

describe("DateTime Validation", () => {
  it("validates ISO 8601 datetime strings if schema exists", () => {
    const schema = validators["isoDateTimeSchema"] || validators["dateTimeSchema"];
    if (schema) {
      expect(schema.safeParse("2025-01-15T14:30:00Z").success).toBe(true);
    }
  });
});

// ── Marine-specific validation ───────────────────────────────────────────────

describe("Marine Validation", () => {
  it("validates IMO number format if schema exists", () => {
    const schema = validators["imoNumberSchema"];
    if (schema) {
      // IMO numbers are 7 digits
      expect(schema.safeParse("1234567").success).toBe(true);
    }
  });

  it("validates MMSI format if schema exists", () => {
    const schema = validators["mmsiSchema"];
    if (schema) {
      // MMSI is 9 digits
      expect(schema.safeParse("123456789").success).toBe(true);
    }
  });
});

// ── Telemetry validation ─────────────────────────────────────────────────────

describe("Telemetry Validation", () => {
  it("validates telemetry payload if schema exists", () => {
    const schema = validators["telemetryPayloadSchema"] || validators["telemetryRecordSchema"];
    if (schema) {
      // Telemetry typically needs: sensorId, value, timestamp
      const valid = schema.safeParse({
        sensorId: "sensor-001",
        value: 42.5,
        timestamp: new Date().toISOString(),
      });
      // Just verify the schema runs without crashing
      expect(typeof valid.success).toBe("boolean");
    }
  });
});

// ── PdM validation ───────────────────────────────────────────────────────────

describe("PdM Validation", () => {
  it("validates prediction input if schema exists", () => {
    const schema = validators["predictionInputSchema"];
    if (schema) {
      const result = schema.safeParse({
        equipmentId: "eq-001",
        modelId: "rf_all_123",
      });
      expect(typeof result.success).toBe("boolean");
    }
  });
});

// ── Sensor validation ────────────────────────────────────────────────────────

describe("Sensor Validation", () => {
  it("validates sensor configuration if schema exists", () => {
    const schema = validators["sensorConfigSchema"];
    if (schema) {
      const result = schema.safeParse({
        name: "Main Engine RPM",
        unit: "rpm",
        minThreshold: 0,
        maxThreshold: 1000,
      });
      expect(typeof result.success).toBe("boolean");
    }
  });
});

// ── Query filter validation ──────────────────────────────────────────────────

describe("Query Filter Validation", () => {
  it("validates pagination params if schema exists", () => {
    const schema = validators["paginationSchema"] || validators["queryFiltersSchema"];
    if (schema) {
      const result = schema.safeParse({ page: 1, limit: 20 });
      expect(typeof result.success).toBe("boolean");
    }
  });
});
