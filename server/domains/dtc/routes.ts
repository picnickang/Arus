import { Express, Request, Response } from "express";
import { z } from "zod";
import { insertDtcFaultSchema } from "../../../shared/schema.js";
import { withErrorHandling, sendNotFound, sendCreated } from "../../lib/route-utils.js";
import { logger } from "../../utils/logger.js";
import { dbDtcStorage } from "../../db/dtc/index.js";
import { dbEquipmentStorage } from "../../db/equipment/index.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

let _dtcIntegrationService: any = null;
async function getDtcService() {
  if (!_dtcIntegrationService) {
    const mod = await import("../../dtc-integration-service.js");
    _dtcIntegrationService = mod.getDtcIntegrationService();
  }
  return _dtcIntegrationService;
}

interface DtcRoutesConfig {
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
  const { writeOperationRateLimit, getWebSocketServer } = config;

  app.get(
    "/api/dtc/definitions",
    withErrorHandling("fetch DTC definitions", async (req: Request, res: Response) => {
      const validation = dtcDefinitionsQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validation.error.errors,
        });
      }

      const { spn, fmi, manufacturer } = validation.data;
      const definitions = await dbDtcStorage.getDtcDefinitions(spn, fmi, manufacturer);

      res.json(definitions);
    })
  );

  app.get(
    "/api/equipment/:id/dtc/active",
    withErrorHandling("fetch active DTCs", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = DEFAULT_ORG_ID;

      const activeDtcs = await dbDtcStorage.getActiveDtcs(id, orgId);
      res.json(activeDtcs);
    })
  );

  app.get(
    "/api/equipment/:id/dtc/history",
    withErrorHandling("fetch DTC history", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = DEFAULT_ORG_ID;

      const validation = dtcHistoryQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validation.error.errors,
        });
      }

      const filters = validation.data;
      const history = await dbDtcStorage.getDtcHistory(id, orgId, filters);
      res.json(history);
    })
  );

  app.get(
    "/api/dtc/active",
    withErrorHandling("fetch all active DTCs", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;

      const validation = dtcActiveQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validation.error.errors,
        });
      }

      const { vesselId, severity } = validation.data;

      const equipmentList = vesselId
        ? await dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId)
        : await dbEquipmentStorage.getEquipmentRegistry(orgId);

      const equipmentIds = equipmentList.map((eq: any) => eq.id);
      const equipmentMap = new Map(equipmentList.map((eq: any) => [eq.id, eq]));

      let flatDtcs: any[];

      if (typeof dbDtcStorage.getActiveDtcsBatch === "function" && equipmentIds.length > 0) {
        const batchResults = await dbDtcStorage.getActiveDtcsBatch(equipmentIds, orgId);
        flatDtcs = batchResults.map((dtc: any) => ({
          ...dtc,
          equipment: equipmentMap.get(dtc.equipmentId),
        }));
      } else {
        const CHUNK_SIZE = 50;
        const chunks: any[][] = [];
        for (let i = 0; i < equipmentList.length; i += CHUNK_SIZE) {
          chunks.push(equipmentList.slice(i, i + CHUNK_SIZE));
        }

        const allActiveDtcs = [];
        for (const chunk of chunks) {
          const chunkResults = await Promise.all(
            chunk.map(async (eq: any) => {
              const dtcs = await dbDtcStorage.getActiveDtcs(eq.id, orgId);
              return dtcs.map((dtc: any) => ({ ...dtc, equipment: eq }));
            })
          );
          allActiveDtcs.push(...chunkResults.flat());
        }
        flatDtcs = allActiveDtcs;
      }
      if (severity) {
        flatDtcs = flatDtcs.filter((dtc: any) => dtc.definition?.severity === severity);
      }

      res.json(flatDtcs);
    })
  );

  app.post(
    "/api/dtc/faults",
    writeOperationRateLimit,
    withErrorHandling("create DTC fault", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;

      const faultData = insertDtcFaultSchema.parse({ ...req.body, orgId });

      const equipment = await dbEquipmentStorage.getEquipment(orgId, faultData.equipmentId);
      if (!equipment) {
        return sendNotFound(res, "Equipment");
      }

      const dtcFault = await dbDtcStorage.upsertDtcFault(faultData);

      const activeDtcs = await dbDtcStorage.getActiveDtcs(dtcFault.equipmentId, orgId);
      const enrichedFault = activeDtcs.find(
        (d: any) => d.spn === dtcFault.spn && d.fmi === dtcFault.fmi
      );

      sendCreated(res, enrichedFault || dtcFault);
    })
  );

  app.get(
    "/api/dtc/dashboard-stats",
    withErrorHandling("fetch DTC dashboard statistics", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;

      const dtcService = await getDtcService();
      const stats = await dtcService.getDtcDashboardStats(orgId);

      res.json(stats);
    })
  );

  app.post(
    "/api/dtc/:equipmentId/:spn/:fmi/create-work-order",
    withErrorHandling("create work order from DTC", async (req: Request, res: Response) => {
      const { equipmentId, spn, fmi } = req.params;
      const orgId = DEFAULT_ORG_ID;

      const activeDtcs = await dbDtcStorage.getActiveDtcs(equipmentId, orgId);
      const dtc = activeDtcs.find(
        (d: any) => d.spn === Number.parseInt(spn) && d.fmi === Number.parseInt(fmi)
      );

      if (!dtc) {
        return sendNotFound(res, "DTC not found or not active");
      }

      const dtcService = await getDtcService();
      const workOrder = await dtcService.createWorkOrderFromDtc(dtc, orgId);

      if (!workOrder) {
        return res.status(400).json({
          message: "Work order not created - DTC is not critical or work order already exists",
        });
      }

      sendCreated(res, workOrder);
    })
  );

  app.post(
    "/api/dtc/:equipmentId/:spn/:fmi/create-alert",
    withErrorHandling("create alert from DTC", async (req: Request, res: Response) => {
      const { equipmentId, spn, fmi } = req.params;
      const orgId = DEFAULT_ORG_ID;

      const activeDtcs2 = await dbDtcStorage.getActiveDtcs(equipmentId, orgId);
      const dtc = activeDtcs2.find(
        (d: any) => d.spn === Number.parseInt(spn) && d.fmi === Number.parseInt(fmi)
      );

      if (!dtc) {
        return sendNotFound(res, "DTC not found or not active");
      }

      const dtcService = await getDtcService();
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

  app.get(
    "/api/equipment/:id/dtc/health-impact",
    withErrorHandling("calculate DTC health impact", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = DEFAULT_ORG_ID;

      const activeDtcsHealth = await dbDtcStorage.getActiveDtcs(id, orgId);
      const dtcService = await getDtcService();
      const healthPenalty = dtcService.calculateDtcHealthImpact(activeDtcsHealth);

      res.json({
        equipmentId: id,
        activeDtcCount: activeDtcsHealth.length,
        healthPenalty,
        estimatedHealthScore: Math.max(0, 100 - healthPenalty),
      });
    })
  );

  app.get(
    "/api/vessel/:vesselId/dtc/financial-impact",
    withErrorHandling("calculate vessel financial impact", async (req: Request, res: Response) => {
      const { vesselId } = req.params;
      const orgId = DEFAULT_ORG_ID;

      const dtcService = await getDtcService();
      const impact = await dtcService.calculateDtcFinancialImpact(vesselId, orgId);

      res.json(impact);
    })
  );

  app.get(
    "/api/equipment/:id/dtc/report-summary",
    withErrorHandling("get DTC report summary", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = DEFAULT_ORG_ID;

      const dtcService = await getDtcService();
      const summary = await dtcService.getDtcSummaryForReports(id, orgId);

      res.json(summary);
    })
  );

  app.get(
    "/api/dtc/:equipmentId/:spn/:fmi/telemetry-correlation",
    withErrorHandling("correlate DTC with telemetry", async (req: Request, res: Response) => {
      const { equipmentId, spn, fmi } = req.params;
      const orgId = DEFAULT_ORG_ID;
      const timeWindow = req.query.timeWindow
        ? Number.parseInt(req.query.timeWindow as string)
        : 60;

      const activeDtcsCorr = await dbDtcStorage.getActiveDtcs(equipmentId, orgId);
      const dtc = activeDtcsCorr.find(
        (d: any) => d.spn === Number.parseInt(spn) && d.fmi === Number.parseInt(fmi)
      );

      if (!dtc) {
        return sendNotFound(res, "DTC not found or not active");
      }

      const dtcService = await getDtcService();
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
