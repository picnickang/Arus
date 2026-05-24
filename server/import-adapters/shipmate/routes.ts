/**
 * SHIPMATE Import Routes
 *
 * REST API for importing data from SBN SHIPMATE ERP into ARUS.
 *
 * Endpoints:
 *   POST /api/import/shipmate            — Import a SHIPMATE module export
 *   POST /api/import/shipmate/preview    — Dry run validation
 *   GET  /api/import/shipmate/modules    — List available modules and their field mappings
 *
 * Register: app.use(shipmateImportRouter);
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { shipmateImport } from "./import-service";
type ShipmateModuleType =
  | "pms_equipment"
  | "pms_jobs"
  | "sps_stores"
  | "cms_crew_certs"
  | "cms_rest_hours";
import { getShipmateMapping } from "./field-mapping";
import { requireOrgId, type AuthenticatedRequest } from "../../middleware/auth";
import { RateLimiters } from "../../lib/rate-limit-factory";
import { createLogger } from "../../lib/structured-logger";

const logger = createLogger("shipmate-import-routes");
const router = Router();
const importLimit = RateLimiters.write();

const MODULES: ShipmateModuleType[] = [
  "pms_equipment",
  "pms_jobs",
  "sps_stores",
  "cms_crew_certs",
  "cms_rest_hours",
];

const MODULE_LABELS: Record<ShipmateModuleType, string> = {
  pms_equipment: "PMS — Equipment Register",
  pms_jobs: "PMS — Job History / Work Orders",
  sps_stores: "SPS — Spare Parts & Stores",
  cms_crew_certs: "CMS — Crew Certificates (read-only analytics)",
  cms_rest_hours: "CMS — Work & Rest Hours (read-only analytics)",
};

const importSchema = z.object({
  content: z.string().min(10, "File content is too short"),
  module: z.enum(MODULES as object as [string, ...string[]]),
  vesselName: z.string().optional(),
  vesselId: z.string().optional(),
  filename: z.string().optional(),
  feedToRag: z.boolean().optional().default(true),
  delimiter: z.string().optional(),
  syncRunningHours: z.boolean().optional().default(false),
});

// ── POST /api/import/shipmate — Full import ─────────────────────────────────

router.post("/", requireOrgId, importLimit, async (req: Request, res: Response) => {
  try {
    const orgId = (req as AuthenticatedRequest).orgId as string;
    const parsed = importSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const {
      content,
      module,
      vesselName,
      vesselId,
      filename,
      feedToRag,
      delimiter,
      syncRunningHours,
    } = parsed.data;

    logger.info("SHIPMATE import request", { orgId, module, vesselName, filename });

    const result = await shipmateImport.importFile(orgId, content, {
      module: module as ShipmateModuleType,
      vesselName,
      vesselId,
      filename,
      dryRun: false,
      feedToRag,
      delimiter,
      syncRunningHours,
    });

    res.status(result.success ? 200 : 207).json({ success: result.success, data: result });
  } catch (err) {
    logger.error("SHIPMATE import failed", { error: err });
    res
      .status(500)
      .json({ error: "Import failed", message: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/import/shipmate/preview — Dry run ─────────────────────────────

router.post("/preview", requireOrgId, importLimit, async (req: Request, res: Response) => {
  try {
    const orgId = (req as AuthenticatedRequest).orgId as string;
    const parsed = importSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { content, module, vesselName, filename, delimiter } = parsed.data;

    const result = await shipmateImport.importFile(orgId, content, {
      module: module as ShipmateModuleType,
      vesselName,
      filename,
      dryRun: true,
      feedToRag: false,
      delimiter,
    });

    res.json({
      success: true,
      data: {
        ...result,
        message: `Preview: ${result.imported} rows would be imported, ${result.skipped} skipped.${
          result.hierarchyLevelsDetected > 0
            ? ` Equipment hierarchy: ${result.hierarchyLevelsDetected} levels detected.`
            : ""
        }`,
      },
    });
  } catch (err) {
    logger.error("SHIPMATE preview failed", { error: err });
    res
      .status(500)
      .json({ error: "Preview failed", message: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /api/import/shipmate/modules — Available modules ────────────────────

router.get("/modules", requireOrgId, async (_req: Request, res: Response) => {
  const modules = MODULES.map((m) => {
    const mapping = getShipmateMapping(m);
    return {
      id: m,
      label: MODULE_LABELS[m],
      description: getModuleDescription(m),
      fieldCount: mapping.length,
      requiredFields: mapping.filter((f) => f.required).map((f) => f.amosField),
      sampleHeaders: mapping.slice(0, 8).map((f) => f.amosField),
      readOnly: m === "cms_crew_certs" || m === "cms_rest_hours",
    };
  });

  res.json({ success: true, data: { source: "SHIPMATE (SBN Technologics)", modules } });
});

function getModuleDescription(m: ShipmateModuleType): string {
  switch (m) {
    case "pms_equipment":
      return "Import equipment register from SHIPMATE PMS. Includes hierarchy from component number dot notation, manufacturer data, running hours, and criticality ratings.";
    case "pms_jobs":
      return "Import completed maintenance jobs and job schedules from SHIPMATE PMS. Feeds maintenance history into the RAG knowledge base for AI-powered troubleshooting.";
    case "sps_stores":
      return "Import spare parts catalog and ROB (Remaining On Board) from SHIPMATE SPS. Updates stock levels and links parts to equipment.";
    case "cms_crew_certs":
      return "Import crew certificate data for STCW compliance tracking. Read-only in ARUS — SHIPMATE remains the system of record for crew management.";
    case "cms_rest_hours":
      return "Import work and rest hour records for MLC compliance analytics. Read-only in ARUS — used for fatigue risk dashboards.";
    default:
      return "";
  }
}

export { router as shipmateImportRouter };
export default router;
