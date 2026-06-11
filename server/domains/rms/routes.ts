import { Router, Request, Response } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { authenticatedRequest, requireOrgId } from "../../middleware/auth";
import { logger } from "../../utils/logger";

const MODULE = "rms";
const router = Router();

const hoursQuerySchema = z.object({ hours: z.coerce.number().int().min(1).max(168).default(24) });
const daysQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(7) });
const vesselIdParamSchema = z.object({ vesselId: z.string().min(1) });
const idParamSchema = z.object({ id: z.string().min(1) });
const bunkeringQuerySchema = z.object({
  vesselId: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});
const vesselIdOptQuerySchema = z.object({ vesselId: z.string().optional() });
const alertsQuerySchema = z.object({
  vesselId: z.string().optional(),
  acknowledged: z.enum(["true", "false"]).optional(),
  days: z.coerce.number().int().min(1).max(90).default(7),
});
const acknowledgeBodySchema = z.object({ acknowledgedBy: z.string().optional() });
const alertConfigPatchBodySchema = z.object({
  name: z.string().optional(),
  config: jsonRecordSchema.optional(),
  enabled: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
  cooldownMinutes: z.number().int().optional(),
});

function getOrgId(req: Request): string {
  return authenticatedRequest(req).orgId as string;
}

type Row = Record<string, unknown>;
function getRows(result: unknown): Row[] {
  if (Array.isArray(result)) {
    return result as Row[];
  }
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: Row[] }).rows;
  }
  return [];
}

function getFirstRow(result: unknown): Row | undefined {
  return getRows(result)[0];
}

// ===== Fleet Vessel Positions =====
router.get("/fleet-positions", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { hours: hoursBack } = hoursQuerySchema.parse(req.query);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT DISTINCT ON (v.id)
        v.id as vessel_id, v.name as vessel_name, v.vessel_type,
        v.online_status, v.last_heartbeat,
        vtl.latitude, vtl.longitude, vtl.sog,
        vtl.cog, vtl.heading,
        vtl.timestamp as last_position_at,
        vtl.source
      FROM vessels v
      LEFT JOIN vessel_track_log vtl ON v.id = vtl.vessel_id AND vtl.timestamp >= ${since}
      WHERE v.org_id = ${getOrgId(req)}
      ORDER BY v.id, vtl.timestamp DESC
    `);

    return res.json(getRows(result));
  } catch (err) {
    logger.error(MODULE, "Error fetching fleet positions", { error: err });
    return res.status(500).json({ error: "Failed to fetch fleet positions" });
  }
});

// ===== Vessel Track History =====
router.get("/vessel-track/:vesselId", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { hours: hoursBack } = hoursQuerySchema.parse(req.query);
    const { vesselId } = vesselIdParamSchema.parse(req.params);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT latitude, longitude, sog,
        cog, heading, timestamp, source
      FROM vessel_track_log
      WHERE vessel_id = ${vesselId}
        AND org_id = ${getOrgId(req)}
        AND timestamp >= ${since}
      ORDER BY timestamp ASC
    `);

    return res.json(getRows(result));
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch vessel track" });
  }
});

// ===== Hourly Consumption Aggregates =====
router.get("/consumption/hourly/:vesselId", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { hours: hoursBack } = hoursQuerySchema.parse(req.query);
    const { vesselId } = vesselIdParamSchema.parse(req.params);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const orgId = getOrgId(req);
    const fuelEquipmentId = `fmcc-fuel-${vesselId}`;
    const engineEquipmentId = `fmcc-engine-${vesselId}`;

    const result = await db.execute(sql`
      SELECT
        date_trunc('hour', ts) as hour,
        AVG(CASE WHEN sensor_type = 'fuel_consumption' AND equipment_id = ${fuelEquipmentId} THEN value END) as avg_flow_kg_per_h,
        MAX(CASE WHEN sensor_type = 'fuel_consumption' AND equipment_id = ${fuelEquipmentId} THEN value END) as max_flow_kg_per_h,
        MIN(CASE WHEN sensor_type = 'fuel_consumption' AND equipment_id = ${fuelEquipmentId} THEN value END) as min_flow_kg_per_h,
        AVG(CASE WHEN sensor_type = 'fuel_density' THEN value END) as avg_density,
        AVG(CASE WHEN sensor_type = 'fuel_temperature' THEN value END) as avg_temperature,
        AVG(CASE WHEN sensor_type = 'main_engine_flow' THEN value END) as main_engine_flow,
        AVG(CASE WHEN sensor_type = 'port_engine_flow' THEN value END) as port_engine_flow,
        AVG(CASE WHEN sensor_type = 'stbd_engine_flow' THEN value END) as stbd_engine_flow,
        AVG(CASE WHEN sensor_type = 'generator_flow' THEN value END) as generator_flow,
        AVG(CASE WHEN sensor_type = 'boiler_flow' THEN value END) as boiler_flow,
        AVG(CASE WHEN sensor_type = 'do_flow' THEN value END) as do_flow,
        AVG(CASE WHEN sensor_type = 'aux_engine_1_flow' THEN value END) as aux_engine_1_flow,
        AVG(CASE WHEN sensor_type = 'aux_engine_2_flow' THEN value END) as aux_engine_2_flow,
        AVG(CASE WHEN sensor_type = 'bunker_flow' THEN value END) as bunker_flow,
        AVG(CASE WHEN sensor_type = 'shaft_power' THEN value END) as shaft_power_kw,
        AVG(CASE WHEN sensor_type = 'shaft_torque' THEN value END) as shaft_torque_nm,
        AVG(CASE WHEN sensor_type = 'shaft_rpm' THEN value END) as shaft_rpm,
        AVG(CASE WHEN sensor_type = 'running_hours' THEN value END) as running_hours,
        COUNT(*) as data_points
      FROM equipment_telemetry
      WHERE (equipment_id = ${fuelEquipmentId} OR equipment_id = ${engineEquipmentId})
        AND org_id = ${orgId}
        AND ts >= ${since}
      GROUP BY date_trunc('hour', ts)
      ORDER BY hour ASC
    `);

    return res.json(getRows(result));
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch hourly consumption" });
  }
});

