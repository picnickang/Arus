import { pgTable, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organizations } from "./core";

export const notificationRecipientSchema = z.enum(["crew", "admin", "both", "none"]);
export type NotificationRecipient = z.infer<typeof notificationRecipientSchema>;

export const ruleEnforcementSchema = z.enum(["hard", "soft"]);
export type RuleEnforcement = z.infer<typeof ruleEnforcementSchema>;

export const notificationSettingsSchema = z.object({
  assignmentCreated: notificationRecipientSchema.default("both"),
  assignmentUpdated: notificationRecipientSchema.default("admin"),
  assignmentCancelled: notificationRecipientSchema.default("both"),
  schedulePublished: notificationRecipientSchema.default("both"),
  complianceWarning: notificationRecipientSchema.default("admin"),
  restHoursViolation: notificationRecipientSchema.default("both"),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export const ruleThresholdsSchema = z.object({
  maxOnboardDays: z.number().min(1).max(365).default(28),
  minRestHours: z.number().min(1).max(24).default(10),
  certExpiryWarningDays: z.number().min(1).max(180).default(30),
  overlapBufferHours: z.number().min(0).max(24).default(4),
});
export type RuleThresholds = z.infer<typeof ruleThresholdsSchema>;

export const ruleEnforcementSettingsSchema = z.object({
  maxOnboardDays: ruleEnforcementSchema.default("hard"),
  minRestHours: ruleEnforcementSchema.default("soft"),
  certExpiryWarning: ruleEnforcementSchema.default("soft"),
  overlapBuffer: ruleEnforcementSchema.default("hard"),
});
export type RuleEnforcementSettings = z.infer<typeof ruleEnforcementSettingsSchema>;

export const aiWeightsSchema = z.object({
  continuityPreference: z.number().min(0).max(100).default(50),
  fairnessBalance: z.number().min(0).max(100).default(50),
  fatiguePenalty: z.number().min(0).max(100).default(50),
  certExpiryProximity: z.number().min(0).max(100).default(50),
});
export type AiWeights = z.infer<typeof aiWeightsSchema>;

export const publishBehaviorSchema = z.object({
  whoCanPublish: z.enum(["admins_only", "supervisors", "anyone"]).default("admins_only"),
  allowCrewToSeeDrafts: z.boolean().default(false),
  autoEmailOnPublish: z.boolean().default(false),
  lockScheduleAfterPublish: z.boolean().default(true),
});
export type PublishBehavior = z.infer<typeof publishBehaviorSchema>;

export const rotationTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  daysOn: z.number().min(1).max(180),
  daysOff: z.number().min(1).max(180),
  isDefault: z.boolean().default(false),
  vesselId: z.string().optional(),
  rankFilter: z.array(z.string()).optional(),
});
export type RotationTemplate = z.infer<typeof rotationTemplateSchema>;

export const schedulingSettings = pgTable("scheduling_settings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orgId: varchar("org_id", { length: 36 })
    .notNull()
    .references(() => organizations.id),
  vesselId: varchar("vessel_id", { length: 36 }),
  notificationSettings: jsonb("notification_settings").$type<NotificationSettings>().notNull(),
  ruleThresholds: jsonb("rule_thresholds").$type<RuleThresholds>().notNull(),
  ruleEnforcement: jsonb("rule_enforcement").$type<RuleEnforcementSettings>().notNull(),
  aiWeights: jsonb("ai_weights").$type<AiWeights>().notNull(),
  publishBehavior: jsonb("publish_behavior").$type<PublishBehavior>().notNull(),
  rotationTemplates: jsonb("rotation_templates").$type<RotationTemplate[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSchedulingSettingsSchema = createInsertSchema(schedulingSettings).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertSchedulingSettings = z.infer<typeof insertSchedulingSettingsSchema>;
export type SelectSchedulingSettings = typeof schedulingSettings.$inferSelect;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  assignmentCreated: "both",
  assignmentUpdated: "admin",
  assignmentCancelled: "both",
  schedulePublished: "both",
  complianceWarning: "admin",
  restHoursViolation: "both",
};

export const DEFAULT_RULE_THRESHOLDS: RuleThresholds = {
  maxOnboardDays: 28,
  minRestHours: 10,
  certExpiryWarningDays: 30,
  overlapBufferHours: 4,
};

export const DEFAULT_RULE_ENFORCEMENT: RuleEnforcementSettings = {
  maxOnboardDays: "hard",
  minRestHours: "soft",
  certExpiryWarning: "soft",
  overlapBuffer: "hard",
};

export const DEFAULT_AI_WEIGHTS: AiWeights = {
  continuityPreference: 50,
  fairnessBalance: 50,
  fatiguePenalty: 50,
  certExpiryProximity: 50,
};

export const DEFAULT_PUBLISH_BEHAVIOR: PublishBehavior = {
  whoCanPublish: "admins_only",
  allowCrewToSeeDrafts: false,
  autoEmailOnPublish: false,
  lockScheduleAfterPublish: true,
};

export const DEFAULT_ROTATION_TEMPLATES: RotationTemplate[] = [
  { id: "28-28", name: "28/28 Rotation", daysOn: 28, daysOff: 28, isDefault: true },
  { id: "35-35", name: "35/35 Rotation", daysOn: 35, daysOff: 35, isDefault: false },
];

export function createDefaultSchedulingSettings(
  orgId: string,
  id: string
): InsertSchedulingSettings {
  return {
    id,
    orgId,
    notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    ruleThresholds: DEFAULT_RULE_THRESHOLDS,
    ruleEnforcement: DEFAULT_RULE_ENFORCEMENT,
    aiWeights: DEFAULT_AI_WEIGHTS,
    publishBehavior: DEFAULT_PUBLISH_BEHAVIOR,
    rotationTemplates: DEFAULT_ROTATION_TEMPLATES,
  };
}
