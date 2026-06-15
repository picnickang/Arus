import { Router, type Response } from "express";
import { generalApiRateLimit } from "../../../middleware/rate-limiters";
import { z } from "zod";
import { ModelRegistryAdapter } from "./adapter";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { requirePermission } from "../../../lib/permissions/middleware";

const router = Router();

// Rate-limit every handler on this router (CWE-770). No-op in tests/dev relax.
router.use(generalApiRateLimit);
const registry = new ModelRegistryAdapter();

const createVersionSchema = z.object({
  version: z.string().min(1),
  artifactPath: z.string().optional(),
  changelog: z.string().optional(),
});

const deploySchema = z.object({
  modelVersionId: z.string().min(1),
  target: z.string().default("cloud"),
});

// LR-3.5 / PdM tenancy hardening: `requireOrgId` is mounted on this router
// in `server/routes/domain-router-registry.ts` (mountPath `/api/pdm/models`).
// Unauthenticated requests and authenticated users without an org claim are
// rejected with 401 before reaching any handler; `req.orgId` is guaranteed
// to be the authenticated org context — no single-tenant constant fallback.
function getOrgId(req: AuthenticatedRequest): string {
  return req.orgId;
}

router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const result = await registry.listModels(orgId);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.get("/:modelId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const result = await registry.getModel(orgId, req.params["modelId"] ?? "");
    if (!result) {
      return res.status(404).json({ error: "Model not found" });
    }
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.get("/:modelId/versions", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const result = await registry.listVersions(orgId, req.params["modelId"] ?? "");
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.post("/:modelId/versions", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = createVersionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const result = await registry.createVersion({
      orgId,
      modelId: req.params["modelId"] ?? "",
      ...parsed.data,
    });
    return res.status(201).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.get("/:modelId/deployment", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const result = await registry.getActiveDeployment(orgId, req.params["modelId"] ?? "");
    return res.json(result ?? { message: "No active deployment" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

// LR-3.5 / ML-1: deploy + rollback mutate live production routing for the
// org; gate behind the `predictive_maintenance:manage_config` permission
// grant, consistent with /api/ml/models/:id/promote and the frontend
// `predictive_maintenance` resource gate (no hardcoded role list).
router.post(
  "/:modelId/deploy",
  requirePermission("predictive_maintenance", "manage_config"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = getOrgId(req);
      const parsed = deploySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }
      const { modelVersionId, target } = parsed.data;
      const result = await registry.deploy(
        orgId,
        req.params["modelId"] ?? "",
        modelVersionId,
        target
      );
      return res.status(201).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }
);

router.post(
  "/deployments/:deploymentId/rollback",
  requirePermission("predictive_maintenance", "manage_config"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = getOrgId(req);
      const result = await registry.rollback(orgId, parseInt(req.params["deploymentId"] ?? "0"));
      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }
);

export { router as modelRegistryRouter };
