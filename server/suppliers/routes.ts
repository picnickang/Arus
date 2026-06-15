/**
 * Supplier Routes
 * REST API endpoints for supplier management
 * Single-tenant mode: Uses DEFAULT_ORG_ID automatically
 */

import { Router } from "express";
import type { Request, Response } from "express";
import * as repo from "./repository";
import { insertSupplierSchema, updateSupplierSchema } from "@shared/schema";
import { stripUndefined } from "../lib/strip-undefined";
import type { SupplierListFilters } from "./types";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Suppliers:Routes");

const router = Router();

router.post("/suppliers", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const parsed = insertSupplierSchema.safeParse({ ...req.body, orgId });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const existing = await repo.getSupplierByCode(parsed.data.code, orgId);
    if (existing) {
      return res.status(409).json({ error: "Supplier code already exists" });
    }

    const supplier = await repo.createSupplier(parsed.data);
    return res.status(201).json(supplier);
  } catch (error) {
    logger.error("[Suppliers] Error creating supplier:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/suppliers", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    // Express query values can be string | string[]; normalise to a single
    // comma-joined string so `.includes`/`.split` operate on a string (not
    // an array) — avoids type confusion through parameter tampering.
    const rawType = req.query["type"];
    const typeParam = Array.isArray(rawType)
      ? rawType.join(",")
      : typeof rawType === "string"
        ? rawType
        : undefined;
    let type: SupplierListFilters["type"] | undefined;
    if (typeParam) {
      if (typeParam.includes(",")) {
        type = typeParam.split(",") as ("supplier" | "service_provider" | "both")[];
      } else {
        type = typeParam as "supplier" | "service_provider" | "both";
      }
    }

    const filters: SupplierListFilters = {
      orgId,
      search: req.query["search"] as string | undefined,
      isActive:
        req.query["isActive"] === "true"
          ? true
          : req.query["isActive"] === "false"
            ? false
            : undefined,
      isPreferred:
        req.query["isPreferred"] === "true"
          ? true
          : req.query["isPreferred"] === "false"
            ? false
            : undefined,
      type,
      limit: req.query["limit"] ? Number.parseInt(req.query["limit"] as string, 10) : 50,
      offset: req.query["offset"] ? Number.parseInt(req.query["offset"] as string, 10) : 0,
    };

    const suppliers = await repo.listSuppliers(filters);
    return res.json(suppliers);
  } catch (error) {
    logger.error("[Suppliers] Error listing suppliers:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/suppliers/stats", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const suppliers = await repo.getSuppliersWithOrderStats(orgId);
    return res.json(suppliers);
  } catch (error) {
    logger.error("[Suppliers] Error getting supplier stats:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/suppliers/preferred", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const suppliers = await repo.getPreferredSuppliers(orgId);
    return res.json(suppliers);
  } catch (error) {
    logger.error("[Suppliers] Error getting preferred suppliers:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/suppliers/:id", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const supplier = await repo.getSupplierById(req.params["id"] ?? "", orgId);
    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    return res.json(supplier);
  } catch (error) {
    logger.error("[Suppliers] Error getting supplier:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.patch("/suppliers/:id", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const parsed = updateSupplierSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const dataWithCode = parsed.data as { code?: string } & typeof parsed.data;
    if (dataWithCode.code) {
      const existing = await repo.getSupplierByCode(dataWithCode.code, orgId);
      if (existing?.id !== req.params["id"]) {
        return res.status(409).json({ error: "Supplier code already exists" });
      }
    }

    const supplier = await repo.updateSupplier(
      req.params["id"] ?? "",
      orgId,
      stripUndefined(parsed.data)
    );
    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    return res.json(supplier);
  } catch (error) {
    logger.error("[Suppliers] Error updating supplier:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.delete("/suppliers/:id", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const deleted = await repo.deleteSupplier(req.params["id"] ?? "", orgId);
    if (!deleted) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error("[Suppliers] Error deleting supplier:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
export { router as suppliersRouter };
