/**
 * Schema Base - Common imports, helpers, and shared types
 *
 * This module provides the foundation for all schema modules,
 * including Drizzle ORM imports and Zod utilities.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  unique,
  serial,
  index,
  uniqueIndex,
  numeric,
  vector,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export all Drizzle primitives for use in domain modules
export {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  unique,
  serial,
  index,
  uniqueIndex,
  numeric,
  vector,
  createInsertSchema,
  z,
};

// Common UUID generation helper
export const uuidDefault = () => sql`gen_random_uuid()`;

/**
 * Common Column Builders
 *
 * These functions create reusable column definitions to reduce duplication.
 * Per SonarQube Extract Method pattern: repeated column patterns are centralized here.
 *
 * Usage in table definitions:
 *   const myTable = pgTable("my_table", {
 *     ...uuidPrimaryKey(),
 *     ...timestamps(),
 *     ...tenantColumn(organizations),
 *     // other columns
 *   });
 */

/**
 * Standard UUID primary key column with options
 * @param options.name - Column name (default: "id")
 */
export function uuidPrimaryKey(options?: { name?: string }) {
  const name = options?.name ?? "id";
  return {
    id: varchar(name)
      .primaryKey()
      .default(sql`gen_random_uuid()`),
  };
}

/**
 * Standard created_at and updated_at timestamp columns
 */
export function timestamps() {
  return {
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  };
}

/**
 * Single created_at timestamp (for tables that don't need updated_at)
 */
export function createdAtOnly() {
  return {
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  };
}

/**
 * Multi-tenant org_id column with foreign key reference
 * @param orgTable - Reference to the organizations table for foreign key
 * @param options.required - Whether the column is required (default: true)
 */
export function tenantColumn<T extends { id: AnyPgColumn }>(
  orgTable: T,
  options?: { required?: boolean }
) {
  const col = varchar("org_id").references(() => orgTable.id);
  return {
    orgId: options?.required !== false ? col.notNull() : col,
  };
}

/**
 * Version and modification tracking columns (for optimistic locking)
 */
export function versionTracking() {
  return {
    version: integer("version").default(1),
    lastModifiedBy: varchar("last_modified_by", { length: 255 }),
    lastModifiedDevice: varchar("last_modified_device", { length: 255 }),
  };
}

// Legacy export for backward compatibility
export const timestampFields = {
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
};
