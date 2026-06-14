import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticatedRequest, requireOrgId } from "../../../middleware/auth";
import { logger } from "../../../utils/logger";
import { logbookCorrectionService, OriginalEntryNotFoundError } from "../application";
import type { CorrectionActor } from "../domain/types";

const router = Router();

function getOrgId(req: Request): string {
  return authenticatedRequest(req).orgId as string;
}

function getUser(req: Request): CorrectionActor {
  const user = authenticatedRequest(req).user as
    | { id?: string; name?: string; displayName?: string; rank?: string; role?: string }
    | undefined;
  return {
    id: user?.id || "unknown",
    name: user?.name || user?.displayName || "Unknown",
    rank: user?.rank || user?.role || "Unknown",
  };
}

const correctionSchema = z.object({
  originalEntryId: z.string().min(1),
  correctedFields: z.record(z.unknown()),
  reason: z.string().min(10, "Correction reason must be at least 10 characters"),
});

router.post("/corrections", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const user = getUser(req);
    const data = correctionSchema.parse(req.body);

    const correctionEntry = await logbookCorrectionService.createCorrection(orgId, data, user, {
      ipAddress: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
    });

    logger.info("LogbookCorrections", "Logbook correction created", {
      orgId,
      originalId: data.originalEntryId,
      correctionId: correctionEntry?.["id"],
      reason: data.reason.substring(0, 100),
      user: user.name,
    });

    return res.status(201).json({
      correction: correctionEntry,
      originalMarked: true,
      auditLogged: true,
    });
  } catch (err) {
    if (err instanceof OriginalEntryNotFoundError) {
      return res.status(404).json({ error: "Original log entry not found" });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    logger.error("LogbookCorrections", "Error creating correction", err);
    return res.status(500).json({ error: "Failed to create correction" });
  }
});

router.get("/:entryId/corrections", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const entryId = req.params["entryId"] ?? "";
    const corrections = await logbookCorrectionService.listCorrectionsFor(orgId, entryId);
    return res.json(corrections);
  } catch (err) {
    logger.error("LogbookCorrections", "Error listing corrections", err);
    return res.status(500).json({ error: "Failed to list corrections" });
  }
});

router.get("/:entryId/audit", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const entryId = req.params["entryId"] ?? "";
    const audit = await logbookCorrectionService.getAuditTrail(orgId, entryId);
    return res.json(audit);
  } catch (err) {
    logger.error("LogbookCorrections", "Error fetching audit trail", err);
    return res.status(500).json({ error: "Failed to fetch audit trail" });
  }
});

router.get("/psc-view", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { vesselId, logType, from, to } = req.query;

    if (!vesselId) {
      return res.status(400).json({ error: "vesselId is required" });
    }

    const fromDate = from
      ? new Date(from as string)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();

    const view = await logbookCorrectionService.getPscView(orgId, {
      vesselId: vesselId as string,
      logType: logType ? (logType as string) : undefined,
      fromDate,
      toDate,
    });

    return res.json(view);
  } catch (err) {
    logger.error("LogbookCorrections", "Error generating PSC view", err);
    return res.status(500).json({ error: "Failed to generate PSC view" });
  }
});

router.post("/:entryId/countersign", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const user = getUser(req);
    const entryId = req.params["entryId"] ?? "";

    await logbookCorrectionService.countersign(orgId, entryId, user);

    return res.json({ success: true, countersignedBy: user.name });
  } catch (err) {
    logger.error("LogbookCorrections", "Error countersigning entry", err);
    return res.status(500).json({ error: "Failed to countersign" });
  }
});

export { router as logbookCorrectionRouter };
export default router;
