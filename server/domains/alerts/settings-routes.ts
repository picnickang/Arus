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
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";

function stripUndefined<T extends Record<string, unknown>>(
  obj: T
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as { [K in keyof T]: Exclude<T[K], undefined> };
}

import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";

const updateSettingsSchema = insertAlertSettingsSchema.partial().extend({
  apiKey: z.string().optional(),
  smtpPassword: z.string().optional(),
});

const testEmailSchema = z.object({
  email: z.string().email(),
});

const vesselIdParamSchema = z.object({ vesselId: z.string().min(1) });
const keyParamSchema = z.object({ key: z.string().min(1) });
const typeParamSchema = z.object({ type: z.enum(["purchaseOrder", "serviceOrder"]) });
const categoryQuerySchema = z.object({ category: z.string().optional() });
const vesselIdQuerySchema = z.object({ vesselId: z.string().optional() });
const previewBodySchema = z.object({
  template: z.unknown(),
  type: z.string(),
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
    writeOperationRateLimit: import("express").RequestHandler;
    criticalOperationRateLimit: import("express").RequestHandler;
    generalApiRateLimit: import("express").RequestHandler;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/alert-settings",
    generalApiRateLimit,
    withErrorHandling("get alert settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const settings = await alertSettingsService.getSettings(orgId);
      return res.json(settings);
    })
  );

  app.put(
    "/api/alert-settings",
    writeOperationRateLimit,
    withErrorHandling("update alert settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const data = updateSettingsSchema.parse(req.body);
      const settings = await alertSettingsService.updateSettings(orgId, stripUndefined(data));
      return res.json(settings);
    })
  );

  app.post(
    "/api/alert-settings/test-connection",
    writeOperationRateLimit,
    withErrorHandling("test email connection", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const result = await alertSettingsService.testEmailConnection(orgId);
      return res.json(result);
    })
  );

  app.post(
    "/api/alert-settings/send-test",
    writeOperationRateLimit,
    withErrorHandling("send test email", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { email } = testEmailSchema.parse(req.body);
      const result = await alertSettingsService.sendTestEmail(orgId, email);
      return res.json(result);
    })
  );

  app.get(
    "/api/alert-settings/vessels",
    generalApiRateLimit,
    withErrorHandling("get vessel settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const settings = await alertSettingsService.getAllVesselSettings(orgId);
      return res.json(settings);
    })
  );

  app.get(
    "/api/alert-settings/vessels/:vesselId",
    generalApiRateLimit,
    withErrorHandling("get vessel settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { vesselId } = vesselIdParamSchema.parse(req.params);
      const settings = await alertSettingsService.getVesselSettings(orgId, vesselId);
      if (!settings) {
        return sendNotFound(res, "Vessel settings");
      }
      return res.json(settings);
    })
  );

  app.put(
    "/api/alert-settings/vessels/:vesselId",
    writeOperationRateLimit,
    withErrorHandling("update vessel settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { vesselId } = vesselIdParamSchema.parse(req.params);
      const data = insertAlertSettingsVesselSchema.partial().parse(req.body);
      const settings = await alertSettingsService.updateVesselSettings(
        orgId,
        vesselId,
        stripUndefined(data)
      );
      return res.json(settings);
    })
  );

  app.delete(
    "/api/alert-settings/vessels/:vesselId",
    criticalOperationRateLimit,
    withErrorHandling("delete vessel settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { vesselId } = vesselIdParamSchema.parse(req.params);
      await alertSettingsService.deleteVesselSettings(orgId, vesselId);
      return res.status(204).send();
    })
  );

  app.get(
    "/api/alert-settings/thresholds",
    generalApiRateLimit,
    withErrorHandling("get alert thresholds", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { category } = categoryQuerySchema.parse(req.query);
      const thresholds = await alertSettingsService.getThresholds(orgId, category);
      return res.json(thresholds);
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
      const threshold = await alertSettingsService.updateThreshold(orgId, data.key, stripUndefined(data));
      return res.status(201).json(threshold);
    })
  );

  app.put(
    "/api/alert-settings/thresholds/:key",
    writeOperationRateLimit,
    withErrorHandling("update alert threshold", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const data = insertAlertThresholdSchema.partial().parse(req.body);
      const { key } = keyParamSchema.parse(req.params);
      const threshold = await alertSettingsService.updateThreshold(orgId, key, stripUndefined(data));
      return res.json(threshold);
    })
  );

  app.delete(
    "/api/alert-settings/thresholds/:key",
    criticalOperationRateLimit,
    withErrorHandling("delete alert threshold", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { key } = keyParamSchema.parse(req.params);
      await alertSettingsService.deleteThreshold(orgId, key);
      return res.status(204).send();
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
      return res.json(logs);
    })
  );

  app.get(
    "/api/alert-settings/crew",
    generalApiRateLimit,
    withErrorHandling("get crew alert settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { vesselId } = vesselIdQuerySchema.parse(req.query);
      const settings = await alertSettingsService.getCrewAlertSettings(orgId, vesselId);
      return res.json(settings ?? {});
    })
  );

  app.get(
    "/api/alert-settings/crew/all",
    generalApiRateLimit,
    withErrorHandling("get all crew alert settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const settings = await alertSettingsService.getAllCrewAlertSettings(orgId);
      return res.json(settings);
    })
  );

  app.put(
    "/api/alert-settings/crew",
    writeOperationRateLimit,
    withErrorHandling("update crew alert settings", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const vesselId = vesselIdQuerySchema.parse(req.query).vesselId ?? null;
      const data = insertCrewAlertSettingsSchema.partial().parse(req.body);
      const settings = await alertSettingsService.updateCrewAlertSettings(orgId, vesselId, stripUndefined(data));
      return res.json(settings);
    })
  );

  app.post(
    "/api/alerts/run",
    criticalOperationRateLimit,
    withErrorHandling("run crew alerts", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { vesselId } = vesselIdQuerySchema.parse(req.query);
      const { alertRunnerService } = await import("./alert-runner");
      const result = await alertRunnerService.runCrewAlerts({
        orgId,
        vesselId,
        now: new Date(),
      });
      return res.json(result);
    })
  );

  app.get(
    "/api/alerts/preview",
    generalApiRateLimit,
    withErrorHandling("preview alerts", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { vesselId } = vesselIdQuerySchema.parse(req.query);
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
      return res.json(templates);
    })
  );

  app.get(
    "/api/email-templates/placeholders",
    generalApiRateLimit,
    withErrorHandling("get email template placeholders", async (_req: Request, res: Response) => {
      const placeholders = emailTemplatesService.getPlaceholders();
      return res.json(placeholders);
    })
  );

  app.get(
    "/api/email-templates/defaults",
    generalApiRateLimit,
    withErrorHandling("get default email templates", async (_req: Request, res: Response) => {
      const defaults = emailTemplatesService.getDefaultTemplates();
      return res.json(defaults);
    })
  );

  app.patch(
    "/api/email-templates",
    writeOperationRateLimit,
    withErrorHandling("update email templates", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const body = z.record(z.unknown()).parse(req.body);
      const templates = await emailTemplatesService.updateTemplates(
        orgId,
        body as Parameters<typeof emailTemplatesService.updateTemplates>[1]
      );
      return res.json(templates);
    })
  );

  app.post(
    "/api/email-templates/reset/:type",
    writeOperationRateLimit,
    withErrorHandling("reset email template", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const parsedParams = typeParamSchema.safeParse(req.params);
      if (!parsedParams.success) {
        return res.status(400).json({ message: "Invalid template type" });
      }
      const templates = await emailTemplatesService.resetTemplate(orgId, parsedParams.data.type);
      return res.json(templates);
    })
  );

  app.post(
    "/api/email-templates/preview",
    generalApiRateLimit,
    withErrorHandling("preview email template", async (req: Request, res: Response) => {
      const parsed = previewBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Template and type are required" });
      }
      const { template, type } = parsed.data;
      const preview = emailTemplatesService.generatePreview(
        template as Parameters<typeof emailTemplatesService.generatePreview>[0],
        type as Parameters<typeof emailTemplatesService.generatePreview>[1]
      );
      return res.json(preview);
    })
  );

  // NOTE: The email_template_variables table does not exist in PostgreSQL.
  // These endpoints return 501 Not Implemented until the table is provisioned
  // or the feature is removed from the client.
  const notImplemented = (_req: Request, res: Response) => {
    res.status(501).json({
      message:
        "Email template variables are not provisioned in this environment (email_template_variables table is missing).",
    });
  };
  app.get("/api/email-template-variables", generalApiRateLimit, notImplemented);
  app.post("/api/email-template-variables", writeOperationRateLimit, notImplemented);
  app.patch("/api/email-template-variables/:id", writeOperationRateLimit, notImplemented);
  app.delete("/api/email-template-variables/:id", writeOperationRateLimit, notImplemented);

  logger.info("AlertSettingsRoutes", "Registered");
}
