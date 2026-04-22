import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { requireOrgId, type AuthenticatedRequest } from "../../middleware/auth";
import { logger } from "../../utils/logger";

const MODULE = "dp-system";
const router = Router();

function getOrgId(req: Request): string {
  return (req as AuthenticatedRequest).orgId as string;
}

function getRows(result: any): any[] {
  return Array.isArray(result) ? result : (result as any)?.rows || [];
}

function getFirstRow(result: any): any | undefined {
  const rows = getRows(result);
  return rows[0];
}

const createDpSchema = z.object({
  vesselId: z.string().min(1),
  dpClass: z.enum(["DP1", "DP2", "DP3"]),
  dpControllerMake: z.string().optional(),
  dpControllerModel: z.string().optional(),
  dpSoftwareVersion: z.string().optional(),
  thrusters: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        make: z.string().optional(),
        model: z.string().optional(),
        powerKw: z.number().optional(),
        status: z.enum(["operational", "degraded", "failed"]).default("operational"),
      })
    )
    .optional(),
  referenceSystems: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        make: z.string().optional(),
        model: z.string().optional(),
        status: z.enum(["active", "standby", "failed"]).default("active"),
      })
    )
    .optional(),
  lastDpTrialDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dpFmeaDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().optional(),
});

const incidentSchema = z.object({
  vesselId: z.string().min(1),
  dpSystemId: z.string().optional(),
  incidentDate: z.string(),
  incidentType: z.enum([
    "position_loss",
    "heading_loss",
    "drive_off",
    "drift_off",
    "near_miss",
    "equipment_failure",
    "reference_loss",
    "power_failure",
  ]),
  severity: z.enum(["critical", "major", "minor", "observation"]),
  operationType: z.string().optional(),
  description: z.string().min(1),
  waterDepthM: z.number().optional(),
  windSpeedKts: z.number().optional(),
  waveHeightM: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  excursionM: z.number().optional(),
  reportedBy: z.string().optional(),
});

const dailyCheckSchema = z.object({
  vesselId: z.string().min(1),
  checkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  watchPeriod: z.enum(["morning", "afternoon", "night"]).optional(),
  checklist: z.array(
    z.object({
      item: z.string(),
      category: z.string(),
      status: z.enum(["pass", "fail", "na"]),
      notes: z.string().optional(),
    })
  ),
  overallStatus: z.enum(["ready", "degraded", "not_ready"]),
  dpoName: z.string().min(1),
  dpoRank: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/systems", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId } = req.query;
    let q = sql`SELECT ds.*, v.name as vessel_name FROM dp_systems ds LEFT JOIN vessels v ON ds.vessel_id = v.id WHERE ds.org_id = ${getOrgId(req)}`;
    if (vesselId) {
      q = sql`${q} AND ds.vessel_id = ${vesselId as string}`;
    }
    q = sql`${q} ORDER BY v.name`;
    const result = await db.execute(q);
    res.json(getRows(result));
  } catch (err) {
    logger.error(MODULE, "Error listing DP systems", { error: err });
    res.status(500).json({ error: "Failed to list DP systems" });
  }
});

