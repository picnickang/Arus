/**
 * Schema: Vessel Certificates
 *
 * Statutory and class certificates with validity tracking, survey windows,
 * conditions of class, and flag state endorsements.
 */

import { sql, pgTable, text, varchar, timestamp, jsonb, createInsertSchema, z } from "./base";
import { organizations } from "./core";
import { vessels } from "./vessels";
import { equipment } from "./equipment";

export const CERTIFICATE_TYPES = [
  "safety_equipment",
  "safety_radio",
  "safety_construction",
  "load_line",
  "iopp",
  "ispp",
  "class_machinery",
  "class_hull",
  "class_electrical",
  "smc",
  "issc",
  "doc",
  "mlc",
  "ism",
  "tonnage",
  "registry",
  "minimum_safe_manning",
  "other",
] as const;

export const ISSUING_AUTHORITY_TYPES = [
  "class_society",
  "flag_state",
  "recognized_organization",
  "port_state",
] as const;

export const CERTIFICATE_STATUSES = [
  "valid",
  "expired",
  "suspended",
  "withdrawn",
  "pending_renewal",
] as const;

export const vesselCertificates = pgTable(
  "vessel_certificates",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id")
      .notNull()
      .references(() => vessels.id),

    certificateType: text("certificate_type").notNull(),
    certificateNumber: text("certificate_number"),
    certificateName: text("certificate_name").notNull(),

    issuingAuthority: text("issuing_authority").notNull(),
    issuingAuthorityType: text("issuing_authority_type").notNull().default("class_society"),

    issueDate: timestamp("issue_date", { mode: "date" }).notNull(),
    expiryDate: timestamp("expiry_date", { mode: "date" }),

    lastSurveyDate: timestamp("last_survey_date", { mode: "date" }),
    nextSurveyDue: timestamp("next_survey_due", { mode: "date" }),
    surveyWindowStart: timestamp("survey_window_start", { mode: "date" }),
    surveyWindowEnd: timestamp("survey_window_end", { mode: "date" }),

    status: text("status").notNull().default("valid"),

    conditionsOfClass: jsonb("conditions_of_class").default(sql`'[]'::jsonb`),
    endorsements: jsonb("endorsements").default(sql`'[]'::jsonb`),

    surveyId: varchar("survey_id"),
    equipmentId: varchar("equipment_id").references(() => equipment.id),

    documentUrl: text("document_url"),

    notes: text("notes"),
    createdBy: varchar("created_by"),
    updatedBy: varchar("updated_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgVesselIdx: sql`CREATE INDEX IF NOT EXISTS idx_vessel_certs_org_vessel ON vessel_certificates (${table.orgId}, ${table.vesselId})`,
    expiryIdx: sql`CREATE INDEX IF NOT EXISTS idx_vessel_certs_expiry ON vessel_certificates (${table.orgId}, ${table.expiryDate}) WHERE status = 'valid'`,
    surveyDueIdx: sql`CREATE INDEX IF NOT EXISTS idx_vessel_certs_survey_due ON vessel_certificates (${table.orgId}, ${table.nextSurveyDue}) WHERE status = 'valid'`,
    typeIdx: sql`CREATE INDEX IF NOT EXISTS idx_vessel_certs_type ON vessel_certificates (${table.certificateType}, ${table.status})`,
  })
);

export const certificateEvents = pgTable(
  "certificate_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    certificateId: varchar("certificate_id")
      .notNull()
      .references(() => vesselCertificates.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    userId: varchar("user_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    certEventIdx: sql`CREATE INDEX IF NOT EXISTS idx_cert_events_cert ON certificate_events (${table.certificateId}, ${table.createdAt} DESC)`,
  })
);

export const insertVesselCertificateSchema = createInsertSchema(vesselCertificates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCertificateEventSchema = createInsertSchema(certificateEvents).omit({
  id: true,
  createdAt: true,
});

export type VesselCertificate = typeof vesselCertificates.$inferSelect;
export type InsertVesselCertificate = z.infer<typeof insertVesselCertificateSchema>;

export type CertificateEvent = typeof certificateEvents.$inferSelect;
export type InsertCertificateEvent = z.infer<typeof insertCertificateEventSchema>;

export type CertificateType = (typeof CERTIFICATE_TYPES)[number];
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];
export type IssuingAuthorityType = (typeof ISSUING_AUTHORITY_TYPES)[number];

export interface ConditionOfClass {
  id: string;
  description: string;
  dueDate: string;
  status: "open" | "closed" | "overdue";
  imposedDate: string;
  closedDate?: string;
  closedBy?: string;
}

export interface FlagStateEndorsement {
  flagState: string;
  endorsementNumber: string;
  issueDate: string;
  expiryDate?: string;
}
