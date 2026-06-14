/**
 * End-to-end asset-anomaly simulation — marine-engine coolant overheating.
 *
 * Simulates the three facets of a predictive-maintenance anomaly against the
 * embedded SQLite integration lane:
 *
 *   1. Data generation — seed deterministic coolant-temperature telemetry
 *      (a normal baseline history + a recent overheating excursion) into the
 *      embedded SQLite equipment_telemetry table and read it back.
 *   2. Visual profile — assert the chart-payload contract produced by
 *      normalizeAnomalyDetection, the exact transform the client analytics
 *      charts consume.
 *   3. Downstream logic — drive the real degradation / RUL / failure-mode
 *      algorithms and assert a degraded prediction (high risk, reduced
 *      remaining-useful-life) plus the coolant -> "overheating" mapping.
 *
 * It exercises the genuine statistical engine deterministically:
 * detectStatisticalAnomaly, calculateDegradationMetrics,
 * statisticalFailurePrediction, and inferFailureMode. The baseline is computed
 * with calculateMeanAndStdDev rather than calculateStatisticalBaseline because
 * the latter (like getMultiSensorData) uses Postgres-only date_trunc SQL that
 * does not run on SQLite.
 *
 * Telemetry is written/read through the raw libSQL client (the embedded-lane
 * seeding pattern used by lr35-pdm-promote-rollback-gate.test.ts). The shared
 * `db` proxy is a Postgres-typed drizzle handle, so passing the runtime
 * equipment_telemetry table to it emits Postgres-only columns (idempotency_key)
 * and a Postgres timestamp encoding that the embedded SQLite table rejects.
 *
 * The PdM HTTP routes are intentionally NOT called. In the embedded lane
 * GET /api/analytics/anomaly-detections and the PdM health endpoint return 500
 * (their reads dereference Postgres-only tables such as pdm_score_logs), and the
 * health endpoint reports a hardcoded health score regardless of data. Those are
 * product gaps tracked separately (see the branch/PR summary); here we assert the
 * real client-facing normalizer transform and the real prediction algorithms.
 *
 * Determinism: a fixed baseline (79/81 -> mean 80, stdDev 1) and a fixed 110
 * spike, no randomness in the signal, and a unique equipmentId so the shared
 * embedded DB file stays hermetic across suites.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";

import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import type { AnomalyDetection } from "@shared/schema";

import { detectStatisticalAnomaly } from "../../server/ml-analytics/anomaly-detection";
import { calculateMeanAndStdDev } from "../../server/ml-analytics/statistical";
import {
  calculateDegradationMetrics,
  inferFailureMode,
  statisticalFailurePrediction,
} from "../../server/ml-analytics/failure-prediction";
import { normalizeAnomalyDetection } from "../../server/analytics-data-normalizer/anomaly-normalizer";
import type {
  MlAnalyticsTelemetryReading,
  StatisticalBaseline,
} from "../../server/ml-analytics/types";

const RUN = randomUUID().slice(0, 8);
const ORG_ID = DEFAULT_ORG_ID;
const EQUIP_ID = `coolant-${RUN}`;
// "temperature" is the literal that drives isBadTrendSensor() and
// inferFailureMode() -> "overheating"; a CAN-frame sensor name would not.
const SENSOR = "temperature";
const UNIT = "C";

const HOUR_S = 60 * 60; // equipment_telemetry.ts is stored as epoch SECONDS
const NOW_S = Math.floor(Date.now() / 1000);

const BASELINE_COUNT = 240; // 120x79 + 120x81 -> mean 80, stdDev 1
const SPIKE_VALUE = 110; // ~30 stdDev above baseline -> "critical"
// Separates the baseline window (rows >= 48h old) from the spikes (< 1h old).
const BASELINE_CUTOFF_S = NOW_S - 24 * HOUR_S;

const INSERT_SQL =
  "INSERT INTO equipment_telemetry (id, org_id, ts, equipment_id, sensor_type, value, unit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

let client: Client;
let baseline: StatisticalBaseline;
let latestValue: number;

beforeAll(async () => {
  const { libsqlClient } = await import("../../server/db-config.js");
  if (!libsqlClient) {
    throw new Error("Embedded SQLite client unavailable — run via the embedded integration lane.");
  }
  client = libsqlClient;

  // --- Facet 1: generate deterministic coolant telemetry -------------------
  for (let i = 0; i < BASELINE_COUNT; i++) {
    await client.execute({
      sql: INSERT_SQL,
      args: [
        randomUUID(),
        ORG_ID,
        NOW_S - (i + 48) * HOUR_S,
        EQUIP_ID,
        SENSOR,
        i % 2 === 0 ? 79 : 81,
        UNIT,
        "normal",
      ],
    });
  }
  for (let k = 1; k <= 3; k++) {
    await client.execute({
      sql: INSERT_SQL,
      args: [randomUUID(), ORG_ID, NOW_S - k * 600, EQUIP_ID, SENSOR, SPIKE_VALUE, UNIT, "critical"],
    });
  }

  // Read the baseline window back (proves the telemetry round-trips) and
  // compute the statistical baseline the way calculateStatisticalBaseline would,
  // minus its Postgres-only date_trunc aggregation.
  const baseRes = await client.execute({
    sql: "SELECT value FROM equipment_telemetry WHERE equipment_id = ? AND sensor_type = ? AND ts < ? ORDER BY ts",
    args: [EQUIP_ID, SENSOR, BASELINE_CUTOFF_S],
  });
  const values = baseRes.rows.map((r) => Number(r["value"]));
  const { mean, stdDev } = calculateMeanAndStdDev(values);
  baseline = {
    mean,
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values),
    sampleCount: values.length,
    trend: "stable",
    seasonality: false,
  };

  const latestRes = await client.execute({
    sql: "SELECT value FROM equipment_telemetry WHERE equipment_id = ? AND sensor_type = ? ORDER BY ts DESC LIMIT 1",
    args: [EQUIP_ID, SENSOR],
  });
  latestValue = latestRes.rows[0] ? Number(latestRes.rows[0]["value"]) : Number.NaN;
}, 60000);

afterAll(async () => {
  try {
    await client?.execute({
      sql: "DELETE FROM equipment_telemetry WHERE equipment_id = ?",
      args: [EQUIP_ID],
    });
  } catch {
    // best-effort cleanup; never poison sibling suites on the shared embedded DB
  }
});

describe("asset anomaly E2E — coolant overheating (statistical Z-score)", () => {
  it("Facet 1: generates a queryable baseline + overheating excursion", () => {
    expect(baseline.sampleCount).toBe(BASELINE_COUNT);
    expect(baseline.mean).toBeCloseTo(80, 5);
    expect(baseline.stdDev).toBeGreaterThan(0);
    expect(baseline.stdDev).toBeCloseTo(1, 5);
    expect(latestValue).toBe(SPIKE_VALUE);
  });

  it("Facet 1->2: detects a CRITICAL statistical anomaly on the spike", () => {
    const result = detectStatisticalAnomaly(SPIKE_VALUE, baseline);
    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe("critical"); // z ~= 30 > 3.5
    expect(result.anomalyType).toBe("statistical");
    expect(result.anomalyScore).toBeGreaterThan(0);
    expect(result.anomalyScore).toBeLessThanOrEqual(1);
    expect(result.contributingFactors.some((f) => f.includes("Z-score"))).toBe(true);
  });

  it("Facet 2: produces a chart-ready normalized anomaly payload", () => {
    const result = detectStatisticalAnomaly(SPIKE_VALUE, baseline);

    // The shape GET /api/analytics/anomaly-detections returns before normalization.
    const canonical: AnomalyDetection = {
      id: 1,
      orgId: ORG_ID,
      equipmentId: EQUIP_ID,
      sensorType: SENSOR,
      detectionTimestamp: new Date(),
      anomalyScore: result.anomalyScore,
      anomalyType: result.anomalyType,
      severity: result.severity,
      detectedValue: SPIKE_VALUE,
      expectedValue: baseline.mean,
      deviation: SPIKE_VALUE - baseline.mean,
      modelId: null,
      contributingFactors: result.contributingFactors,
      recommendedActions: result.recommendedActions,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedByWorkOrderId: null,
      actualFailureOccurred: null,
      outcomeLabel: null,
      outcomeVerifiedAt: null,
      outcomeVerifiedBy: null,
      metadata: { explanation: result.explanation },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const payload = normalizeAnomalyDetection(canonical);
    expect(payload.anomalyScore).toBeGreaterThanOrEqual(0);
    expect(payload.anomalyScore).toBeLessThanOrEqual(1);
    expect(payload.anomalyType).toBe("statistical");
    expect(payload.severity).toBe("critical");
    expect(payload.detectedValue).toBe(SPIKE_VALUE);
    expect(payload.expectedValue).toBeCloseTo(80, 5);
    expect(payload.detectionTimestamp instanceof Date).toBe(true);
  });

  it("Facet 3: derives a degraded RUL / risk prediction downstream", () => {
    // Hourly buckets: a normal stretch followed by the overheating excursion.
    const readings: MlAnalyticsTelemetryReading[] = [];
    for (let i = 0; i < 10; i++) {
      readings.push({
        sensorType: SENSOR,
        avgValue: 80,
        anomalyScore: 0,
        windowStart: new Date((NOW_S - (i + 14) * HOUR_S) * 1000),
      });
    }
    for (let i = 0; i < 4; i++) {
      readings.push({
        sensorType: SENSOR,
        avgValue: SPIKE_VALUE,
        anomalyScore: 0.95,
        windowStart: new Date((NOW_S - (i + 1) * HOUR_S) * 1000),
      });
    }

    const metrics = calculateDegradationMetrics(readings);
    // increasing trend (+0.3, bad-trend sensor) + anomaly count > 20% (+0.3).
    expect(metrics.degradationScore).toBeCloseTo(0.6, 5);

    const prediction = statisticalFailurePrediction(metrics);
    expect(prediction.riskLevel).toBe("high"); // p ~= 0.72
    expect(prediction.failureProbability).toBeCloseTo(0.72, 5);
    expect(prediction.remainingUsefulLife).toBe(180); // degraded from the 365 healthy default
    expect(prediction.predictedFailureDate).toBeInstanceOf(Date);

    // The coolant scenario's signature failure mode — asserted on the mapping
    // directly, since the integrated metrics under-classify a single sensor.
    expect(inferFailureMode(["temperature"])).toBe("overheating");

    // Characterization of a real gate quirk: calculateDegradationMetrics promotes
    // a sensor to criticalSensors only when sensorRisk > 0.6, but a single
    // realistic temperature sensor maxes at exactly 0.6 (variability cannot exceed
    // 0.5 at plausible coolant temps). So it is never promoted, and the integrated
    // failure mode falls back to "general_deterioration". If the gate is ever
    // relaxed to >= 0.6, update these two expectations to overheating / [temperature].
    expect(metrics.criticalSensors).toEqual([]);
    expect(prediction.failureMode).toBe("general_deterioration");

    // A test-derived health projection (NOT a /api/pdm/health response, which is
    // a hardcoded 100 in this codebase): higher failure probability -> lower health.
    const healthProjection = Math.round(100 * (1 - prediction.failureProbability));
    expect(healthProjection).toBeLessThan(50);
  });
});
