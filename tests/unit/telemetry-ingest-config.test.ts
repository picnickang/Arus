/**
 * applyConfigsToReadings — the pure bulk-path equivalent of
 * applySensorConfiguration (server/services/telemetry-processing.ts:186).
 *
 * Pins the contract the batch writer now depends on:
 *   - gain multiplies, THEN offset adds (ordering matters);
 *   - minValue/maxValue breaches are FLAGGED (counter) but the reading
 *     is KEPT — range breaches are the PdM signal, not garbage;
 *   - enabled === false DROPS the reading and is counted;
 *   - readings without a config pass through with the SAME object
 *     reference (no per-reading reallocation on unconfigured fleets);
 *   - an empty config map returns the input array itself.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  applyConfigsToReadings,
  configKey,
  ingestConfigOutcomes,
  type ConfigurableReading,
  type SensorConfigLite,
} from "../../server/telemetry-ingest-config";

function config(partial: Partial<SensorConfigLite>): SensorConfigLite {
  return { gain: null, offset: null, minValue: null, maxValue: null, enabled: null, ...partial };
}

function reading(equipmentId: string, sensorType: string, value: number): ConfigurableReading {
  return { equipmentId, sensorType, value, orgId: "org-1" };
}

async function outcomeCount(outcome: string): Promise<number> {
  const metric = await ingestConfigOutcomes.get();
  return metric.values.find((v) => v.labels.outcome === outcome)?.value ?? 0;
}

describe("applyConfigsToReadings", () => {
  beforeEach(() => {
    ingestConfigOutcomes.reset();
  });

  it("returns the input array itself when the config map is empty", () => {
    const readings = [reading("e1", "temperature", 50)];
    const result = applyConfigsToReadings(readings, new Map());
    expect(result.kept).toBe(readings);
    expect(result.droppedDisabled).toBe(0);
  });

  it("passes readings without a matching config through by reference", () => {
    const r = reading("e1", "temperature", 50);
    const configs = new Map([[configKey("OTHER", "temperature"), config({ gain: 2 })]]);
    const { kept, droppedDisabled } = applyConfigsToReadings([r], configs);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toBe(r);
    expect(droppedDisabled).toBe(0);
  });

  it("applies gain before offset (value * gain + offset)", () => {
    const configs = new Map([
      [configKey("e1", "temperature"), config({ gain: 2, offset: 10, enabled: true })],
    ]);
    const { kept } = applyConfigsToReadings([reading("e1", "temperature", 5)], configs);
    // 5 * 2 + 10 = 20; offset-first would give (5 + 10) * 2 = 30.
    expect(kept[0]?.value).toBe(20);
  });

  it("does not mutate the original reading when transforming", () => {
    const r = reading("e1", "temperature", 5);
    const configs = new Map([[configKey("e1", "temperature"), config({ gain: 3 })]]);
    const { kept } = applyConfigsToReadings([r], configs);
    expect(kept[0]).not.toBe(r);
    expect(kept[0]?.value).toBe(15);
    expect(r.value).toBe(5);
  });

  it("keeps the same object reference when gain/offset leave the value unchanged", () => {
    const r = reading("e1", "temperature", 5);
    const configs = new Map([[configKey("e1", "temperature"), config({ gain: 1, offset: 0 })]]);
    const { kept } = applyConfigsToReadings([r], configs);
    expect(kept[0]).toBe(r);
  });

  it("drops readings whose config is disabled and counts them", async () => {
    const configs = new Map([[configKey("e1", "rpm"), config({ enabled: false })]]);
    const { kept, droppedDisabled } = applyConfigsToReadings(
      [reading("e1", "rpm", 900), reading("e1", "rpm", 901)],
      configs
    );
    expect(kept).toHaveLength(0);
    expect(droppedDisabled).toBe(2);
    expect(await outcomeCount("dropped_disabled")).toBe(2);
  });

  it("flags below_min / above_max but KEEPS the readings", async () => {
    const configs = new Map([
      [configKey("e1", "pressure"), config({ minValue: 10, maxValue: 100, enabled: true })],
    ]);
    const { kept, droppedDisabled } = applyConfigsToReadings(
      [reading("e1", "pressure", 5), reading("e1", "pressure", 50), reading("e1", "pressure", 150)],
      configs
    );
    expect(kept.map((r) => r.value)).toEqual([5, 50, 150]);
    expect(droppedDisabled).toBe(0);
    expect(await outcomeCount("below_min")).toBe(1);
    expect(await outcomeCount("above_max")).toBe(1);
  });

  it("evaluates bounds against the transformed value, not the raw one", async () => {
    // Raw 5 is below min=10, but gain 3 lifts it to 15 — no flag.
    const configs = new Map([
      [configKey("e1", "pressure"), config({ gain: 3, minValue: 10, enabled: true })],
    ]);
    const { kept } = applyConfigsToReadings([reading("e1", "pressure", 5)], configs);
    expect(kept[0]?.value).toBe(15);
    expect(await outcomeCount("below_min")).toBe(0);
  });

  it("handles a mixed batch preserving order: drop, transform, pass-through", () => {
    const configs = new Map([
      [configKey("e1", "rpm"), config({ enabled: false })],
      [configKey("e1", "temperature"), config({ offset: -2, enabled: true })],
    ]);
    const passThrough = reading("e2", "fuel_flow", 7);
    const { kept, droppedDisabled } = applyConfigsToReadings(
      [reading("e1", "rpm", 900), reading("e1", "temperature", 80), passThrough],
      configs
    );
    expect(droppedDisabled).toBe(1);
    expect(kept).toHaveLength(2);
    expect(kept[0]?.value).toBe(78);
    expect(kept[1]).toBe(passThrough);
  });
});
