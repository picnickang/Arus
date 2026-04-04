import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { requireOrgId, type AuthenticatedRequest } from "../../middleware/auth";
import { logger } from "../../utils/logger";

const MODULE = "rms";
const router = Router();

function getOrgId(req: Request): string {
  return (req as AuthenticatedRequest).orgId as string;
}

function getRows(result: any): any[] {
  return Array.isArray(result) ? result : (result as any)?.rows || [];
}

function getFirstRow(result: any): any | undefined {
  return getRows(result)[0];
}

// ===== Fleet Vessel Positions =====
router.get("/fleet-positions", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { hours = "24" } = req.query;
    const hoursBack = Math.min(parseInt(hours as string, 10) || 24, 168);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT DISTINCT ON (v.id)
        v.id as vessel_id, v.name as vessel_name, v.vessel_type,
        v.online_status, v.last_heartbeat,
        vtl.latitude, vtl.longitude, vtl.speed_over_ground as sog,
        vtl.course_over_ground as cog, vtl.heading,
        vtl.timestamp as last_position_at,
        vtl.source
      FROM vessels v
      LEFT JOIN vessel_track_log vtl ON v.id = vtl.vessel_id AND vtl.timestamp >= ${since}
      WHERE v.org_id = ${getOrgId(req)}
      ORDER BY v.id, vtl.timestamp DESC
    `);

    res.json(getRows(result));
  } catch (err) {
    logger.error(MODULE, "Error fetching fleet positions", { error: err });
    res.status(500).json({ error: "Failed to fetch fleet positions" });
  }
});

// ===== Vessel Track History =====
router.get("/vessel-track/:vesselId", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { hours = "24" } = req.query;
    const hoursBack = Math.min(parseInt(hours as string, 10) || 24, 168);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT latitude, longitude, speed_over_ground as sog,
        course_over_ground as cog, heading, timestamp, source
      FROM vessel_track_log
      WHERE vessel_id = ${req.params.vesselId}
        AND org_id = ${getOrgId(req)}
        AND timestamp >= ${since}
      ORDER BY timestamp ASC
    `);

    res.json(getRows(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vessel track" });
  }
});

// ===== Hourly Consumption Aggregates =====
router.get("/consumption/hourly/:vesselId", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { hours = "24" } = req.query;
    const hoursBack = Math.min(parseInt(hours as string, 10) || 24, 168);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT
        date_trunc('hour', timestamp) as hour,
        AVG(CASE WHEN sensor_type = 'fuel_consumption' THEN value END) as avg_flow_kg_per_h,
        MAX(CASE WHEN sensor_type = 'fuel_consumption' THEN value END) as max_flow_kg_per_h,
        MIN(CASE WHEN sensor_type = 'fuel_consumption' THEN value END) as min_flow_kg_per_h,
        AVG(CASE WHEN sensor_type = 'fuel_density' THEN value END) as avg_density,
        AVG(CASE WHEN sensor_type = 'fuel_temperature' THEN value END) as avg_temperature,
        COUNT(*) as data_points
      FROM equipment_telemetry
      WHERE equipment_id LIKE ${'fmcc-fuel-' + req.params.vesselId}
        AND org_id = ${getOrgId(req)}
        AND timestamp >= ${since}
        AND sensor_type IN ('fuel_consumption', 'fuel_density', 'fuel_temperature')
      GROUP BY date_trunc('hour', timestamp)
      ORDER BY hour ASC
    `);

    res.json(getRows(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch hourly consumption" });
  }
});

// ===== Daily Summary =====
router.get("/consumption/daily/:vesselId", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { days = "7" } = req.query;
    const daysBack = Math.min(parseInt(days as string, 10) || 7, 90);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT
        date_trunc('day', timestamp) as day,
        AVG(CASE WHEN sensor_type = 'fuel_consumption' THEN value END) as avg_flow_kg_per_h,
        MAX(CASE WHEN sensor_type = 'fuel_consumption' THEN value END) as max_flow_kg_per_h,
        SUM(CASE WHEN sensor_type = 'fuel_consumption' THEN value END) / NULLIF(COUNT(DISTINCT date_trunc('hour', timestamp)), 0) * 24 / 1000 as estimated_daily_mt,
        AVG(CASE WHEN sensor_type = 'fuel_density' THEN value END) as avg_density,
        COUNT(*) as data_points
      FROM equipment_telemetry
      WHERE equipment_id LIKE ${'fmcc-fuel-' + req.params.vesselId}
        AND org_id = ${getOrgId(req)}
        AND timestamp >= ${since}
        AND sensor_type IN ('fuel_consumption', 'fuel_density')
      GROUP BY date_trunc('day', timestamp)
      ORDER BY day DESC
    `);

    const trackResult = await db.execute(sql`
      SELECT
        date_trunc('day', timestamp) as day,
        AVG(speed_over_ground) as avg_sog,
        SUM(speed_over_ground * EXTRACT(EPOCH FROM '1 hour'::interval) / 3600) as est_distance_nm
      FROM vessel_track_log
      WHERE vessel_id = ${req.params.vesselId}
        AND org_id = ${getOrgId(req)}
        AND timestamp >= ${since}
      GROUP BY date_trunc('day', timestamp)
    `);

    const trackByDay: Record<string, any> = {};
    for (const t of getRows(trackResult)) {
      trackByDay[new Date(t.day).toISOString()] = t;
    }

    const dailyData = getRows(result).map((d: any) => ({
      ...d,
      avg_sog: trackByDay[new Date(d.day).toISOString()]?.avg_sog ?? null,
      est_distance_nm: trackByDay[new Date(d.day).toISOString()]?.est_distance_nm ?? null,
    }));

    res.json(dailyData);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch daily consumption" });
  }
});

