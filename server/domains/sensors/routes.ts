import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { requireOrgId, type AuthenticatedRequest } from "../../middleware/auth";
import { logger } from "../../utils/logger";

type SqlResultLike<T> = T[] | { rows: T[] };
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const maybe = result as { rows?: T[] } | null | undefined;
  return Array.isArray(maybe?.rows) ? (maybe!.rows as T[]) : [];
}

interface CalibrationSummaryRow {
  calibration_status: string;
  sensor_type: string;
  sensorType?: string;
  count: number | string;
}

interface SensorRow {
  id: string;
  sensor_tag: string;
  calibration_interval_days: number;
  certificate_url: string | null;
  [key: string]: unknown;
}

const router = Router();

function getOrgId(req: Request): string {
  return (req as AuthenticatedRequest).orgId as string;
}

const SENSOR_TYPES = [
  "vibration",
  "temperature",
  "pressure",
  "flow",
  "level",
  "rpm",
  "torque",
  "humidity",
  "exhaust_gas",
  "fuel_flow",
  "other",
] as const;

const createSensorSchema = z.object({
  vesselId: z.string().min(1),
  equipmentId: z.string().optional(),
  sensorTag: z.string().min(1),
  sensorType: z.enum(SENSOR_TYPES),
  sensorLocation: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  calibrationIntervalDays: z.number().int().min(1).default(365),
  lastCalibrationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  calibrationStandard: z.string().optional(),
  measurementRangeMin: z.number().optional(),
  measurementRangeMax: z.number().optional(),
  measurementUnit: z.string().optional(),
  alarmLow: z.number().optional().nullable(),
  alarmHigh: z.number().optional().nullable(),
  tripLow: z.number().optional().nullable(),
  tripHigh: z.number().optional().nullable(),
  installedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().optional(),
});

const calibrationEventSchema = z.object({
  calibrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  performedBy: z.string().min(1),
  performedByRank: z.string().optional(),
  status: z.enum(["pass", "fail", "adjusted", "replaced"]),
  driftBefore: z.number().optional(),
  driftAfter: z.number().optional(),
  referenceValue: z.number().optional(),
  measuredValue: z.number().optional(),
  adjustedTo: z.number().optional(),
  certificateNumber: z.string().optional(),
  certificateUrl: z.string().url().optional(),
  notes: z.string().optional(),
  method: z.enum(["field_check", "workshop", "manufacturer_service", "external_lab"]).optional(),
});

router.get("/summary", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const vesselId = req.query.vesselId as string | undefined;

    const whereClause = vesselId
      ? sql`org_id = ${orgId} AND vessel_id = ${vesselId}`
      : sql`org_id = ${orgId}`;

    const result = await db.execute(sql`
      SELECT
        calibration_status,
        sensor_type,
        COUNT(*) as count
      FROM sensor_calibrations
      WHERE ${whereClause}
        AND decommissioned_date IS NULL
      GROUP BY calibration_status, sensor_type
    `);

    const rows = rowsOf<CalibrationSummaryRow>(result);

    const summary = {
      total: 0,
      calibrated: 0,
      due: 0,
      overdue: 0,
      failed: 0,
      unknown: 0,
      byType: {} as Record<string, number>,
      dataQualityScore: 0,
    };

    for (const row of rows) {
      const count = Number(row.count);
      summary.total += count;
      if (row.calibration_status === "calibrated") {
        summary.calibrated += count;
      }
      if (row.calibration_status === "due") {
        summary.due += count;
      }
      if (row.calibration_status === "overdue") {
        summary.overdue += count;
      }
      if (row.calibration_status === "failed") {
        summary.failed += count;
      }
      if (row.calibration_status === "unknown") {
        summary.unknown += count;
      }
      const typeKey = row.sensor_type ?? row.sensorType ?? "unknown";
      summary.byType[typeKey] = (summary.byType[typeKey] || 0) + count;
    }

    summary.dataQualityScore =
      summary.total > 0 ? Math.round((summary.calibrated / summary.total) * 100) : 0;

    res.json(summary);
  } catch (err) {
    logger.error("SensorCalibration", "Error getting calibration summary", err);
    res.status(500).json({ error: "Failed to get calibration summary" });
  }
});

