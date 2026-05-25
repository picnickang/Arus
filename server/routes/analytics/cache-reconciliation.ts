/**
 * Analytics Routes - Cache Management and Data Reconciliation
 */
import type { Router, Request, Response } from "express";
import { invalidateAnalyticsCache } from "../../lib/cache";
import { getOrgId, handleError } from "./helpers.js";

export function mountCacheReconciliationRoutes(router: Router) {
  router.post("/cache/invalidate", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) {
        return;
      }
      const { scope } = req.body;
      const cacheInvalidators: Record<string, (orgId: string) => Promise<void>> = {
        all: invalidateAnalyticsCache.allForOrg,
        "equipment-health": invalidateAnalyticsCache.equipmentHealth,
        anomalies: invalidateAnalyticsCache.anomalies,
        "failure-predictions": invalidateAnalyticsCache.failurePredictions,
        "ml-models": invalidateAnalyticsCache.mlModels,
      };
      const invalidator = cacheInvalidators[scope];
      if (!invalidator) {
        throw new Error("Invalid cache scope");
      }
      await invalidator(orgId);
      return res.json({
        success: true,
        message: `Cache invalidated for scope: ${scope}`,
        metadata: { orgId, timestamp: new Date(), version: "1.0" },
      });
    } catch (error) {
      handleError(res, error, "Cache Invalidation");
      return undefined;
    }
  });

  router.post("/reconciliation/run", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) {
        return;
      }
      const { dataReconciliationService } = await import("../../services/data-reconciliation.js");
      const report = await dataReconciliationService.runReconciliation(orgId);
      return res.json({
        success: true,
        report,
        metadata: { orgId, timestamp: new Date(), version: "1.0" },
      });
    } catch (error) {
      handleError(res, error, "Data Reconciliation");
      return undefined;
    }
  });

  router.get("/reconciliation/status", async (req: Request, res: Response) => {
    const orgId = getOrgId(req, res);
    if (!orgId) {
      return;
    }
    try {
      const { dataReconciliationService } = await import("../../services/data-reconciliation.js");
      const status = dataReconciliationService.getStatus();
      return res.json({ ...status, metadata: { orgId, timestamp: new Date(), version: "1.0" } });
    } catch (error) {
      handleError(res, error, "Reconciliation Status");
      return undefined;
    }
  });

  router.get("/reconciliation/latest-report", async (req: Request, res: Response) => {
    const orgId = getOrgId(req, res);
    if (!orgId) {
      return;
    }
    try {
      const { dataReconciliationService } = await import("../../services/data-reconciliation.js");
      const report = dataReconciliationService.getLatestReport();
      if (!report) {
        return res
          .status(404)
          .json({
            error: { code: "NOT_FOUND", message: "No reconciliation report available yet" },
            metadata: { orgId, timestamp: new Date(), version: "1.0" },
          });
      }
      const issueGroups = new Map<
        string,
        { type: string; severity: string; table: string; count: number; description: string }
      >();
      report.issues.forEach((issue) => {
        const issueTypeMap: Record<string, string> = {
          missing_equipment: "missing_reference",
          invalid_sensor: "validation_failure",
          data_quality: "quality_issue",
          org_mismatch: "inconsistent",
          timestamp_anomaly: "temporal_issue",
          orphaned_record: "orphaned",
        };
        const frontendType = issueTypeMap[issue.type] ?? "unknown";
        const frontendSeverity =
          issue.severity === "low" ? "info" : issue.severity === "medium" ? "warning" : "critical";
        const table = (issue.metadata?.['table'] as string) || "unknown";
        const groupKey = `${frontendType}:${frontendSeverity}:${table}`;
        if (issueGroups.has(groupKey)) {
          issueGroups.get(groupKey)!.count++;
        } else {
          issueGroups.set(groupKey, {
            type: frontendType,
            severity: frontendSeverity,
            table,
            count: 1,
            description: issue.message,
          });
        }
      });
      return res.json({
        timestamp: report.endTime,
        duration: report.duration,
        totalChecks: report.recordsScanned,
        issuesFound: report.issuesDetected,
        issues: Array.from(issueGroups.values()),
        status: "completed",
        metadata: { orgId, timestamp: new Date(), version: "1.0" },
      });
    } catch (error) {
      handleError(res, error, "Latest Reconciliation Report");
      return undefined;
    }
  });
}
