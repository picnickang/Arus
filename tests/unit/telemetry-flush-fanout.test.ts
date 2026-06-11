/**
 * Batch-writer post-commit fan-out — latest-per-(equipment, sensor)
 * dedup that feeds both the live WebSocket push and the post-flush alert
 * evaluation. The dedup is what bounds enrichment cost by sensor count
 * instead of message rate, so its semantics matter.
 */

import { jest, describe, it, expect, beforeAll } from "@jest/globals";

type Reading = {
  equipmentId: string;
  sensorType: string;
  value: number;
  timestamp: Date;
  orgId?: string;
  unit?: string;
};

let latestPerEquipmentSensor: (readings: Reading[]) => Map<string, Map<string, Reading>>;

beforeAll(async () => {
  // The batch-writer module pulls repositories/quota at import time; stub
  // the heavy edges the same way sibling suites do.
  jest.unstable_mockModule("../../server/repositories", () => ({
    __esModule: true,
    dbTelemetryStorage: { createTelemetryReadingsBulk: jest.fn() },
  }));
  jest.unstable_mockModule("../../server/tenancy/quota-service", () => ({
    __esModule: true,
    quotaService: { check: jest.fn(), increment: jest.fn() },
  }));
  jest.unstable_mockModule("../../server/websocket-server", () => ({
    __esModule: true,
    getWebSocketServer: () => null,
    setWebSocketServer: jest.fn(),
  }));

  ({ latestPerEquipmentSensor } = await import("../../server/telemetry-batch-writer"));
});

function r(equipmentId: string, sensorType: string, value: number, t: number): Reading {
  return { equipmentId, sensorType, value, timestamp: new Date(t) };
}

describe("latestPerEquipmentSensor", () => {
  it("keeps only the newest reading per (equipment, sensor)", () => {
    const latest = latestPerEquipmentSensor([
      r("eq-1", "temperature", 70, 1000),
      r("eq-1", "temperature", 71, 3000),
      r("eq-1", "temperature", 69, 2000),
      r("eq-1", "pressure", 5, 1500),
      r("eq-2", "temperature", 90, 1000),
    ]);

    expect(latest.size).toBe(2);
    expect(latest.get("eq-1")?.get("temperature")?.value).toBe(71);
    expect(latest.get("eq-1")?.get("pressure")?.value).toBe(5);
    expect(latest.get("eq-2")?.get("temperature")?.value).toBe(90);
  });

  it("prefers the later entry on identical timestamps (last write wins)", () => {
    const latest = latestPerEquipmentSensor([
      r("eq-1", "temperature", 70, 1000),
      r("eq-1", "temperature", 75, 1000),
    ]);
    expect(latest.get("eq-1")?.get("temperature")?.value).toBe(75);
  });

  it("returns an empty map for an empty flush", () => {
    expect(latestPerEquipmentSensor([]).size).toBe(0);
  });
});
