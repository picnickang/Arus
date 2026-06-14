/**
 * Deeper asset-anomaly coverage (embedded SQLite lane).
 *
 * Complements asset-anomaly-coolant-overheating.test.ts with:
 *   1. Z-score severity boundaries + a no-anomaly control (detectStatisticalAnomaly).
 *   2. A MULTI-sensor correlated-degradation case that actually populates
 *      criticalSensors (a vibration spike has a high coefficient of variation,
 *      so it clears the sensorRisk > 0.6 gate that a lone temperature sensor
 *      cannot) and a 3-critical-sensor case that characterises the missing final
 *      clamp on failureProbability.
 *   3. Real round-trips through the embedded SQLite ML tables
 *      (anomaly_detections / failure_predictions / pdm_score_logs) via the raw
 *      libSQL client, using the physical DDL columns from server/sqlite/ml-tables.ts.
 *
 * All deterministic; runs in the default embedded gate.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";

import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { detectStatisticalAnomaly } from "../../server/ml-analytics/anomaly-detection";
import {
  calculateDegradationMetrics,
  inferFailureMode,
  statisticalFailurePrediction,
} from "../../server/ml-analytics/failure-prediction";
import type {
  MlAnalyticsTelemetryReading,
  StatisticalBaseline,
} from "../../server/ml-analytics/types";

const ORG_ID = DEFAULT_ORG_ID;
const EQUIP_ID = `deep-${randomUUID().slice(0, 8)}`;
const NOW_S = Math.floor(Date.now() / 1000);
const HOUR_S = 3600;

const BASELINE: StatisticalBaseline = {
  mean: 80,
  stdDev: 1,
  min: 79,
  max: 81,
  sampleCount: 240,
  trend: "stable",
  seasonality: false,
};

let client: Client;

/** Hourly buckets: `count` normal readings then `spikes` anomalous ones. */
function degradationReadings(
  sensorType: string,
  normal: number,
  spike: number
): MlAnalyticsTelemetryReading[] {
  const out: MlAnalyticsTelemetryReading[] = [];
  for (let i = 0; i < 10; i++) {
    out.push({ sensorType, avgValue: normal, anomalyScore: 0, windowStart: new Date() });
  }
  for (let i = 0; i < 5; i++) {
    out.push({ sensorType, avgValue: spike, anomalyScore: 0.95, windowStart: new Date() });
  }
  return out;
}

beforeAll(async () => {
  const { libsqlClient } = await import("../../server/db-config.js");
  if (!libsqlClient) {
    throw new Error("Embedded SQLite client unavailable — run via the embedded integration lane.");
  }
  client = libsqlClient;
});

afterAll(async () => {
  for (const table of ["anomaly_detections", "failure_predictions", "pdm_score_logs"]) {
    try {
      await client?.execute({ sql: `DELETE FROM ${table} WHERE equipment_id = ?`, args: [EQUIP_ID] });
    } catch {
      // best-effort cleanup
    }
  }
});

describe("anomaly detection — Z-score severity boundaries", () => {
  const cases: Array<{ value: number; isAnomaly: boolean; severity: string; label: string }> = [
    { value: 80.0, isAnomaly: false, severity: "low", label: "z=0 (no anomaly)" },
    { value: 80.5, isAnomaly: false, severity: "low", label: "z=0.5 (no anomaly)" },
    { value: 81.7, isAnomaly: true, severity: "low", label: "z=1.7 (low)" },
    { value: 82.2, isAnomaly: true, severity: "medium", label: "z=2.2 (medium)" },
    { value: 82.7, isAnomaly: true, severity: "high", label: "z=2.7 (high)" },
    { value: 84.0, isAnomaly: true, severity: "critical", label: "z=4.0 (critical)" },
  ];

  for (const c of cases) {
    it(`classifies ${c.label}`, () => {
      const r = detectStatisticalAnomaly(c.value, BASELINE);
      expect(r.isAnomaly).toBe(c.isAnomaly);
      expect(r.severity).toBe(c.severity);
      if (c.isAnomaly) {
        expect(r.anomalyScore).toBeGreaterThan(0);
        expect(r.anomalyScore).toBeLessThanOrEqual(1);
      }
    });
  }
});

