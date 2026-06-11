/**
 * Bulk sensor-configuration application for the telemetry ingest path.
 *
 * `applySensorConfiguration` (server/services/telemetry-processing.ts)
 * defines the per-reading semantics — gain, then offset, bounds FLAG but
 * do not drop, `enabled === false` drops — but it does one DB lookup per
 * reading, which is unusable at the batch writer's measured 2,000 msg/s.
 * Nothing on the bulk path ever applied configs, so gain/offset were
 * silently ignored for every ingested reading.
 *
 * This module is the bulk-rate equivalent: org-scoped config maps with a
 * short TTL cache (one query per org per refresh window, fetched under
 * withTenantContext because sensor_configurations carries FORCE RLS),
 * plus a pure transform exported for unit tests. Readings without a
 * config pass through untouched, preserving prior behavior.
 */

import client from "prom-client";
import { createLogger } from "./lib/structured-logger";

const logger = createLogger("TelemetryIngestConfig");

const CONFIG_CACHE_TTL_MS = 30_000;

export interface SensorConfigLite {
  gain: number | null;
  offset: number | null;
  minValue: number | null;
  maxValue: number | null;
  enabled: boolean | null;
}

export interface ConfigurableReading {
  equipmentId: string;
  sensorType: string;
  value: number;
  orgId?: string;
}

export const ingestConfigOutcomes = new client.Counter({
  name: "arus_telemetry_ingest_config_total",
  help:
    "Outcomes of sensor-config application on the bulk ingest path: " +
    "dropped_disabled = reading discarded because the sensor config is " +
    "disabled; below_min / above_max = out-of-range flags (reading is " +
    "KEPT, matching applySensorConfiguration semantics — range breaches " +
    "are the PdM signal, not garbage).",
  labelNames: ["outcome"] as const,
});

export function configKey(equipmentId: string, sensorType: string): string {
  return `${equipmentId}::${sensorType}`;
}

/**
 * Pure transform: apply gain/offset, count bounds flags, drop disabled.
 * Mirrors applySensorConfiguration ordering exactly. Exported for tests.
 */
export function applyConfigsToReadings<T extends ConfigurableReading>(
  readings: T[],
  configs: Map<string, SensorConfigLite>
): { kept: T[]; droppedDisabled: number } {
  if (configs.size === 0) {
    return { kept: readings, droppedDisabled: 0 };
  }

  const kept: T[] = [];
  let droppedDisabled = 0;

  for (const reading of readings) {
    const config = configs.get(configKey(reading.equipmentId, reading.sensorType));
    if (!config) {
      kept.push(reading);
      continue;
    }

    if (config.enabled === false) {
      droppedDisabled++;
      ingestConfigOutcomes.inc({ outcome: "dropped_disabled" });
      continue;
    }

    let value = reading.value;
    // gain 0 is treated as unset (mirrors applySensorConfiguration's
    // truthiness check) — zeroing a channel is what `enabled: false` is for.
    if (config.gain != null && config.gain !== 0 && config.gain !== 1) {
      value = value * config.gain;
    }
    if (config.offset != null && config.offset !== 0) {
      value = value + config.offset;
    }

    if (config.minValue != null && value < config.minValue) {
      ingestConfigOutcomes.inc({ outcome: "below_min" });
    }
    if (config.maxValue != null && value > config.maxValue) {
      ingestConfigOutcomes.inc({ outcome: "above_max" });
    }

    kept.push(value === reading.value ? reading : { ...reading, value });
  }

  return { kept, droppedDisabled };
}

interface CacheEntry {
  expiresAt: number;
  configs: Map<string, SensorConfigLite>;
}

const orgConfigCache = new Map<string, CacheEntry>();

/**
 * Org-scoped config map with a 30s TTL. Fetched under the org's tenant
 * context (FORCE RLS on sensor_configurations means an unpinned read
 * returns zero rows in production). Fails open: a fetch error yields an
 * empty map (pass-through) rather than blocking the flush.
 */
export async function getOrgConfigMap(orgId: string): Promise<Map<string, SensorConfigLite>> {
  const cached = orgConfigCache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.configs;
  }

  let configs = new Map<string, SensorConfigLite>();
  try {
    const { withTenantContext } = await import("./middleware/db-context.js");
    const { dbSensorsStorage } = await import("./repositories");
    const rows = await withTenantContext(orgId, () =>
      dbSensorsStorage.getSensorConfigurations(orgId)
    );
    // Bounds normalize from the schema's REAL columns min_valid/max_valid
    // (Drizzle properties minValid/maxValid). applySensorConfiguration
    // reads config.minValue/maxValue through a cast — properties that have
    // never existed on the row — so its below_min/above_max flags can
    // never fire; this module maps the actual columns instead of
    // inheriting that dead mapping.
    configs = new Map(
      (rows as Array<Record<string, unknown>>).map((row) => [
        configKey(String(row["equipmentId"]), String(row["sensorType"])),
        {
          gain: (row["gain"] as number | null) ?? null,
          offset: (row["offset"] as number | null) ?? null,
          minValue: (row["minValid"] as number | null) ?? null,
          maxValue: (row["maxValid"] as number | null) ?? null,
          enabled: (row["enabled"] as boolean | null) ?? null,
        },
      ])
    );
  } catch (err) {
    logger.warn("Sensor-config fetch failed — ingest passes through unconfigured", {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  orgConfigCache.set(orgId, { expiresAt: Date.now() + CONFIG_CACHE_TTL_MS, configs });
  return configs;
}

/** Test hook: clear the TTL cache between cases. */
export function clearConfigCacheForTests(): void {
  orgConfigCache.clear();
}
