/**
 * Scheduled Reports - REST API Routes
 */

import { Router, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth.js";
import { z } from "zod";
import { ReportSchedulerService } from "../application/report-scheduler-service.js";
import { ReportGenerationService } from "../application/report-generation-service.js";
import { isCloudMode, canUseCloudFeature } from "../../../config/runtimeEnv.js";
import { DEFAULT_ORG_ID } from "../../../../shared/config/tenant.js";
import { logger } from "../../../utils/logger.js";
import { DbSettingsStorage } from "../../../db/system-admin/db-settings.js";

const LOG_CTX = "ScheduledReportsRoutes";
const SETTINGS_CATEGORY = "scheduled_reports";

export interface ScheduledReportsSettings {
  reportRetentionDays: number;
  defaultTimezone: string;
  maxRecipientsPerSchedule: number;
  reportGenerationTimeoutSeconds: number;
}

export const DEFAULT_SCHEDULED_REPORTS_SETTINGS: ScheduledReportsSettings = {
  reportRetentionDays: 7,
  defaultTimezone: "UTC",
  maxRecipientsPerSchedule: 10,
  reportGenerationTimeoutSeconds: 120,
};

const UpdateSettingsSchema = z.object({
  reportRetentionDays: z.number().min(1).max(365).optional(),
  defaultTimezone: z.string().min(1).optional(),
  maxRecipientsPerSchedule: z.number().min(1).max(50).optional(),
  reportGenerationTimeoutSeconds: z.number().min(30).max(600).optional(),
});

const REPORT_TYPES = [
  "fleet_health",
  "maintenance_due",
  "inventory_status",
  "crew_compliance",
  "cost_summary",
] as const;
const FREQUENCIES = ["daily", "weekly", "monthly"] as const;
const FORMATS = ["pdf", "csv", "json"] as const;

const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  reportType: z.enum(REPORT_TYPES),
  frequency: z.enum(FREQUENCIES),
  cronExpression: z.string().optional(),
  timezone: z.string().default("UTC"),
  format: z.enum(FORMATS).default("pdf"),
  recipients: z.array(z.string().email()).min(1),
  vesselIds: z.array(z.string().uuid()).nullable().optional(),
  enabled: z.boolean().default(true),
});

const UpdateScheduleSchema = CreateScheduleSchema.partial();

const GenerateOnDemandSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  format: z.enum(FORMATS).default("pdf"),
  vesselIds: z.array(z.string().uuid()).nullable().optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });
const limitQuerySchema = z.object({ limit: z.coerce.number().int().optional() });

