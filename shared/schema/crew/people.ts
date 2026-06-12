/**
 * Crew profile, employment, notification, alert, and role schema tables.
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

export const crew = pgTable(
  "crew",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    photoPath: text("photo_path"), // Profile photo object path (/objects/...); managed only via /api/crew/:id/photo
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    crewCode: text("crew_code"), // Human-readable crew code e.g. "CRW-0001"
    status: text("status").default("active"), // Explicit status: active | on_leave | standby | onboard
    employmentType: text("employment_type"), // permanent | contract | temporary | rotational
    reportsToId: varchar("reports_to_id").references((): AnyPgColumn => crew.id, {
      onDelete: "set null",
    }), // Supervisor (another crew member) this person reports to
    rotationOnDays: integer("rotation_on_days"), // Rotation pattern: days on
    rotationOffDays: integer("rotation_off_days"), // Rotation pattern: days off
    rank: text("rank"), // Legacy field, kept for backward compatibility
    department: text("department"), // Department/section (e.g. bridge, engine, deck) — pre-filled from crew role default
    watchKeeping: text("watch_keeping"), // Standard watch/shift pattern — pre-filled from crew role default
    roleId: varchar("role_id").references(() => roles.id, { onDelete: "set null" }), // Link to RBAC permissions roles
    // Optional 1:1 link to a login account (users row). null = no login account.
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    maxHours7d: real("max_hours_7d").default(72),
    minRestH: real("min_rest_h").default(10),
    active: boolean("active").default(true),
    onDuty: boolean("on_duty").default(false),
    notes: text("notes"),
    hourlyRate: numeric("hourly_rate", { precision: 12, scale: 2, mode: "number" }), // Hourly salary rate in SGD for labor cost calculations
    startDate: timestamp("start_date", { mode: "date" }), // Contract start date
    contractEndDate: timestamp("contract_end_date", { mode: "date" }), // Contract expected end date
    contractPenalty: numeric("contract_penalty", { precision: 12, scale: 2, mode: "number" }), // Penalty fee in SGD if contract cancelled
    terminationType: text("termination_type"), // 'retired' | 'cancelled' | null
    terminationDate: timestamp("termination_date", { mode: "date" }), // When crew member left
    terminationNotes: text("termination_notes"), // Reason/notes for departure
    reinstatedAt: timestamp("reinstated_at", { mode: "date" }), // When crew was reinstated
    reinstatedBy: varchar("reinstated_by"), // Who reinstated the crew member
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdx: sql`CREATE INDEX IF NOT EXISTS idx_crew_org ON crew (org_id)`,
    vesselIdx: sql`CREATE INDEX IF NOT EXISTS idx_crew_vessel ON crew (vessel_id)`,
    activeIdx: sql`CREATE INDEX IF NOT EXISTS idx_crew_active ON crew (active, on_duty)`,
    roleIdx: index("idx_crew_role").on(table.roleId),
    reportsToIdx: index("idx_crew_reports_to").on(table.reportsToId),
    terminationIdx: index("idx_crew_termination").on(table.terminationType),
    // Enforce optional 1:1 — a login account links to at most one crew member.
    // (Postgres treats NULLs as distinct, so unlinked crew rows are unconstrained.)
    userUnique: unique("uq_crew_user_id").on(table.userId),
  })
);

// Employment history for tracking previous employment periods when reinstated
export const crewEmploymentHistory = pgTable(
  "crew_employment_history",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    crewId: varchar("crew_id")
      .notNull()
      .references(() => crew.id, { onDelete: "cascade" }),
    startDate: timestamp("start_date", { mode: "date" }).notNull(),
    endDate: timestamp("end_date", { mode: "date" }).notNull(),
    terminationType: text("termination_type").notNull(), // 'retired' | 'cancelled'
    terminationNotes: text("termination_notes"),
    contractPenalty: numeric("contract_penalty", { precision: 12, scale: 2, mode: "number" }), // Penalty applied if cancelled
    vesselId: varchar("vessel_id"), // Last vessel assignment during this period
    rank: text("rank"), // Rank during this period
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_crew_employment_history_org").on(table.orgId),
    crewIdIdx: index("idx_crew_employment_history_crew").on(table.crewId),
  })
);

export const crewNotificationSettings = pgTable(
  "crew_notification_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    crewId: varchar("crew_id")
      .notNull()
      .references(() => crew.id, { onDelete: "cascade" }),
    emailAlertsEnabled: boolean("email_alerts_enabled").default(true),
    certExpiryEmailEnabled: boolean("cert_expiry_email_enabled").default(true),
    documentExpiryEmailEnabled: boolean("document_expiry_email_enabled").default(true),
    complianceEmailEnabled: boolean("compliance_email_enabled").default(true),
    overrideEmail: text("override_email"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_crew_notification_settings_org").on(table.orgId),
    crewIdIdx: index("idx_crew_notification_settings_crew").on(table.crewId),
    uniqueCrewId: unique("uq_crew_notification_settings_crew").on(table.crewId),
  })
);

// Manager-raised ad-hoc alerts/notes against a crew member (e.g. "follow up
// on visa", "performance review due"). These live alongside the expiry-derived
// alerts surfaced in the crew Alerts tab, but unlike certifications/documents
// they carry no expiry-scan machinery — the severity is chosen by the manager.
export const crewAlerts = pgTable(
  "crew_alerts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    crewId: varchar("crew_id")
      .notNull()
      .references(() => crew.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    detail: text("detail"),
    severity: text("severity").notNull().default("notice"), // critical | warning | notice
    dueAt: timestamp("due_at", { mode: "date" }), // optional follow-up date
    createdBy: varchar("created_by", { length: 255 }),
    acknowledged: boolean("acknowledged").default(false),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
    acknowledgedBy: varchar("acknowledged_by", { length: 255 }),
    acknowledgedNotes: text("acknowledged_notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_crew_alerts_org").on(table.orgId),
    crewIdx: index("idx_crew_alerts_crew").on(table.crewId),
  })
);

// Manageable crew roles (positions / ranks). This is the crew POSITION concept
// backing the `crew.rank` text column — deliberately SEPARATE from the RBAC
// permission roles in `permissions.ts` (`crew.roleId`). Org-scoped; `name` is
// the value stored in `crew.rank`, `category` drives roster grouping, and
// `sortOrder` orders positions top (highest) to bottom (lowest).
export const crewRoles = pgTable(
  "crew_roles",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    category: text("category").notNull().default("Other"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    // Per-role defaults pre-filled (editable) onto a crew member when this role
    // is selected in the Add/Edit Crew form. All optional — null means "no
    // default, leave the crew field untouched".
    defaultDepartment: text("default_department"),
    defaultMinRestHours: real("default_min_rest_hours"),
    defaultMaxHours: real("default_max_hours"),
    defaultWatchKeeping: text("default_watch_keeping"),
    // Optional SUGGESTED RBAC permission role to offer when assigning this crew
    // role. Purely a suggestion surfaced in the form — never auto-applied and
    // always overridable. Deliberately a soft FK into the separate `roles`
    // (RBAC) table; the two systems are NOT merged.
    defaultRoleId: varchar("default_role_id").references(() => roles.id, {
      onDelete: "set null",
    }),
    // Document types this role REQUIRES every crew member to hold. Drives the
    // per-crew compliance snapshot + Docs tab (Valid / Due soon / Missing) and
    // the roster needs-action highlight. Empty / null = no requirements, so the
    // crew member's compliance view behaves exactly as it did before. Values are
    // drawn from CREW_DOCUMENT_TYPE_VALUES (the crew_documents type catalog).
    requiredDocuments: text("required_documents").array(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_crew_roles_org").on(table.orgId),
    orgNameUnique: unique("uq_crew_roles_org_name").on(table.orgId, table.name),
  })
);

// Canonical catalog of crew document types. Single source of truth shared by the
// document form (client), the per-role "required documents" picker, and the
// server-side validation of a role's requirements. Mirrors the labelled
// DOCUMENT_TYPES list on the client.
export const CREW_DOCUMENT_TYPE_VALUES = [
  "passport",
  "seaman_book",
  "visa",
  "medical",
  "endorsement",
] as const;
export type CrewDocumentType = (typeof CREW_DOCUMENT_TYPE_VALUES)[number];