router.get("/overdue", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const result = await db.execute(sql`
      SELECT sc.*, v.name as vessel_name, e.name as equipment_name
      FROM sensor_calibrations sc
      LEFT JOIN vessels v ON sc.vessel_id = v.id
      LEFT JOIN equipment e ON sc.equipment_id = e.id
      WHERE sc.org_id = ${orgId}
        AND sc.next_calibration_due <= CURRENT_DATE
        AND sc.calibration_status != 'decommissioned'
        AND sc.decommissioned_date IS NULL
      ORDER BY sc.next_calibration_due ASC
    `);

    const sensors = rowsOf<SensorRow>(result);

    res.json(sensors);
  } catch (err) {
    logger.error("SensorCalibration", "Error listing overdue calibrations", err);
    res.status(500).json({ error: "Failed to list overdue calibrations" });
  }
});

router.get("/", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { vesselId, equipmentId, sensorType, status } = req.query;

    let query = sql`
      SELECT sc.*, v.name as vessel_name, e.name as equipment_name
      FROM sensor_calibrations sc
      LEFT JOIN vessels v ON sc.vessel_id = v.id
      LEFT JOIN equipment e ON sc.equipment_id = e.id
      WHERE sc.org_id = ${orgId}
    `;

    if (vesselId) {
      query = sql`${query} AND sc.vessel_id = ${vesselId as string}`;
    }
    if (equipmentId) {
      query = sql`${query} AND sc.equipment_id = ${equipmentId as string}`;
    }
    if (sensorType) {
      query = sql`${query} AND sc.sensor_type = ${sensorType as string}`;
    }
    if (status) {
      query = sql`${query} AND sc.calibration_status = ${status as string}`;
    }

    query = sql`${query} ORDER BY sc.next_calibration_due ASC NULLS LAST`;

    const result = await db.execute(query);
    const sensors = rowsOf<SensorRow>(result);

    res.json(sensors);
  } catch (err) {
    logger.error("SensorCalibration", "Error listing sensors", err);
    res.status(500).json({ error: "Failed to list sensors" });
  }
});

router.get("/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);

    const sensorResult = await db.execute(sql`
      SELECT sc.*, v.name as vessel_name, e.name as equipment_name
      FROM sensor_calibrations sc
      LEFT JOIN vessels v ON sc.vessel_id = v.id
      LEFT JOIN equipment e ON sc.equipment_id = e.id
      WHERE sc.id = ${req.params.id} AND sc.org_id = ${orgId}
    `);

    const sensor = rowsOf<SensorRow>(sensorResult)[0];

    if (!sensor) {
      return res.status(404).json({ error: "Sensor not found" });
    }

    const historyResult = await db.execute(sql`
      SELECT * FROM sensor_calibration_events
      WHERE calibration_id = ${req.params.id}
      ORDER BY calibration_date DESC
    `);

    const history = rowsOf<Record<string, unknown>>(historyResult);

    res.json({ ...sensor, calibrationHistory: history });
  } catch (err) {
    logger.error("SensorCalibration", "Error getting sensor detail", err);
    res.status(500).json({ error: "Failed to get sensor" });
  }
});

