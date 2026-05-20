/**
 * Task #82 — Admin-curated equipment dependency edges (blast-radius
 * reasoning surface).
 *
 * Routes (mounted at /api/v1, behind requireOrgId via registry):
 *   - GET    /vessels/:vesselId/equipment-dependencies         list
 *   - POST   /equipment-dependencies                            create (admin)
 *   - DELETE /equipment-dependencies/:id                        remove (admin)
 *   - POST   /vessels/:vesselId/equipment-dependencies/import-csv
 *                                                              bulk import (admin)
 *
 * Mutating routes are best-effort projected into the AGE graph via
 * `projectDependency` / `retractDependency` so the existing
 * `failurePropagation` query (used by the 3D viewer + Copilot) stays
 * in sync. Graph-disabled deployments are unaffected (projector is
 * a no-op).
 *
 * The relational table is the source of truth — if the projector is
 * unavailable the row still commits and a backfill brings the graph
 * back in line.
 */

import { Router, type Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  equipmentDependencies,
  equipmentDependencyLayouts,
  equipmentDependencyLayoutPositionsSchema,
  equipment,
  insertEquipmentDependencySchema,
  type EquipmentDependency,
  type EquipmentDependencyLayoutPositions,
} from "@shared/schema";
import { requireRole } from "../middleware/role-auth";
import type { AuthenticatedRequest } from "../middleware/auth";
import { createLogger } from "../lib/structured-logger";
import { projectDependency, retractDependency } from "../graph";

const logger = createLogger("Routes:EquipmentDependencies");

const router = Router();

const createBodySchema = insertEquipmentDependencySchema
  .omit({ orgId: true })
  .extend({
    notes: z.string().max(500).optional().nullable(),
  })
  .refine(
    (b) => b.upstreamEquipmentId !== b.downstreamEquipmentId,
    "upstream and downstream must differ"
  );

const csvRowSchema = z.object({
  upstreamEquipmentId: z.string().min(1),
  downstreamEquipmentId: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
});

const csvBodySchema = z.object({
  rows: z.array(csvRowSchema).min(1).max(1000),
});

/**
 * Confirm every referenced equipment id belongs to the caller's org
 * AND to the supplied vessel. Stops cross-org / cross-vessel writes
 * before they touch the database (RLS would also reject, but a
 * targeted 400 is friendlier than a generic 500).
 */
async function validateEquipmentBelongsToVessel(
  orgId: string,
  vesselId: string,
  equipmentIds: string[]
): Promise<{ ok: true } | { ok: false; missingIds: string[] }> {
  if (equipmentIds.length === 0) return { ok: true };
  const rows = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(
      and(
        eq(equipment.orgId, orgId),
        eq(equipment.vesselId, vesselId),
        inArray(equipment.id, equipmentIds)
      )
    );
  const found = new Set(rows.map((r) => r.id));
  const missing = equipmentIds.filter((id) => !found.has(id));
  return missing.length === 0 ? { ok: true } : { ok: false, missingIds: missing };
}

// ---------- GET list ----------
router.get(
  "/vessels/:vesselId/equipment-dependencies",
  async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { vesselId } = req.params;
    try {
      const rows: EquipmentDependency[] = await db
        .select()
        .from(equipmentDependencies)
        .where(
          and(
            eq(equipmentDependencies.orgId, authReq.orgId),
            eq(equipmentDependencies.vesselId, vesselId)
          )
        );
      res.json({ dependencies: rows });
    } catch (err) {
      logger.error("list failed", {
        details: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "Failed to load dependencies" });
    }
  }
);

// ---------- POST create ----------
router.post(
  "/equipment-dependencies",
  requireRole("admin", "chief_engineer"),
  async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;

    const check = await validateEquipmentBelongsToVessel(
      authReq.orgId,
      body.vesselId,
      [body.upstreamEquipmentId, body.downstreamEquipmentId]
    );
    if (!check.ok) {
      res.status(400).json({
        error: "Equipment not found in this vessel",
        missingIds: check.missingIds,
      });
      return;
    }

    try {
      const [row] = await db
        .insert(equipmentDependencies)
        .values({
          orgId: authReq.orgId,
          vesselId: body.vesselId,
          upstreamEquipmentId: body.upstreamEquipmentId,
          downstreamEquipmentId: body.downstreamEquipmentId,
          notes: body.notes ?? null,
        })
        .onConflictDoNothing({
          target: [
            equipmentDependencies.orgId,
            equipmentDependencies.upstreamEquipmentId,
            equipmentDependencies.downstreamEquipmentId,
          ],
        })
        .returning();

      if (!row) {
        res.status(409).json({ error: "Dependency already exists" });
        return;
      }

      // Best-effort graph projection — never blocks the relational write.
      void projectDependency(
        authReq.orgId,
        row.upstreamEquipmentId,
        row.downstreamEquipmentId
      );

      res.status(201).json({ dependency: row });
    } catch (err) {
      logger.error("create failed", {
        details: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "Failed to create dependency" });
    }
  }
);

