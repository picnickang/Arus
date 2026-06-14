/**
 * Item-supplier and service request/order schema tables.
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
  jsonb,
  unique,
} from "../base";
import { organizations } from "../core";
import { parts, suppliers } from "../inventory";
import { workOrders } from "../work-orders";

// ============================================================================
// ITEM-SUPPLIER RELATIONSHIPS
// ============================================================================

// Item-supplier linking
export const itemSuppliers = pgTable(
  "item_suppliers",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    partId: varchar("part_id")
      .notNull()
      .references(() => parts.id),
    supplierId: varchar("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    isPrimary: boolean("is_primary").default(false),
    supplierPartNumber: text("supplier_part_number"),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2, mode: "number" }),
    leadTimeDays: integer("lead_time_days"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    partSupplierIdx: sql`CREATE INDEX IF NOT EXISTS idx_item_suppliers_part_supplier ON item_suppliers (part_id, supplier_id)`,
    orgPartIdx: sql`CREATE INDEX IF NOT EXISTS idx_item_suppliers_org_part ON item_suppliers (org_id, part_id)`,
    uniqueOrgPartSupplier: unique("uq_item_suppliers_org_part_supplier").on(
      table.orgId,
      table.partId,
      table.supplierId
    ),
  })
);

// ============================================================================
// SERVICE REQUESTS (Lightweight intake before formal Service Orders)
// ============================================================================

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    workOrderId: varchar("work_order_id")
      .notNull()
      .references(() => workOrders.id),
    serviceOrderId: varchar("service_order_id"),
    requestNumber: text("request_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    urgency: text("urgency").notNull().default("medium"),
    estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2, mode: "number" }),
    requestedBy: text("requested_by").notNull(),
    status: text("status").notNull().default("pending_review"),
    rejectionReason: text("rejection_reason"),
    previousWoStatus: text("previous_wo_status"),
    serviceDetails: text("service_details"),
    specialRequirements: text("special_requirements"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    convertedAt: timestamp("converted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgStatusIdx: sql`CREATE INDEX IF NOT EXISTS idx_service_requests_org_status ON service_requests (org_id, status)`,
    workOrderIdx: sql`CREATE INDEX IF NOT EXISTS idx_service_requests_work_order ON service_requests (work_order_id)`,
    orgRequestNumberIdx: unique("uq_service_requests_org_request_number").on(
      table.orgId,
      table.requestNumber
    ),
  })
);

// ============================================================================
// SERVICE ORDERS
// ============================================================================

// Service orders
export const serviceOrders = pgTable(
  "service_orders",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    workOrderId: varchar("work_order_id")
      .notNull()
      .references(() => workOrders.id),
    serviceProviderId: varchar("service_provider_id")
      .notNull()
      .references(() => suppliers.id),
    soNumber: text("so_number").notNull(),
    status: text("status").notNull().default("draft"),
    scheduledStartDate: timestamp("scheduled_start_date", { mode: "date" }),
    scheduledEndDate: timestamp("scheduled_end_date", { mode: "date" }),
    actualStartDate: timestamp("actual_start_date", { mode: "date" }),
    actualEndDate: timestamp("actual_end_date", { mode: "date" }),
    estimatedDurationHours: real("estimated_duration_hours"),
    actualDurationHours: real("actual_duration_hours"),
    scope: text("scope"),
    serviceDetails: text("service_details"),
    specialRequirements: text("special_requirements"),
    quotedAmount: numeric("quoted_amount", { precision: 12, scale: 2, mode: "number" }),
    actualAmount: numeric("actual_amount", { precision: 12, scale: 2, mode: "number" }),
    currency: text("currency").default("USD"),
    revisedAmount: numeric("revised_amount", { precision: 12, scale: 2, mode: "number" }),
    revisionNotes: text("revision_notes"),
    revisedAt: timestamp("revised_at", { mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { mode: "date" }),
    cancellationReason: text("cancellation_reason"),
    sentAt: timestamp("sent_at", { mode: "date" }),
    confirmedAt: timestamp("confirmed_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgStatusIdx: sql`CREATE INDEX IF NOT EXISTS idx_service_orders_org_status ON service_orders (org_id, status)`,
    workOrderIdx: sql`CREATE INDEX IF NOT EXISTS idx_service_orders_work_order ON service_orders (work_order_id)`,
    providerIdx: sql`CREATE INDEX IF NOT EXISTS idx_service_orders_provider ON service_orders (service_provider_id)`,
    orgSoNumberIdx: unique("uq_service_orders_org_so_number").on(table.orgId, table.soNumber),
  })
);

// Audit log for service order events
export const serviceOrderEvents = pgTable(
  "service_order_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    soId: varchar("so_id")
      .notNull()
      .references(() => serviceOrders.id),
    eventType: text("event_type").notNull(),
    userId: varchar("user_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    soEventIdx: sql`CREATE INDEX IF NOT EXISTS idx_service_order_events_so ON service_order_events (so_id, created_at)`,
  })
);
