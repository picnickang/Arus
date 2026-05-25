/**
 * Schema Purchasing - Purchasing, Procurement, and Service Orders
 *
 * Manages purchase requests, purchase orders, service orders,
 * parts reservations, and item-supplier relationships.
 */

import {
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
  index,
  createInsertSchema,
  z,
} from "./base";
import { organizations } from "./core";
import { vessels } from "./vessels";
import { parts, suppliers } from "./inventory";
import { workOrders } from "./work-orders";

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
    quantity: real("quantity").notNull(),
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
    totalAmount: real("total_amount"),
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
    quantity: real("quantity").notNull(),
    unitPrice: real("unit_price").notNull(),
    totalPrice: real("total_price").notNull(),
    receivedQuantity: real("received_quantity").default(0),
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
    quantity: real("quantity").notNull(),
    robSnapshot: real("rob_snapshot"),
    uom: text("uom"),
    remarks: text("remarks"),
    quantityFulfilled: real("quantity_fulfilled").default(0),
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
    unitCost: real("unit_cost"),
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
    estimatedCost: real("estimated_cost"),
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
    quotedAmount: real("quoted_amount"),
    actualAmount: real("actual_amount"),
    currency: text("currency").default("USD"),
    revisedAmount: real("revised_amount"),
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

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertReservationSchema = createInsertSchema(reservations).omit({
  id: true,
  createdAt: true,
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
});

export const insertPurchaseOrderEventSchema = createInsertSchema(purchaseOrderEvents).omit({
  id: true,
  createdAt: true,
});

export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseRequestItemSchema = createInsertSchema(purchaseRequestItems).omit({
  id: true,
  createdAt: true,
});

export const insertPurchaseRequestEventSchema = createInsertSchema(purchaseRequestEvents).omit({
  id: true,
  createdAt: true,
});

export const insertItemSupplierSchema = createInsertSchema(itemSuppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceOrderSchema = createInsertSchema(serviceOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceOrderEventSchema = createInsertSchema(serviceOrderEvents).omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = z.infer<typeof insertReservationSchema>;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;

export type PurchaseOrderEvent = typeof purchaseOrderEvents.$inferSelect;
export type InsertPurchaseOrderEvent = z.infer<typeof insertPurchaseOrderEventSchema>;

export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = z.infer<typeof insertPurchaseRequestSchema>;

export type PurchaseRequestItem = typeof purchaseRequestItems.$inferSelect;
export type InsertPurchaseRequestItem = z.infer<typeof insertPurchaseRequestItemSchema>;

export type PurchaseRequestEvent = typeof purchaseRequestEvents.$inferSelect;
export type InsertPurchaseRequestEvent = z.infer<typeof insertPurchaseRequestEventSchema>;

export type ItemSupplier = typeof itemSuppliers.$inferSelect;
export type InsertItemSupplier = z.infer<typeof insertItemSupplierSchema>;

export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = z.infer<typeof insertServiceOrderSchema>;

export type ServiceOrderEvent = typeof serviceOrderEvents.$inferSelect;
export type InsertServiceOrderEvent = z.infer<typeof insertServiceOrderEventSchema>;
