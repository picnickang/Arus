/**
 * GDPR - Types
 */

import type {
  dataSubjectRequests,
  engineerOverrides,
} from "@shared/schema-runtime";

export type DataSubjectRequest = typeof dataSubjectRequests.$inferSelect;
export type InsertDataSubjectRequest = typeof dataSubjectRequests.$inferInsert;
export type MlEngineerOverride = typeof engineerOverrides.$inferSelect;
export type InsertMlEngineerOverride = typeof engineerOverrides.$inferInsert;
