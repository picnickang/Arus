/**
 * Alert Settings Routes
 * API endpoints for email and alert configuration
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { alertSettingsService } from "./settings-service";
import { emailTemplatesService } from "./email-templates-service";
import {
  insertAlertSettingsSchema,
  insertAlertSettingsVesselSchema,
  insertAlertThresholdSchema,
  insertCrewAlertSettingsSchema,
} from "@shared/schema";
import {
  insertEmailTemplateVariableSchema,
  emailTemplateVariables,
} from "@shared/schema/email-templates.js";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";

const updateSettingsSchema = insertAlertSettingsSchema.partial().extend({
  apiKey: z.string().optional(),
  smtpPassword: z.string().optional(),
});

const testEmailSchema = z.object({
  email: z.string().email(),
});

const emailLogsQuerySchema = z.object({
  vesselId: z.string().optional(),
  alertType: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).optional(),
  offset: z.coerce.number().min(0).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

function getOrgId(req: Request): string {
  return (req as AuthenticatedRequest).orgId || "default-org-id";
}

export function registerAlertSettingsRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/alert-settings",
    generalApiRateLimit,
    withErrorHandling("get alert settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const settings = await alertSettingsService.getSettings(orgId);
      res.json(settings);
    })
  );

  app.put(
    "/api/alert-settings",
    writeOperationRateLimit,
    withErrorHandling("update alert settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const data = updateSettingsSchema.parse(req.body);
      const settings = await alertSettingsService.updateSettings(orgId, data);
      res.json(settings);
    })
  );

  app.post(
    "/api/alert-settings/test-connection",
    writeOperationRateLimit,
    withErrorHandling("test email connection", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const result = await alertSettingsService.testEmailConnection(orgId);
      res.json(result);
    })
  );

  app.post(
    "/api/alert-settings/send-test",
    writeOperationRateLimit,
    withErrorHandling("send test email", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { email } = testEmailSchema.parse(req.body);
      const result = await alertSettingsService.sendTestEmail(orgId, email);
      res.json(result);
    })
  );

  app.get(
    "/api/alert-settings/vessels",
    generalApiRateLimit,
    withErrorHandling("get vessel settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const settings = await alertSettingsService.getAllVesselSettings(orgId);
      res.json(settings);
    })
  );

  app.get(
    "/api/alert-settings/vessels/:vesselId",
    generalApiRateLimit,
    withErrorHandling("get vessel settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const settings = await alertSettingsService.getVesselSettings(orgId, req.params.vesselId);
      if (!settings) {
        return sendNotFound(res, "Vessel settings");
      }
      res.json(settings);
    })
  );

  app.put(
    "/api/alert-settings/vessels/:vesselId",
    writeOperationRateLimit,
    withErrorHandling("update vessel settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const data = insertAlertSettingsVesselSchema.partial().parse(req.body);
      const settings = await alertSettingsService.updateVesselSettings(
        orgId,
        req.params.vesselId,
        data
      );
      res.json(settings);
    })
  );

  app.delete(
    "/api/alert-settings/vessels/:vesselId",
    criticalOperationRateLimit,
    withErrorHandling("delete vessel settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      await alertSettingsService.deleteVesselSettings(orgId, req.params.vesselId);
      res.status(204).send();
    })
  );

  app.get(
    "/api/alert-settings/thresholds",
    generalApiRateLimit,
    withErrorHandling("get alert thresholds", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const category = req.query.category as string | undefined;
      const thresholds = await alertSettingsService.getThresholds(orgId, category);
      res.json(thresholds);
    })
  );

  app.post(
    "/api/alert-settings/thresholds",
    writeOperationRateLimit,
    withErrorHandling("create alert threshold", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const data = insertAlertThresholdSchema.partial().parse(req.body);
      if (!data.key || !data.name) {
        return res.status(400).json({
          message: "Threshold key and name are required",
        });
      }
      const threshold = await alertSettingsService.updateThreshold(orgId, data.key, data);
      res.status(201).json(threshold);
    })
  );

  app.put(
    "/api/alert-settings/thresholds/:key",
    writeOperationRateLimit,
    withErrorHandling("update alert threshold", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const data = insertAlertThresholdSchema.partial().parse(req.body);
      const threshold = await alertSettingsService.updateThreshold(orgId, req.params.key, data);
      res.json(threshold);
    })
  );

  app.delete(
    "/api/alert-settings/thresholds/:key",
    criticalOperationRateLimit,
    withErrorHandling("delete alert threshold", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      await alertSettingsService.deleteThreshold(orgId, req.params.key);
      res.status(204).send();
    })
  );

  app.get(
    "/api/alert-settings/email-logs",
    generalApiRateLimit,
    withErrorHandling("get email logs", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const query = emailLogsQuerySchema.parse(req.query);
      const logs = await alertSettingsService.getEmailLogs(orgId, {
        ...query,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });
      res.json(logs);
    })
  );

  app.get(
    "/api/alert-settings/crew",
    generalApiRateLimit,
    withErrorHandling("get crew alert settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const vesselId = req.query.vesselId as string | undefined;
      const settings = await alertSettingsService.getCrewAlertSettings(orgId, vesselId);
      res.json(settings ?? {});
    })
  );

  app.get(
    "/api/alert-settings/crew/all",
    generalApiRateLimit,
    withErrorHandling("get all crew alert settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const settings = await alertSettingsService.getAllCrewAlertSettings(orgId);
      res.json(settings);
    })
  );

  app.put(
    "/api/alert-settings/crew",
    writeOperationRateLimit,
    withErrorHandling("update crew alert settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const vesselId = (req.query.vesselId as string | null) || null;
      const data = insertCrewAlertSettingsSchema.partial().parse(req.body);
      const settings = await alertSettingsService.updateCrewAlertSettings(orgId, vesselId, data);
      res.json(settings);
    })
  );

  app.post(
    "/api/alerts/run",
    criticalOperationRateLimit,
    withErrorHandling("run crew alerts", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const vesselId = req.query.vesselId as string | undefined;
      const { alertRunnerService } = await import("./alert-runner");
      const result = await alertRunnerService.runCrewAlerts({
        orgId,
        vesselId,
        now: new Date(),
      });
      res.json(result);
    })
  );

  app.get(
    "/api/alerts/preview",
    generalApiRateLimit,
    withErrorHandling("preview alerts", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const vesselId = req.query.vesselId as string | undefined;
      const { runAllCrewAlertEvaluators } = await import("./crew-alert-evaluators");
      const alerts = await runAllCrewAlertEvaluators({
        orgId,
        vesselId,
        now: new Date(),
      });
      res.json({
        timestamp: new Date().toISOString(),
        orgId,
        vesselId,
        alertCount: alerts.length,
        alerts,
      });
    })
  );

  // Email Templates Routes
  app.get(
    "/api/email-templates",
    generalApiRateLimit,
    withErrorHandling("get email templates", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const templates = await emailTemplatesService.getTemplates(orgId);
      res.json(templates);
    })
  );

  app.get(
    "/api/email-templates/placeholders",
    generalApiRateLimit,
    withErrorHandling("get email template placeholders", async (_req: Request, res: Response) => {
      const placeholders = emailTemplatesService.getPlaceholders();
      res.json(placeholders);
    })
  );

  app.get(
    "/api/email-templates/defaults",
    generalApiRateLimit,
    withErrorHandling("get default email templates", async (_req: Request, res: Response) => {
      const defaults = emailTemplatesService.getDefaultTemplates();
      res.json(defaults);
    })
  );

  app.patch(
    "/api/email-templates",
    writeOperationRateLimit,
    withErrorHandling("update email templates", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const templates = await emailTemplatesService.updateTemplates(orgId, req.body);
      res.json(templates);
    })
  );

  app.post(
    "/api/email-templates/reset/:type",
    writeOperationRateLimit,
    withErrorHandling("reset email template", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const type = req.params.type as "purchaseOrder" | "serviceOrder";
      if (type !== "purchaseOrder" && type !== "serviceOrder") {
        return res.status(400).json({ message: "Invalid template type" });
      }
      const templates = await emailTemplatesService.resetTemplate(orgId, type);
      res.json(templates);
    })
  );

  app.post(
    "/api/email-templates/preview",
    generalApiRateLimit,
    withErrorHandling("preview email template", async (req: Request, res: Response) => {
      const { template, type } = req.body;
      if (!template || !type) {
        return res.status(400).json({ message: "Template and type are required" });
      }
      const preview = emailTemplatesService.generatePreview(template, type);
      res.json(preview);
    })
  );

  // Custom Email Template Variables CRUD
  app.get(
    "/api/email-template-variables",
    generalApiRateLimit,
    withErrorHandling("get email template variables", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const variables = await db
        .select()
        .from(emailTemplateVariables)
        .where(eq(emailTemplateVariables.orgId, orgId));
      res.json(variables);
    })
  );

  app.post(
    "/api/email-template-variables",
    writeOperationRateLimit,
    withErrorHandling("create email template variable", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const data = insertEmailTemplateVariableSchema.parse({ ...req.body, orgId });
      const [variable] = await db.insert(emailTemplateVariables).values(data).returning();
      res.status(201).json(variable);
    })
  );

  app.patch(
    "/api/email-template-variables/:id",
    writeOperationRateLimit,
    withErrorHandling("update email template variable", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { id } = req.params;
      const { name, value, description } = req.body;
      const [variable] = await db
        .update(emailTemplateVariables)
        .set({ name, value, description, updatedAt: new Date() })
        .where(and(eq(emailTemplateVariables.id, id), eq(emailTemplateVariables.orgId, orgId)))
        .returning();
      if (!variable) {
        return sendNotFound(res, "Email template variable");
      }
      res.json(variable);
    })
  );

  app.delete(
    "/api/email-template-variables/:id",
    writeOperationRateLimit,
    withErrorHandling("delete email template variable", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { id } = req.params;
      const [deleted] = await db
        .delete(emailTemplateVariables)
        .where(and(eq(emailTemplateVariables.id, id), eq(emailTemplateVariables.orgId, orgId)))
        .returning();
      if (!deleted) {
        return sendNotFound(res, "Email template variable");
      }
      res.json({ success: true });
    })
  );

  logger.info("AlertSettingsRoutes", "Registered");
}
