/**
 * Task #80 — Cross-vessel failure patterns surface.
 *
 * For an equipment item on vessel V (class C), surface the top
 * failure modes seen on peer equipment of the same `type` installed
 * on other vessels of the same class within the caller's org. The
 * query is org-isolated by both the per-tenant graph AND the
 * RLS-protected SQL used to compute the peer-vessel id list — zero
 * cross-tenant rows by construction.
 *
 * Routes (mounted at /api/v1, behind requireOrgId via registry):
 *   - GET /equipment/:id/cross-class-patterns
 *       → { vesselClass, equipmentType, peerVesselCount, patterns: [...] }
 *   - GET /equipment/:id/cross-class-patterns/:failureMode/parts
 *       → { failureMode, parts: [...] }
 *
 * Read-only. No mutation, no admin gate — same visibility as the
 * existing PdM equipment detail view that hosts the panel.
 */

import { Router, type Response } from "express";
import { generalApiRateLimit } from "../middleware/rate-limiters";
import {
  findFocalEquipment,
  findVesselClass,
  findPeerVesselIds,
  equipmentExistsInOrg,
} from "../db/equipment/cross-class-queries";
import { authenticatedRequest } from "../middleware/auth";
import { createLogger } from "../lib/structured-logger";
import { crossClassPatterns, whatPartsForFailureMode, isGraphAvailable } from "../graph";

const logger = createLogger("Routes:EquipmentCrossClass");

const router = Router();

// Rate-limit every handler on this router (CWE-770). No-op in tests/dev relax.
router.use(generalApiRateLimit);

// ---------- GET cross-class patterns ----------
router.get("/equipment/:id/cross-class-patterns", async (req, res: Response) => {
  const authReq = authenticatedRequest(req);
  const { id } = req.params;

  try {
    // 1) Look up the focal equipment (RLS-scoped via orgId).
    const eq0 = await findFocalEquipment(authReq.orgId, id ?? "");

    if (!eq0) {
      res.status(404).json({ error: "Equipment not found" });
      return;
    }
    if (!eq0.vesselId) {
      res.json({
        vesselClass: null,
        equipmentType: eq0.type,
        peerVesselCount: 0,
        patterns: [],
        reason: "equipment_not_assigned_to_vessel",
      });
      return;
    }

    // 2) Get the focal vessel's class.
    const vessel = await findVesselClass(authReq.orgId, eq0.vesselId);

    if (!vessel || !vessel.vesselClass) {
      res.json({
        vesselClass: vessel?.vesselClass ?? null,
        equipmentType: eq0.type,
        peerVesselCount: 0,
        patterns: [],
        reason: "vessel_class_not_set",
      });
      return;
    }

    // 3) Peer vessels of the same class, same org, NOT the focal
    //    vessel. RLS keeps this org-bounded; the explicit orgId +
    //    `ne(id)` keeps cross-tenant and self-vessel rows out.
    const peerVesselIds = await findPeerVesselIds(authReq.orgId, vessel.vesselClass, vessel.id);

    if (!isGraphAvailable() || peerVesselIds.length === 0) {
      res.json({
        vesselClass: vessel.vesselClass,
        equipmentType: eq0.type,
        peerVesselCount: peerVesselIds.length,
        patterns: [],
      });
      return;
    }

    // 4) Graph query — restricted to the peer-vessel id list.
    const patterns = await crossClassPatterns(authReq.orgId, peerVesselIds, eq0.type);

    res.json({
      vesselClass: vessel.vesselClass,
      equipmentType: eq0.type,
      peerVesselCount: peerVesselIds.length,
      patterns,
    });
  } catch (err) {
    logger.error("cross-class-patterns failed", {
      equipmentId: id,
      details: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Failed to load cross-class patterns" });
  }
});

// ---------- GET parts drill-down for a failure mode ----------
router.get("/equipment/:id/cross-class-patterns/:failureMode/parts", async (req, res: Response) => {
  const authReq = authenticatedRequest(req);
  const { id, failureMode } = req.params;

  try {
    // Confirm the focal equipment is in the caller's org before
    // we expose any graph rows. The graph itself is org-isolated,
    // but a 404 here gives a clean contract.
    const exists = await equipmentExistsInOrg(authReq.orgId, id ?? "");

    if (!exists) {
      res.status(404).json({ error: "Equipment not found" });
      return;
    }

    if (!isGraphAvailable()) {
      res.json({ failureMode, parts: [] });
      return;
    }

    const parts = await whatPartsForFailureMode(authReq.orgId, failureMode);
    res.json({ failureMode, parts });
  } catch (err) {
    logger.error("cross-class parts drill-down failed", {
      equipmentId: id,
      failureMode,
      details: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Failed to load parts" });
  }
});

export { router as equipmentCrossClassRouter };
