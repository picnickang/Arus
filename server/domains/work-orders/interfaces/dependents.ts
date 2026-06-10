import type { Express, Request, Response } from "express";
import { authenticatedRequest, requireOrgId } from "../../../middleware/auth";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils";
import {
  findWorkOrderForDependents,
  countWorkOrderDependents,
} from "../infrastructure/dependents-repository";

export function registerDependentsRoutes(app: Express) {
  app.get(
    "/api/work-orders/:id/dependents",
    requireOrgId,
    withErrorHandling("fetch work order dependents", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const id = req.params["id"] ?? "";

      const wo = await findWorkOrderForDependents(id);
      if (!wo || (orgId && wo.orgId !== orgId)) {
        sendNotFound(res, "Work order");
        return;
      }

      const { cascade, linked, totals } = await countWorkOrderDependents(id);
      res.json({ workOrderId: id, cascade, linked, totals });
    })
  );
}
