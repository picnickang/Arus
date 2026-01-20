import { Express, Request, Response } from "express";
import { z } from "zod";
import { insertDtcFaultSchema } from "../../../shared/schema.js";
import { withErrorHandling, sendNotFound, sendCreated } from "../../lib/route-utils.js";
import { logger } from "../../utils/logger.js";

interface DtcRoutesConfig {
  storage: any;
  writeOperationRateLimit: any;
  getWebSocketServer: () => any;
}

const dtcDefinitionsQuerySchema = z.object({
  spn: z.string().regex(/^\d+$/).transform(Number).optional(),
  fmi: z.string().regex(/^\d+$/).transform(Number).optional(),
  manufacturer: z.string().optional(),
});

const dtcHistoryQuerySchema = z.object({
  spn: z.string().regex(/^\d+$/).transform(Number).optional(),
  fmi: z.string().regex(/^\d+$/).transform(Number).optional(),
  severity: z
    .string()
    .regex(/^[1-4]$/)
    .transform(Number)
    .optional(),
  from: z
    .string()
    .datetime()
    .transform((s) => new Date(s))
    .optional(),
  to: z
    .string()
    .datetime()
    .transform((s) => new Date(s))
    .optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const dtcActiveQuerySchema = z.object({
  vesselId: z.string().optional(),
  severity: z
    .string()
    .regex(/^[1-4]$/)
    .transform(Number)
    .optional(),
});

export function registerDtcRoutes(app: Express, config: DtcRoutesConfig) {
  const { storage, writeOperationRateLimit, getWebSocketServer } = config;

  app.get("/api/dtc/definitions",
    withErrorHandling("fetch DTC definitions", async (req: Request, res: Response) => {
      const validation = dtcDefinitionsQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validation.error.errors,
        });
      }

      const { spn, fmi, manufacturer } = validation.data;
      const definitions = await storage.getDtcDefinitions(spn, fmi, manufacturer);

      res.json(definitions);
    })
  );

  app.get("/api/equipment/:id/dtc/active",
    withErrorHandling("fetch active DTCs", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const activeDtcs = await storage.getActiveDtcs(id, orgId);
      res.json(activeDtcs);
    })
  );

  app.get("/api/equipment/:id/dtc/history",
    withErrorHandling("fetch DTC history", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const validation = dtcHistoryQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validation.error.errors,
        });
      }

      const filters = validation.data;
      const history = await storage.getDtcHistory(id, orgId, filters);
      res.json(history);
    })
  );

  app.get("/api/dtc/active",
    withErrorHandling("fetch all active DTCs", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const validation = dtcActiveQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validation.error.errors,
        });
      }

      const { vesselId, severity } = validation.data;

      const equipmentList = vesselId
        ? await storage.getEquipmentByVessel(vesselId, orgId)
        : await storage.getEquipmentRegistry(orgId);

      const allActiveDtcs = await Promise.all(
        equipmentList.map(async (eq: any) => {
          const dtcs = await storage.getActiveDtcs(eq.id, orgId);
          return dtcs.map((dtc: any) => ({ ...dtc, equipment: eq }));
        })
      );

      let flatDtcs = allActiveDtcs.flat();
      if (severity) {
        flatDtcs = flatDtcs.filter((dtc: any) => dtc.definition?.severity === severity);
      }

      res.json(flatDtcs);
    })
  );

  app.post("/api/dtc/faults", writeOperationRateLimit,
    withErrorHandling("create DTC fault", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const faultData = insertDtcFaultSchema.parse({ ...req.body, orgId });

      const equipment = await storage.getEquipment(faultData.equipmentId, orgId);
      if (!equipment) {
        return sendNotFound(res, "Equipment");
      }

      const dtcFault = await storage.upsertDtcFault(faultData);

      const activeDtcs = await storage.getActiveDtcs(dtcFault.equipmentId, orgId);
      const enrichedFault = activeDtcs.find(
        (d: any) => d.spn === dtcFault.spn && d.fmi === dtcFault.fmi
      );

      sendCreated(res, enrichedFault || dtcFault);
    })
  );

  app.get("/api/dtc/dashboard-stats",
    withErrorHandling("fetch DTC dashboard statistics", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const stats = await dtcService.getDtcDashboardStats(orgId);

      res.json(stats);
    })
  );

  app.post("/api/dtc/:equipmentId/:spn/:fmi/create-work-order",
    withErrorHandling("create work order from DTC", async (req: Request, res: Response) => {
      const { equipmentId, spn, fmi } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const activeDtcs = await storage.getActiveDtcs(equipmentId, orgId);
      const dtc = activeDtcs.find((d: any) => d.spn === Number.parseInt(spn) && d.fmi === Number.parseInt(fmi));

      if (!dtc) {
        return sendNotFound(res, "DTC not found or not active");
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const workOrder = await dtcService.createWorkOrderFromDtc(dtc, orgId);

      if (!workOrder) {
        return res.status(400).json({
          message: "Work order not created - DTC is not critical or work order already exists",
        });
      }

      sendCreated(res, workOrder);
    })
  );

  app.post("/api/dtc/:equipmentId/:spn/:fmi/create-alert",
    withErrorHandling("create alert from DTC", async (req: Request, res: Response) => {
      const { equipmentId, spn, fmi } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const activeDtcs = await storage.getActiveDtcs(equipmentId, orgId);
      const dtc = activeDtcs.find((d: any) => d.spn === Number.parseInt(spn) && d.fmi === Number.parseInt(fmi));

      if (!dtc) {
        return sendNotFound(res, "DTC not found or not active");
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const alert = await dtcService.createDtcAlert(dtc, orgId);

      if (!alert) {
        return res.status(400).json({
          message: "Alert not created - DTC does not meet alert criteria or recent alert exists",
        });
      }

      if (getWebSocketServer()) {
        getWebSocketServer().broadcast("alerts", {
          type: "new_alert",
          alert,
          timestamp: new Date().toISOString(),
        });
      }

      sendCreated(res, alert);
    })
  );

  app.get("/api/equipment/:id/dtc/health-impact",
    withErrorHandling("calculate DTC health impact", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const activeDtcs = await storage.getActiveDtcs(id, orgId);
      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const healthPenalty = dtcService.calculateDtcHealthImpact(activeDtcs);

      res.json({
        equipmentId: id,
        activeDtcCount: activeDtcs.length,
        healthPenalty,
        estimatedHealthScore: Math.max(0, 100 - healthPenalty),
      });
    })
  );

  app.get("/api/vessel/:vesselId/dtc/financial-impact",
    withErrorHandling("calculate vessel financial impact", async (req: Request, res: Response) => {
      const { vesselId } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const impact = await dtcService.calculateDtcFinancialImpact(vesselId, orgId);

      res.json(impact);
    })
  );

  app.get("/api/equipment/:id/dtc/report-summary",
    withErrorHandling("get DTC report summary", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const summary = await dtcService.getDtcSummaryForReports(id, orgId);

      res.json(summary);
    })
  );

  app.get("/api/dtc/:equipmentId/:spn/:fmi/telemetry-correlation",
    withErrorHandling("correlate DTC with telemetry", async (req: Request, res: Response) => {
      const { equipmentId, spn, fmi } = req.params;
      const orgId = req.headers["x-org-id"] as string;
      const timeWindow = req.query.timeWindow ? Number.parseInt(req.query.timeWindow as string) : 60;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const activeDtcs = await storage.getActiveDtcs(equipmentId, orgId);
      const dtc = activeDtcs.find((d: any) => d.spn === Number.parseInt(spn) && d.fmi === Number.parseInt(fmi));

      if (!dtc) {
        return sendNotFound(res, "DTC not found or not active");
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const telemetry = await dtcService.correlateDtcWithTelemetry(dtc, orgId, timeWindow);

      res.json({
        dtc: {
          spn: dtc.spn,
          fmi: dtc.fmi,
          description: dtc.definition?.description,
          firstSeen: dtc.firstSeen,
          lastSeen: dtc.lastSeen,
        },
        telemetryReadings: telemetry,
        timeWindowMinutes: timeWindow,
      });
    })
  );

  logger.info("DTCRoutes", "Registered (definitions: 1, faults: 5, integration: 6)");
}
