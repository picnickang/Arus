/**
 * Reservation, purchase order, and purchase request schema tables.
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
  index,
} from "../base";
import { organizations } from "../core";
import { vessels } from "../vessels";
import { parts, suppliers } from "../inventory";
import { workOrders } from "../work-orders";

// ============================================================================
// RESERVATIONS
// ============================================================================

// Parts reservations for work orders
export const reservations = pgTable(
  "reservations",
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
    workOrderId: varchar("work_order_id")
      .notNull()
      .references(() => workOrders.id),
    quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" }).notNull(),
    reservedBy: text("reserved_by"),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    partIdx: sql`CREATE INDEX IF NOT EXISTS idx_reservations_part ON reservations (part_id)`,
    workOrderIdx: sql`CREATE INDEX IF NOT EXISTS idx_reservations_work_order ON reservations (work_order_id)`,
    statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations (status, expires_at)`,
    orgPartStatusIdx: sql`CREATE INDEX IF NOT EXISTS idx_reservations_org_part_status ON reservations (org_id, part_id, status)`,
  })
);

// ============================================================================
// PURCHASE ORDERS
// ============================================================================

// Purchase orders for inventory replenishment
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    supplierId: varchar("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    orderNumber: text("order_number").notNull(),
    expectedDate: timestamp("expected_date", { mode: "date" }),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2, mode: "number" }),
    currency: text("currency").default("USD"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    supplierIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders (supplier_id)`,
    statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders (status, expected_date)`,
    orderNumberIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders (order_number)`,
    orgStatusIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_status ON purchase_orders (org_id, status)`,
  })
);

// Purchase order line items
export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    // P2 #16 — purchase_order_items are exclusive line-items of the
    // parent purchase_orders row. Cascading delete keeps the two in
    // lock-step (migration 0023). The part_id FK stays RESTRICT
    // because parts are cross-aggregate reference data.
    poId: varchar("po_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    partId: varchar("part_id")
      .notNull()
      .references(() => parts.id),
    quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" }).notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2, mode: "number" }).notNull(),
    totalPrice: numeric("total_price", { precision: 12, scale: 2, mode: "number" }).notNull(),
    receivedQuantity: numeric("received_quantity", {
      precision: 12,
      scale: 3,
      mode: "number",
    }).default(0),
    rejectedQuantity: integer("rejected_quantity").default(0),
    rejectionReason: text("rejection_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_po_items_org_id").on(table.orgId),
    poIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items (po_id)`,
    partIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_order_items_part ON purchase_order_items (part_id)`,
  })
);

// Audit log for purchase order events
export const purchaseOrderEvents = pgTable(
  "purchase_order_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    poId: varchar("po_id")
      .notNull()
      .references(() => purchaseOrders.id),
    eventType: text("event_type").notNull(),
    userId: varchar("user_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    poEventIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_order_events_po ON purchase_order_events (po_id, created_at)`,
  })
);

// ============================================================================
// PURCHASE REQUESTS
// ============================================================================

// Purchase requests
export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    workOrderId: varchar("work_order_id").references(() => workOrders.id),
    requestNumber: text("request_number").notNull(),
    status: text("status").notNull().default("draft"),
    requiredByDate: timestamp("required_by_date", { mode: "date" }),
    deliveryLocation: text("delivery_location"),
    requestedBy: text("requested_by").notNull(),
    notes: text("notes"),
    lastDraftSaveAt: timestamp("last_draft_save_at", { mode: "date" }),
    sentAt: timestamp("sent_at", { mode: "date" }),
    closedAt: timestamp("closed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgStatusIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_requests_org_status ON purchase_requests (org_id, status)`,
    orgRequestNumberIdx: unique("uq_purchase_requests_org_request_number").on(
      table.orgId,
      table.requestNumber
    ),
    vesselIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_requests_vessel ON purchase_requests (vessel_id)`,
    workOrderIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_requests_work_order ON purchase_requests (work_order_id)`,
  })
);

// Purchase request line items
export const purchaseRequestItems = pgTable(
  "purchase_request_items",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    // P2 #16 — purchase_request_items are exclusive line-items of
    // the parent purchase_requests row. Cascading delete keeps the
    // two in lock-step (migration 0023). part_id / supplier_id FKs
    // stay RESTRICT because both are cross-aggregate reference data.
    prId: varchar("pr_id")
      .notNull()
      .references(() => purchaseRequests.id, { onDelete: "cascade" }),
    partId: varchar("part_id")
      .notNull()
      .references(() => parts.id),
    supplierId: varchar("supplier_id").references(() => suppliers.id),
    quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" }).notNull(),
    robSnapshot: numeric("rob_snapshot", { precision: 12, scale: 3, mode: "number" }),
    uom: text("uom"),
    remarks: text("remarks"),
    quantityFulfilled: numeric("quantity_fulfilled", {
      precision: 12,
      scale: 3,
      mode: "number",
    }).default(0),
    fulfilledAt: timestamp("fulfilled_at", { mode: "date" }),
    fulfilledBy: text("fulfilled_by"),
    fulfillmentStatus: text("fulfillment_status").default("pending"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    prIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_request_items_pr ON purchase_request_items (pr_id)`,
    partIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_request_items_part ON purchase_request_items (part_id)`,
    supplierIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_request_items_supplier ON purchase_request_items (supplier_id)`,
  })
);

// Audit log for purchase request events
export const purchaseRequestEvents = pgTable(
  "purchase_request_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    prId: varchar("pr_id")
      .notNull()
      .references(() => purchaseRequests.id),
    eventType: text("event_type").notNull(),
    userId: varchar("user_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    prEventIdx: sql`CREATE INDEX IF NOT EXISTS idx_purchase_request_events_pr ON purchase_request_events (pr_id, created_at)`,
  })
);
