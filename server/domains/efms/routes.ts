import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { requireOrgId, type AuthenticatedRequest } from "../../middleware/auth";
import { logger } from "../../utils/logger";

const MODULE = "efms";
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

const registerMapSchema = z.record(
  z.string(),
  z.object({
    register: z.number().int(),
    type: z.enum(["float32", "uint16", "int16", "uint32", "int32"]),
    unit: z.string(),
    scaling: z.number().default(1.0),
  })
);

const createConnectionSchema = z.object({
  vesselId: z.string().min(1),
  equipmentId: z.string().optional(),
  efmsMake: z.string().optional(),
  efmsModel: z.string().optional(),
  protocol: z
    .enum(["modbus_tcp", "modbus_rtu", "nmea0183", "canbus", "csv_polling"])
    .default("modbus_tcp"),
  host: z.string().optional(),
  port: z.number().int().optional(),
  slaveId: z.number().int().default(1),
  registerMap: registerMapSchema.optional(),
  pollIntervalMs: z.number().int().min(1000).default(5000),
});

const updateConnectionSchema = z.object({
  efmsMake: z.string().optional(),
  efmsModel: z.string().optional(),
  protocol: z.enum(["modbus_tcp", "modbus_rtu", "nmea0183", "canbus", "csv_polling"]).optional(),
  host: z.string().optional(),
  port: z.number().int().optional(),
  slaveId: z.number().int().optional(),
  registerMap: registerMapSchema.optional(),
  pollIntervalMs: z.number().int().min(1000).optional(),
  status: z.enum(["configured", "connected", "polling", "error", "disabled"]).optional(),
});

router.get("/connections", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId, status } = req.query;
    let q = sql`
      SELECT ec.*, v.name as vessel_name, e.name as equipment_name
      FROM efms_connections ec
      LEFT JOIN vessels v ON ec.vessel_id = v.id
      LEFT JOIN equipment e ON ec.equipment_id = e.id
      WHERE ec.org_id = ${getOrgId(req)}
    `;
    if (vesselId) {
      q = sql`${q} AND ec.vessel_id = ${vesselId as string}`;
    }
    if (status) {
      q = sql`${q} AND ec.status = ${status as string}`;
    }
    q = sql`${q} ORDER BY v.name, e.name`;
    const result = await db.execute(q);
    return res.json(getRows(result));
  } catch (err) {
    logger.error(MODULE, "Error listing EFMS connections", { error: err });
    return res.status(500).json({ error: "Failed to list EFMS connections" });
  }
});

router.get("/connections/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT ec.*, v.name as vessel_name, e.name as equipment_name
      FROM efms_connections ec
      LEFT JOIN vessels v ON ec.vessel_id = v.id
      LEFT JOIN equipment e ON ec.equipment_id = e.id
      WHERE ec.id = ${req.params['id']} AND ec.org_id = ${getOrgId(req)}
    `);
    const conn = getFirstRow(result);
    if (!conn) {
      return res.status(404).json({ error: "EFMS connection not found" });
    }
    return res.json(conn);
  } catch (err) {
    return res.status(500).json({ error: "Failed to get EFMS connection" });
  }
});

router.post("/connections", requireOrgId, async (req: Request, res: Response) => {
  try {
    const data = createConnectionSchema.parse(req.body);
    const result = await db.execute(sql`
      INSERT INTO efms_connections (
        org_id, vessel_id, equipment_id, efms_make, efms_model,
        protocol, host, port, slave_id, register_map, poll_interval_ms
      ) VALUES (
        ${getOrgId(req)}, ${data.vesselId}, ${data.equipmentId || null},
        ${data.efmsMake || null}, ${data.efmsModel || null},
        ${data.protocol}, ${data.host || null}, ${data.port ?? null},
        ${data.slaveId}, ${JSON.stringify(data.registerMap || {})},
        ${data.pollIntervalMs}
      ) RETURNING *
    `);
    logger.info(MODULE, "EFMS connection created", {
      vesselId: data.vesselId,
      protocol: data.protocol,
    });
    return res.status(201).json(getFirstRow(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    logger.error(MODULE, "Error creating EFMS connection", { error: err });
    return res.status(500).json({ error: "Failed to create EFMS connection" });
  }
});

router.patch("/connections/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const data = updateConnectionSchema.parse(req.body);

    const existing = await db.execute(sql`
      SELECT id FROM efms_connections WHERE id = ${req.params['id']} AND org_id = ${getOrgId(req)}
    `);
    if (!getFirstRow(existing)) {
      return res.status(404).json({ error: "EFMS connection not found" });
    }

    const setClauses: string[] = [];
    const result = await db.execute(sql`
      UPDATE efms_connections SET
        efms_make = COALESCE(${data.efmsMake ?? null}, efms_make),
        efms_model = COALESCE(${data.efmsModel ?? null}, efms_model),
        protocol = COALESCE(${data.protocol ?? null}, protocol),
        host = COALESCE(${data.host ?? null}, host),
        port = COALESCE(${data.port ?? null}, port),
        slave_id = COALESCE(${data.slaveId ?? null}, slave_id),
        register_map = COALESCE(${data.registerMap ? JSON.stringify(data.registerMap) : null}, register_map),
        poll_interval_ms = COALESCE(${data.pollIntervalMs ?? null}, poll_interval_ms),
        status = COALESCE(${data.status ?? null}, status),
        updated_at = NOW()
      WHERE id = ${req.params['id']} AND org_id = ${getOrgId(req)}
      RETURNING *
    `);

    return res.json(getFirstRow(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    return res.status(500).json({ error: "Failed to update EFMS connection" });
  }
});

router.delete("/connections/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      DELETE FROM efms_connections
      WHERE id = ${req.params['id']} AND org_id = ${getOrgId(req)}
      RETURNING id
    `);
    const deleted = getFirstRow(result);
    if (!deleted) {
      return res.status(404).json({ error: "EFMS connection not found" });
    }
    return res.json({ success: true, deletedId: deleted['id'] });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete EFMS connection" });
  }
});

router.get("/status", requireOrgId, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        ec.id, ec.vessel_id, ec.equipment_id, ec.protocol,
        ec.host, ec.port, ec.status, ec.last_reading_at, ec.error_message,
        v.name as vessel_name, e.name as equipment_name
      FROM efms_connections ec
      LEFT JOIN vessels v ON ec.vessel_id = v.id
      LEFT JOIN equipment e ON ec.equipment_id = e.id
      WHERE ec.org_id = ${getOrgId(req)}
      ORDER BY ec.status, v.name
    `);

    const connections = getRows(result);

    return res.json({
      totalConnections: connections.length,
      polling: connections.filter((c) => c['status'] === "polling").length,
      connected: connections.filter((c) => c['status'] === "connected").length,
      configured: connections.filter((c) => c['status'] === "configured").length,
      error: connections.filter((c) => c['status'] === "error").length,
      disabled: connections.filter((c) => c['status'] === "disabled").length,
      connections,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to get EFMS status" });
  }
});

export { router as efmsRouter };