// ===== Daily Summary =====
router.get("/consumption/daily/:vesselId", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { days: daysBack } = daysQuerySchema.parse(req.query);
    const { vesselId } = vesselIdParamSchema.parse(req.params);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const orgId = getOrgId(req);
    const fuelEquipmentId = `fmcc-fuel-${vesselId}`;
    const engineEquipmentId = `fmcc-engine-${vesselId}`;

    const result = await db.execute(sql`
      SELECT
        date_trunc('day', ts) as day,
        AVG(CASE WHEN sensor_type = 'fuel_consumption' THEN value END) as avg_flow_kg_per_h,
        MAX(CASE WHEN sensor_type = 'fuel_consumption' THEN value END) as max_flow_kg_per_h,
        AVG(CASE WHEN sensor_type = 'fuel_consumption' THEN value END) * 24 / 1000 as estimated_daily_mt,
        AVG(CASE WHEN sensor_type = 'fuel_density' THEN value END) as avg_density,
        AVG(CASE WHEN sensor_type = 'main_engine_flow' THEN value END) as main_engine_flow,
        AVG(CASE WHEN sensor_type = 'port_engine_flow' THEN value END) as port_engine_flow,
        AVG(CASE WHEN sensor_type = 'stbd_engine_flow' THEN value END) as stbd_engine_flow,
        AVG(CASE WHEN sensor_type = 'generator_flow' THEN value END) as generator_flow,
        AVG(CASE WHEN sensor_type = 'boiler_flow' THEN value END) as boiler_flow,
        AVG(CASE WHEN sensor_type = 'do_flow' THEN value END) as do_flow,
        MAX(CASE WHEN sensor_type = 'running_hours' THEN value END) - MIN(CASE WHEN sensor_type = 'running_hours' THEN value END) as running_hours_delta,
        MAX(CASE WHEN sensor_type = 'running_hours' THEN value END) as running_hours_total,
        COUNT(*) as data_points
      FROM equipment_telemetry
      WHERE (equipment_id = ${fuelEquipmentId} OR equipment_id = ${engineEquipmentId})
        AND org_id = ${orgId}
        AND ts >= ${since}
      GROUP BY date_trunc('day', ts)
      ORDER BY day DESC
    `);

    const trackResult = await db.execute(sql`
      SELECT day, AVG(sog) as avg_sog, SUM(COALESCE(segment_nm, 0)) as est_distance_nm
      FROM (
        SELECT
          date_trunc('day', timestamp) as day,
          sog,
          sog * EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (PARTITION BY date_trunc('day', timestamp) ORDER BY timestamp))) / 3600.0 as segment_nm
        FROM vessel_track_log
        WHERE vessel_id = ${vesselId}
          AND org_id = ${orgId}
          AND timestamp >= ${since}
      ) segments
      GROUP BY day
    `);

    const trackByDay: Record<string, Row> = {};
    for (const t of getRows(trackResult)) {
      trackByDay[new Date(t["day"] as string | number | Date).toISOString()] = t;
    }

    const dailyData = getRows(result).map((d) => ({
      ...d,
      avg_sog:
        trackByDay[new Date(d["day"] as string | number | Date).toISOString()]?.["avg_sog"] ?? null,
      est_distance_nm:
        trackByDay[new Date(d["day"] as string | number | Date).toISOString()]?.[
          "est_distance_nm"
        ] ?? null,
    }));

    return res.json(dailyData);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch daily consumption" });
  }
});