router.post("/", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const data = createSensorSchema.parse(req.body);

    const lastCalDate = data.lastCalibrationDate ? new Date(data.lastCalibrationDate) : null;
    const nextDue = lastCalDate
      ? new Date(lastCalDate.getTime() + data.calibrationIntervalDays * 24 * 60 * 60 * 1000)
      : null;

    const status = !lastCalDate
      ? "unknown"
      : nextDue && nextDue < new Date()
        ? "overdue"
        : "calibrated";

    const result = await db.execute(sql`
      INSERT INTO sensor_calibrations (
        org_id, vessel_id, equipment_id, sensor_tag, sensor_type,
        sensor_location, manufacturer, model, serial_number,
        calibration_interval_days, last_calibration_date, next_calibration_due,
        calibration_standard, calibration_status,
        measurement_range_min, measurement_range_max, measurement_unit,
        alarm_low, alarm_high, trip_low, trip_high,
        installed_date, notes
      ) VALUES (
        ${orgId}, ${data.vesselId}, ${data.equipmentId || null},
        ${data.sensorTag}, ${data.sensorType},
        ${data.sensorLocation || null}, ${data.manufacturer || null},
        ${data.model || null}, ${data.serialNumber || null},
        ${data.calibrationIntervalDays}, ${lastCalDate},
        ${nextDue}, ${data.calibrationStandard || null}, ${status},
        ${data.measurementRangeMin ?? null}, ${data.measurementRangeMax ?? null},
        ${data.measurementUnit || null},
        ${data.alarmLow ?? null}, ${data.alarmHigh ?? null},
        ${data.tripLow ?? null}, ${data.tripHigh ?? null},
        ${data.installedDate ? new Date(data.installedDate) : null},
        ${data.notes || null}
      )
      RETURNING *
    `);

    const sensor = rowsOf<SensorRow>(result)[0];
    res.status(201).json(sensor);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    logger.error("SensorCalibration", "Error creating sensor", err);
    res.status(500).json({ error: "Failed to create sensor" });
  }
});

router.post("/:id/calibrate", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const data = calibrationEventSchema.parse(req.body);

    const sensorResult = await db.execute(sql`
      SELECT * FROM sensor_calibrations
      WHERE id = ${req.params.id} AND org_id = ${orgId}
    `);
    const sensor = rowsOf<SensorRow>(sensorResult)[0];

    if (!sensor) {
      return res.status(404).json({ error: "Sensor not found" });
    }

    await db.execute(sql`
      INSERT INTO sensor_calibration_events (
        org_id, calibration_id, calibration_date, performed_by,
        performed_by_rank, status, drift_before, drift_after,
        reference_value, measured_value, adjusted_to,
        certificate_number, certificate_url, notes, method
      ) VALUES (
        ${orgId}, ${req.params.id}, ${new Date(data.calibrationDate)},
        ${data.performedBy}, ${data.performedByRank || null},
        ${data.status}, ${data.driftBefore ?? null}, ${data.driftAfter ?? null},
        ${data.referenceValue ?? null}, ${data.measuredValue ?? null},
        ${data.adjustedTo ?? null},
        ${data.certificateNumber || null}, ${data.certificateUrl || null},
        ${data.notes || null}, ${data.method || null}
      )
    `);

    const calDate = new Date(data.calibrationDate);
    const nextDue = new Date(
      calDate.getTime() + sensor.calibration_interval_days * 24 * 60 * 60 * 1000
    );

    const newStatus =
      data.status === "fail" ? "failed" : data.status === "replaced" ? "calibrated" : "calibrated";

    await db.execute(sql`
      UPDATE sensor_calibrations
      SET last_calibration_date = ${calDate},
          next_calibration_due = ${nextDue},
          calibration_status = ${newStatus},
          drift_percentage = ${data.driftAfter ?? data.driftBefore ?? null},
          certificate_url = ${data.certificateUrl || sensor.certificate_url},
          updated_at = NOW()
      WHERE id = ${req.params.id} AND org_id = ${orgId}
    `);

    logger.info("SensorCalibration", "Calibration recorded", {
      sensorId: req.params.id,
      sensorTag: sensor.sensor_tag,
      status: data.status,
      nextDue: nextDue.toISOString(),
    });

    res.status(201).json({
      success: true,
      sensorTag: sensor.sensor_tag,
      calibrationStatus: newStatus,
      nextCalibrationDue: nextDue,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    logger.error("SensorCalibration", "Error recording calibration", err);
    res.status(500).json({ error: "Failed to record calibration" });
  }
});

router.delete("/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);

    await db.execute(sql`
      UPDATE sensor_calibrations
      SET calibration_status = 'decommissioned',
          decommissioned_date = CURRENT_DATE,
          updated_at = NOW()
      WHERE id = ${req.params.id} AND org_id = ${orgId}
    `);

    res.json({ success: true });
  } catch (err) {
    logger.error("SensorCalibration", "Error decommissioning sensor", err);
    res.status(500).json({ error: "Failed to decommission sensor" });
  }
});

export { router as sensorCalibrationRouter };
export default router;
