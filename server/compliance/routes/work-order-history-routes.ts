// @ts-nocheck
import { Router, Request, Response } from "express";
import { workOrderHistoryHashService } from "../work-order-history-hash.service";
import { requireComplianceAccess } from "./audit-routes";
import { createLogger } from "../../lib/structured-logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
const logger = createLogger("Compliance:Routes:WorkOrderHistoryRoutes");

const router = Router();

router.post(
  "/work-orders/:workOrderId/history/verify",
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const { workOrderId } = req.params;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const result = await workOrderHistoryHashService.verifyWorkOrderHistory(workOrderId, orgId);
      res.json({ success: true, data: { workOrderId, ...result } });
    } catch (error) {
      logger.error("[Compliance] Work order history verification error:", undefined, error);
      res.status(500).json({ error: "Failed to verify work order history" });
    }
  }
);

router.post(
  "/work-orders/history/verify-all",
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const { workOrderIds } = req.body;
      if (!workOrderIds || !Array.isArray(workOrderIds)) {
        return res.status(400).json({ error: "Work order IDs array required" });
      }
      const results = await Promise.all(
        workOrderIds.map(async (id: string) => ({
          workOrderId: id,
          ...(await workOrderHistoryHashService.verifyWorkOrderHistory(id, orgId)),
        }))
      );
      const allValid = results.every((r) => r.valid);
      res.json({ success: true, data: { allValid, count: results.length, results } });
    } catch (error) {
      logger.error("[Compliance] Bulk work order history verification error:", undefined, error);
      res.status(500).json({ error: "Failed to verify work order histories" });
    }
  }
);

router.get(
  "/work-orders/:workOrderId/history/stats",
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const { workOrderId } = req.params;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const stats = await workOrderHistoryHashService.getWorkOrderHistoryStats(workOrderId, orgId);
      res.json({ success: true, data: { workOrderId, ...stats } });
    } catch (error) {
      logger.error("[Compliance] Work order history stats error:", undefined, error);
      res.status(500).json({ error: "Failed to get work order history stats" });
    }
  }
);

export { router as complianceWorkOrderHistoryRouter };
