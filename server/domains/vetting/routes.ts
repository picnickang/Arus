import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { requireOrgId, type AuthenticatedRequest } from "../../middleware/auth";

const MODULE = "vetting";
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

const createInspectionSchema = z.object({
  vesselId: z.string().min(1),
  inspectionType: z.enum(["ovid", "sire", "cdi", "rightship", "client_vetting", "internal"]),
  inspectionRef: z.string().optional(),
  inspectorName: z.string().optional(),
  inspectorCompany: z.string().optional(),
  requestingClient: z.string().optional(),
  inspectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  port: z.string().optional(),
  country: z.string().optional(),
  overallRating: z.enum(["acceptable", "acceptable_with_conditions", "unacceptable"]).optional(),
  reportUrl: z.string().optional(),
  notes: z.string().optional(),
});

const findingSchema = z.object({
  findingNumber: z.number().int(),
  chapter: z.string().optional(),
  questionRef: z.string().optional(),
  severity: z.enum(["critical", "major", "minor", "observation"]),
  description: z.string().min(1),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  responsiblePerson: z.string().optional(),
  targetCloseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

router.get("/", requireOrgId, async (req: Request, res: Response) => {
  try {
    const { vesselId, type, status } = req.query;
    let q = sql`
      SELECT vi.*, v.name as vessel_name
      FROM vetting_inspections vi LEFT JOIN vessels v ON vi.vessel_id = v.id
      WHERE vi.org_id = ${getOrgId(req)}
    `;
    if (vesselId) {
      q = sql`${q} AND vi.vessel_id = ${vesselId as string}`;
    }
    if (type) {
      q = sql`${q} AND vi.inspection_type = ${type as string}`;
    }
    if (status) {
      q = sql`${q} AND vi.status = ${status as string}`;
    }
    q = sql`${q} ORDER BY vi.inspection_date DESC`;
    const result = await db.execute(q);
    res.json(getRows(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to list inspections" });
  }
});

router.post("/", requireOrgId, async (req: Request, res: Response) => {
  try {
    const data = createInspectionSchema.parse(req.body);
    const result = await db.execute(sql`
      INSERT INTO vetting_inspections (
        org_id, vessel_id, inspection_type, inspection_ref,
        inspector_name, inspector_company, requesting_client,
        inspection_date, port, country, overall_rating, report_url, notes
      ) VALUES (
        ${getOrgId(req)}, ${data.vesselId}, ${data.inspectionType},
        ${data.inspectionRef || null}, ${data.inspectorName || null},
        ${data.inspectorCompany || null}, ${data.requestingClient || null},
        ${new Date(data.inspectionDate)}, ${data.port || null},
        ${data.country || null}, ${data.overallRating || null},
        ${data.reportUrl || null}, ${data.notes || null}
      ) RETURNING *
    `);
    const inspection = getFirstRow(result);

    if (data.overallRating) {
      const vstatus =
        data.overallRating === "unacceptable"
          ? "conditional"
          : data.overallRating === "acceptable"
            ? "valid"
            : "conditional";
      await db.execute(sql`
        UPDATE vessels SET vetting_status = ${vstatus},
          last_vetting_date = ${new Date(data.inspectionDate)}
        WHERE id = ${data.vesselId} AND org_id = ${getOrgId(req)}
      `);
    }

    res.status(201).json(inspection);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    res.status(500).json({ error: "Failed to create inspection" });
  }
});

router.post("/:inspectionId/findings", requireOrgId, async (req: Request, res: Response) => {
  try {
    const data = findingSchema.parse(req.body);
    const { inspectionId } = req.params;

    const result = await db.execute(sql`
      INSERT INTO vetting_findings (
        org_id, inspection_id, finding_number, chapter, question_ref,
        severity, description, root_cause, corrective_action,
        responsible_person, target_close_date
      ) VALUES (
        ${getOrgId(req)}, ${inspectionId}, ${data.findingNumber},
        ${data.chapter || null}, ${data.questionRef || null},
        ${data.severity}, ${data.description}, ${data.rootCause || null},
        ${data.correctiveAction || null}, ${data.responsiblePerson || null},
        ${data.targetCloseDate ? new Date(data.targetCloseDate) : null}
      ) RETURNING *
    `);

    await db.execute(sql`
      UPDATE vetting_inspections SET
        total_findings = (SELECT COUNT(*) FROM vetting_findings WHERE inspection_id = ${inspectionId}),
        critical_findings = (SELECT COUNT(*) FROM vetting_findings WHERE inspection_id = ${inspectionId} AND severity = 'critical'),
        major_findings = (SELECT COUNT(*) FROM vetting_findings WHERE inspection_id = ${inspectionId} AND severity = 'major'),
        observations = (SELECT COUNT(*) FROM vetting_findings WHERE inspection_id = ${inspectionId} AND severity IN ('minor', 'observation')),
        status = 'findings_open',
        all_findings_closed = false,
        updated_at = NOW()
      WHERE id = ${inspectionId} AND org_id = ${getOrgId(req)}
    `);

    res.status(201).json(getFirstRow(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    res.status(500).json({ error: "Failed to add finding" });
  }
});

router.get("/:inspectionId/findings", requireOrgId, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM vetting_findings
      WHERE inspection_id = ${req.params.inspectionId} AND org_id = ${getOrgId(req)}
      ORDER BY finding_number
    `);
    res.json(getRows(result));
  } catch (err) {
    res.status(500).json({ error: "Failed to list findings" });
  }
});

router.patch(
  "/:inspectionId/findings/:findingId/close",
  requireOrgId,
  async (req: Request, res: Response) => {
    try {
      const { evidenceUrl, verifiedBy } = z
        .object({
          evidenceUrl: z.string().optional(),
          verifiedBy: z.string().optional(),
        })
        .parse(req.body);

      await db.execute(sql`
      UPDATE vetting_findings SET
        status = 'closed', actual_close_date = CURRENT_DATE,
        evidence_url = ${evidenceUrl || null},
        verified_by = ${verifiedBy || null},
        verified_date = CURRENT_DATE,
        updated_at = NOW()
      WHERE id = ${req.params.findingId} AND org_id = ${getOrgId(req)}
    `);

      const openResult = await db.execute(sql`
      SELECT COUNT(*) as open_count FROM vetting_findings
      WHERE inspection_id = ${req.params.inspectionId}
        AND org_id = ${getOrgId(req)} AND status NOT IN ('closed', 'verified')
    `);
      const openCount = Number(getFirstRow(openResult)?.open_count || 0);

      if (openCount === 0) {
        await db.execute(sql`
        UPDATE vetting_inspections SET
          all_findings_closed = true, status = 'closed_out',
          closed_out_date = CURRENT_DATE, updated_at = NOW()
        WHERE id = ${req.params.inspectionId} AND org_id = ${getOrgId(req)}
      `);
      }

      res.json({ success: true, allFindingsClosed: openCount === 0 });
    } catch (err) {
      res.status(500).json({ error: "Failed to close finding" });
    }
  }
);

router.get("/fleet-readiness", requireOrgId, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        v.id as vessel_id, v.name as vessel_name, v.dp_class,
        v.vetting_status, v.last_vetting_date,
        (SELECT COUNT(*) FROM vetting_findings vf
         JOIN vetting_inspections vi ON vf.inspection_id = vi.id
         WHERE vi.vessel_id = v.id AND vi.org_id = ${getOrgId(req)}
           AND vf.status IN ('open', 'in_progress')
        ) as open_findings,
        (SELECT vi2.inspection_date FROM vetting_inspections vi2
         WHERE vi2.vessel_id = v.id AND vi2.org_id = ${getOrgId(req)}
         ORDER BY vi2.inspection_date DESC LIMIT 1
        ) as last_inspection_date,
        (SELECT vi3.overall_rating FROM vetting_inspections vi3
         WHERE vi3.vessel_id = v.id AND vi3.org_id = ${getOrgId(req)}
         ORDER BY vi3.inspection_date DESC LIMIT 1
        ) as last_rating
      FROM vessels v
      WHERE v.org_id = ${getOrgId(req)}
      ORDER BY v.name
    `);

    const vessels = getRows(result);

    res.json({
      totalVessels: vessels.length,
      vettedAndValid: vessels.filter((v) => v.vetting_status === "valid").length,
      needsVetting: vessels.filter(
        (v) => v.vetting_status === "not_vetted" || v.vetting_status === "expired"
      ).length,
      openFindings: vessels.reduce((s, v) => s + Number(v.open_findings || 0), 0),
      vessels,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get fleet readiness" });
  }
});

export { router as vettingRouter };
