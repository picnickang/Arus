import { Router } from "express";
import { z } from "zod";
import { PostgresEquipmentIntelligenceRepository } from "../infrastructure/postgres-repository.js";
import { createGetIntelligenceUseCase } from "../application/get-intelligence.use-case.js";
import { logger } from "../../../utils/logger.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { createAdminMiddleware } from "../../../shared/middleware.js";

const repository = new PostgresEquipmentIntelligenceRepository();
const useCase = createGetIntelligenceUseCase(repository);

const equipmentIdSchema = z.object({
  equipmentId: z.string().min(1).max(255),
});

const router = Router();

router.get("/overview", async (req, res) => {
  try {
    const orgId = req.orgId || (req.headers["x-org-id"] as string) || DEFAULT_ORG_ID;
    const data = await useCase.getOverview(orgId);
    res.json(data);
  } catch (error) {
    logger.error("Error fetching equipment intelligence overview:", error);
    res.status(500).json({ error: "Failed to fetch equipment intelligence data" });
  }
});

router.get("/system-details", createAdminMiddleware(), async (req, res) => {
  try {
    const orgId = req.orgId || (req.headers["x-org-id"] as string) || DEFAULT_ORG_ID;
    const systemDetails = await repository.getSystemDetails(orgId);
    res.json(systemDetails);
  } catch (error) {
    logger.error("Error fetching system details:", error);
    res.status(500).json({ error: "Failed to fetch system details" });
  }
});

router.get("/detail/:equipmentId", async (req, res) => {
  try {
    const orgId = req.orgId || (req.headers["x-org-id"] as string) || DEFAULT_ORG_ID;
    const parseResult = equipmentIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid equipment ID" });
    }
    const { equipmentId } = parseResult.data;
    const data = await useCase.getDetail(orgId, equipmentId);
    if (!data) {
      return res.status(404).json({ error: "Equipment not found" });
    }
    res.json(data);
  } catch (error) {
    logger.error("Error fetching equipment detail:", error);
    res.status(500).json({ error: "Failed to fetch equipment detail" });
  }
});

export default router;