// ===== Bunkering Events =====
router.get("/bunkering", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId, days = "30" } = req.query;
    const daysBack = Math.min(parseInt(days as string, 10) || 30, 365);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    let q = sql`
      SELECT be.*, v.name as vessel_name
      FROM rms_bunkering_events be
      LEFT JOIN vessels v ON be.vessel_id = v.id
      WHERE be.org_id = ${getOrgId(req)} AND be.started_at >= ${since}
    `;
    if (vesselId) q = sql`${q} AND be.vessel_id = ${vesselId as string}`;
    q = sql`${q} ORDER BY be.started_at DESC LIMIT 200`;

    const result = await db.execute(q);
    res.json(getRows(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bunkering events" });
  }
});

// ===== Tank Levels (latest readings) =====
router.get("/tanks/:vesselId", requireOrgId, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (sensor_type)
        sensor_type, value, timestamp, metadata
      FROM equipment_telemetry
      WHERE equipment_id LIKE ${'fmcc-fuel-' + req.params.vesselId}
        AND org_id = ${getOrgId(req)}
        AND sensor_type LIKE 'tank_%'
      ORDER BY sensor_type, timestamp DESC
    `);

    res.json(getRows(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tank levels" });
  }
});

// ===== ROB Estimate =====
router.get("/rob/:vesselId", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const tankResult = await db.execute(sql`
      SELECT DISTINCT ON (sensor_type)
        sensor_type, value, timestamp
      FROM equipment_telemetry
      WHERE equipment_id LIKE ${'fmcc-fuel-' + req.params.vesselId}
        AND org_id = ${orgId}
        AND sensor_type LIKE 'tank_%'
      ORDER BY sensor_type, timestamp DESC
    `);

    const consumptionResult = await db.execute(sql`
      SELECT AVG(value) as avg_consumption_kg_per_h
      FROM equipment_telemetry
      WHERE equipment_id = ${'fmcc-fuel-' + req.params.vesselId}
        AND org_id = ${orgId}
        AND sensor_type = 'fuel_consumption'
        AND timestamp >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)}
    `);

    const avgConsumption = getFirstRow(consumptionResult)?.avg_consumption_kg_per_h ?? 0;
    const tanks = getRows(tankResult);

    res.json({
      tanks,
      avgConsumptionKgPerH: parseFloat(avgConsumption) || 0,
      estimatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to calculate ROB" });
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
    const { vesselId } = req.query;
    let q = sql`
      SELECT ac.*, v.name as vessel_name
      FROM rms_alert_configs ac
      LEFT JOIN vessels v ON ac.vessel_id = v.id
      WHERE ac.org_id = ${getOrgId(req)}
    `;
    if (vesselId) q = sql`${q} AND ac.vessel_id = ${vesselId as string}`;
    q = sql`${q} ORDER BY ac.name`;

    const result = await db.execute(q);
    res.json(getRows(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alert configs" });
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
    res.status(201).json(getFirstRow(result));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    res.status(500).json({ error: "Failed to create alert config" });
  }
});

router.patch("/alerts/configs/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const existing = await db.execute(sql`
      SELECT id FROM rms_alert_configs WHERE id = ${req.params.id} AND org_id = ${getOrgId(req)}
    `);
    if (!getFirstRow(existing)) return res.status(404).json({ error: "Alert config not found" });

    const { name, config, enabled, notifyEmail, notifyInApp, cooldownMinutes } = req.body;

    const result = await db.execute(sql`
      UPDATE rms_alert_configs SET
        name = COALESCE(${name ?? null}, name),
        config = COALESCE(${config ? JSON.stringify(config) : null}, config),
        enabled = COALESCE(${enabled ?? null}, enabled),
        notify_email = COALESCE(${notifyEmail ?? null}, notify_email),
        notify_in_app = COALESCE(${notifyInApp ?? null}, notify_in_app),
        cooldown_minutes = COALESCE(${cooldownMinutes ?? null}, cooldown_minutes),
        updated_at = NOW()
      WHERE id = ${req.params.id} AND org_id = ${getOrgId(req)}
      RETURNING *
    `);

    res.json(getFirstRow(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to update alert config" });
  }
});

router.delete("/alerts/configs/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      DELETE FROM rms_alert_configs WHERE id = ${req.params.id} AND org_id = ${getOrgId(req)} RETURNING id
    `);
    const deleted = getFirstRow(result);
    if (!deleted) return res.status(404).json({ error: "Alert config not found" });
    res.json({ success: true, deletedId: deleted.id });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete alert config" });
  }
});

