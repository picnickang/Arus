/**
 * PdM Dashboard Routes (mounted at /api/pdm)
 *
 * Core PdM domain routes: dashboard, risk queue, asset detail,
 * bearing/pump analysis, schedule, telemetry detail, and exports.
 */
import { Router } from "express";
import { z } from "zod";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { validateResponse } from "../lib/api-helpers";
import { logger } from "../utils/logger";
import { createAcknowledgeRiskUseCase } from "./application/acknowledge-risk.use-case";
import { createCreateWorkOrderFromRiskUseCase } from "./application/create-work-order.use-case";
import { createGetAssetDetailUseCase } from "./application/get-asset-detail.use-case";
import { createGetDashboardUseCase } from "./application/get-dashboard.use-case";
import { createGetRiskQueueUseCase } from "./application/get-risk-queue.use-case";
import { createGetScheduleUseCase } from "./application/get-schedule.use-case";
import { pdmPostgresRepository } from "./adapters/pdm-postgres.repository";
import { registerPdmAnalysisRoutes } from "./analysis-routes";
import {
  pdmDashboardResponseSchema,
  pdmFilterOptionsResponseSchema,
  pdmRiskQueueResponseSchema,
} from "./domain/response-schemas";
import { registerPdmEquipmentLiveRoutes } from "./equipment-live-routes";
import { registerPdmExportRoutes } from "./export-routes";
import {
  dashboardFiltersSchema,
  filterRiskQueue,
  scheduleFiltersSchema,
} from "./routes-shared";

const router = Router();

const getDashboardUseCase = createGetDashboardUseCase(pdmPostgresRepository);
const getRiskQueueUseCase = createGetRiskQueueUseCase(pdmPostgresRepository);
const getAssetDetailUseCase = createGetAssetDetailUseCase(pdmPostgresRepository);
const acknowledgeRiskUseCase = createAcknowledgeRiskUseCase(pdmPostgresRepository);
const createWorkOrderFromRiskUseCase = createCreateWorkOrderFromRiskUseCase(pdmPostgresRepository);
const getScheduleUseCase = createGetScheduleUseCase(pdmPostgresRepository);

const riskStatusSchema = z.enum(["new", "active", "resolved"]);

router.get("/dashboard", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const filters = dashboardFiltersSchema.parse(req.query);

    const dashboardData = await getDashboardUseCase.execute({ orgId });

    if (
      filters.vesselId ||
      filters.equipmentType ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.search
    ) {
      dashboardData.riskQueue.new = filterRiskQueue(dashboardData.riskQueue.new, filters);
      dashboardData.riskQueue.active = filterRiskQueue(dashboardData.riskQueue.active, filters);
      dashboardData.riskQueue.resolved = filterRiskQueue(dashboardData.riskQueue.resolved, filters);
    }

    return res.json(
      validateResponse(pdmDashboardResponseSchema, dashboardData, "GET /api/pdm/dashboard")
    );
  } catch (error) {
    logger.error("Error fetching PdM dashboard data:", error);
    return res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

router.get("/filter-options", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const [vessels, equipmentTypes] = await Promise.all([
      pdmPostgresRepository.getVessels(orgId),
      pdmPostgresRepository.getEquipmentTypes(orgId),
    ]);

    return res.json(
      validateResponse(
        pdmFilterOptionsResponseSchema,
        { vessels, equipmentTypes },
        "GET /api/pdm/filter-options"
      )
    );
  } catch (error) {
    logger.error("Error fetching filter options:", error);
    return res.status(500).json({ error: "Failed to fetch filter options" });
  }
});

router.get("/risk-queue/:status", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const statusResult = riskStatusSchema.safeParse(req.params.status);
    if (!statusResult.success) {
      return res.status(400).json({ error: "Invalid status. Must be new, active, or resolved." });
    }
    const items = await getRiskQueueUseCase.execute({ orgId, status: statusResult.data });
    return res.json(
      validateResponse(pdmRiskQueueResponseSchema, items, "GET /api/pdm/risk-queue/:status")
    );
  } catch (error) {
    logger.error("Error fetching risk queue:", error);
    return res.status(500).json({ error: "Failed to fetch risk queue" });
  }
});

router.get("/asset/:equipmentId", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const equipmentId = req.params.equipmentId;
    if (!equipmentId) {
      return res.status(400).json({ error: "Equipment ID is required" });
    }
    const assetDetail = await getAssetDetailUseCase.execute({ orgId, equipmentId });
    if (!assetDetail) {
      return res.status(404).json({ error: "Asset not found" });
    }
    return res.json(assetDetail);
  } catch (error) {
    logger.error("Error fetching asset detail:", error);
    return res.status(500).json({ error: "Failed to fetch asset detail" });
  }
});

router.post("/risk/:itemId/acknowledge", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = (req.headers["x-user-id"] as string) || "system";
    const itemId = req.params.itemId;
    if (!itemId) {
      return res.status(400).json({ error: "Item ID is required" });
    }
    await acknowledgeRiskUseCase.execute({ orgId, itemId, userId });
    return res.json({ success: true });
  } catch (error) {
    logger.error("Error acknowledging risk item:", error);
    return res.status(500).json({ error: "Failed to acknowledge risk item" });
  }
});

router.post("/risk/:itemId/create-work-order", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = (req.headers["x-user-id"] as string) || "system";
    const itemId = req.params.itemId;
    if (!itemId) {
      return res.status(400).json({ error: "Item ID is required" });
    }
    const result = await createWorkOrderFromRiskUseCase.execute({ orgId, itemId, userId });
    return res.json({ success: true, workOrderId: result.workOrderId });
  } catch (error) {
    logger.error("Error creating work order from risk:", error);
    return res.status(500).json({ error: "Failed to create work order" });
  }
});

router.get("/schedule", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const filters = scheduleFiltersSchema.parse(req.query);

    const result = await getScheduleUseCase.execute({
      orgId,
      ...(filters.vesselIds && { vesselIds: filters.vesselIds.split(",") }),
      ...(filters.equipmentTypes && { equipmentTypes: filters.equipmentTypes.split(",") }),
      ...(filters.startDate && { startDate: new Date(filters.startDate) }),
      ...(filters.endDate && { endDate: new Date(filters.endDate) }),
      ...(filters.maxTasksPerVesselPerDay !== undefined && {
        maxTasksPerVesselPerDay: filters.maxTasksPerVesselPerDay,
      }),
      autoPopulate: filters.autoPopulate,
    });

    return res.json(result.data);
  } catch (error) {
    logger.error("Error fetching PdM schedule:", error);
    return res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

registerPdmExportRoutes(router, {
  getDashboardUseCase,
  getScheduleUseCase,
});
registerPdmEquipmentLiveRoutes(router, {
  getRiskQueueUseCase,
});
registerPdmAnalysisRoutes(router);

export { router as pdmRouter };