router.get("/systems/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT ds.*, v.name as vessel_name
      FROM dp_systems ds LEFT JOIN vessels v ON ds.vessel_id = v.id
      WHERE ds.id = ${req.params.id} AND ds.org_id = ${getOrgId(req)}
    `);
    const system = getFirstRow(result);
    if (!system) {
      return res.status(404).json({ error: "DP system not found" });
    }
    res.json(system);
  } catch (err) {
    res.status(500).json({ error: "Failed to get DP system" });
  }
});

router.post("/systems", requireOrgId, async (req: Request, res: Response) => {
  try {
    const data = createDpSchema.parse(req.body);
    const trialDate = data.lastDpTrialDate ? new Date(data.lastDpTrialDate) : null;
    const nextTrial = trialDate ? new Date(trialDate.getTime() + 365 * 24 * 60 * 60 * 1000) : null;

    const result = await db.execute(sql`
      INSERT INTO dp_systems (
        org_id, vessel_id, dp_class, dp_controller_make, dp_controller_model,
        dp_software_version, thrusters, reference_systems,
        last_dp_trial_date, next_dp_trial_due, dp_fmea_date, notes
      ) VALUES (
        ${getOrgId(req)}, ${data.vesselId}, ${data.dpClass},
        ${data.dpControllerMake || null}, ${data.dpControllerModel || null},
        ${data.dpSoftwareVersion || null},
        ${JSON.stringify(data.thrusters || [])},
        ${JSON.stringify(data.referenceSystems || [])},
        ${trialDate}, ${nextTrial},
        ${data.dpFmeaDate ? new Date(data.dpFmeaDate) : null},
        ${data.notes || null}
      ) RETURNING *
    `);

    await db.execute(sql`
      UPDATE vessels SET dp_class = ${data.dpClass}
      WHERE id = ${data.vesselId} AND org_id = ${getOrgId(req)}
    `);

    res.status(201).json(getFirstRow(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    logger.error(MODULE, "Error creating DP system", { error: err });
    res.status(500).json({ error: "Failed to create DP system" });
  }
});

router.get("/incidents", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId, status } = req.query;
    let q = sql`SELECT di.*, v.name as vessel_name FROM dp_incidents di LEFT JOIN vessels v ON di.vessel_id = v.id WHERE di.org_id = ${getOrgId(req)}`;
    if (vesselId) {
      q = sql`${q} AND di.vessel_id = ${vesselId as string}`;
    }
    if (status) {
      q = sql`${q} AND di.status = ${status as string}`;
    }
    q = sql`${q} ORDER BY di.incident_date DESC LIMIT 100`;
    const result = await db.execute(q);
    res.json(getRows(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to list DP incidents" });
  }
});

router.post("/incidents", requireOrgId, async (req: Request, res: Response) => {
  try {
    const data = incidentSchema.parse(req.body);
    const result = await db.execute(sql`
      INSERT INTO dp_incidents (
        org_id, vessel_id, dp_system_id, incident_date, incident_type,
        severity, operation_type, description, water_depth_m,
        wind_speed_kts, wave_height_m, latitude, longitude,
        excursion_m, reported_by
      ) VALUES (
        ${getOrgId(req)}, ${data.vesselId}, ${data.dpSystemId || null},
        ${new Date(data.incidentDate)}, ${data.incidentType},
        ${data.severity}, ${data.operationType || null}, ${data.description},
        ${data.waterDepthM ?? null}, ${data.windSpeedKts ?? null},
        ${data.waveHeightM ?? null}, ${data.latitude ?? null},
        ${data.longitude ?? null}, ${data.excursionM ?? null},
        ${data.reportedBy || null}
      ) RETURNING *
    `);
    res.status(201).json(getFirstRow(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    res.status(500).json({ error: "Failed to create DP incident" });
  }
});

router.post("/daily-checks", requireOrgId, async (req: Request, res: Response) => {
  try {
    const data = dailyCheckSchema.parse(req.body);
    const result = await db.execute(sql`
      INSERT INTO dp_daily_checks (
        org_id, vessel_id, check_date, watch_period, checklist,
        overall_status, dpo_name, dpo_rank, notes
      ) VALUES (
        ${getOrgId(req)}, ${data.vesselId}, ${new Date(data.checkDate)},
        ${data.watchPeriod || null}, ${JSON.stringify(data.checklist)},
        ${data.overallStatus}, ${data.dpoName}, ${data.dpoRank || null},
        ${data.notes || null}
      ) RETURNING *
    `);
    res.status(201).json(getFirstRow(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    res.status(500).json({ error: "Failed to create DP check" });
  }
});

router.get("/daily-checks", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId, from, to } = req.query;
    if (!vesselId) {
      return res.status(400).json({ error: "vesselId required" });
    }
    const fromDate = from
      ? new Date(from as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();
    const result = await db.execute(sql`
      SELECT * FROM dp_daily_checks
      WHERE org_id = ${getOrgId(req)} AND vessel_id = ${vesselId as string}
        AND check_date >= ${fromDate} AND check_date <= ${toDate}
      ORDER BY check_date DESC, watch_period
    `);
    res.json(getRows(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to list DP checks" });
  }
});

router.get("/summary", requireOrgId, async (req: Request, res: Response) => {
  try {
    const oid = getOrgId(req);

    const systemsResult = await db.execute(sql`
      SELECT ds.vessel_id, ds.dp_class, ds.dp_status, ds.next_dp_trial_due,
             v.name as vessel_name
      FROM dp_systems ds
      LEFT JOIN vessels v ON ds.vessel_id = v.id
      WHERE ds.org_id = ${oid}
    `);
    const systems = getRows(systemsResult);

    const incidentsResult = await db.execute(sql`
      SELECT severity, COUNT(*) as count
      FROM dp_incidents
      WHERE org_id = ${oid} AND incident_date >= NOW() - INTERVAL '90 days'
      GROUP BY severity
    `);
    const incidents = getRows(incidentsResult);

    const openIncidents = await db.execute(sql`
      SELECT COUNT(*) as count FROM dp_incidents
      WHERE org_id = ${oid} AND status = 'open'
    `);

    res.json({
      vessels: systems,
      totalVesselsWithDp: systems.length,
      operational: (systems as any[]).filter((s: any) => s.dp_status === "operational").length,
      degraded: (systems as any[]).filter((s: any) => s.dp_status === "degraded").length,
      trialsDueIn90Days: (systems as any[]).filter((s: any) => {
        if (!s.next_dp_trial_due) {
          return false;
        }
        const due = new Date(s.next_dp_trial_due);
        return due <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      }).length,
      incidents90Days: incidents,
      openIncidents: Number(getFirstRow(openIncidents)?.count || 0),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get DP summary" });
  }
});

export { router as dpRouter };
