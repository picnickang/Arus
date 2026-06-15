/**
 * SQLite-Compatible Sync Schemas for Vessel Mode
 *
 * This file contains SQLite-compatible versions of critical sync tables
 * needed for offline vessel deployments. These tables use SQLite-compatible
 * types instead of PostgreSQL-specific types.
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Organizations table (SQLite version)
export const organizationsSqlite = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  domain: text("domain"),
  billingEmail: text("billing_email"),
  maxUsers: integer("max_users").default(50),
  maxEquipment: integer("max_equipment").default(1000),
  subscriptionTier: text("subscription_tier").notNull().default("basic"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  emergencyLaborMultiplier: integer("emergency_labor_multiplier").default(3),
  emergencyPartsMultiplier: real("emergency_parts_multiplier").default(1.5),
  emergencyDowntimeMultiplier: integer("emergency_downtime_multiplier").default(3),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Sync journal table (SQLite version) - stores JSON as text
export const syncJournalSqlite = sqliteTable("sync_journal", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  operation: text("operation").notNull(),
  payload: text("payload"), // JSON stored as text
  userId: text("user_id"),
  syncStatus: text("sync_status").default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

// Sync outbox table (SQLite version) - stores JSON as text
export const syncOutboxSqlite = sqliteTable("sync_outbox", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  payload: text("payload"), // JSON stored as text
  processed: integer("processed", { mode: "boolean" }).default(false),
  processingAttempts: integer("processing_attempts").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }),
  processedAt: integer("processed_at", { mode: "timestamp" }),
});

// Users table (SQLite version)
export const usersSqlite = sqliteTable("users", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  email: text("email").notNull(),
  username: text("username"),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  passwordUpdatedAt: integer("password_updated_at", { mode: "timestamp" }),
  role: text("role").notNull().default("viewer"),
  jobTitle: text("job_title"),
  phone: text("phone"),
  timezone: text("timezone").default("UTC"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  loginEnabled: integer("login_enabled", { mode: "boolean" }).notNull().default(true),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  supervisorUserId: text("supervisor_user_id"),
  hubAdmin: integer("hub_admin", { mode: "boolean" }).notNull().default(false),
  hubAccess: text("hub_access"),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Helper functions for JSON handling in SQLite
export const sqliteJsonHelpers = {
  // Convert object to JSON string for storage
  stringify: (obj: unknown) => (obj ? JSON.stringify(obj) : null),

  // Parse JSON string from storage
  parse: <T = unknown>(str: string | null): T | null => {
    if (!str) {
      return null;
    }
    try {
      return JSON.parse(str) as T;
    } catch {
      return null;
    }
  },
};
