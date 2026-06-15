import { Router } from "express";
import { generalApiRateLimit } from "../../../middleware/rate-limiters";
import { z } from "zod";
import { PostgresEquipmentIntelligenceRepository } from "../infrastructure/postgres-repository.js";
import { PostgresEquipmentHubRepository } from "../infrastructure/hub-repository.js";
import { createGetIntelligenceUseCase } from "../application/get-intelligence.use-case.js";
import { createGetEquipmentHubUseCase } from "../application/get-equipment-hub.use-case.js";
import { logger } from "../../../utils/logger.js";
import { createAdminMiddleware } from "../../../shared/middleware.js";
import { authenticatedRequest } from "../../../middleware/auth.js";

const repository = new PostgresEquipmentIntelligenceRepository();
const useCase = createGetIntelligenceUseCase(repository);
const hubRepository = new PostgresEquipmentHubRepository();
const hubUseCase = createGetEquipmentHubUseCase(hubRepository);

const equipmentIdSchema = z.object({
  equipmentId: z.string().min(1).max(255),
});

function resolveOrgId(
  req: import("express").Request,
  res: import("express").Response
): string | null {
  const orgId = req.orgId;
  if (!orgId) {
    res.status(403).json({ error: "Organization ID is required" });
    return null;
  }
  return orgId;
}

const router = Router();

// Rate-limit every handler on this router (CWE-770). No-op in tests/dev relax.
router.use(generalApiRateLimit);

router.get("/overview", async (req, res) => {
  try {
    const orgId = resolveOrgId(req, res);
    if (!orgId) {
      return;
    }
    const data = await useCase.getOverview(orgId);
    return res.json(data);
  } catch (error) {
    logger.error("Error fetching equipment intelligence overview:", error);
    return res.status(500).json({ error: "Failed to fetch equipment intelligence data" });
  }
});

router.get("/system-details", createAdminMiddleware(), async (req, res) => {
  try {
    const orgId = resolveOrgId(req, res);
    if (!orgId) {
      return;
    }
    const systemDetails = await repository.getSystemDetails(orgId);
    return res.json(systemDetails);
  } catch (error) {
    logger.error("Error fetching system details:", error);
    return res.status(500).json({ error: "Failed to fetch system details" });
  }
});

router.get("/detail/:equipmentId", async (req, res) => {
  try {
    const orgId = resolveOrgId(req, res);
    if (!orgId) {
      return;
    }
    const parseResult = equipmentIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid equipment ID" });
    }
    const { equipmentId } = parseResult.data;
    const data = await useCase.getDetail(orgId, equipmentId);
    if (!data) {
      return res.status(404).json({ error: "Equipment not found" });
    }
    return res.json(data);
  } catch (error) {
    logger.error("Error fetching equipment detail:", error);
    return res.status(500).json({ error: "Failed to fetch equipment detail" });
  }
});

const analysisTypeSchema = z.object({
  analysisType: z.enum(["bearing", "pump", "general"]),
});

router.get("/hub/:equipmentId", async (req, res) => {
  try {
    const orgId = resolveOrgId(req, res);
    if (!orgId) {
      return;
    }
    const parseResult = equipmentIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid equipment ID" });
    }
    const { equipmentId } = parseResult.data;
    const data = await hubUseCase.getHub(orgId, equipmentId);
    if (!data) {
      return res.status(404).json({ error: "Equipment not found" });
    }
    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      `Error fetching equipment hub: ${message}`,
      error instanceof Error ? error.stack : undefined
    );
    return res.status(500).json({ error: "Failed to fetch equipment hub data" });
  }
});

router.post("/diagnostics/:equipmentId/run", async (req, res) => {
  try {
    const orgId = resolveOrgId(req, res);
    if (!orgId) {
      return;
    }
    const parseResult = equipmentIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid equipment ID" });
    }
    const bodyResult = analysisTypeSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res
        .status(400)
        .json({ error: "Invalid analysis type. Must be 'bearing', 'pump', or 'general'." });
    }
    const { equipmentId } = parseResult.data;
    const { analysisType } = bodyResult.data;
    const result = await hubUseCase.runDiagnostic(orgId, equipmentId, analysisType);
    if (!result) {
      return res.status(404).json({ error: "Equipment not found" });
    }
    return res.json(result);
  } catch (error) {
    logger.error("Error running diagnostic:", error);
    return res.status(500).json({ error: "Failed to run diagnostic" });
  }
});

router.post("/anomalies/:equipmentId/acknowledge", async (req, res) => {
  try {
    const orgId = resolveOrgId(req, res);
    if (!orgId) {
      return;
    }
    const parseResult = equipmentIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid equipment ID" });
    }
    const { equipmentId } = parseResult.data;
    const authReq = authenticatedRequest(req);
    const acknowledgedBy =
      authReq.user?.name || authReq.user?.email || authReq.user?.id || "system";
    const result = await hubUseCase.acknowledgeAnomaly(orgId, equipmentId, acknowledgedBy);
    if (!result) {
      return res.status(404).json({ error: "No active anomaly to acknowledge" });
    }
    return res.json(result);
  } catch (error) {
    logger.error("Error acknowledging anomaly:", error);
    return res.status(500).json({ error: "Failed to acknowledge anomaly" });
  }
});

export default router;
