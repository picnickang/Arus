/**
 * Crew Routes - Leave Management
 * Crew leave request operations
 */

import { insertCrewLeaveSchema } from "@shared/schema-runtime";
import { crewAppService as crewService } from "../application/index.js";
import { requireOrgId, requireOrgIdAndValidateBody } from "../../../middleware/auth";
import { withErrorHandling, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import type { CrewRouteDeps } from "./types.js";

export function registerLeaveRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/crew-leave",
    generalApiRateLimit,
    withErrorHandling("fetch crew leave", async (req, res) => {
      const { crewId, startDate, endDate } = req.query;
      type ListLeaveDateArg = Parameters<typeof crewService.listLeave>[1];
      const toDate = (v: unknown): ListLeaveDateArg =>
        (v ? new Date(v as string).toISOString() : undefined) as ListLeaveDateArg;
      const leave = await crewService.listLeave(
        crewId as string | undefined,
        toDate(startDate),
        toDate(endDate)
      );
      res.json(leave);
    })
  );

  app.post(
    "/api/crew-leave",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create leave record", async (req, res) => {
      const leaveData = insertCrewLeaveSchema.parse(req.body);
      const leave = await crewService.createLeave(leaveData, req.user?.id);
      sendCreated(res, leave);
    })
  );

  app.put(
    "/api/crew-leave/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update leave record", async (req, res) => {
      const leaveData = insertCrewLeaveSchema.partial().parse(req.body);
      const leave = await crewService.updateLeave(req.params["id"] ?? "", leaveData, req.user?.id);
      res.json(leave);
    })
  );

  app.delete(
    "/api/crew-leave/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete leave record", async (req, res) => {
      await crewService.deleteLeave(req.params["id"] ?? "", req.user?.id);
      sendDeleted(res);
    })
  );
}
