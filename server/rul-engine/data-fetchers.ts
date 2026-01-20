/**
 * RUL Engine Data Fetchers
 * 
 * Database queries and data fetching utilities for RUL calculations.
 */

import { eq, and, sql } from "drizzle-orm";
import {
  failureHistory,
  equipment,
  equipmentTelemetry,
  componentDegradation,
} from "../../shared/schema.js";
import { safeSql } from "../utils/safeSql.js";
import { ModeDetector, type OperatingMode as DetectedMode } from "../context/mode-detector.js";
import { deriveOpMode, dataQualityScore, type OpMode } from "../utils/rul-utils.js";
import type { EnhancementData } from "./types.js";
import { CACHE_TTL_MS } from "./constants.js";

// Cache for base failure rates
const baseRateCache: Map<string, { rate: number; timestamp: number }> = new Map();

/**
 * Batch fetch all v2.0 enhancement data in parallel
 * Reduces 4 sequential queries to 1 parallel batch
 */
export async function fetchEnhancementData(
  db: any,
  equipmentId: string, 
  equipmentType: string, 
  orgId: string
): Promise<EnhancementData> {
  const [telemetryResult, qualityResult, repairResult, baseRateResult] = await Promise.allSettled([
    // Query 1: Latest telemetry for mode detection
    db
      .select()
      .from(equipmentTelemetry)
      .where(
        and(
          eq(equipmentTelemetry.equipmentId, equipmentId),
          eq(equipmentTelemetry.orgId, orgId)
        )
      )
      .orderBy(sql`${equipmentTelemetry.ts} DESC`)
      .limit(1)
      .catch(() => []),

    // Query 2: Data quality stats
    db.execute(sql`
      SELECT 
        COUNT(*) AS n,
        EXTRACT(EPOCH FROM (MAX(measurement_timestamp) - MIN(measurement_timestamp)))/86400 AS span_days,
        AVG(CASE WHEN degradation_metric IS NULL THEN 1 ELSE 0 END) AS missing_pct,
        EXTRACT(EPOCH FROM (NOW() - MAX(measurement_timestamp)))/60 AS staleness_min
      FROM ${componentDegradation}
      WHERE equipment_id = ${equipmentId} 
        AND org_id = ${orgId}
        AND measurement_timestamp >= NOW() - INTERVAL '30 days'
    `).catch(() => ({ rows: [] })),

    // Query 3: Last successful repair
    db
      .select()
      .from(failureHistory)
      .where(
        and(
          eq(failureHistory.equipmentId, equipmentId),
          eq(failureHistory.orgId, orgId),
          eq(failureHistory.status, "resolved")
        )
      )
      .orderBy(sql`${failureHistory.resolvedAt} DESC`)
      .limit(1)
      .catch(() => []),

    // Query 4: Base failure rate (with cache check)
    fetchBaseRateWithCache(db, equipmentType, orgId),
  ]);

  return {
    telemetry: telemetryResult.status === "fulfilled" ? telemetryResult.value[0] ?? null : null,
    qualityStats:
      qualityResult.status === "fulfilled" && qualityResult.value.rows?.length
        ? qualityResult.value.rows[0]
        : null,
    lastRepair: repairResult.status === "fulfilled" ? repairResult.value[0] ?? null : null,
    baseRate: baseRateResult.status === "fulfilled" ? baseRateResult.value : 0.05,
  };
}

/**
 * Cached base failure rate lookup
 * Reduces DB load for frequently accessed equipment types
 */
export async function fetchBaseRateWithCache(
  db: any,
  equipmentType: string, 
  orgId: string
): Promise<number> {
  const cacheKey = `${orgId}:${equipmentType}`;
  const cached = baseRateCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.rate;
  }

  try {
    const stats = await safeSql(db, sql`
      SELECT 
        COALESCE(
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END)::float / 
          NULLIF(COUNT(*), 0), 
          0.05
        ) AS base_rate
      FROM ${failureHistory} fh
      JOIN ${equipment} e ON e.id = fh.equipment_id
      WHERE fh.org_id = ${orgId} 
        AND e.type = ${equipmentType}
        AND fh.failure_timestamp >= NOW() - INTERVAL '365 days'
    `);

    const baseRate = Number(stats.rows?.[0]?.base_rate ?? 0.05);
    const clampedRate = Math.max(0.01, Math.min(0.5, baseRate));

    // Cache the result
    baseRateCache.set(cacheKey, {
      rate: clampedRate,
      timestamp: Date.now(),
    });

    return clampedRate;
  } catch (error) {
    console.warn("[RUL Engine] Failed to calculate base failure rate:", error);
    return 0.05;
  }
}

/**
 * Detect current operating mode from telemetry
 */
