import type { Express, Request, Response } from "express";
import { withErrorHandling } from "../lib/route-utils";
import { validateResponse } from "../lib/api-helpers";
import { logger } from "../utils/logger";
import { dbAlertStorage } from "../db/alerts/index.js";
import { dbWorkOrderStorage } from "../db/workorders/index.js";
import { dbEquipmentStorage } from "../db/equipment/index.js";
import { homeAttentionSummaryResponseSchema } from "./home-routes.schema";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

function safeCall<T>(fn: (() => Promise<T>) | undefined): Promise<T | null> {
  if (typeof fn !== "function") {
    return Promise.resolve(null);
  }
  try {
    const result = fn();
    if (result && typeof (result as any).catch === "function") {
      return (result as any).catch(() => null);
    }
    return Promise.resolve(result);
  } catch {
    return Promise.resolve(null);
  }
}

export function registerHomeRoutes(
  app: Express,
  deps: { generalApiRateLimit: any; requireOrgId: any }
) {
  const { generalApiRateLimit, requireOrgId } = deps;

  app.get(
    "/api/home/attention-summary",
    generalApiRateLimit,
    requireOrgId,
    withErrorHandling("get home attention summary", async (req: Request, res: Response) => {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;

      const sinceParam = (req.query.since as string) || (req.headers["x-last-visit"] as string);
      const lastVisitTime = sinceParam ? new Date(sinceParam) : null;

      const [alerts, workOrders, equipmentList] = await Promise.allSettled([
        safeCall(() => dbAlertStorage.getAlertNotifications(false, orgId)),
        safeCall(() => dbWorkOrderStorage.getWorkOrders(undefined, orgId)),
        safeCall(() => dbEquipmentStorage.getEquipmentRegistry(orgId)),
      ]);

      const alertData = alerts.status === "fulfilled" ? alerts.value : [];
      const woData = workOrders.status === "fulfilled" ? workOrders.value : [];
      const equipData = equipmentList.status === "fulfilled" ? equipmentList.value : [];

      const now = new Date();
      const overdueWorkOrders = Array.isArray(woData)
        ? woData.filter(
            (wo: any) => wo.status === "open" && wo.dueDate && new Date(wo.dueDate) < now
          ).length
        : 0;
      const unacknowledgedAlerts = Array.isArray(alertData) ? alertData.length : 0;
      const highRiskEquipment = Array.isArray(equipData)
        ? equipData.filter((eq: any) => eq.riskLevel === "high" || eq.riskLevel === "critical")
            .length
        : 0;

      let newSinceLastVisit = undefined;

      if (lastVisitTime && !isNaN(lastVisitTime.getTime())) {
        try {
          const recentAlerts = Array.isArray(alertData)
            ? alertData.filter((a: any) => a.createdAt && new Date(a.createdAt) > lastVisitTime)
                .length
            : 0;
          const recentWOs = Array.isArray(woData)
            ? woData.filter((wo: any) => wo.createdAt && new Date(wo.createdAt) > lastVisitTime)
                .length
            : 0;
          const completedWOs = Array.isArray(woData)
            ? woData.filter(
                (wo: any) =>
                  wo.status === "completed" &&
                  wo.updatedAt &&
                  new Date(wo.updatedAt) > lastVisitTime
              ).length
            : 0;

          newSinceLastVisit = {
            newAlerts: recentAlerts,
            newWorkOrders: recentWOs,
            completedWorkOrders: completedWOs,
          };
        } catch {}
      }

      res.json(
        validateResponse(
          homeAttentionSummaryResponseSchema,
          {
            overdueWorkOrders,
            unacknowledgedAlerts,
            highRiskEquipment,
            newSinceLastVisit,
          },
          "GET /api/home/attention-summary"
        )
      );
    })
  );

  logger.info("HomeRoutes", "Registered /api/home/attention-summary");
}
