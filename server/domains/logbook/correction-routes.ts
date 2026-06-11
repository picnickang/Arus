import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { authenticatedRequest, requireOrgId } from "../../middleware/auth";
import { logger } from "../../utils/logger";

const router = Router();

function getOrgId(req: Request): string {
  return authenticatedRequest(req).orgId as string;
}

function getUser(req: Request): { id: string; name?: string; rank?: string } {
  const user = authenticatedRequest(req).user as
    | { id?: string; name?: string; displayName?: string; rank?: string; role?: string }
    | undefined;
  return {
    id: user?.id || "unknown",
    name: user?.name || user?.displayName || "Unknown",
    rank: user?.rank || user?.role || "Unknown",
  };
}

function getRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as Record<string, unknown>[];
    }
  }
  return [];
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

    const originalResult = await db.execute(
      sql`SELECT * FROM log_entries WHERE id = ${data.originalEntryId} AND org_id = ${orgId}`
    );
    const originalEntry = getRows(originalResult)[0];

    if (!originalEntry) {
      return res.status(404).json({ error: "Original log entry not found" });
    }

    const insertResult = await db.execute(sql`
      INSERT INTO log_entries (
        org_id, vessel_id, log_type, entry_date, watch_period,
        data, correction_of, correction_reason, corrected_by_id,
        author_id, author_name, author_rank,
        created_at, updated_at
      ) VALUES (
        ${orgId},
        ${originalEntry["vessel_id"]},
        ${originalEntry["log_type"]},
        ${originalEntry["entry_date"]},
        ${originalEntry["watch_period"] || null},
        ${JSON.stringify(data.correctedFields)},
        ${data.originalEntryId},
        ${data.reason},
        ${user.id},
        ${user.id},
        ${user.name},
        ${user.rank},
        NOW(), NOW()
      )
      RETURNING *
    `);

    const correctionEntry = getRows(insertResult)[0];

    await db.execute(sql`
      UPDATE log_entries
      SET is_corrected = true, updated_at = NOW()
      WHERE id = ${data.originalEntryId} AND org_id = ${orgId}
    `);

    await db.execute(sql`
      INSERT INTO logbook_audit_log (
        org_id, vessel_id, log_entry_id, action,
        performed_by, performed_by_name, performed_by_rank,
        details, ip_address, user_agent
      ) VALUES (
        ${orgId},
        ${originalEntry["vessel_id"]},
        ${data.originalEntryId},
        'corrected',
        ${user.id},
        ${user.name},
        ${user.rank},
        ${JSON.stringify({
          originalEntryId: data.originalEntryId,
          correctionEntryId: correctionEntry?.["id"],
          reason: data.reason,
          correctedFields: Object.keys(data.correctedFields),
        })},
        ${req.ip || null},
        ${req.headers["user-agent"] || null}
      )
    `);

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
    const { entryId } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM log_entries
      WHERE correction_of = ${entryId} AND org_id = ${orgId}
      ORDER BY created_at DESC
    `);

    return res.json(getRows(result));
  } catch (err) {
    logger.error("LogbookCorrections", "Error listing corrections", err);
    return res.status(500).json({ error: "Failed to list corrections" });
  }
});

router.get("/:entryId/audit", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { entryId } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM logbook_audit_log
      WHERE log_entry_id = ${entryId} AND org_id = ${orgId}
      ORDER BY created_at ASC
    `);

    return res.json(getRows(result));
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

    const result = await db.execute(sql`
      SELECT
        le.*,
        CASE WHEN le.correction_of IS NOT NULL THEN 'correction' ELSE 'original' END as entry_role,
        corrected.id as corrected_by_entry_id,
        corrected.created_at as corrected_at,
        corrected.corrected_by_id as corrected_by_user
      FROM log_entries le
      LEFT JOIN log_entries corrected ON corrected.correction_of = le.id
      WHERE le.org_id = ${orgId}
        AND le.vessel_id = ${vesselId as string}
        AND le.entry_date >= ${fromDate}
        AND le.entry_date <= ${toDate}
        ${logType ? sql`AND le.log_type = ${logType as string}` : sql``}
      ORDER BY le.entry_date DESC, le.created_at DESC
    `);

    const entries = getRows(result);

    const auditResult = await db.execute(sql`
      SELECT action, COUNT(*) as count
      FROM logbook_audit_log
      WHERE org_id = ${orgId}
        AND vessel_id = ${vesselId as string}
        AND created_at >= ${fromDate}
        AND created_at <= ${toDate}
      GROUP BY action
    `);

    const auditSummary = getRows(auditResult);

    return res.json({
      vessel_id: vesselId,
      period: { from: fromDate, to: toDate },
      totalEntries: entries.length,
      correctedEntries: entries.filter((e) =>
        Boolean((e as { is_corrected?: unknown }).is_corrected)
      ).length,
      corrections: entries.filter((e) => Boolean((e as { correction_of?: unknown }).correction_of))
        .length,
      auditSummary,
      entries,
    });
  } catch (err) {
    logger.error("LogbookCorrections", "Error generating PSC view", err);
    return res.status(500).json({ error: "Failed to generate PSC view" });
  }
});

router.post("/:entryId/countersign", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const user = getUser(req);
    const { entryId } = req.params;

    await db.execute(sql`
      INSERT INTO logbook_audit_log (
        org_id, vessel_id, log_entry_id, action,
        performed_by, performed_by_name, performed_by_rank,
        details
      )
      SELECT
        ${orgId},
        vessel_id,
        ${entryId},
        'countersigned',
        ${user.id},
        ${user.name},
        ${user.rank},
        ${JSON.stringify({ countersignedBy: user.name, rank: user.rank })}
      FROM log_entries
      WHERE id = ${entryId} AND org_id = ${orgId}
    `);

    return res.json({ success: true, countersignedBy: user.name });
  } catch (err) {
    logger.error("LogbookCorrections", "Error countersigning entry", err);
    return res.status(500).json({ error: "Failed to countersign" });
  }
});

export { router as logbookCorrectionRouter };
export default router;
