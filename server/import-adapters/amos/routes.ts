import { Router, Request, Response } from "express";
import { generalApiRateLimit } from "../../middleware/rate-limiters";
import { z } from "zod";
import { amosImportService } from "./import-service";
import { createLogger } from "../../lib/structured-logger";
import { authenticatedRequest, requireOrgId } from "../../middleware/auth";
import {
  EQUIPMENT_FIELD_MAP,
  WORK_ORDER_FIELD_MAP,
  PARTS_FIELD_MAP,
  MAINTENANCE_PLAN_FIELD_MAP,
} from "./field-mapping";

const logger = createLogger("amos-import-routes");
const router = Router();

// Rate-limit every handler on this router (CWE-770). No-op in tests/dev relax.
router.use(generalApiRateLimit);

const importSchema = z.object({
  content: z.string().min(10, "File content is too short"),
  type: z.enum(["equipment", "work_orders", "parts", "maintenance_plans"]),
  filename: z.string().optional(),
  vesselId: z.string().optional(),
  feedToRag: z.boolean().optional().default(true),
  delimiter: z.string().optional(),
});

router.post("/api/import/amos", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = authenticatedRequest(req).orgId as string;

    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }

    const { content, type, filename, vesselId, feedToRag, delimiter } = parsed.data;

    logger.info("AMOS import request", { orgId, type, filename, feedToRag });

    const result = await amosImportService.importFile(orgId, content, {
      type,
      filename,
      dryRun: false,
      feedToRag,
      vesselId,
      delimiter,
    });

    const status = result.success ? 200 : 207;
    return res.status(status).json({
      success: result.success,
      data: result,
    });
  } catch (err) {
    logger.error("AMOS import failed", { error: err });
    return res.status(500).json({
      error: "Import failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/api/import/amos/preview", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = authenticatedRequest(req).orgId as string;

    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }

    const { content, type, filename, delimiter } = parsed.data;

    const result = await amosImportService.importFile(orgId, content, {
      type,
      filename,
      dryRun: true,
      feedToRag: false,
      delimiter,
    });

    return res.json({
      success: true,
      data: {
        ...result,
        message: `Preview: ${result.imported} rows would be imported, ${result.skipped} would be skipped.`,
      },
    });
  } catch (err) {
    logger.error("AMOS preview failed", { error: err });
    return res.status(500).json({
      error: "Preview failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/api/import/amos/mappings", requireOrgId, async (_req: Request, res: Response) => {
  const mappings = {
    equipment: {
      description: "AMOS Equipment Register export",
      fields: EQUIPMENT_FIELD_MAP.map((f) => ({
        amosField: f.amosField,
        arusField: f.arusField,
        required: f.required ?? false,
        hasTransform: !!f.transform,
      })),
    },
    work_orders: {
      description: "AMOS Job Orders / Work Orders export",
      fields: WORK_ORDER_FIELD_MAP.map((f) => ({
        amosField: f.amosField,
        arusField: f.arusField,
        required: f.required ?? false,
        hasTransform: !!f.transform,
      })),
    },
    parts: {
      description: "AMOS Spare Parts / Stock export",
      fields: PARTS_FIELD_MAP.map((f) => ({
        amosField: f.amosField,
        arusField: f.arusField,
        required: f.required ?? false,
        hasTransform: !!f.transform,
      })),
    },
    maintenance_plans: {
      description: "AMOS Maintenance Plans export",
      fields: MAINTENANCE_PLAN_FIELD_MAP.map((f) => ({
        amosField: f.amosField,
        arusField: f.arusField,
        required: f.required ?? false,
        hasTransform: !!f.transform,
      })),
    },
  };

  return res.json({ success: true, data: mappings });
});

export { router as amosImportRouter };
export default router;
