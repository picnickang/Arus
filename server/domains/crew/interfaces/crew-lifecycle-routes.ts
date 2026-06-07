import { Router, type Request, type Response } from "express";
import { crewLifecycleService } from "../lifecycle";
import {
  retireCrewSchema,
  cancelCrewContractSchema,
  reinstateCrewSchema,
  bulkDeleteCrewSchema,
  updateEmploymentHistorySchema,
} from "../lifecycle/lifecycle-validation";
import { asyncHandler } from "../../../lib/async-handler";
import { logger } from "../../../utils/logger.js";
import { authenticatedRequest, requireOrgId } from "../../../middleware/auth";
import { requirePermission } from "../../../lib/permissions-middleware.js";
import { z } from "zod";

const idParamSchema = z.object({ id: z.string().min(1) });
const historyIdParamSchema = z.object({ historyId: z.string().min(1) });

const router = Router();

router.post(
  "/:id/retire",
  requireOrgId,
  requirePermission("crew_members", "edit"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const authReq = authenticatedRequest(req);
    const orgId = authReq.orgId;
    const userId = authReq.user?.id;

    const validated = retireCrewSchema.parse(req.body);
    const crew = await crewLifecycleService.retireCrew(id, orgId, validated, userId);

    logger.info("CrewLifecycleRoutes", `Crew member ${id} retired`);
    res.json(crew);
  })
);

router.post(
  "/:id/cancel",
  requireOrgId,
  requirePermission("crew_members", "edit"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const authReq = authenticatedRequest(req);
    const orgId = authReq.orgId;
    const userId = authReq.user?.id;

    const validated = cancelCrewContractSchema.parse(req.body);
    const crew = await crewLifecycleService.cancelCrewContract(id, orgId, validated, userId);

    logger.info("CrewLifecycleRoutes", `Crew member ${id} contract cancelled`);
    res.json(crew);
  })
);

router.post(
  "/:id/reinstate",
  requireOrgId,
  requirePermission("crew_members", "edit"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const authReq = authenticatedRequest(req);
    const orgId = authReq.orgId;
    const userId = authReq.user?.id;

    const validated = reinstateCrewSchema.parse(req.body);
    const crew = await crewLifecycleService.reinstateCrew(id, orgId, validated, userId);

    logger.info("CrewLifecycleRoutes", `Crew member ${id} reinstated`);
    res.json(crew);
  })
);

router.get(
  "/former",
  requireOrgId,
  requirePermission("crew_members", "view"),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = authenticatedRequest(req);
    const orgId = authReq.orgId;
    const formerCrew = await crewLifecycleService.getFormerCrewWithHistory(orgId);
    res.json(formerCrew);
  })
);

router.get(
  "/:id/history",
  requireOrgId,
  requirePermission("crew_members", "view"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const authReq = authenticatedRequest(req);
    const orgId = authReq.orgId;
    const history = await crewLifecycleService.getEmploymentHistory(id, orgId);
    res.json(history);
  })
);

router.put(
  "/history/:historyId",
  requireOrgId,
  requirePermission("crew_members", "edit"),
  asyncHandler(async (req: Request, res: Response) => {
    const { historyId } = historyIdParamSchema.parse(req.params);
    const authReq = authenticatedRequest(req);
    const orgId = authReq.orgId;

    const validated = updateEmploymentHistorySchema.parse(req.body);
    const updated = await crewLifecycleService.updateEmploymentHistory(historyId, orgId, validated);

    logger.info("CrewLifecycleRoutes", `Employment history ${historyId} updated`);
    res.json(updated);
  })
);

router.delete(
  "/history/:historyId",
  requireOrgId,
  requirePermission("crew_members", "delete"),
  asyncHandler(async (req: Request, res: Response) => {
    const { historyId } = historyIdParamSchema.parse(req.params);
    const authReq = authenticatedRequest(req);
    const orgId = authReq.orgId;

    await crewLifecycleService.deleteEmploymentHistory(historyId, orgId);

    logger.info("CrewLifecycleRoutes", `Employment history ${historyId} deleted`);
    res.status(204).send();
  })
);

router.delete(
  "/:id/former",
  requireOrgId,
  requirePermission("crew_members", "delete"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const authReq = authenticatedRequest(req);
    const orgId = authReq.orgId;
    const userId = authReq.user?.id;

    await crewLifecycleService.deleteFormerCrew(id, orgId, userId);

    logger.info("CrewLifecycleRoutes", `Former crew member ${id} deleted`);
    res.status(204).send();
  })
);

router.delete(
  "/bulk",
  requireOrgId,
  requirePermission("crew_members", "delete"),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = authenticatedRequest(req);
    const orgId = authReq.orgId;
    const userId = authReq.user?.id;

    const validated = bulkDeleteCrewSchema.parse(req.body);
    const deletedCount = await crewLifecycleService.bulkDeleteFormerCrew(
      validated.ids,
      orgId,
      userId
    );

    logger.info("CrewLifecycleRoutes", `${deletedCount} former crew members deleted`);
    res.json({ deletedCount });
  })
);

export default router;