// ===== Active Alerts =====
router.get("/alerts", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId, acknowledged, days = "7" } = req.query;
    const daysBack = Math.min(parseInt(days as string, 10) || 7, 90);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    let q = sql`
      SELECT al.*, v.name as vessel_name
      FROM rms_alert_log al
      LEFT JOIN vessels v ON al.vessel_id = v.id
      WHERE al.org_id = ${getOrgId(req)} AND al.created_at >= ${since}
    `;
    if (vesselId) q = sql`${q} AND al.vessel_id = ${vesselId as string}`;
    if (acknowledged === 'false') q = sql`${q} AND al.acknowledged = false`;
    if (acknowledged === 'true') q = sql`${q} AND al.acknowledged = true`;
    q = sql`${q} ORDER BY al.created_at DESC LIMIT 200`;

    const result = await db.execute(q);
    res.json(getRows(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.patch("/alerts/:id/acknowledge", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { acknowledgedBy } = req.body;
    const result = await db.execute(sql`
      UPDATE rms_alert_log SET
        acknowledged = true,
        acknowledged_by = ${acknowledgedBy || 'system'},
        acknowledged_at = NOW()
      WHERE id = ${req.params.id} AND org_id = ${getOrgId(req)}
      RETURNING *
    `);
    const row = getFirstRow(result);
    if (!row) return res.status(404).json({ error: "Alert not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to acknowledge alert" });
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

    res.json({
      alerts: {
        total24h: parseInt(alerts.total) || 0,
        unacknowledged: parseInt(alerts.unacknowledged) || 0,
        critical: parseInt(alerts.critical) || 0,
      },
      bunkering: {
        last30Days: parseInt(bunkering.total) || 0,
        active: parseInt(bunkering.active) || 0,
      },
      efmsConnections: {
        total: parseInt(efms.total) || 0,
        polling: parseInt(efms.polling) || 0,
        error: parseInt(efms.error) || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch RMS summary" });
  }
});

export { router as rmsRouter };
