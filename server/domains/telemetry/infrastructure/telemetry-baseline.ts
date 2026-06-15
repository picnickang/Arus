/**
 * Telemetry baseline statistics — raw SQL lives in the infrastructure layer
 * (hex-storage guard: `server/db` imports are banned from routes/interfaces;
 * the previous inline dynamic import of the db handle in routes.ts dodged
 * that statically but counted as dynamic-import debt in the domain-leak guard).
 */
import { db } from "../../../db.js";
import { sql } from "drizzle-orm";

export interface TelemetrySensorBaseline {
  sensorType: string;
  p50: number;
  avg: number;
  stddev: number;
  min: number;
  max: number;
  sampleCount: number;
  /** Expected operating envelope: median ± 2σ. */
  bandLow: number;
  bandHigh: number;
}

export async function getSensorBaselines(
  equipmentId: string,
  days: number
): Promise<TelemetrySensorBaseline[]> {
  const result = await db.execute(sql`
    SELECT sensor_type,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY value) AS p50,
           avg(value)    AS avg,
           stddev(value) AS stddev,
           min(value)    AS min,
           max(value)    AS max,
           count(*)::int AS sample_count
    FROM equipment_telemetry
    WHERE equipment_id = ${equipmentId}
      AND ts > now() - make_interval(days => ${days})
    GROUP BY sensor_type
    ORDER BY sensor_type
  `);

  return (result.rows as Array<Record<string, unknown>>).map((row) => {
    const p50 = Number(row["p50"]);
    const stddev = Number(row["stddev"] ?? 0) || 0;
    return {
      sensorType: String(row["sensor_type"]),
      p50,
      avg: Number(row["avg"]),
      stddev,
      min: Number(row["min"]),
      max: Number(row["max"]),
      sampleCount: Number(row["sample_count"]),
      // Expected operating envelope: median ± 2σ.
      bandLow: p50 - 2 * stddev,
      bandHigh: p50 + 2 * stddev,
    };
  });
}
