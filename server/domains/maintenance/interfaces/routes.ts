import type { Express, Request, Response } from "express";
import { z } from "zod";
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

const schedulesListQuerySchema = z.object({
  equipmentId: z.string().optional(),
  status: z.string().optional(),
});

const upcomingQuerySchema = z.object({
  daysAhead: z.coerce.number().int().positive().optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });
const equipmentIdParamSchema = z.object({ equipmentId: z.string().min(1) });

const autoScheduleBodySchema = z.object({
  pdmScore: z.number().min(0).max(100),
});

const templatesListQuerySchema = z.object({
  equipmentType: z.string().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export function registerMaintenanceRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: import("express").RequestHandler;
    criticalOperationRateLimit: import("express").RequestHandler;
    generalApiRateLimit: import("express").RequestHandler;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/maintenance-schedules",
    generalApiRateLimit,
    withErrorHandling("fetch maintenance schedules", async (req: Request, res: Response) => {
      const { equipmentId, status } = schedulesListQuerySchema.parse(req.query);
      const schedules = await maintenanceService.listSchedules(equipmentId, status);
      return res.json(schedules);
    })
  );

  app.get(
    "/api/maintenance-schedules/upcoming",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling(
      "fetch upcoming maintenance schedules",
      async (req: Request, res: Response) => {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { daysAhead } = upcomingQuerySchema.parse(req.query);

        const schedules = await maintenanceService.getUpcomingSchedules(orgId, daysAhead ?? 30);
        return res.json(schedules);
      }
    )
  );

  app.get(
    "/api/maintenance-schedules/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch maintenance schedule", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);
      const schedule = await maintenanceService.getScheduleById(id, orgId);

      if (!schedule) {
        return sendNotFound(res, "Maintenance schedule");
      }

      return res.json(schedule);
    })
  );

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

  app.put(
    "/api/maintenance-schedules/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update maintenance schedule", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);
      const scheduleData = insertMaintenanceScheduleSchema.partial().parse(req.body);
      const schedule = await maintenanceService.updateSchedule(
        id,
        scheduleData,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );

      return res.json(schedule);
    })
  );

  app.delete(
    "/api/maintenance-schedules/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete maintenance schedule", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);
      await maintenanceService.deleteSchedule(
        id,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );
      sendDeleted(res);
    })
  );

  app.post(
    "/api/maintenance-schedules/auto-schedule/:equipmentId",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("auto-schedule maintenance", async (req: Request, res: Response) => {
      const { equipmentId } = equipmentIdParamSchema.parse(req.params);
      const parsed = autoScheduleBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "pdmScore must be a number between 0 and 100",
        });
      }

      const schedule = await maintenanceService.autoScheduleForEquipment(
        equipmentId,
        parsed.data.pdmScore,
        (req as AuthenticatedRequest).user?.id
      );

      sendCreated(res, schedule);
      return undefined;
    })
  );

  app.get(
    "/api/maintenance-templates",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch maintenance templates", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentType, isActive } = templatesListQuerySchema.parse(req.query);

      const templates = await maintenanceService.listTemplates(
        orgId,
        equipmentType,
        isActive === undefined ? undefined : isActive === "true"
      );
      return res.json(templates);
    })
  );

  app.get(
    "/api/maintenance-templates/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch maintenance template", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);
      const template = await maintenanceService.getTemplateById(id, orgId);

      if (!template) {
        return sendNotFound(res, "Maintenance template");
      }

      return res.json(template);
    })
  );

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

  app.put(
    "/api/maintenance-templates/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update maintenance template", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);

      const templateData = insertMaintenanceTemplateSchema.partial().parse(req.body);
      const template = await maintenanceService.updateTemplate(
        id,
        templateData,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );

      return res.json(template);
    })
  );

  app.delete(
    "/api/maintenance-templates/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete maintenance template", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);

      await maintenanceService.deleteTemplate(
        id,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );
      sendDeleted(res);
    })
  );
}
