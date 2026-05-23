/**
 * Integrations Domain Module - External Service Integration Routes
 *
 * Handles integration endpoints for:
 * - FMCC (Aquametro Fuel Monitoring)
 * - Dashboard metrics with caching
 */

import { Express, RequestHandler } from "express";
import { z } from "zod";
import { LRUCache } from "lru-cache";

const fmccDiagnosticQuerySchema = z.object({ vesselId: z.string().optional() });
const vesselIdParamSchema = z.object({ vesselId: z.string().min(1) });
const crewIdParamSchema = z.object({ crewId: z.string().min(1) });
const fmccFuelQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
const stcwDaysQuerySchema = z.object({ days: z.string().optional() });
import { withErrorHandling } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import {
  analyticsInsightsAdapter,
  vesselService,
  dbDevicesStorage,
  workOrderService,
} from "../../repositories.js";
import { dbEquipmentStorage } from "../../db/equipment/index.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

interface IntegrationsRoutesConfig {
  generalApiRateLimit: RequestHandler;
  getFMCCService: typeof import("../../integrations/aquametro-fmcc").getFMCCService;
  updateFleetHealthScore: (score: number) => void;
}

export function registerIntegrationsRoutes(app: Express, config: IntegrationsRoutesConfig): void {
  const { generalApiRateLimit, getFMCCService, updateFleetHealthScore } = config;

  const DASHBOARD_TTL_MS = Number.parseInt(process.env.DASHBOARD_TTL_MS || "30000", 10);
  const dashboardCache = new LRUCache<string, { data: unknown; etag: string }>({
    max: 200,
    ttl: DASHBOARD_TTL_MS,
  });

  app.get(
    "/api/dashboard",
    withErrorHandling("fetch dashboard metrics", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const cacheKey = `dashboard:${orgId}`;
      const now = Date.now();

      const cached = dashboardCache.get(cacheKey);
      if (cached) {
        const clientEtag = req.headers["if-none-match"];
        if (clientEtag === cached.etag) {
          return res.status(304).end();
        }
        res.setHeader("ETag", cached.etag);
        res.setHeader("Cache-Control", "private, max-age=30");
        return res.json(cached.data);
      }

      const metrics = await analyticsInsightsAdapter.getDashboardMetrics(orgId);

      if (metrics.fleetHealth !== undefined) {
        updateFleetHealthScore(metrics.fleetHealth);
      }

      const etag = `"${Buffer.from(JSON.stringify(metrics)).toString("base64").slice(0, 16)}"`;

      dashboardCache.set(cacheKey, { data: metrics, etag });

      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "private, max-age=30");
      res.json(metrics);
    })
  );

  const SUMMARY_TTL_MS = 30_000;
  const summaryCache = new LRUCache<string, object>({ max: 200, ttl: SUMMARY_TTL_MS });

  app.get(
    "/api/dashboard/summary",
    withErrorHandling("fetch dashboard summary", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const cacheKey = `summary:${orgId}`;
      const now = Date.now();

      const cached = summaryCache.get(cacheKey);
      if (cached) {
        res.setHeader("Cache-Control", "private, max-age=60");
        return res.json(cached);
      }

      // Fetch all dashboard data in parallel - extended to reduce frontend API calls
      const { getFleetSTCWSummary, getSTCWComplianceTrends } = await import(
        "../../scheduler/stcw-dashboard"
      );

      // Base queries that always work
      const [metrics, vessels, devices, equipmentHealth, workOrders, equipment] = await Promise.all(
        [
          analyticsInsightsAdapter.getDashboardMetrics(orgId),
          vesselService.getVessels(orgId).catch(() => []),
          dbDevicesStorage.getDevices(orgId).catch(() => []),
          dbEquipmentStorage.getEquipmentHealth(orgId, {}).catch(() => []),
          workOrderService.getWorkOrdersWithDetails(undefined, orgId).catch(() => []),
          dbEquipmentStorage.getEquipmentRegistry(orgId).catch(() => []),
        ]
      );

      // Extended queries with safe fallbacks (non-blocking)
      const [stcwSummary, stcwTrends] = await Promise.all([
        getFleetSTCWSummary(orgId, 30).catch(() => null),
        getSTCWComplianceTrends(orgId, 30).catch(() => null),
      ]);

      // Static fallback values for optional fields (these can be fetched by components if needed)
      const latestTelemetry: never[] = [];
      const dtcStats = {
        totalActiveDtcs: 0,
        criticalDtcs: 0,
        equipmentWithDtcs: 0,
        dtcTriggeredWorkOrders: 0,
      };
      const operatingAlerts: never[] = [];
      const insightsSnapshot = null;
      const insightsJobStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        totalProcessed: 0,
        recentInsightsJobs: [],
      };

      const summary = {
        metrics,
        vessels,
        devices,
        equipmentHealth,
        workOrders: workOrders.slice(0, 50),
        equipment,
        latestTelemetry,
        dtcStats,
        operatingAlerts,
        insightsSnapshot,
        insightsJobStats,
        stcwSummary,
        stcwTrends,
        timestamp: new Date().toISOString(),
      };

      summaryCache.set(cacheKey, summary);

      res.setHeader("Cache-Control", "private, max-age=60");
      res.json(summary);
    })
  );

  // ===== FMCC (Aquametro Fuel Monitoring) STATUS ENDPOINTS =====

  app.get(
    "/api/integrations/fmcc/status",
    generalApiRateLimit,
    withErrorHandling("get FMCC status", async (req, res) => {
      const fmccService = getFMCCService();
      const status = fmccService.getStatus();

      res.json({
        ok: true,
        fmcc: status,
        description: "Aquametro FMCC (Fuel Mass Consumption Computer) integration status",
        capabilities: status.enabled
          ? [
              "Real-time fuel flow measurement",
              "Fuel density compensation",
              "Cumulative fuel counters",
              "Multi-circuit monitoring",
            ]
          : [],
      });
    })
  );

  app.get(
    "/api/integrations/fmcc/diagnostic",
    generalApiRateLimit,
    withErrorHandling("run FMCC diagnostic", async (req, res) => {
      const fmccService = getFMCCService();

      if (!fmccService.isEnabled()) {
        return res.json({
          ok: false,
          status: "disabled",
          message: "FMCC integration is not configured",
          configuration: {
            required: ["FMCC_ENABLED", "FMCC_API_URL"],
            optional: ["FMCC_MODBUS_HOST", "FMCC_API_KEY"],
          },
        });
      }

      const { vesselId } = fmccDiagnosticQuerySchema.parse(req.query);
      if (!vesselId) {
        return res.status(400).json({
          ok: false,
          message: "vesselId query parameter is required for diagnostic",
        });
      }

      const realtimeData = await (
        fmccService as unknown as {
          getRealTimeFuelData: (vesselId: string) => Promise<{
            success: boolean;
            source?: string;
            error?: string;
            data?: {
              foFlowRate?: unknown;
              doFlowRate?: unknown;
              foDensity?: unknown;
              timestamp?: unknown;
            };
          }>;
        }
      ).getRealTimeFuelData(vesselId);

      res.json({
        ok: realtimeData.success,
        status: realtimeData.success ? "connected" : "error",
        source: realtimeData.source,
        data: realtimeData.data
          ? {
              foFlowRate: realtimeData.data.foFlowRate,
              doFlowRate: realtimeData.data.doFlowRate,
              foDensity: realtimeData.data.foDensity,
              timestamp: realtimeData.data.timestamp,
            }
          : null,
        error: realtimeData.error,
      });
    })
  );

  app.get(
    "/api/integrations/fmcc/fuel/:vesselId",
    generalApiRateLimit,
    withErrorHandling("retrieve FMCC fuel data", async (req, res) => {
      const { vesselId } = vesselIdParamSchema.parse(req.params);
      const { startDate, endDate } = fmccFuelQuerySchema.parse(req.query);

      if (!startDate || !endDate) {
        return res.status(400).json({
          ok: false,
          message: "startDate and endDate query parameters are required (ISO format)",
        });
      }

      const fmccService = getFMCCService();

      if (!fmccService.isEnabled()) {
        return res.status(503).json({
          ok: false,
          message: "FMCC integration is not enabled",
        });
      }

      const periodStart = new Date(startDate as string);
      const periodEnd = new Date(endDate as string);

      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        return res.status(400).json({
          ok: false,
          message: "Invalid date format. Use ISO 8601 format (e.g., 2024-01-15T00:00:00Z)",
        });
      }

      const result = await fmccService.getCumulativeFuelCounters(vesselId, periodStart, periodEnd);

      res.json({
        ok: result.success,
        vesselId,
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        },
        source: result.source,
        data: result.data
          ? {
              foConsumedMt: result.data.foConsumedMt,
              doConsumedMt: result.data.doConsumedMt,
              totalFuelMt: result.data.totalFuelMt,
              avgFoDensity: result.data.avgFoDensity,
              avgDoTemperature: result.data.avgDoTemperature,
              dataPoints: result.data.dataPoints,
              dataCompleteness: result.data.dataCompleteness,
            }
          : null,
        error: result.error,
      });
    })
  );

  // ===== FLEET STCW COMPLIANCE DASHBOARD ROUTES =====

  app.get(
    "/api/dashboard/stcw-summary",
    withErrorHandling("fetch fleet STCW summary", async (req, res) => {
      const orgId = req.orgId!;
      const { days = "30" } = stcwDaysQuerySchema.parse(req.query);
      const lookbackDays = Number.parseInt(days, 10) || 30;

      const { getFleetSTCWSummary } = await import("../../scheduler/stcw-dashboard");
      const summary = await getFleetSTCWSummary(orgId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  app.get(
    "/api/dashboard/stcw-summary/vessel/:vesselId",
    withErrorHandling("fetch vessel STCW summary", async (req, res) => {
      const orgId = req.orgId!;
      const { vesselId } = vesselIdParamSchema.parse(req.params);
      const { days = "30" } = stcwDaysQuerySchema.parse(req.query);
      const lookbackDays = Number.parseInt(days, 10) || 30;

      const { getVesselSTCWSummary } = await import("../../scheduler/stcw-dashboard");
      const summary = await getVesselSTCWSummary(orgId, vesselId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  app.get(
    "/api/dashboard/stcw-summary/crew/:crewId",
    withErrorHandling("fetch crew STCW summary", async (req, res) => {
      const orgId = req.orgId!;
      const { crewId } = crewIdParamSchema.parse(req.params);
      const { days = "30" } = stcwDaysQuerySchema.parse(req.query);
      const lookbackDays = Number.parseInt(days, 10) || 30;

      const stcwMod = (await import("../../scheduler/stcw-dashboard")) as unknown as {
        getCrewSTCWSummary: (
          orgId: string,
          crewId: string,
          lookbackDays: number,
        ) => Promise<unknown>;
      };
      const summary = await stcwMod.getCrewSTCWSummary(orgId, crewId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  logger.info("IntegrationsRoutes", "Registered (FMCC: 3, dashboard: 4)");
}
