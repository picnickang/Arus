import type { Express, Request, Response } from "express";
import { withErrorHandling } from "../lib/route-utils";
import { logger } from "../utils/logger";
import { dbAlertStorage } from "../db/alerts/index.js";
import { dbWorkOrderStorage } from "../db/workorders/index.js";
import { dbEquipmentStorage } from "../db/equipment/index.js";

function safeCall<T>(fn: (() => Promise<T>) | undefined): Promise<T | null> {
  if (typeof fn !== "function") return Promise.resolve(null);
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

export function registerHomeRoutes(app: Express, deps: { generalApiRateLimit: any; requireOrgId: any }) {
  const { generalApiRateLimit, requireOrgId } = deps;

  app.get("/api/home/attention-summary", generalApiRateLimit, requireOrgId,
    withErrorHandling("get home attention summary", async (req: Request, res: Response) => {
      const orgId = (req as any).orgId || req.headers["x-org-id"] as string;

      const [alerts, workOrders, equipment] = await Promise.allSettled([
        safeCall(() => dbAlertStorage.getAlertNotifications(false, orgId)),
        safeCall(() => dbWorkOrderStorage.getWorkOrders(undefined, orgId)),
        safeCall(() => dbEquipmentStorage.getEquipment(orgId)),
      ]);

      const alertData = alerts.status === "fulfilled" ? alerts.value : [];
      const woData = workOrders.status === "fulfilled" ? workOrders.value : [];
      const equipData = equipment.status === "fulfilled" ? equipment.value : [];

      const now = new Date();
      const overdueWorkOrders = Array.isArray(woData)
        ? woData.filter((wo: any) => wo.status === "open" && wo.dueDate && new Date(wo.dueDate) < now).length
        : 0;
      const unacknowledgedAlerts = Array.isArray(alertData) ? alertData.length : 0;
      const highRiskEquipment = Array.isArray(equipData)
        ? equipData.filter((eq: any) => eq.riskLevel === "high" || eq.riskLevel === "critical").length
        : 0;

      res.json({
        overdueWorkOrders,
        unacknowledgedAlerts,
        highRiskEquipment,
      });
    })
  );

  logger.info("HomeRoutes", "Registered /api/home/attention-summary");
}
