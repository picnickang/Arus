/**
 * Deep Postgres-lane asset-anomaly test.
 *
 * Exercises the REAL Postgres-only code paths that the embedded SQLite lane
 * cannot run (cf. asset-anomaly-coolant-overheating.test.ts, which substitutes
 * pure helpers because these throw on SQLite):
 *   - calculateStatisticalBaseline + getMultiSensorData — the `date_trunc('hour', …)::float8`
 *     aggregations that have no SQLite equivalent.
 *   - the real ML persistence repos (recordAnomalyDetection / getRecentAnomalies /
 *     recordFailurePrediction) writing and reading the canonical PG
 *     anomaly_detections / failure_predictions tables.
 *
 * Requires a live Postgres via DATABASE_URL (the postgres lane). Skips with a
 * note when absent — same convention as equipment-telemetry-partitioning.test.ts.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

import {
  calculateStatisticalBaseline,
  detectStatisticalAnomaly,
} from "../../server/ml-analytics/anomaly-detection";
import {
  calculateDegradationMetrics,
  getMultiSensorData,
  statisticalFailurePrediction,
} from "../../server/ml-analytics/failure-prediction";
import {
  getRecentAnomalies,
  recordAnomalyDetection,
  recordFailurePrediction,
} from "../../server/ml-analytics/database";
import type { MlAnalyticsTelemetryReading } from "../../server/ml-analytics/types";

const databaseUrl = process.env["DATABASE_URL"];
const RUN = randomUUID().slice(0, 8);
const ORG_ID = `pg-org-${RUN}`;
const EQUIP_ID = `pg-equip-${RUN}`;
const SENSOR = "temperature";

let pool: Pool | null = null;
let ready = false;

function vibrationDegradation(): MlAnalyticsTelemetryReading[] {
  const out: MlAnalyticsTelemetryReading[] = [];
  for (let i = 0; i < 10; i++) {
    out.push({ sensorType: "vibration", avgValue: 2, anomalyScore: 0, windowStart: new Date() });
  }
  for (let i = 0; i < 5; i++) {
    out.push({
      sensorType: "vibration",
      avgValue: 25,
      anomalyScore: 0.95,
      windowStart: new Date(),
    });
  }
  return out;
}

beforeAll(async () => {
  if (!databaseUrl) {
    return;
  }
  pool = new Pool({ connectionString: databaseUrl, max: 2 });
  // Swallow idle-client errors (e.g. a connection dropped during teardown on a
  // slow-checkpoint disk) so they never surface as an unhandled exception.
  pool.on("error", () => undefined);
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [ORG_ID, `PG Anomaly ${RUN}`, `pg-anomaly-${RUN}`]
    );
    await c.query(
      `INSERT INTO equipment (id, org_id, name, type) VALUES ($1, $2, $3, 'Engine') ON CONFLICT (id) DO NOTHING`,
      [EQUIP_ID, ORG_ID, `PG Engine ${RUN}`]
    );
    // 240 hourly baseline readings (79/81 -> mean 80, stdDev 1), 2..12 days ago.
    await c.query(
      `INSERT INTO equipment_telemetry (org_id, equipment_id, sensor_type, value, unit, status, ts)
         SELECT $1, $2, $3, CASE WHEN g % 2 = 0 THEN 79 ELSE 81 END, 'C', 'normal',
                now() - ((g + 48) * interval '1 hour')
         FROM generate_series(0, 239) AS g`,
      [ORG_ID, EQUIP_ID, SENSOR]
    );
    ready = true;
  } finally {
    c.release();
  }
}, 60000);

afterAll(async () => {
  if (!pool) {
    return;
  }
  // Best-effort cleanup — never fail the suite on a teardown hiccup. The unique
  // per-run ORG_ID keeps leftover rows from colliding with future runs.
  try {
    if (ready) {
      for (const stmt of [
        `DELETE FROM anomaly_detections WHERE org_id = $1`,
        `DELETE FROM failure_predictions WHERE org_id = $1`,
        `DELETE FROM equipment_telemetry WHERE org_id = $1`,
        `DELETE FROM equipment WHERE org_id = $1`,
        `DELETE FROM organizations WHERE id = $1`,
      ]) {
        await pool.query(stmt, [ORG_ID]);
      }
    }
  } catch (err) {
    console.warn(
      `[pg-anomaly] cleanup skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}, 60000);

describe("asset anomaly E2E (Postgres) — real date_trunc baseline + ML repos", () => {
  it("computes a statistical baseline via the real date_trunc aggregation", async () => {
    if (!ready) {
      console.warn("[pg-anomaly] skipped — no DATABASE_URL");
      return;
    }
    const baseline = await calculateStatisticalBaseline(EQUIP_ID, SENSOR);
    // sampleCount >= 10 proves the date_trunc('hour', …) GROUP BY actually ran
    // (the embedded SQLite path returns the fallback baseline / throws here).
    expect(baseline.sampleCount).toBeGreaterThanOrEqual(10);
    expect(baseline.mean).toBeCloseTo(80, 0);
    expect(baseline.stdDev).toBeGreaterThan(0);
  });

  it("detects and persists a CRITICAL anomaly through the real PG repo", async () => {
    if (!ready) {
      return;
    }
    const baseline = await calculateStatisticalBaseline(EQUIP_ID, SENSOR);
    const result = detectStatisticalAnomaly(110, baseline);
    expect(result.severity).toBe("critical");

    await recordAnomalyDetection(ORG_ID, EQUIP_ID, SENSOR, 110, result, new Date());

    const recent = await getRecentAnomalies(EQUIP_ID, SENSOR, 7);
    expect(recent.length).toBeGreaterThanOrEqual(1);
    const a = recent[0]!;
    expect(a.severity).toBe("critical");
    expect(a.anomalyType).toBe("statistical");
    expect(Number(a.detectedValue)).toBe(110);
  });

  it("reads multi-sensor data via date_trunc and persists a failure prediction", async () => {
    if (!ready) {
      return;
    }
    const series = await getMultiSensorData(EQUIP_ID, 30);
    expect(series.length).toBeGreaterThanOrEqual(10);
    expect(series.every((r) => r.sensorType === SENSOR)).toBe(true);

    const prediction = statisticalFailurePrediction(
      calculateDegradationMetrics(vibrationDegradation())
    );
    expect(prediction.riskLevel).toBe("critical");
    await recordFailurePrediction(ORG_ID, EQUIP_ID, prediction);

    const { rows } = await pool!.query(
      `SELECT risk_level, remaining_useful_life FROM failure_predictions WHERE org_id = $1`,
      [ORG_ID]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].risk_level).toBe("critical");
    expect(Number(rows[0].remaining_useful_life)).toBe(90);
  });
});
