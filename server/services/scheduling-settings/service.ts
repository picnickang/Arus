import { db } from "../../db";
import {
  schedulingSettings,
  createDefaultSchedulingSettings,
  insertSchedulingSettingsSchema,
  notificationSettingsSchema,
  ruleThresholdsSchema,
  ruleEnforcementSettingsSchema,
  aiWeightsSchema,
  publishBehaviorSchema,
  rotationTemplateSchema,
} from "@shared/schema/scheduling-settings";
import type {
  SelectSchedulingSettings,
  InsertSchedulingSettings,
  NotificationSettings,
  RuleThresholds,
  RuleEnforcementSettings,
  AiWeights,
  PublishBehavior,
  RotationTemplate,
} from "@shared/schema/scheduling-settings";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_RULE_THRESHOLDS,
  DEFAULT_RULE_ENFORCEMENT,
  DEFAULT_AI_WEIGHTS,
  DEFAULT_PUBLISH_BEHAVIOR,
  DEFAULT_ROTATION_TEMPLATES,
} from "@shared/schema/scheduling-settings";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:SchedulingSettings");
import { z } from "zod";

export interface EffectiveSettings {
  notificationSettings: NotificationSettings;
  ruleThresholds: RuleThresholds;
  ruleEnforcement: RuleEnforcementSettings;
  aiWeights: AiWeights;
  publishBehavior: PublishBehavior;
  rotationTemplates: RotationTemplate[];
  source: "vessel" | "global" | "default";
}

class SchedulingSettingsService {
  async getSettings(orgId: string, vesselId?: string): Promise<SelectSchedulingSettings | null> {
    if (!orgId) {
      logger.warn("[SchedulingSettings] getSettings called without orgId");
      return null;
    }

    try {
      const conditions = vesselId
        ? and(eq(schedulingSettings.orgId, orgId), eq(schedulingSettings.vesselId, vesselId))
        : and(eq(schedulingSettings.orgId, orgId), isNull(schedulingSettings.vesselId));

      const [result] = await db.select().from(schedulingSettings).where(conditions).limit(1);
      return result || null;
    } catch (error) {
      logger.error("[SchedulingSettings] Error fetching settings", { orgId, vesselId, error });
      return null;
    }
  }

  async getGlobalSettings(orgId: string): Promise<SelectSchedulingSettings | null> {
    return this.getSettings(orgId);
  }

  async getVesselSettings(
    orgId: string,
    vesselId: string
  ): Promise<SelectSchedulingSettings | null> {
    return this.getSettings(orgId, vesselId);
  }

  async resolveEffectiveSettings(orgId: string, vesselId?: string): Promise<EffectiveSettings> {
    if (vesselId) {
      const vesselSettings = await this.getVesselSettings(orgId, vesselId);
      if (vesselSettings) {
        return {
          notificationSettings: vesselSettings.notificationSettings,
          ruleThresholds: vesselSettings.ruleThresholds,
          ruleEnforcement: vesselSettings.ruleEnforcement,
          aiWeights: vesselSettings.aiWeights,
          publishBehavior: vesselSettings.publishBehavior,
          rotationTemplates: vesselSettings.rotationTemplates,
          source: "vessel",
        };
      }
    }

    const globalSettings = await this.getGlobalSettings(orgId);
    if (globalSettings) {
      return {
        notificationSettings: globalSettings.notificationSettings,
        ruleThresholds: globalSettings.ruleThresholds,
        ruleEnforcement: globalSettings.ruleEnforcement,
        aiWeights: globalSettings.aiWeights,
        publishBehavior: globalSettings.publishBehavior,
        rotationTemplates: globalSettings.rotationTemplates,
        source: "global",
      };
    }

    return {
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      ruleThresholds: DEFAULT_RULE_THRESHOLDS,
      ruleEnforcement: DEFAULT_RULE_ENFORCEMENT,
      aiWeights: DEFAULT_AI_WEIGHTS,
      publishBehavior: DEFAULT_PUBLISH_BEHAVIOR,
      rotationTemplates: DEFAULT_ROTATION_TEMPLATES,
      source: "default",
    };
  }

  async createOrUpdateSettings(
    settings: InsertSchedulingSettings
  ): Promise<SelectSchedulingSettings> {
    const validated = insertSchedulingSettingsSchema.parse({
      ...settings,
      id: settings.id || randomUUID(),
      vesselId: settings.vesselId ?? null,
    });

    const existing = await this.getSettings(validated.orgId, validated.vesselId || undefined);

    if (existing) {
      const [updated] = await db
        .update(schedulingSettings)
        .set({
          ...validated,
          updatedAt: new Date(),
        })
        .where(eq(schedulingSettings.id, existing.id))
        .returning();
      if (!updated) {throw new Error("createOrUpdateSettings: update returned no row");}

      logger.info("[SchedulingSettings] Updated settings", {
        id: existing.id,
        orgId: validated.orgId,
      });
      return updated;
    }

    const [created] = await db.insert(schedulingSettings).values(validated).returning();
    if (!created) {throw new Error("createOrUpdateSettings: insert returned no row");}

    logger.info("[SchedulingSettings] Created settings", {
      id: created.id,
      orgId: validated.orgId,
    });
    return created;
  }

