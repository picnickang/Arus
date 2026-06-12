import type { Express, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { withErrorHandling } from "../../lib/route-utils";
import { schedulingSettingsService } from "../../services/scheduling-settings/service";
import { logger } from "../../utils/logger";
import { authenticatedRequest } from "../../middleware/auth";
import {
  aiWeightsSchema,
  notificationSettingsSchema,
  publishBehaviorSchema,
  rotationTemplateSchema,
  ruleEnforcementSettingsSchema,
  ruleThresholdsSchema,
} from "@shared/schema-runtime";

const vesselIdOnlyQuerySchema = z.object({
  vesselId: z.string().optional(),
});

const rulesUpdateBodySchema = z.object({
  thresholds: ruleThresholdsSchema,
  enforcement: ruleEnforcementSettingsSchema,
});

function orgIdFromRequest(req: Request): string {
  return authenticatedRequest(req).orgId;
}

interface SchedulingSettingsRouteContext {
  requireOrgId: RequestHandler;
  writeOperationRateLimit: RequestHandler;
}

export function registerSchedulingSettingsRoutes(
  app: Express,
  context: SchedulingSettingsRouteContext
): void {
  const { requireOrgId, writeOperationRateLimit } = context;

  app.get(
    "/api/scheduling-settings",
    requireOrgId,
    withErrorHandling("fetch scheduling settings", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);

      const effective = await schedulingSettingsService.resolveEffectiveSettings(orgId, vesselId);
      const settings = await schedulingSettingsService.getSettings(orgId, vesselId);

      res.json({
        id: settings?.id || "",
        orgId,
        vesselId: vesselId || null,
        notificationSettings: effective.notificationSettings,
        ruleThresholds: effective.ruleThresholds,
        ruleEnforcement: effective.ruleEnforcement,
        aiWeights: effective.aiWeights,
        publishBehavior: effective.publishBehavior,
        rotationTemplates: effective.rotationTemplates,
        source: effective.source,
      });
    })
  );

  app.patch(
    "/api/scheduling-settings/notifications",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update notification settings", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = notificationSettingsSchema.parse(req.body);

      const updated = await schedulingSettingsService.updateNotificationSettings(
        orgId,
        body,
        vesselId
      );

      logger.info("SchedulingSettings", "Notifications updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/rules",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update rule settings", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const { thresholds, enforcement } = rulesUpdateBodySchema.parse(req.body);

      const updated = await schedulingSettingsService.updateRuleThresholds(
        orgId,
        thresholds,
        enforcement,
        vesselId
      );

      logger.info("SchedulingSettings", "Rules updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/ai-weights",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update AI weights", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = aiWeightsSchema.parse(req.body);

      const updated = await schedulingSettingsService.updateAiWeights(orgId, body, vesselId);

      logger.info("SchedulingSettings", "AI weights updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/publish-behavior",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update publish behavior", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = publishBehaviorSchema.parse(req.body);

      const updated = await schedulingSettingsService.updatePublishBehavior(orgId, body, vesselId);

      logger.info("SchedulingSettings", "Publish behavior updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/rotation-templates",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update rotation templates", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = z.array(rotationTemplateSchema).parse(req.body);

      const updated = await schedulingSettingsService.updateRotationTemplates(
        orgId,
        body,
        vesselId
      );

      logger.info("SchedulingSettings", "Rotation templates updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.post(
    "/api/scheduling-settings/reset",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("reset scheduling settings", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);

      const reset = await schedulingSettingsService.resetToDefaults(orgId, vesselId);

      logger.info("SchedulingSettings", "Settings reset to defaults", { orgId, vesselId });
      res.json(reset);
    })
  );

  logger.info("[SchedulingRoutes] Scheduling settings routes registered");
}