// ---------- DELETE ----------
router.delete(
  "/equipment-dependencies/:id",
  requireRole("admin", "chief_engineer"),
  async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    try {
      const [removed] = await db
        .delete(equipmentDependencies)
        .where(
          and(
            eq(equipmentDependencies.orgId, authReq.orgId),
            eq(equipmentDependencies.id, id)
          )
        )
        .returning();

      if (!removed) {
        res.status(404).json({ error: "Dependency not found" });
        return;
      }

      void retractDependency(
        authReq.orgId,
        removed.upstreamEquipmentId,
        removed.downstreamEquipmentId
      );

      res.json({ ok: true });
    } catch (err) {
      logger.error("delete failed", {
        details: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "Failed to delete dependency" });
    }
  }
);

// ---------- POST CSV bulk import ----------
router.post(
  "/vessels/:vesselId/equipment-dependencies/import-csv",
  requireRole("admin", "chief_engineer"),
  async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { vesselId } = req.params;

    const parsed = csvBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const rows = parsed.data.rows;

    // Reject self-loops up front so the SQL never sees them.
    const selfLoops = rows.filter(
      (r) => r.upstreamEquipmentId === r.downstreamEquipmentId
    );
    if (selfLoops.length > 0) {
      res.status(400).json({
        error: "Self-loops are not allowed",
        offending: selfLoops.map((r) => r.upstreamEquipmentId),
      });
      return;
    }

    const allEquipmentIds = Array.from(
      new Set(rows.flatMap((r) => [r.upstreamEquipmentId, r.downstreamEquipmentId]))
    );
    const check = await validateEquipmentBelongsToVessel(
      authReq.orgId,
      vesselId,
      allEquipmentIds
    );
    if (!check.ok) {
      res.status(400).json({
        error: "Some equipment ids are not in this vessel",
        missingIds: check.missingIds,
      });
      return;
    }

    try {
      const inserted = await db
        .insert(equipmentDependencies)
        .values(
          rows.map((r) => ({
            orgId: authReq.orgId,
            vesselId,
            upstreamEquipmentId: r.upstreamEquipmentId,
            downstreamEquipmentId: r.downstreamEquipmentId,
            notes: r.notes ?? null,
          }))
        )
        .onConflictDoNothing({
          target: [
            equipmentDependencies.orgId,
            equipmentDependencies.upstreamEquipmentId,
            equipmentDependencies.downstreamEquipmentId,
          ],
        })
        .returning();

      for (const row of inserted) {
        void projectDependency(
          authReq.orgId,
          row.upstreamEquipmentId,
          row.downstreamEquipmentId
        );
      }

      res.json({
        ok: true,
        inserted: inserted.length,
        skipped: rows.length - inserted.length,
      });
    } catch (err) {
      logger.error("import failed", {
        details: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "Failed to import dependencies" });
    }
  }
);

// ---------- GET layout (per-user) ----------
router.get(
  "/vessels/:vesselId/equipment-dependency-layout",
  async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { vesselId } = req.params;
    try {
      const [row] = await db
        .select()
        .from(equipmentDependencyLayouts)
        .where(
          and(
            eq(equipmentDependencyLayouts.orgId, authReq.orgId),
            eq(equipmentDependencyLayouts.userId, userId),
            eq(equipmentDependencyLayouts.vesselId, vesselId)
          )
        );
      const positions: EquipmentDependencyLayoutPositions =
        row?.positions ?? {};
      res.json({ positions });
    } catch (err) {
      logger.error("layout load failed", {
        details: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "Failed to load layout" });
    }
  }
);

// ---------- PUT layout (per-user upsert) ----------
const layoutBodySchema = z.object({
  positions: equipmentDependencyLayoutPositionsSchema,
});

router.put(
  "/vessels/:vesselId/equipment-dependency-layout",
  requireRole("admin", "chief_engineer"),
  async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { vesselId } = req.params;

    const parsed = layoutBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const { positions } = parsed.data;

    // Cap the payload defensively — one row per equipment, and this
    // table is per-user-per-vessel so the realistic ceiling is the
    // vessel's equipment count. 5k keys is generous and stops a
    // pathological client from ballooning the JSONB row.
    if (Object.keys(positions).length > 5000) {
      res.status(400).json({ error: "Too many positions (max 5000)" });
      return;
    }

    try {
      const [row] = await db
        .insert(equipmentDependencyLayouts)
        .values({
          orgId: authReq.orgId,
          userId,
          vesselId,
          positions,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            equipmentDependencyLayouts.orgId,
            equipmentDependencyLayouts.userId,
            equipmentDependencyLayouts.vesselId,
          ],
          set: { positions, updatedAt: new Date() },
        })
        .returning();
      res.json({ ok: true, positions: row?.positions ?? positions });
    } catch (err) {
      logger.error("layout save failed", {
        details: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "Failed to save layout" });
    }
  }
);

export { router as equipmentDependenciesRouter };