describe("multi-sensor correlated degradation", () => {
  it("promotes a high-variation vibration sensor to criticalSensors → bearing_wear", () => {
    // A vibration spike (2 -> 25) has CV > 0.5, so it clears the sensorRisk > 0.6
    // gate via trend(+0.3) + variability(+0.2) + anomalyCount(+0.3) = 0.8.
    const metrics = calculateDegradationMetrics(degradationReadings("vibration", 2, 25));
    expect(metrics.criticalSensors).toEqual(["vibration"]);
    expect(metrics.degradationScore).toBeCloseTo(0.8, 5);

    const prediction = statisticalFailurePrediction(metrics);
    expect(prediction.riskLevel).toBe("critical"); // p = min(0.95, 0.8*1.2) = 0.95 > 0.8
    expect(prediction.failureProbability).toBeCloseTo(0.95, 5);
    expect(prediction.remainingUsefulLife).toBe(90); // degradationScore 0.8 -> 90 days
    expect(prediction.predictedFailureDate).toBeInstanceOf(Date);
    expect(prediction.failureMode).toBe("bearing_wear");
    expect(inferFailureMode(metrics.criticalSensors)).toBe("bearing_wear");
  });

  it("clamps failureProbability at 0.95 even with >2 critical sensors", () => {
    const readings = [
      ...degradationReadings("vibration", 2, 25),
      ...degradationReadings("pressure", 20, 150),
      ...degradationReadings("current", 10, 90),
    ];
    const metrics = calculateDegradationMetrics(readings);
    expect(metrics.criticalSensors).toEqual(["vibration", "pressure", "current"]);

    const prediction = statisticalFailurePrediction(metrics);
    expect(prediction.riskLevel).toBe("critical");
    // The >2-critical-sensor *1.3 boost is re-clamped to the 0.95 cap, so
    // probability never exceeds 1.0 (previously it reached 0.95 * 1.3 = 1.235).
    expect(prediction.failureProbability).toBeLessThanOrEqual(0.95);
    expect(prediction.failureProbability).toBeCloseTo(0.95, 5);
    expect(prediction.failureMode).toBe("bearing_wear"); // vibration takes precedence
  });
});

describe("embedded ML-table round-trips (vessel-mode persistence)", () => {
  it("persists and reads back an anomaly_detections row", async () => {
    const r = detectStatisticalAnomaly(110, BASELINE);
    const id = randomUUID();
    await client.execute({
      sql: `INSERT INTO anomaly_detections
        (id, org_id, equipment_id, sensor_type, anomaly_type, severity, detected_value, z_score, detected_at, resolved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      args: [id, ORG_ID, EQUIP_ID, "temperature", r.anomalyType, r.severity, 110, 30, NOW_S],
    });
    const back = await client.execute({
      sql: "SELECT severity, anomaly_type, detected_value, z_score FROM anomaly_detections WHERE id = ?",
      args: [id],
    });
    expect(back.rows).toHaveLength(1);
    expect(back.rows[0]!["severity"]).toBe("critical");
    expect(back.rows[0]!["anomaly_type"]).toBe("statistical");
    expect(Number(back.rows[0]!["detected_value"])).toBe(110);
  });

  it("persists and reads back a failure_predictions row", async () => {
    const prediction = statisticalFailurePrediction(
      calculateDegradationMetrics(degradationReadings("vibration", 2, 25))
    );
    const id = randomUUID();
    await client.execute({
      sql: `INSERT INTO failure_predictions
        (id, org_id, equipment_id, prediction_type, failure_probability, estimated_days_to_failure, prediction_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        ORG_ID,
        EQUIP_ID,
        "statistical",
        prediction.failureProbability,
        prediction.remainingUsefulLife,
        NOW_S,
      ],
    });
    const back = await client.execute({
      sql: "SELECT failure_probability, estimated_days_to_failure FROM failure_predictions WHERE id = ?",
      args: [id],
    });
    expect(back.rows).toHaveLength(1);
    expect(Number(back.rows[0]!["failure_probability"])).toBeCloseTo(0.95, 5);
    expect(Number(back.rows[0]!["estimated_days_to_failure"])).toBe(90);
  });

  it("persists and reads back a pdm_score_logs row", async () => {
    const id = randomUUID();
    const healthIdx = 28; // degraded health index
    await client.execute({
      sql: `INSERT INTO pdm_score_logs (id, org_id, equipment_id, ts, health_idx, p_fail_30d)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, ORG_ID, EQUIP_ID, NOW_S, healthIdx, 0.8],
    });
    const back = await client.execute({
      sql: "SELECT health_idx, p_fail_30d FROM pdm_score_logs WHERE equipment_id = ? ORDER BY ts DESC LIMIT 1",
      args: [EQUIP_ID],
    });
    expect(back.rows).toHaveLength(1);
    expect(Number(back.rows[0]!["health_idx"])).toBe(28);
  });
});
