import type { Express, Request, Response } from "express";
import { withErrorHandling } from "../lib/route-utils";
import { logger } from "../utils/logger";

function safeCall(fn: ((...args: any[]) => any) | undefined, ...args: any[]): Promise<any> {
  if (typeof fn !== "function") return Promise.resolve(null);
  try {
    const result = fn(...args);
    if (result && typeof result.catch === "function") {
      return result.catch(() => null);
    }
    return Promise.resolve(result);
  } catch {
    return Promise.resolve(null);
  }
}

export function registerHomeRoutes(app: Express, deps: { storage: any; generalApiRateLimit: any }) {
  const { storage, generalApiRateLimit } = deps;

  app.get("/api/home/attention-summary", generalApiRateLimit,
    withErrorHandling("get home attention summary", async (req: Request, res: Response) => {
      const orgId = (req as any).orgId || req.headers["x-org-id"] as string;

      const sinceParam = (req.query.since as string) || (req.headers["x-last-visit"] as string);
      const lastVisitTime = sinceParam ? new Date(sinceParam) : null;

      const [workOrderSummary, alerts, pdmRiskQueue] = await Promise.allSettled([
        safeCall(storage.getWorkOrderSummary?.bind(storage), orgId),
        safeCall(storage.getAlertNotifications?.bind(storage), false, orgId),
        safeCall(storage.getPdmRiskQueue?.bind(storage), orgId),
      ]);

      const woData = workOrderSummary.status === "fulfilled" ? workOrderSummary.value : null;
      const alertData = alerts.status === "fulfilled" ? alerts.value : [];
      const pdmData = pdmRiskQueue.status === "fulfilled" ? pdmRiskQueue.value : [];

      const overdueWorkOrders = woData?.overdue ?? woData?.overdueCount ?? 0;
      const unacknowledgedAlerts = Array.isArray(alertData) ? alertData.length : 0;
      const highRiskEquipment = Array.isArray(pdmData)
        ? pdmData.filter((e: any) => e.riskLevel === "high" || e.riskLevel === "critical").length
        : 0;

      let newSinceLastVisit = undefined;

      if (lastVisitTime && !isNaN(lastVisitTime.getTime())) {
        try {
          const [recentAlerts, recentWOs, completedWOs] = await Promise.allSettled([
            safeCall(storage.getAlertNotificationsSince?.bind(storage), orgId, lastVisitTime),
            safeCall(storage.getWorkOrdersSince?.bind(storage), orgId, lastVisitTime, "created"),
            safeCall(storage.getWorkOrdersSince?.bind(storage), orgId, lastVisitTime, "completed"),
          ]);

          const recentAlertsVal = recentAlerts.status === "fulfilled" ? recentAlerts.value : null;
          const recentWOsVal = recentWOs.status === "fulfilled" ? recentWOs.value : null;
          const completedWOsVal = completedWOs.status === "fulfilled" ? completedWOs.value : null;

          newSinceLastVisit = {
            newAlerts: Array.isArray(recentAlertsVal) ? recentAlertsVal.length : 0,
            newWorkOrders: Array.isArray(recentWOsVal) ? recentWOsVal.length : 0,
            completedWorkOrders: Array.isArray(completedWOsVal) ? completedWOsVal.length : 0,
          };
        } catch {
        }
      }

      res.json({
        overdueWorkOrders,
        unacknowledgedAlerts,
        highRiskEquipment,
        newSinceLastVisit,
      });
    })
  );

  logger.info("HomeRoutes", "Registered /api/home/attention-summary");
}
