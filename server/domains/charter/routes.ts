import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { requireOrgId, type AuthenticatedRequest } from "../../middleware/auth";
import { logger } from "../../utils/logger";

const MODULE = "charter-compliance";
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

const createCharterSchema = z.object({
  vesselId: z.string().min(1),
  charterRef: z.string().min(1),
  chartererName: z.string().min(1),
  charterType: z
    .enum(["time_charter", "voyage_charter", "bareboat", "spot"])
    .default("time_charter"),
  commencementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dailyRate: z.number().optional(),
  currency: z.string().default("USD"),
  targetAvailabilityPct: z.number().min(0).max(100).default(95),
  targetResponseHours: z.number().optional(),
  targetFuelConsumption: z.number().optional(),
  targetDpUptimePct: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const kpiSchema = z.object({
  charterId: z.string().min(1),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodType: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  availabilityPct: z.number().min(0).max(100).optional(),
  offHireHours: z.number().min(0).optional(),
  offHireReason: z.string().optional(),
  responseTimeHours: z.number().optional(),
  fuelConsumptionMt: z.number().optional(),
  dpUptimePct: z.number().min(0).max(100).optional(),
  distanceNm: z.number().optional(),
  runningHours: z.number().optional(),
  notes: z.string().optional(),
  source: z.enum(["manual", "telemetry", "noon_report"]).default("manual"),
});

router.get("/", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId, status, charterer } = req.query;
    let q = sql`
      SELECT cp.*, v.name as vessel_name
      FROM charter_parties cp
      LEFT JOIN vessels v ON cp.vessel_id = v.id
      WHERE cp.org_id = ${getOrgId(req)}
    `;
    if (vesselId) {
      q = sql`${q} AND cp.vessel_id = ${vesselId as string}`;
    }
    if (status) {
      q = sql`${q} AND cp.status = ${status as string}`;
    }
    if (charterer) {
      q = sql`${q} AND LOWER(cp.charterer_name) LIKE LOWER(${`%${charterer}%`})`;
    }
    q = sql`${q} ORDER BY cp.commencement_date DESC`;
    const result = await db.execute(q);
    res.json(getRows(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to list charters" });
  }
});

router.post("/", requireOrgId, async (req: Request, res: Response) => {
  try {
    const data = createCharterSchema.parse(req.body);
    const result = await db.execute(sql`
      INSERT INTO charter_parties (
        org_id, vessel_id, charter_ref, charterer_name, charter_type,
        commencement_date, expiry_date, daily_rate, currency,
        target_availability_pct, target_response_hours,
        target_fuel_consumption, target_dp_uptime_pct, notes
      ) VALUES (
        ${getOrgId(req)}, ${data.vesselId}, ${data.charterRef},
        ${data.chartererName}, ${data.charterType},
        ${new Date(data.commencementDate)},
        ${data.expiryDate ? new Date(data.expiryDate) : null},
        ${data.dailyRate ?? null}, ${data.currency},
        ${data.targetAvailabilityPct}, ${data.targetResponseHours ?? null},
        ${data.targetFuelConsumption ?? null}, ${data.targetDpUptimePct ?? null},
        ${data.notes || null}
      ) RETURNING *
    `);

    const charter = getFirstRow(result);
    await db.execute(sql`
      UPDATE vessels SET charter_status = 'on_charter',
        current_charter_id = ${charter?.id}
      WHERE id = ${data.vesselId} AND org_id = ${getOrgId(req)}
    `);

    res.status(201).json(charter);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    logger.error(MODULE, "Error creating charter", { error: err });
    res.status(500).json({ error: "Failed to create charter" });
  }
});

router.post("/kpi", requireOrgId, async (req: Request, res: Response) => {
  try {
    const data = kpiSchema.parse(req.body);

    const charterResult = await db.execute(sql`
      SELECT * FROM charter_parties WHERE id = ${data.charterId} AND org_id = ${getOrgId(req)}
    `);
    const charter = getFirstRow(charterResult);
    if (!charter) {
      return res.status(404).json({ error: "Charter not found" });
    }

    const c = charter as any;
    const availCompliant =
      data.availabilityPct != null
        ? data.availabilityPct >= (c.target_availability_pct || 0)
        : null;
    const fuelCompliant =
      data.fuelConsumptionMt != null && c.target_fuel_consumption
        ? data.fuelConsumptionMt <= c.target_fuel_consumption
        : null;
    const dpCompliant =
      data.dpUptimePct != null && c.target_dp_uptime_pct
        ? data.dpUptimePct >= c.target_dp_uptime_pct
        : null;

    const result = await db.execute(sql`
      INSERT INTO charter_kpi_logs (
        org_id, vessel_id, charter_id, period_start, period_end, period_type,
        availability_pct, off_hire_hours, off_hire_reason,
        response_time_hours, fuel_consumption_mt, dp_uptime_pct,
        distance_nm, running_hours,
        availability_compliant, fuel_compliant, dp_compliant,
        notes, source
      ) VALUES (
        ${getOrgId(req)}, ${c.vessel_id}, ${data.charterId},
        ${new Date(data.periodStart)}, ${new Date(data.periodEnd)}, ${data.periodType},
        ${data.availabilityPct ?? null}, ${data.offHireHours ?? 0},
        ${data.offHireReason || null}, ${data.responseTimeHours ?? null},
        ${data.fuelConsumptionMt ?? null}, ${data.dpUptimePct ?? null},
        ${data.distanceNm ?? null}, ${data.runningHours ?? null},
        ${availCompliant}, ${fuelCompliant}, ${dpCompliant},
        ${data.notes || null}, ${data.source}
      )
      ON CONFLICT (charter_id, period_start, period_type) DO UPDATE SET
        availability_pct = EXCLUDED.availability_pct,
        off_hire_hours = EXCLUDED.off_hire_hours,
        fuel_consumption_mt = EXCLUDED.fuel_consumption_mt,
        dp_uptime_pct = EXCLUDED.dp_uptime_pct,
        availability_compliant = EXCLUDED.availability_compliant,
        fuel_compliant = EXCLUDED.fuel_compliant,
        dp_compliant = EXCLUDED.dp_compliant,
        notes = EXCLUDED.notes
      RETURNING *
    `);

    res.status(201).json(getFirstRow(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    res.status(500).json({ error: "Failed to log KPI" });
  }
});

router.get("/:charterId/performance", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { charterId } = req.params;
    const days = Number(req.query.days) || 30;

    const charterResult = await db.execute(sql`
      SELECT cp.*, v.name as vessel_name
      FROM charter_parties cp LEFT JOIN vessels v ON cp.vessel_id = v.id
      WHERE cp.id = ${charterId} AND cp.org_id = ${getOrgId(req)}
    `);
    const charter = getFirstRow(charterResult);
    if (!charter) {
      return res.status(404).json({ error: "Charter not found" });
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const kpiResult = await db.execute(sql`
      SELECT * FROM charter_kpi_logs
      WHERE charter_id = ${charterId} AND org_id = ${getOrgId(req)}
        AND period_start >= ${cutoff}
      ORDER BY period_start ASC
    `);
    const kpis = getRows(kpiResult) as any[];
    const c = charter as any;

    const totalDays = kpis.length;
    const avgAvailability =
      totalDays > 0 ? kpis.reduce((s, k) => s + (k.availability_pct || 0), 0) / totalDays : null;
    const totalOffHire = kpis.reduce((s, k) => s + (k.off_hire_hours || 0), 0);
    const avgFuel =
      totalDays > 0 ? kpis.reduce((s, k) => s + (k.fuel_consumption_mt || 0), 0) / totalDays : null;
    const dpEntries = kpis.filter((k) => k.dp_uptime_pct != null);
    const avgDpUptime =
      dpEntries.length > 0
        ? dpEntries.reduce((s, k) => s + k.dp_uptime_pct, 0) / dpEntries.length
        : null;

    res.json({
      charter,
      period: { days, from: cutoff, to: new Date() },
      kpiSummary: {
        avgAvailability,
        targetAvailability: c.target_availability_pct,
        availabilityMet:
          avgAvailability != null ? avgAvailability >= (c.target_availability_pct || 0) : null,
        totalOffHireHours: totalOffHire,
        avgDailyFuelMt: avgFuel,
        targetDailyFuelMt: c.target_fuel_consumption,
        fuelMet:
          avgFuel != null && c.target_fuel_consumption
            ? avgFuel <= c.target_fuel_consumption
            : null,
        avgDpUptime,
        targetDpUptime: c.target_dp_uptime_pct,
        dpMet:
          avgDpUptime != null && c.target_dp_uptime_pct
            ? avgDpUptime >= c.target_dp_uptime_pct
            : null,
      },
      daysNonCompliant: {
        availability: kpis.filter((k) => k.availability_compliant === false).length,
        fuel: kpis.filter((k) => k.fuel_compliant === false).length,
        dp: kpis.filter((k) => k.dp_compliant === false).length,
      },
      totalDataPoints: totalDays,
      dailyKpis: kpis,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get charter performance" });
  }
});

router.get("/fleet-overview", requireOrgId, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        cp.id, cp.charter_ref, cp.charterer_name, cp.status,
        cp.commencement_date, cp.expiry_date,
        cp.target_availability_pct, cp.daily_rate, cp.currency,
        v.name as vessel_name, v.dp_class,
        (
          SELECT AVG(k.availability_pct)
          FROM charter_kpi_logs k
          WHERE k.charter_id = cp.id AND k.period_start >= NOW() - INTERVAL '30 days'
        ) as avg_availability_30d,
        (
          SELECT SUM(k.off_hire_hours)
          FROM charter_kpi_logs k
          WHERE k.charter_id = cp.id AND k.period_start >= NOW() - INTERVAL '30 days'
        ) as total_off_hire_30d
      FROM charter_parties cp
      LEFT JOIN vessels v ON cp.vessel_id = v.id
      WHERE cp.org_id = ${getOrgId(req)} AND cp.status = 'active'
      ORDER BY v.name
    `);

    const charters = getRows(result) as any[];

    res.json({
      activeCharters: charters.length,
      charters: charters.map((c) => ({
        ...c,
        availabilityCompliant:
          c.avg_availability_30d != null
            ? c.avg_availability_30d >= (c.target_availability_pct || 0)
            : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get fleet charter overview" });
  }
});

export { router as charterRouter };
