import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { requireOrgId, type AuthenticatedRequest } from "../../middleware/auth";

const MODULE = "offshore-ops";
const router = Router();

function getOrgId(req: Request): string {
  return (req as AuthenticatedRequest).orgId as string;
}

function getRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const r = result as { rows?: Record<string, unknown>[] } | null | undefined;
  return r?.rows ?? [];
}

function getFirstRow(result: unknown): Record<string, unknown> | undefined {
  return getRows(result)[0];
}

const OP_TYPES = [
  "cargo_transfer",
  "anchor_handling",
  "towing",
  "spm_operations",
  "dive_support",
  "rov_operations",
  "standby_duty",
  "personnel_transfer",
  "bunkering",
  "dp_operations",
] as const;

const createOpSchema = z.object({
  vesselId: z.string().min(1),
  operationType: z.enum(OP_TYPES),
  operationRef: z.string().optional(),
  startTime: z.string(),
  endTime: z.string().optional(),
  locationName: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  waterDepthM: z.number().optional(),
  windSpeedKts: z.number().optional(),
  windDirection: z.string().optional(),
  waveHeightM: z.number().optional(),
  visibilityNm: z.number().optional(),
  seaState: z.enum(["calm", "slight", "moderate", "rough", "very_rough"]).optional(),
  cargoDetails: z
    .object({
      items: z
        .array(
          z.object({
            description: z.string(),
            quantity: z.number().optional(),
            unit: z.string().optional(),
            weightMt: z.number().optional(),
          })
        )
        .optional(),
      totalWeightMt: z.number().optional(),
      deckAreaM2: z.number().optional(),
    })
    .optional(),
  fuelConsumedMt: z.number().optional(),
  officerInCharge: z.string().min(1),
  officerRank: z.string().optional(),
  toolboxTalkDone: z.boolean().default(false),
  jsaCompleted: z.boolean().default(false),
  permitToWork: z.string().optional(),
  clientRepresentative: z.string().optional(),
  clientSignedOff: z.boolean().default(false),
  notes: z.string().optional(),
});

router.get("/", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId, type, from, to } = req.query;
    const fromDate = from
      ? new Date(from as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const defaultTo = new Date();
    defaultTo.setHours(23, 59, 59, 999);
    const toDate = to ? new Date(to as string) : defaultTo;

    let q = sql`
      SELECT oo.*, v.name as vessel_name
      FROM offshore_operations oo
      LEFT JOIN vessels v ON oo.vessel_id = v.id
      WHERE oo.org_id = ${getOrgId(req)}
        AND oo.start_time >= ${fromDate} AND oo.start_time <= ${toDate}
    `;
    if (vesselId) {
      q = sql`${q} AND oo.vessel_id = ${vesselId as string}`;
    }
    if (type) {
      q = sql`${q} AND oo.operation_type = ${type as string}`;
    }
    q = sql`${q} ORDER BY oo.start_time DESC LIMIT 200`;

    const result = await db.execute(q);
    return res.json(getRows(result));
  } catch (err) {
    return res.status(500).json({ error: "Failed to list operations" });
  }
});