// ===== Bunkering Events =====
router.get("/bunkering", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId, days: daysBack } = bunkeringQuerySchema.parse(req.query);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    let q = sql`
      SELECT be.*, v.name as vessel_name
      FROM rms_bunkering_events be
      LEFT JOIN vessels v ON be.vessel_id = v.id
      WHERE be.org_id = ${getOrgId(req)} AND be.started_at >= ${since}
    `;
    if (vesselId) {
      q = sql`${q} AND be.vessel_id = ${vesselId}`;
    }
    q = sql`${q} ORDER BY be.started_at DESC LIMIT 200`;

    const result = await db.execute(q);
    return res.json(getRows(result));
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch bunkering events" });
  }
});

// ===== Tank Levels (latest readings) =====
router.get("/tanks/:vesselId", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId } = vesselIdParamSchema.parse(req.params);
    const result = await db.execute(sql`
      SELECT DISTINCT ON (sensor_type)
        sensor_type, value, ts as timestamp
      FROM equipment_telemetry
      WHERE equipment_id LIKE ${`fmcc-fuel-${vesselId}`}
        AND org_id = ${getOrgId(req)}
        AND sensor_type LIKE 'tank_%'
      ORDER BY sensor_type, ts DESC
    `);

    return res.json(getRows(result));
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch tank levels" });
  }
});

// ===== ROB Estimate =====
router.get("/rob/:vesselId", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId } = vesselIdParamSchema.parse(req.params);
    const orgId = getOrgId(req);
    const tankResult = await db.execute(sql`
      SELECT DISTINCT ON (sensor_type)
        sensor_type, value, ts as timestamp
      FROM equipment_telemetry
      WHERE equipment_id LIKE ${`fmcc-fuel-${vesselId}`}
        AND org_id = ${orgId}
        AND sensor_type LIKE 'tank_%'
      ORDER BY sensor_type, ts DESC
    `);

    const consumptionResult = await db.execute(sql`
      SELECT AVG(value) as avg_consumption_kg_per_h
      FROM equipment_telemetry
      WHERE equipment_id = ${`fmcc-fuel-${vesselId}`}
        AND org_id = ${orgId}
        AND sensor_type = 'fuel_consumption'
        AND ts >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)}
    `);

    const avgConsumption = getFirstRow(consumptionResult)?.["avg_consumption_kg_per_h"] ?? 0;
    const tanks = getRows(tankResult);

    return res.json({
      tanks,
      avgConsumptionKgPerH: parseFloat(String(avgConsumption)) || 0,
      estimatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to calculate ROB" });
  }
});

// ===== Alert Config CRUD =====
const createAlertConfigSchema = z.object({
  vesselId: z.string().min(1),
  alertType: z.enum(["fuel_threshold", "daily_consumption", "geofence", "bunkering"]),
  name: z.string().min(1),
  config: z.record(z.any()),
  notifyEmail: z.boolean().default(true),
  notifyInApp: z.boolean().default(true),
  cooldownMinutes: z.number().int().min(1).default(60),
});

router.get("/alerts/configs", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId } = vesselIdOptQuerySchema.parse(req.query);
    let q = sql`
      SELECT ac.*, v.name as vessel_name
      FROM rms_alert_configs ac
      LEFT JOIN vessels v ON ac.vessel_id = v.id
      WHERE ac.org_id = ${getOrgId(req)}
    `;
    if (vesselId) {
      q = sql`${q} AND ac.vessel_id = ${vesselId}`;
    }
    q = sql`${q} ORDER BY ac.name`;

    const result = await db.execute(q);
    return res.json(getRows(result));
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch alert configs" });
  }
});

