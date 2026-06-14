/**
 * System Admin Routes - Performance Metrics
 * System performance monitoring and trends
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendCreated } from "../../../lib/route-utils.js";
import { dbSystemAdminStorage } from "../../../db/system-admin/index.js";
import { dbDigitalTwinStorage } from "../../../db/digital-twin/index.js";

export function registerMetricsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    generalApiRateLimit,
    writeOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    insertSystemPerformanceMetricSchema,
  } = deps;

  app.get(
    "/api/admin/performance-metrics",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_PERFORMANCE_METRICS"),
    withErrorHandling("fetch system performance metrics", async (req: Request, res: Response) => {
      const { orgId, category, hours } = req.query;
      const metrics = await dbDigitalTwinStorage.getSystemPerformanceMetrics(
        orgId as string,
        category as string,
        hours ? Number.parseInt(hours as string) : undefined
      );
      res.json(metrics);
    })
  );

  app.post(
    "/api/admin/performance-metrics",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_PERFORMANCE_METRIC"),
    withErrorHandling("create system performance metric", async (req: Request, res: Response) => {
      const validatedData = insertSystemPerformanceMetricSchema.parse(req.body);
      const metric = await dbDigitalTwinStorage.createSystemPerformanceMetric(validatedData);
      sendCreated(res, metric);
    })
  );

  app.get(
    "/api/admin/performance-metrics/:orgId/:category/latest",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_LATEST_METRICS"),
    withErrorHandling("fetch latest performance metrics", async (req: Request, res: Response) => {
      const { orgId = "", category = "" } = req.params;
      const metrics = await dbDigitalTwinStorage.getLatestMetricsByCategory(orgId, category);
      res.json(metrics);
    })
  );

  app.get(
    "/api/admin/performance-metrics/:orgId/:metricName/trends",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_METRIC_TRENDS"),
    withErrorHandling("fetch metric trends", async (req: Request, res: Response) => {
      const { orgId = "", metricName = "" } = req.params;
      const { hours } = req.query;
      const trends = await dbSystemAdminStorage.getMetricTrends(
        orgId,
        metricName,
        hours ? Number.parseInt(hours as string) : 24
      );
      res.json(trends);
    })
  );
}
