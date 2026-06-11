/**
 * Crew skill, assignment, credential, document, and rest schema tables.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  numeric,
  timestamp,
  boolean,
  index,
  unique,
} from "../base";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { organizations, users } from "../core";
import { vessels } from "../vessels";
import { roles } from "../permissions";
import { crew } from "./people";

export const skills = pgTable("skills", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull().unique(),
  category: text("category"),
  description: text("description"),
  maxLevel: integer("max_level").default(5),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const crewSkill = pgTable(
  "crew_skill",
  {
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    crewId: varchar("crew_id")
      .notNull()
      .references(() => crew.id),
    skill: text("skill").notNull(),
    level: integer("level").default(1),
  },
  (table) => ({
    pk: sql`PRIMARY KEY (${table.crewId}, ${table.skill})`,
    orgIdIdx: index("idx_crew_skill_org_id").on(table.orgId),
  })
);

export const crewLeave = pgTable(
  "crew_leave",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    crewId: varchar("crew_id")
      .notNull()
      .references(() => crew.id),
    start: timestamp("start", { mode: "date" }).notNull(),
    end: timestamp("end", { mode: "date" }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_crew_leave_org_id").on(table.orgId),
  })
);

export const shiftTemplate = pgTable(
  "shift_template",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    equipmentId: text("equipment_id"),
    role: text("role").notNull(),
    start: text("start").notNull(),
    end: text("end").notNull(),
    durationH: real("duration_h").notNull(),
    requiredSkills: text("required_skills"),
    rankMin: text("rank_min"),
    certRequired: text("cert_required"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_shift_template_org_id").on(table.orgId),
  })
);

export const crewAssignment = pgTable(
  "crew_assignment",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    date: text("date").notNull(),
    shiftId: varchar("shift_id").references(() => shiftTemplate.id),
    crewId: varchar("crew_id")
      .notNull()
      .references(() => crew.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    start: timestamp("start", { mode: "date" }).notNull(),
    end: timestamp("end", { mode: "date" }).notNull(),
    role: text("role"),
    status: text("status").default("scheduled"),
    generatedByRunId: varchar("generated_by_run_id"),
    source: text("source").default("manual"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    version: integer("version").default(1),
    lastModifiedBy: varchar("last_modified_by", { length: 255 }),
    lastModifiedDevice: varchar("last_modified_device", { length: 255 }),
  },
  (table) => ({
    orgIdIdx: index("idx_crew_assignment_org_id").on(table.orgId),
    generatedRunIdx: index("idx_crew_assignment_generated_run").on(table.generatedByRunId),
  })
);

export const crewCertification = pgTable(
  "crew_cert",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    crewId: varchar("crew_id")
      .notNull()
      .references(() => crew.id),
    cert: text("cert").notNull(),
    certNumber: text("cert_number"),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    issuedAt: timestamp("issued_at", { mode: "date" }),
    issuedBy: text("issued_by"),
    alertSent: boolean("alert_sent").default(false),
    alertSent30: boolean("alert_sent_30").default(false),
    alertSent60: boolean("alert_sent_60").default(false),
    alertSent90: boolean("alert_sent_90").default(false),
    alertLastScannedAt: timestamp("alert_last_scanned_at", { mode: "date" }),
    alertAcknowledged: boolean("alert_acknowledged").default(false),
    alertAcknowledgedAt: timestamp("alert_acknowledged_at", { mode: "date" }),
    alertAcknowledgedBy: varchar("alert_acknowledged_by", { length: 255 }),
    alertAcknowledgedNotes: text("alert_acknowledged_notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_crew_cert_org_id").on(table.orgId),
    crewIdx: sql`CREATE INDEX IF NOT EXISTS idx_crew_cert_crew ON crew_cert (crew_id)`,
    expiryIdx: sql`CREATE INDEX IF NOT EXISTS idx_crew_cert_expires ON crew_cert (expires_at)`,
  })
);

export const crewDocuments = pgTable(
  "crew_documents",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    crewId: varchar("crew_id")
      .notNull()
      .references(() => crew.id),
    documentType: varchar("document_type", { length: 50 }).notNull(),
    documentNumber: varchar("document_number", { length: 100 }),
    filePath: varchar("file_path", { length: 1024 }),
    issuingAuthority: varchar("issuing_authority", { length: 255 }),
    issuingCountry: varchar("issuing_country", { length: 100 }),
    issuedAt: timestamp("issued_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    alertSent: boolean("alert_sent").default(false),
    alertSent30: boolean("alert_sent_30").default(false),
    alertSent60: boolean("alert_sent_60").default(false),
    alertSent90: boolean("alert_sent_90").default(false),
    alertLastScannedAt: timestamp("alert_last_scanned_at", { mode: "date" }),
    alertAcknowledged: boolean("alert_acknowledged").default(false),
    alertAcknowledgedAt: timestamp("alert_acknowledged_at", { mode: "date" }),
    alertAcknowledgedBy: varchar("alert_acknowledged_by", { length: 255 }),
    alertAcknowledgedNotes: text("alert_acknowledged_notes"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_crew_documents_org_id").on(table.orgId),
    crewIdx: index("idx_crew_documents_crew").on(table.crewId),
    typeIdx: index("idx_crew_documents_type").on(table.documentType),
    expiryIdx: index("idx_crew_documents_expires").on(table.expiresAt),
  })
);

export const crewRestSheet = pgTable(
  "crew_rest_sheet",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    crewId: varchar("crew_id")
      .notNull()
      .references(() => crew.id),
    crewName: text("crew_name").notNull(),
    rank: text("rank"),
    month: text("month").notNull(),
    year: integer("year").notNull(),
    sourceType: text("source_type").default("manual"),
    scheduleRunId: varchar("schedule_run_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_crew_rest_sheet_org_id").on(table.orgId),
    scheduleRunIdx: index("idx_crew_rest_sheet_schedule_run").on(table.scheduleRunId),
  })
);

export const crewRestDay = pgTable(
  "crew_rest_day",
  {
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    sheetId: varchar("sheet_id")
      .notNull()
      .references(() => crewRestSheet.id),
    date: text("date").notNull(),
    h0: integer("h0").default(0),
    h1: integer("h1").default(0),
    h2: integer("h2").default(0),
    h3: integer("h3").default(0),
    h4: integer("h4").default(0),
    h5: integer("h5").default(0),
    h6: integer("h6").default(0),
    h7: integer("h7").default(0),
    h8: integer("h8").default(0),
    h9: integer("h9").default(0),
    h10: integer("h10").default(0),
    h11: integer("h11").default(0),
    h12: integer("h12").default(0),
    h13: integer("h13").default(0),
    h14: integer("h14").default(0),
    h15: integer("h15").default(0),
    h16: integer("h16").default(0),
    h17: integer("h17").default(0),
    h18: integer("h18").default(0),
    h19: integer("h19").default(0),
    h20: integer("h20").default(0),
    h21: integer("h21").default(0),
    h22: integer("h22").default(0),
    h23: integer("h23").default(0),
  },
  (table) => ({
    pk: sql`PRIMARY KEY (${table.sheetId}, ${table.date})`,
    orgIdIdx: index("idx_crew_rest_day_org_id").on(table.orgId),
  })
);