router.post("/alerts/configs", requireOrgId, async (req: Request, res: Response) => {
  try {
    const data = createAlertConfigSchema.parse(req.body);
    const result = await db.execute(sql`
      INSERT INTO rms_alert_configs (
        org_id, vessel_id, alert_type, name, config, notify_email, notify_in_app, cooldown_minutes
      ) VALUES (
        ${getOrgId(req)}, ${data.vesselId}, ${data.alertType}, ${data.name},
        ${JSON.stringify(data.config)}, ${data.notifyEmail}, ${data.notifyInApp}, ${data.cooldownMinutes}
      ) RETURNING *
    `);
    return res.status(201).json(getFirstRow(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    return res.status(500).json({ error: "Failed to create alert config" });
  }
});

router.patch("/alerts/configs/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const existing = await db.execute(sql`
      SELECT id FROM rms_alert_configs WHERE id = ${id} AND org_id = ${getOrgId(req)}
    `);
    if (!getFirstRow(existing)) {
      return res.status(404).json({ error: "Alert config not found" });
    }

    const { name, config, enabled, notifyEmail, notifyInApp, cooldownMinutes } =
      alertConfigPatchBodySchema.parse(req.body);

    const result = await db.execute(sql`
      UPDATE rms_alert_configs SET
        name = COALESCE(${name ?? null}, name),
        config = COALESCE(${config ? JSON.stringify(config) : null}, config),
        enabled = COALESCE(${enabled ?? null}, enabled),
        notify_email = COALESCE(${notifyEmail ?? null}, notify_email),
        notify_in_app = COALESCE(${notifyInApp ?? null}, notify_in_app),
        cooldown_minutes = COALESCE(${cooldownMinutes ?? null}, cooldown_minutes),
        updated_at = NOW()
      WHERE id = ${id} AND org_id = ${getOrgId(req)}
      RETURNING *
    `);

    return res.json(getFirstRow(result));
  } catch (err) {
    return res.status(500).json({ error: "Failed to update alert config" });
  }
});

router.delete("/alerts/configs/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await db.execute(sql`
      DELETE FROM rms_alert_configs WHERE id = ${id} AND org_id = ${getOrgId(req)} RETURNING id
    `);
    const deleted = getFirstRow(result);
    if (!deleted) {
      return res.status(404).json({ error: "Alert config not found" });
    }
    return res.json({ success: true, deletedId: deleted["id"] });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete alert config" });
  }
});

// ===== Active Alerts =====
router.get("/alerts", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId, acknowledged, days: daysBack } = alertsQuerySchema.parse(req.query);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    let q = sql`
      SELECT al.*, v.name as vessel_name
      FROM rms_alert_log al
      LEFT JOIN vessels v ON al.vessel_id = v.id
      WHERE al.org_id = ${getOrgId(req)} AND al.created_at >= ${since}
    `;
    if (vesselId) {
      q = sql`${q} AND al.vessel_id = ${vesselId}`;
    }
    if (acknowledged === "false") {
      q = sql`${q} AND al.acknowledged = false`;
    }
    if (acknowledged === "true") {
      q = sql`${q} AND al.acknowledged = true`;
    }
    q = sql`${q} ORDER BY al.created_at DESC LIMIT 200`;

    const result = await db.execute(q);
    return res.json(getRows(result));
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.patch("/alerts/:id/acknowledge", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { acknowledgedBy } = acknowledgeBodySchema.parse(req.body);
    const result = await db.execute(sql`
      UPDATE rms_alert_log SET
        acknowledged = true,
        acknowledged_by = ${acknowledgedBy || "system"},
        acknowledged_at = NOW()
      WHERE id = ${id} AND org_id = ${getOrgId(req)}
      RETURNING *
    `);
    const row = getFirstRow(result);
    if (!row) {
      return res.status(404).json({ error: "Alert not found" });
    }
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

// ===== Fleet RMS Summary =====
router.get("/summary", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);

    const [alertsResult, bunkeringResult, efmsResult] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*) as total,
          COUNT(*) FILTER (WHERE acknowledged = false) as unacknowledged,
          COUNT(*) FILTER (WHERE severity = 'critical' AND acknowledged = false) as critical
        FROM rms_alert_log
        WHERE org_id = ${orgId} AND created_at >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)}
      `),
      db.execute(sql`
        SELECT COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'in_progress') as active
        FROM rms_bunkering_events
        WHERE org_id = ${orgId} AND started_at >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
      `),
      db.execute(sql`
        SELECT COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'polling') as polling,
          COUNT(*) FILTER (WHERE status = 'error') as error
        FROM efms_connections
        WHERE org_id = ${orgId}
      `),
    ]);

    const alerts = getFirstRow(alertsResult) || {};
    const bunkering = getFirstRow(bunkeringResult) || {};
    const efms = getFirstRow(efmsResult) || {};

    return res.json({
      alerts: {
        total24h: parseInt(String(alerts["total"] ?? 0)) || 0,
        unacknowledged: parseInt(String(alerts["unacknowledged"] ?? 0)) || 0,
        critical: parseInt(String(alerts["critical"] ?? 0)) || 0,
      },
      bunkering: {
        last30Days: parseInt(String(bunkering["total"] ?? 0)) || 0,
        active: parseInt(String(bunkering["active"] ?? 0)) || 0,
      },
      efmsConnections: {
        total: parseInt(String(efms["total"] ?? 0)) || 0,
        polling: parseInt(String(efms["polling"] ?? 0)) || 0,
        error: parseInt(String(efms["error"] ?? 0)) || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch RMS summary" });
  }
});

export { router as rmsRouter };
