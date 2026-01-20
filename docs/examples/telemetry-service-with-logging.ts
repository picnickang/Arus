/**
 * Example: Telemetry Service with Marine PdM Logging
 * Demonstrates production-ready logging integration for telemetry ingestion
 */

import type { Request, Response } from "express";
import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "../../server/db";
import { equipmentTelemetry, equipment } from "../../shared/schema";
import {
  logTelemetryIngestion,
  logDataQuality,
  withPerformanceLogging,
  createMarinePdMContext,
} from "../../server/utils/marine-pdm-logger";

/**
 * Telemetry batch ingestion endpoint with comprehensive logging
 */
export async function ingestTelemetryBatch(req: Request, res: Response) {
  const { equipmentId, readings } = req.body;
  const orgId = (req as any).orgId;

  const context = createMarinePdMContext(req, {
    equipmentId,
    dataPointCount: readings?.length || 0,
  });

  try {
    // Log incoming request
    logTelemetryIngestion("info", "Telemetry batch ingestion started", context);

    // Validate equipment exists
    const [equipmentRecord] = await db
      .select()
      .from(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .limit(1);

    if (!equipmentRecord) {
      logTelemetryIngestion("warn", "Equipment not found for telemetry ingestion", context);
      return res.status(404).json({ error: "Equipment not found" });
    }

    // Enrich context with equipment type
    context.equipmentType = equipmentRecord.type || "unknown";

    // Validate and process readings
    const validReadings: any[] = [];
    const invalidReadings: any[] = [];

    for (const reading of readings) {
      // Data quality validation
      if (!reading.sensorType || typeof reading.value !== "number") {
        invalidReadings.push(reading);
        continue;
      }

      // Range validation (example: temperature)
      if (reading.sensorType === "temperature" && (reading.value < -50 || reading.value > 200)) {
        logDataQuality("Temperature reading out of valid range", {
          ...context,
          sensorType: reading.sensorType,
          value: reading.value,
        });
        invalidReadings.push(reading);
        continue;
      }

      validReadings.push({
        orgId,
        equipmentId,
        sensorType: reading.sensorType,
        value: reading.value,
        unit: reading.unit || "unknown",
        status: determineStatus(reading.sensorType, reading.value),
        timestamp: new Date(reading.timestamp || Date.now()),
      });
    }

    // Log data quality issues
    if (invalidReadings.length > 0) {
      logTelemetryIngestion("warn", `${invalidReadings.length} invalid readings rejected`, {
        ...context,
        dataPointCount: invalidReadings.length,
      });
    }

    // Insert valid readings with performance tracking
    const insertedRecords = await withPerformanceLogging(
      "telemetry-ingestion",
      "batch-insert",
      async () => {
        if (validReadings.length === 0) return [];
        return await db.insert(equipmentTelemetry).values(validReadings).returning();
      },
      { ...context, dataPointCount: validReadings.length }
    );

    // Check for critical alerts
    const criticalReadings = validReadings.filter((r) => r.status === "critical");
    if (criticalReadings.length > 0) {
      logTelemetryIngestion("error", `${criticalReadings.length} critical threshold breaches detected`, {
        ...context,
        alertLevel: "critical",
        dataPointCount: criticalReadings.length,
        sensorTypes: [...new Set(criticalReadings.map((r) => r.sensorType))].join(", "),
      });
    }

    // Log successful completion
    logTelemetryIngestion("info", "Telemetry batch ingestion completed", {
      ...context,
      dataPointCount: validReadings.length,
      alertLevel: criticalReadings.length > 0 ? "critical" : "normal",
    });

    res.json({
      success: true,
      processed: validReadings.length,
      rejected: invalidReadings.length,
      criticalAlerts: criticalReadings.length,
    });
  } catch (error) {
    logTelemetryIngestion("error", "Telemetry batch ingestion failed", context);
    res.status(500).json({ error: "Ingestion failed" });
  }
}

/**
 * Equipment telemetry query endpoint with logging
 */
export async function getEquipmentTelemetry(req: Request, res: Response) {
  const { equipmentId } = req.params;
  const { sensorType, limit = 100 } = req.query;
  const orgId = (req as any).orgId;

  const context = createMarinePdMContext(req, {
    equipmentId,
    operation: "telemetry-query",
    sensorType: sensorType as string,
  });

  try {
    logTelemetryIngestion("info", "Telemetry query started", context);

    const telemetryData = await withPerformanceLogging(
      "telemetry-ingestion",
      "query-telemetry",
      async () => {
        const conditions = [
          eq(equipmentTelemetry.orgId, orgId),
          eq(equipmentTelemetry.equipmentId, equipmentId),
        ];

        if (sensorType) {
          conditions.push(eq(equipmentTelemetry.sensorType, sensorType as string));
        }

        return await db
          .select()
          .from(equipmentTelemetry)
          .where(and(...conditions))
          .orderBy(desc(equipmentTelemetry.timestamp))
          .limit(Number(limit));
      },
      context
    );

    logTelemetryIngestion("info", "Telemetry query completed", {
      ...context,
      dataPointCount: telemetryData.length,
    });

    res.json({ data: telemetryData });
  } catch (error) {
    logTelemetryIngestion("error", "Telemetry query failed", context);
    res.status(500).json({ error: "Query failed" });
  }
}

/**
 * Recent critical alerts endpoint with logging
 */
export async function getRecentCriticalAlerts(req: Request, res: Response) {
  const orgId = (req as any).orgId;
  const { hours = 24 } = req.query;

  const context = createMarinePdMContext(req, {
    operation: "critical-alerts-query",
  });

  try {
    logTelemetryIngestion("info", "Critical alerts query started", context);

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - Number(hours));

    const alerts = await withPerformanceLogging(
      "telemetry-ingestion",
      "query-critical-alerts",
      async () => {
        return await db
          .select()
          .from(equipmentTelemetry)
          .where(
            and(
              eq(equipmentTelemetry.orgId, orgId),
              eq(equipmentTelemetry.status, "critical"),
              gte(equipmentTelemetry.timestamp, cutoffTime)
            )
          )
          .orderBy(desc(equipmentTelemetry.timestamp));
      },
      context
    );

    if (alerts.length > 0) {
      logTelemetryIngestion("warn", `${alerts.length} critical alerts in last ${hours}h`, {
        ...context,
        alertLevel: "critical",
        dataPointCount: alerts.length,
      });
    } else {
      logTelemetryIngestion("info", "No critical alerts found", context);
    }

    res.json({ data: alerts, count: alerts.length });
  } catch (error) {
    logTelemetryIngestion("error", "Critical alerts query failed", context);
    res.status(500).json({ error: "Query failed" });
  }
}

/**
 * Helper: Determine telemetry status based on sensor type and value
 */
function determineStatus(sensorType: string, value: number): "normal" | "warning" | "critical" {
  // Example thresholds (production would use equipment-specific thresholds)
  const thresholds: Record<string, { warning: number; critical: number }> = {
    temperature: { warning: 80, critical: 95 },
    pressure: { warning: 150, critical: 180 },
    vibration: { warning: 10, critical: 15 },
    rpm: { warning: 3000, critical: 3500 },
  };

  const threshold = thresholds[sensorType];
  if (!threshold) return "normal";

  if (value >= threshold.critical) return "critical";
  if (value >= threshold.warning) return "warning";
  return "normal";
}