router.post("/", requireOrgId, async (req: Request, res: Response) => {
  try {
    const data = createOpSchema.parse(req.body);
    const endTime = data.endTime ? new Date(data.endTime) : null;
    const startTime = new Date(data.startTime);
    const durationHours = endTime
      ? (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
      : null;

    const result = await db.execute(sql`
      INSERT INTO offshore_operations (
        org_id, vessel_id, operation_type, operation_ref,
        start_time, end_time, duration_hours,
        location_name, latitude, longitude, water_depth_m,
        wind_speed_kts, wind_direction, wave_height_m, visibility_nm, sea_state,
        cargo_details, fuel_consumed_mt,
        officer_in_charge, officer_rank,
        toolbox_talk_done, jsa_completed, permit_to_work,
        client_representative, client_signed_off,
        status, notes
      ) VALUES (
        ${getOrgId(req)}, ${data.vesselId}, ${data.operationType},
        ${data.operationRef || null},
        ${startTime}, ${endTime}, ${durationHours},
        ${data.locationName || null}, ${data.latitude ?? null},
        ${data.longitude ?? null}, ${data.waterDepthM ?? null},
        ${data.windSpeedKts ?? null}, ${data.windDirection || null},
        ${data.waveHeightM ?? null}, ${data.visibilityNm ?? null},
        ${data.seaState || null},
        ${data.cargoDetails ? JSON.stringify(data.cargoDetails) : null},
        ${data.fuelConsumedMt ?? null},
        ${data.officerInCharge}, ${data.officerRank || null},
        ${data.toolboxTalkDone}, ${data.jsaCompleted},
        ${data.permitToWork || null},
        ${data.clientRepresentative || null}, ${data.clientSignedOff},
        ${endTime ? "completed" : "in_progress"}, ${data.notes || null}
      ) RETURNING *
    `);

    return res.status(201).json(getFirstRow(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    return res.status(500).json({ error: "Failed to create operation" });
  }
});

router.patch("/:id/complete", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { endTime, fuelConsumedMt, clientSignedOff, notes } = z
      .object({
        endTime: z.string(),
        fuelConsumedMt: z.number().optional(),
        clientSignedOff: z.boolean().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const result = await db.execute(sql`
      UPDATE offshore_operations SET
        end_time = ${new Date(endTime)},
        duration_hours = EXTRACT(EPOCH FROM (${new Date(endTime)}::timestamptz - start_time)) / 3600,
        fuel_consumed_mt = COALESCE(${fuelConsumedMt ?? null}, fuel_consumed_mt),
        client_signed_off = COALESCE(${clientSignedOff ?? null}, client_signed_off),
        notes = COALESCE(${notes || null}, notes),
        status = 'completed',
        updated_at = NOW()
      WHERE id = ${req.params.id} AND org_id = ${getOrgId(req)}
      RETURNING *
    `);

    return res.json(getFirstRow(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    return res.status(500).json({ error: "Failed to complete operation" });
  }
});

router.get("/summary", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId, days } = req.query;
    if (!vesselId) {
      return res.status(400).json({ error: "vesselId required" });
    }
    const d = Number(days) || 30;
    const cutoff = new Date(Date.now() - d * 24 * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT
        operation_type,
        COUNT(*) as count,
        SUM(duration_hours) as total_hours,
        SUM(fuel_consumed_mt) as total_fuel_mt,
        COUNT(*) FILTER (WHERE toolbox_talk_done = true) as with_toolbox_talk,
        COUNT(*) FILTER (WHERE jsa_completed = true) as with_jsa,
        COUNT(*) FILTER (WHERE client_signed_off = true) as client_signed
      FROM offshore_operations
      WHERE org_id = ${getOrgId(req)} AND vessel_id = ${vesselId as string}
        AND start_time >= ${cutoff} AND status = 'completed'
      GROUP BY operation_type
      ORDER BY count DESC
    `);

    const ops = getRows(result);

    return res.json({
      vesselId,
      period: { days: d, from: cutoff, to: new Date() },
      totalOperations: ops.reduce((s, o) => s + Number(o.count), 0),
      totalHours: ops.reduce((s, o) => s + Number(o.total_hours || 0), 0),
      totalFuelMt: ops.reduce((s, o) => s + Number(o.total_fuel_mt || 0), 0),
      safetyCompliance: {
        toolboxTalkRate:
          (ops.reduce((s, o) => s + Number(o.with_toolbox_talk), 0) /
            Math.max(
              1,
              ops.reduce((s, o) => s + Number(o.count), 0)
            )) *
          100,
        jsaRate:
          (ops.reduce((s, o) => s + Number(o.with_jsa), 0) /
            Math.max(
              1,
              ops.reduce((s, o) => s + Number(o.count), 0)
            )) *
          100,
      },
      byType: ops,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to get operations summary" });
  }
});

export { router as offshoreOpsRouter };
