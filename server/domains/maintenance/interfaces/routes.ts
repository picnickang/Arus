import type { Express, Request, Response } from "express";
import {
  insertMaintenanceScheduleSchema,
  insertMaintenanceTemplateSchema,
} from "@shared/schema-runtime";
import { maintenanceService } from "../service";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../../middleware/auth";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils";

/**
 * Maintenance Routes (Interfaces Layer)
 * Handles HTTP concerns for maintenance domain (schedules and templates)
 */
export function registerMaintenanceRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  // ========== Maintenance Schedules ==========

  // GET /api/maintenance-schedules
  app.get(
    "/api/maintenance-schedules",
    generalApiRateLimit,
    withErrorHandling("fetch maintenance schedules", async (req: Request, res: Response) => {
      const { equipmentId, status } = req.query;
      const schedules = await maintenanceService.listSchedules(
        equipmentId as string | undefined,
        status as string | undefined
      );
      res.json(schedules);
    })
  );

  // GET /api/maintenance-schedules/upcoming
  app.get(
    "/api/maintenance-schedules/upcoming",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling(
      "fetch upcoming maintenance schedules",
      async (req: Request, res: Response) => {
        const orgId = (req as AuthenticatedRequest).orgId;
        const daysAhead = req.query.daysAhead ? Number.parseInt(req.query.daysAhead as string) : 30;

        const schedules = await maintenanceService.getUpcomingSchedules(orgId, daysAhead);
        res.json(schedules);
      }
    )
  );

  // GET /api/maintenance-schedules/:id
  app.get(
    "/api/maintenance-schedules/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch maintenance schedule", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const schedule = await maintenanceService.getScheduleById(req.params.id, orgId);

      if (!schedule) {
        return sendNotFound(res, "Maintenance schedule");
      }

      res.json(schedule);
    })
  );

  // POST /api/maintenance-schedules
  app.post(
    "/api/maintenance-schedules",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create maintenance schedule", async (req: Request, res: Response) => {
      const scheduleData = insertMaintenanceScheduleSchema.parse(req.body);
      const schedule = await maintenanceService.createSchedule(
        scheduleData,
        (req as AuthenticatedRequest).user?.id
      );

      sendCreated(res, schedule);
    })
  );

  // PUT /api/maintenance-schedules/:id
  app.put(
    "/api/maintenance-schedules/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update maintenance schedule", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const scheduleData = insertMaintenanceScheduleSchema.partial().parse(req.body);
      const schedule = await maintenanceService.updateSchedule(
        req.params.id,
        scheduleData,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );

      res.json(schedule);
    })
  );

  // DELETE /api/maintenance-schedules/:id
  app.delete(
    "/api/maintenance-schedules/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete maintenance schedule", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      await maintenanceService.deleteSchedule(
        req.params.id,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );
      sendDeleted(res);
    })
  );

  // POST /api/maintenance-schedules/auto-schedule/:equipmentId
  app.post(
    "/api/maintenance-schedules/auto-schedule/:equipmentId",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("auto-schedule maintenance", async (req: Request, res: Response) => {
      const equipmentId = req.params.equipmentId;
      const { pdmScore } = req.body;

      if (pdmScore === undefined || pdmScore === null) {
        return res.status(400).json({
          message: "pdmScore is required in request body",
        });
      }

      if (typeof pdmScore !== "number" || pdmScore < 0 || pdmScore > 100) {
        return res.status(400).json({
          message: "pdmScore must be a number between 0 and 100",
        });
      }

      const schedule = await maintenanceService.autoScheduleForEquipment(
        equipmentId,
        pdmScore,
        (req as AuthenticatedRequest).user?.id
      );

      sendCreated(res, schedule);
    })
  );

  // ========== Maintenance Templates ==========

  // GET /api/maintenance-templates
  app.get(
    "/api/maintenance-templates",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch maintenance templates", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentType, isActive } = req.query;

      const templates = await maintenanceService.listTemplates(
        orgId,
        equipmentType as string | undefined,
        isActive === undefined ? undefined : isActive === "true"
      );
      res.json(templates);
    })
  );

  // GET /api/maintenance-templates/:id
  app.get(
    "/api/maintenance-templates/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch maintenance template", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const template = await maintenanceService.getTemplateById(req.params.id, orgId);

      if (!template) {
        return sendNotFound(res, "Maintenance template");
      }

      res.json(template);
    })
  );

  // POST /api/maintenance-templates
  app.post(
    "/api/maintenance-templates",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create maintenance template", async (req: Request, res: Response) => {
      const templateData = insertMaintenanceTemplateSchema.parse(req.body);
      const template = await maintenanceService.createTemplate(
        templateData,
        (req as AuthenticatedRequest).user?.id
      );

      sendCreated(res, template);
    })
  );

  // PUT /api/maintenance-templates/:id
  app.put(
    "/api/maintenance-templates/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update maintenance template", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const templateData = insertMaintenanceTemplateSchema.partial().parse(req.body);
      const template = await maintenanceService.updateTemplate(
        req.params.id,
        templateData,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );

      res.json(template);
    })
  );

  // DELETE /api/maintenance-templates/:id
  app.delete(
    "/api/maintenance-templates/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete maintenance template", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      await maintenanceService.deleteTemplate(
        req.params.id,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );
      sendDeleted(res);
    })
  );
}
