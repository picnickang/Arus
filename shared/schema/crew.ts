/**
 * Schema Crew - Crew Management, Skills, Certifications, and Scheduling
 */

import { createInsertSchema, z } from "./base";
import {
  crew,
  crewAlerts,
  crewEmploymentHistory,
  crewNotificationSettings,
  crewRoles,
} from "./crew/people";
import {
  crewAssignment,
  crewCertification,
  crewDocuments,
  crewLeave,
  crewRestDay,
  crewRestSheet,
  crewSkill,
  shiftTemplate,
  skills,
} from "./crew/operations";

export * from "./crew/people";
export * from "./crew/operations";

// Insert schemas
// NOTE: `userId` (the 1:1 login-account link) is intentionally omitted. The
// link/unlink lifecycle is owned exclusively by the admin-gated crew-admin
// endpoints (/api/admin/crew/members/:crewId/{account,link}); exposing it here
// would let the generic, non-admin /api/crew CRUD routes set or clear the
// account link and bypass those guardrails.
export const insertCrewSchema = createInsertSchema(crew).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCrewEmploymentHistorySchema = createInsertSchema(crewEmploymentHistory).omit({
  id: true,
  createdAt: true,
});
export const insertCrewNotificationSettingsSchema = createInsertSchema(
  crewNotificationSettings
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrewAlertSchema = createInsertSchema(crewAlerts)
  .omit({
    id: true,
    acknowledged: true,
    acknowledgedAt: true,
    acknowledgedBy: true,
    acknowledgedNotes: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    // Matches the crew_alerts_severity_valid CHECK constraint (0042).
    severity: z.enum(["critical", "warning", "notice"]).default("notice"),
  });
export const insertCrewRoleSchema = createInsertSchema(crewRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertSkillSchema = createInsertSchema(skills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCrewSkillSchema = createInsertSchema(crewSkill);
export const insertCrewLeaveSchema = createInsertSchema(crewLeave).omit({
  id: true,
  createdAt: true,
});
export const insertShiftTemplateSchema = createInsertSchema(shiftTemplate).omit({
  id: true,
  createdAt: true,
});
export const insertCrewAssignmentSchema = createInsertSchema(crewAssignment).omit({
  id: true,
  createdAt: true,
});
export const insertCrewCertificationSchema = createInsertSchema(crewCertification).omit({
  id: true,
  createdAt: true,
});
export const insertCrewDocumentSchema = createInsertSchema(crewDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCrewRestSheetSchema = createInsertSchema(crewRestSheet).omit({
  id: true,
  createdAt: true,
});
export const insertCrewRestDaySchema = createInsertSchema(crewRestDay);

// Types
export type Crew = typeof crew.$inferSelect;
export type SelectCrew = Crew;
// Canonical CrewMember alias. Single source of truth — every other
// module that needs a "crew member" shape should rename its local
// type or import this one. Counted by check-duplicate-domain-types.
export type CrewMember = Crew;
export type InsertCrew = z.infer<typeof insertCrewSchema>;
export type CrewEmploymentHistory = typeof crewEmploymentHistory.$inferSelect;
export type SelectCrewEmploymentHistory = CrewEmploymentHistory;
export type InsertCrewEmploymentHistory = z.infer<typeof insertCrewEmploymentHistorySchema>;
export type CrewNotificationSettings = typeof crewNotificationSettings.$inferSelect;
export type InsertCrewNotificationSettings = z.infer<typeof insertCrewNotificationSettingsSchema>;
export type CrewAlert = typeof crewAlerts.$inferSelect;
export type SelectCrewAlert = CrewAlert;
export type InsertCrewAlert = z.infer<typeof insertCrewAlertSchema>;

export type CrewRole = typeof crewRoles.$inferSelect;
export type SelectCrewRole = CrewRole;
export type InsertCrewRole = z.infer<typeof insertCrewRoleSchema>;
export type Skill = typeof skills.$inferSelect;
export type SelectSkill = Skill;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type CrewSkill = typeof crewSkill.$inferSelect;
export type SelectCrewSkill = CrewSkill;
export type InsertCrewSkill = z.infer<typeof insertCrewSkillSchema>;
export type CrewLeave = typeof crewLeave.$inferSelect;
export type SelectCrewLeave = CrewLeave;
export type InsertCrewLeave = z.infer<typeof insertCrewLeaveSchema>;
export type ShiftTemplate = typeof shiftTemplate.$inferSelect;
export type SelectShiftTemplate = ShiftTemplate;
export type InsertShiftTemplate = z.infer<typeof insertShiftTemplateSchema>;
export type CrewAssignment = typeof crewAssignment.$inferSelect;
export type SelectCrewAssignment = CrewAssignment;
export type InsertCrewAssignment = z.infer<typeof insertCrewAssignmentSchema>;
export type CrewCertification = typeof crewCertification.$inferSelect;
export type SelectCrewCertification = CrewCertification;
export type InsertCrewCertification = z.infer<typeof insertCrewCertificationSchema>;
export type CrewDocument = typeof crewDocuments.$inferSelect;
export type SelectCrewDocument = CrewDocument;
export type InsertCrewDocument = z.infer<typeof insertCrewDocumentSchema>;
export type CrewRestSheet = typeof crewRestSheet.$inferSelect;
export type SelectCrewRestSheet = CrewRestSheet;
export type InsertCrewRestSheet = z.infer<typeof insertCrewRestSheetSchema>;
export type CrewRestDay = typeof crewRestDay.$inferSelect;
export type SelectCrewRestDay = CrewRestDay;
export type InsertCrewRestDay = z.infer<typeof insertCrewRestDaySchema>;