  async updateNotificationSettings(
    orgId: string,
    notificationSettings: NotificationSettings,
    vesselId?: string
  ): Promise<SelectSchedulingSettings> {
    const validatedNotifications = notificationSettingsSchema.parse(notificationSettings);
    const existing = await this.getSettings(orgId, vesselId);

    if (existing) {
      const [updated] = await db
        .update(schedulingSettings)
        .set({ notificationSettings: validatedNotifications, updatedAt: new Date() })
        .where(eq(schedulingSettings.id, existing.id))
        .returning();
      if (!updated) {throw new Error("updateNotificationSettings: update returned no row");}
      return updated;
    }

    return this.createOrUpdateSettings({
      ...createDefaultSchedulingSettings(orgId, randomUUID()),
      vesselId: vesselId ?? null,
      notificationSettings: validatedNotifications,
    });
  }

  async updateRuleThresholds(
    orgId: string,
    ruleThresholds: RuleThresholds,
    ruleEnforcement: RuleEnforcementSettings,
    vesselId?: string
  ): Promise<SelectSchedulingSettings> {
    const validatedThresholds = ruleThresholdsSchema.parse(ruleThresholds);
    const validatedEnforcement = ruleEnforcementSettingsSchema.parse(ruleEnforcement);
    const existing = await this.getSettings(orgId, vesselId);

    if (existing) {
      const [updated] = await db
        .update(schedulingSettings)
        .set({
          ruleThresholds: validatedThresholds,
          ruleEnforcement: validatedEnforcement,
          updatedAt: new Date(),
        })
        .where(eq(schedulingSettings.id, existing.id))
        .returning();
      if (!updated) {throw new Error("updateRuleThresholds: update returned no row");}
      return updated;
    }

    return this.createOrUpdateSettings({
      ...createDefaultSchedulingSettings(orgId, randomUUID()),
      vesselId: vesselId ?? null,
      ruleThresholds: validatedThresholds,
      ruleEnforcement: validatedEnforcement,
    });
  }

  async updateAiWeights(
    orgId: string,
    aiWeights: AiWeights,
    vesselId?: string
  ): Promise<SelectSchedulingSettings> {
    const validatedWeights = aiWeightsSchema.parse(aiWeights);
    const existing = await this.getSettings(orgId, vesselId);

    if (existing) {
      const [updated] = await db
        .update(schedulingSettings)
        .set({ aiWeights: validatedWeights, updatedAt: new Date() })
        .where(eq(schedulingSettings.id, existing.id))
        .returning();
      if (!updated) {throw new Error("updateAiWeights: update returned no row");}
      return updated;
    }

    return this.createOrUpdateSettings({
      ...createDefaultSchedulingSettings(orgId, randomUUID()),
      vesselId: vesselId ?? null,
      aiWeights: validatedWeights,
    });
  }

  async updatePublishBehavior(
    orgId: string,
    publishBehavior: PublishBehavior,
    vesselId?: string
  ): Promise<SelectSchedulingSettings> {
    const validatedBehavior = publishBehaviorSchema.parse(publishBehavior);
    const existing = await this.getSettings(orgId, vesselId);

    if (existing) {
      const [updated] = await db
        .update(schedulingSettings)
        .set({ publishBehavior: validatedBehavior, updatedAt: new Date() })
        .where(eq(schedulingSettings.id, existing.id))
        .returning();
      if (!updated) {throw new Error("updatePublishBehavior: update returned no row");}
      return updated;
    }

    return this.createOrUpdateSettings({
      ...createDefaultSchedulingSettings(orgId, randomUUID()),
      vesselId: vesselId ?? null,
      publishBehavior: validatedBehavior,
    });
  }

  async updateRotationTemplates(
    orgId: string,
    rotationTemplates: RotationTemplate[],
    vesselId?: string
  ): Promise<SelectSchedulingSettings> {
    const validatedTemplates = z.array(rotationTemplateSchema).parse(rotationTemplates);
    const existing = await this.getSettings(orgId, vesselId);

    if (existing) {
      const [updated] = await db
        .update(schedulingSettings)
        .set({ rotationTemplates: validatedTemplates, updatedAt: new Date() })
        .where(eq(schedulingSettings.id, existing.id))
        .returning();
      if (!updated) {throw new Error("updateRotationTemplates: update returned no row");}
      return updated;
    }

    return this.createOrUpdateSettings({
      ...createDefaultSchedulingSettings(orgId, randomUUID()),
      vesselId: vesselId ?? null,
      rotationTemplates: validatedTemplates,
    });
  }

  async addRotationTemplate(
    orgId: string,
    template: Omit<RotationTemplate, "id">,
    vesselId?: string
  ): Promise<SelectSchedulingSettings> {
    const effective = await this.resolveEffectiveSettings(orgId, vesselId);
    const newTemplate: RotationTemplate = {
      ...template,
      id: randomUUID(),
    };

    const updatedTemplates = [...effective.rotationTemplates, newTemplate];
    return this.updateRotationTemplates(orgId, updatedTemplates, vesselId);
  }

  async setDefaultRotationTemplate(
    orgId: string,
    templateId: string,
    vesselId?: string
  ): Promise<SelectSchedulingSettings> {
    const effective = await this.resolveEffectiveSettings(orgId, vesselId);
    const updatedTemplates = effective.rotationTemplates.map((t) => ({
      ...t,
      isDefault: t.id === templateId,
    }));

    return this.updateRotationTemplates(orgId, updatedTemplates, vesselId);
  }

  async resetToDefaults(orgId: string, vesselId?: string): Promise<SelectSchedulingSettings> {
    return this.createOrUpdateSettings({
      ...createDefaultSchedulingSettings(orgId, randomUUID()),
      vesselId: vesselId || null,
    });
  }
}

export const schedulingSettingsService = new SchedulingSettingsService();
