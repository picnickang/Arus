/**
 * Schema: Safety Bulletins
 *
 * Fleet/vessel safety bulletins (notices) pushed from shore or fleet
 * management to vessels. Powers the user-portal "Safety Notices" and
 * "Safety Status" cards with a real backend feed instead of inferring
 * them from generic alerts.
 *
 * Cloud-only (PostgreSQL) domain — mirrors the certificates pattern:
 * not registered in schema-runtime and has no SQLite mirror.
 */

import { sql, pgTable, text, varchar, timestamp, boolean, createInsertSchema, z } from "./base";
import { organizations } from "./core";
import { vessels } from "./vessels";

export const SAFETY_BULLETIN_SEVERITIES = [
  "info",
  "advisory",
  "warning",
  "critical",
] as const;

export const safetyBulletins = pgTable(
  "safety_bulletins",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    // Null vesselId => fleet-wide bulletin visible to every vessel.
    vesselId: varchar("vessel_id").references(() => vessels.id),

    title: text("title").notNull(),
    body: text("body"),
    severity: text("severity").notNull().default("info"),
    category: text("category").notNull().default("general"),
    reference: text("reference"),

    active: boolean("active").notNull().default(true),

    effectiveDate: timestamp("effective_date", { mode: "date" }).defaultNow(),
    expiresAt: timestamp("expires_at", { mode: "date" }),

    createdBy: varchar("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgActiveIdx: sql`CREATE INDEX IF NOT EXISTS idx_safety_bulletins_org_active ON safety_bulletins (${table.orgId}, ${table.active}, ${table.effectiveDate} DESC)`,
    orgVesselIdx: sql`CREATE INDEX IF NOT EXISTS idx_safety_bulletins_org_vessel ON safety_bulletins (${table.orgId}, ${table.vesselId})`,
  }),
);

export const insertSafetyBulletinSchema = createInsertSchema(safetyBulletins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SafetyBulletin = typeof safetyBulletins.$inferSelect;
export type InsertSafetyBulletin = z.infer<typeof insertSafetyBulletinSchema>;
export type SafetyBulletinSeverity = (typeof SAFETY_BULLETIN_SEVERITIES)[number];
