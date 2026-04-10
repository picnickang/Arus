import type { Express, RequestHandler } from "express";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { analyticsInsightsAdapter } from "../../repositories.js";
import { dbAnalyticsStorage } from "../../db/analytics/index.js";

interface InsightsRouteDependencies {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  reportGenerationRateLimit: RequestHandler;
}

export function registerInsightsV2Routes(
  app: Express,
  deps: InsightsRouteDependencies
): void {
  const { generalApiRateLimit, reportGenerationRateLimit } = deps;

  logger.info("InsightsV2Routes", "Registering insights V2 API endpoints");

  app.get("/api/insights/snapshots", generalApiRateLimit,
    withErrorHandling("fetch insight snapshots", async (req, res) => {
      const { orgId, scope } = req.query;
      const snapshots = await analyticsInsightsAdapter.getInsightSnapshots(
        orgId as string | undefined,
        scope as string | undefined
      );
      res.json(snapshots);
    })
  );

  app.get("/api/insights/snapshots/latest", generalApiRateLimit,
    withErrorHandling("fetch latest insight snapshot", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, scope = "fleet" } = req.query;
      const snapshot = await dbAnalyticsStorage.getLatestInsightSnapshot(orgId as string, scope as string);

      if (!snapshot) {
        return sendNotFound(res, `Insight snapshots for org: ${orgId}, scope: ${scope}`);
      }

      res.json(snapshot);
    })
  );

  app.post("/api/insights/generate", reportGenerationRateLimit,
    withErrorHandling("trigger insights generation", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, scope = "fleet" } = req.body;

      const { triggerInsightsGeneration } = await import("../../insights-scheduler");
      const jobId = await triggerInsightsGeneration(orgId, scope);

      res.status(202).json({
        message: "Insights generation job scheduled successfully",
        jobId,
        orgId,
        scope,
        estimatedCompletionTime: "1-2 minutes",
      });
    })
  );

  app.get("/api/insights/jobs/stats", generalApiRateLimit,
    withErrorHandling("get insights job statistics", async (req, res) => {
      const { getInsightsJobStats } = await import("../../insights-scheduler");
      const stats = getInsightsJobStats();
      res.json(stats);
    })
  );

  app.get("/api/insights/reports", generalApiRateLimit,
    withErrorHandling("fetch insight reports", async (req, res) => {
      const { orgId, scope } = req.query;
      const reports = await analyticsInsightsAdapter.getInsightReports(
        orgId as string | undefined,
        scope as string | undefined
      );
      res.json(reports);
    })
  );

  app.get("/api/insights/v2/equipment/:id", generalApiRateLimit,
    withErrorHandling("generate technician insight", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;

      if (!orgId) {
        return res.status(400).json({
          message: "Organization ID required",
        });
      }

      const { generateTechnicianInsight } = await import("../../insights-engine");
      const insight = await generateTechnicianInsight(id, orgId);

      if (!insight) {
        return sendNotFound(res, "Equipment or prediction");
      }

      res.json(insight);
    })
  );

  app.get("/api/insights/v2/fleet-overview", generalApiRateLimit,
    withErrorHandling("generate fleet technician insights", async (req, res) => {
      const startTime = Date.now();

      const { logInfo, logError, createRequestContext } = await import("../../structured-logging");
      const { generateFleetTechnicianInsights } = await import("../../insights-engine");
      const { fleetOverviewRequests, fleetOverviewResponseTime } = await import(
        "../../ml-prometheus-metrics"
      );

      const { vesselId } = req.query;
      const orgId = (req as AuthenticatedRequest).orgId;
      const requestContext = createRequestContext(req, { orgId });

      if (!orgId) {
        logError("Fleet overview request missing orgId", requestContext);
        fleetOverviewRequests.inc({ org_id: "unknown", status: "error" });
        return res.status(400).json({
          message: "Organization ID required",
        });
      }

      logInfo("Generating fleet technician insights", {
        ...requestContext,
        vesselId: vesselId || "all",
      });

      const fleetInsights = await generateFleetTechnicianInsights(
        orgId,
        vesselId as string | undefined
      );

      const duration = Date.now() - startTime;
      fleetOverviewRequests.inc({ org_id: orgId, status: "success" });
      fleetOverviewResponseTime.observe({ org_id: orgId }, duration);

      logInfo("Fleet technician insights generated successfully", {
        ...requestContext,
        vesselCount: fleetInsights.length,
        totalEquipment: fleetInsights.reduce((sum, v) => sum + v.insights.length, 0),
        durationMs: duration,
      });

      res.json({
        orgId,
        vesselId: vesselId || null,
        vessels: fleetInsights,
        generatedAt: new Date().toISOString(),
      });
    })
  );

  logger.info("InsightsV2Routes", "Registered (snapshots: 2, reports: 1, jobs: 1, v2: 2, generate: 1)");
}