export function createScheduledReportsRouter(
  schedulerService: ReportSchedulerService,
  generationService: ReportGenerationService
): Router {
  const router = Router();

  const requireCloudFeature = (req: Request, res: Response, next: Function) => {
    if (!isCloudMode || !canUseCloudFeature("scheduledReports")) {
      return res.status(403).json({
        error: "Scheduled reports are only available in cloud mode",
        code: "FEATURE_DISABLED",
      });
    }
    next();
  };

  router.get("/schedules", requireCloudFeature, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.orgId || DEFAULT_ORG_ID;
      const schedules = await schedulerService.getSchedulesByOrg(orgId);
      res.json({ data: schedules });
    } catch (error) {
      logger.error(LOG_CTX, "Failed to list schedules", String(error));
      res.status(500).json({ error: "Failed to list schedules" });
    }
  });

  router.get("/schedules/:id", requireCloudFeature, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.orgId || DEFAULT_ORG_ID;
      const schedule = await schedulerService.getSchedule(idParamSchema.parse(req.params).id, orgId);

      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      res.json({ data: schedule });
    } catch (error) {
      logger.error(LOG_CTX, "Failed to get schedule", String(error));
      res.status(500).json({ error: "Failed to get schedule" });
    }
  });

  router.post("/schedules", requireCloudFeature, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.orgId || DEFAULT_ORG_ID;
      const userId = req.user?.id || "system";

      const validation = CreateScheduleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: validation.error.errors,
        });
      }

      const schedule = await schedulerService.createSchedule(orgId, validation.data, userId);
      res.status(201).json({ data: schedule });
    } catch (error) {
      logger.error(LOG_CTX, "Failed to create schedule", String(error));
      res.status(500).json({ error: "Failed to create schedule" });
    }
  });

  router.patch("/schedules/:id", requireCloudFeature, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.orgId || DEFAULT_ORG_ID;
      const userId = req.user?.id || "system";

      const validation = UpdateScheduleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: validation.error.errors,
        });
      }

      const schedule = await schedulerService.updateSchedule(
        idParamSchema.parse(req.params).id,
        orgId,
        validation.data,
        userId
      );
      res.json({ data: schedule });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found")) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      logger.error(LOG_CTX, "Failed to update schedule", message);
      res.status(500).json({ error: "Failed to update schedule" });
    }
  });

  router.delete("/schedules/:id", requireCloudFeature, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.orgId || DEFAULT_ORG_ID;
      const userId = req.user?.id || "system";

      await schedulerService.deleteSchedule(idParamSchema.parse(req.params).id, orgId, userId);
      res.status(204).send();
    } catch (error) {
      logger.error(LOG_CTX, "Failed to delete schedule", String(error));
      res.status(500).json({ error: "Failed to delete schedule" });
    }
  });

  router.post("/schedules/:id/run", requireCloudFeature, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.orgId || DEFAULT_ORG_ID;
      await schedulerService.runScheduleNow(idParamSchema.parse(req.params).id, orgId);
      res.json({ message: "Report generation started" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found")) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      logger.error(LOG_CTX, "Failed to run schedule", message);
      res.status(500).json({ error: "Failed to run schedule" });
    }
  });

  router.get("/schedules/:id/history", requireCloudFeature, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.orgId || DEFAULT_ORG_ID;
      const limit = limitQuerySchema.parse(req.query).limit ?? 10;
      const reports = await schedulerService.getReportHistory(idParamSchema.parse(req.params).id, orgId, limit);
      res.json({ data: reports });
    } catch (error) {
      logger.error(LOG_CTX, "Failed to get report history", String(error));
      res.status(500).json({ error: "Failed to get report history" });
    }
  });

  router.get("/reports", requireCloudFeature, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.orgId || DEFAULT_ORG_ID;
      const limit = limitQuerySchema.parse(req.query).limit ?? 50;
      const reports = await schedulerService.getAllReports(orgId, limit);
      res.json({ data: reports });
    } catch (error) {
      logger.error(LOG_CTX, "Failed to list reports", String(error));
      res.status(500).json({ error: "Failed to list reports" });
    }
  });

  router.post("/reports/generate", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.orgId || DEFAULT_ORG_ID;

      const validation = GenerateOnDemandSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: validation.error.errors,
        });
      }

      const { reportType, format, vesselIds } = validation.data;
      const result = await generationService.generateOnDemand(
        orgId,
        reportType,
        vesselIds || null,
        format
      );

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.send(result.content);
    } catch (error) {
      logger.error(LOG_CTX, "Failed to generate report", String(error));
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  router.get("/report-types", (req: AuthenticatedRequest, res: Response) => {
    res.json({
      data: REPORT_TYPES.map((type) => ({
        id: type,
        name: type
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      })),
    });
  });

  // ============================================================================
  // SETTINGS ENDPOINTS
  // ============================================================================

  const settingsStorage = new DbSettingsStorage();

  async function getSettingsFromDb(orgId: string): Promise<ScheduledReportsSettings> {
    const dbSettings = await settingsStorage.getSettingsByCategory(orgId, SETTINGS_CATEGORY);
    const settings: ScheduledReportsSettings = { ...DEFAULT_SCHEDULED_REPORTS_SETTINGS };

    for (const setting of dbSettings) {
      if (setting.key === "report_retention_days" && typeof setting.value === "number") {
        settings.reportRetentionDays = setting.value;
      } else if (setting.key === "default_timezone" && typeof setting.value === "string") {
        settings.defaultTimezone = setting.value;
      } else if (
        setting.key === "max_recipients_per_schedule" &&
        typeof setting.value === "number"
      ) {
        settings.maxRecipientsPerSchedule = setting.value;
      } else if (
        setting.key === "report_generation_timeout_seconds" &&
        typeof setting.value === "number"
      ) {
        settings.reportGenerationTimeoutSeconds = setting.value;
      }
    }

    return settings;
  }

  async function upsertSetting(
    orgId: string,
    key: string,
    value: number | string,
    dataType: "string" | "number" | "boolean" | "object" | "array"
  ): Promise<void> {
    const existing = await settingsStorage.getAdminSystemSetting(orgId, SETTINGS_CATEGORY, key);
    if (existing) {
      await settingsStorage.updateAdminSystemSetting(existing.id, { value });
    } else {
      await settingsStorage.createAdminSystemSetting({
        orgId,
        category: SETTINGS_CATEGORY,
        key,
        value,
        dataType,
        description: `Scheduled reports setting: ${key}`,
      });
    }
  }

  router.get("/settings", requireCloudFeature, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.orgId || DEFAULT_ORG_ID;
      const settings = await getSettingsFromDb(orgId);
      res.json({ data: settings });
    } catch (error) {
      logger.error(LOG_CTX, "Failed to get settings", String(error));
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  router.patch("/settings", requireCloudFeature, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.orgId || DEFAULT_ORG_ID;

      const validation = UpdateSettingsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: validation.error.errors,
        });
      }

      const updates = validation.data;

      if (updates.reportRetentionDays !== undefined) {
        await upsertSetting(orgId, "report_retention_days", updates.reportRetentionDays, "number");
      }
      if (updates.defaultTimezone !== undefined) {
        await upsertSetting(orgId, "default_timezone", updates.defaultTimezone, "string");
      }
      if (updates.maxRecipientsPerSchedule !== undefined) {
        await upsertSetting(
          orgId,
          "max_recipients_per_schedule",
          updates.maxRecipientsPerSchedule,
          "number"
        );
      }
      if (updates.reportGenerationTimeoutSeconds !== undefined) {
        await upsertSetting(
          orgId,
          "report_generation_timeout_seconds",
          updates.reportGenerationTimeoutSeconds,
          "number"
        );
      }

      const updatedSettings = await getSettingsFromDb(orgId);
      logger.info(LOG_CTX, "Settings updated", { orgId, updates });
      res.json({ data: updatedSettings });
    } catch (error) {
      logger.error(LOG_CTX, "Failed to update settings", String(error));
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  return router;
}