export async function detectOperatingMode(
  db: any,
  equipmentId: string, 
  orgId: string
): Promise<OpMode> {
  try {
    const latestTelemetry = await db
      .select()
      .from(equipmentTelemetry)
      .where(
        and(eq(equipmentTelemetry.equipmentId, equipmentId), eq(equipmentTelemetry.orgId, orgId))
      )
      .orderBy(sql`${equipmentTelemetry.ts} DESC`)
      .limit(1);

    if (!latestTelemetry.length) {return "UNKNOWN";}

    const telemetryPoint = latestTelemetry[0];

    // Method 1: Check for operating_mode field
    const modeFromField = deriveOpMode([], (telemetryPoint as any).operatingMode);
    if (modeFromField !== "UNKNOWN") {return modeFromField;}

    // Method 2: Check tags array
    const tags = (telemetryPoint as any).tags ?? [];
    const modeFromTags = deriveOpMode(tags);
    if (modeFromTags !== "UNKNOWN") {return modeFromTags;}

    // Method 3: Use ModeDetector to infer from telemetry values
    const detector = new ModeDetector();
    const window = detector.toTelemetryWindow(telemetryPoint);
    const detection = detector.detectMode(window);

    // Map DetectedMode to OpMode
    const modeMap: Record<DetectedMode, OpMode> = {
      DP: "DP",
      Transit: "TRANSIT",
      Harbor: "HARBOR",
      Cargo_Ops: "CARGO_OPS",
      Standby: "STANDBY",
      Docking: "DOCKING",
      Unknown: "UNKNOWN",
    };

    return modeMap[detection.mode] || "UNKNOWN";
  } catch (error) {
    console.warn("[RUL Engine] Failed to detect operating mode:", error);
    return "UNKNOWN";
  }
}

/**
 * Calculate data quality score for equipment
 * Factors: sample count, time span, missing data, staleness
 */
export async function calculateDataQuality(
  db: any,
  equipmentId: string, 
  orgId: string
): Promise<number> {
  try {
    const stats = await safeSql(db, sql`
      SELECT 
        COUNT(*) AS n,
        EXTRACT(EPOCH FROM (MAX(measurement_timestamp) - MIN(measurement_timestamp)))/86400 AS span_days,
        AVG(CASE WHEN degradation_metric IS NULL THEN 1 ELSE 0 END) AS missing_pct,
        EXTRACT(EPOCH FROM (NOW() - MAX(measurement_timestamp)))/60 AS staleness_min
      FROM ${componentDegradation}
      WHERE equipment_id = ${equipmentId} 
        AND org_id = ${orgId}
        AND measurement_timestamp >= NOW() - INTERVAL '30 days'
    `);

    if (!stats.rows?.length) {return 0.5;} // Default medium quality

    const row = stats.rows[0] as any;
    return dataQualityScore(
      Number(row.n || 0),
      Number(row.span_days || 0),
      Number(row.missing_pct || 0),
      Number(row.staleness_min || 0)
    );
  } catch (error) {
    console.warn("[RUL Engine] Failed to calculate data quality:", error);
    return 0.5; // Default medium quality
  }
}

/**
 * Get last successful repair for survival analysis
 */
export async function getLastRepair(
  db: any,
  equipmentId: string, 
  orgId: string
): Promise<any> {
  try {
    const repairs = await db
      .select()
      .from(failureHistory)
      .where(
        and(
          eq(failureHistory.equipmentId, equipmentId),
          eq(failureHistory.orgId, orgId),
          eq(failureHistory.status, "resolved")
        )
      )
      .orderBy(sql`${failureHistory.resolvedAt} DESC`)
      .limit(1);

    return repairs[0] ?? null;
  } catch (error) {
    console.warn("[RUL Engine] Failed to fetch last repair:", error);
    return null;
  }
}

/**
 * Get base failure rate for equipment type
 * Used for probability calibration
 */
export async function getBaseFailureRate(
  db: any,
  equipmentType: string, 
  orgId: string
): Promise<number> {
  try {
    const stats = await safeSql(db, sql`
      SELECT 
        COALESCE(
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END)::float / 
          NULLIF(COUNT(*), 0), 
          0.05
        ) AS base_rate
      FROM ${failureHistory} fh
      JOIN ${equipment} e ON e.id = fh.equipment_id
      WHERE fh.org_id = ${orgId} 
        AND e.type = ${equipmentType}
        AND fh.failure_timestamp >= NOW() - INTERVAL '365 days'
    `);

    const baseRate = Number(stats.rows?.[0]?.base_rate ?? 0.05);

    // Clamp to reasonable range [0.01, 0.50]
    return Math.max(0.01, Math.min(0.5, baseRate));
  } catch (error) {
    console.warn("[RUL Engine] Failed to calculate base failure rate:", error);
    return 0.05; // Default 5% annual failure rate
  }
}
