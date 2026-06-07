/**
 * SQLite Schema Inventory Module
 * Parts, stock, suppliers, purchase orders, movements, substitutions
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const partsInventorySqlite = sqliteTable(
  "parts_inventory",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partNumber: text("part_number").notNull(),
    partName: text("part_name").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    manufacturer: text("manufacturer"),
    unitCost: real("unit_cost").notNull(),
    quantityOnHand: integer("quantity_on_hand").notNull().default(0),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    minStockLevel: integer("min_stock_level").default(1),
    maxStockLevel: integer("max_stock_level").default(100),
    location: text("location"),
    supplierName: text("supplier_name"),
    supplierPartNumber: text("supplier_part_number"),
    leadTimeDays: integer("lead_time_days").default(7),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_pi_org").on(table.orgId),
    partNumberIdx: index("idx_pi_part_number").on(table.partNumber),
  })
);

export const stockSqlite = sqliteTable(
  "stock",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partId: text("part_id").notNull(),
    partNo: text("part_no").notNull(),
    location: text("location").notNull().default("MAIN"),
    quantityOnHand: real("quantity_on_hand").default(0),
    quantityReserved: real("quantity_reserved").default(0),
    quantityOnOrder: real("quantity_on_order").default(0),
    unitCost: real("unit_cost").default(0),
    lastCountDate: integer("last_count_date", { mode: "timestamp" }),
    binLocation: text("bin_location"),
    supplierId: text("supplier_id"),
    reorderPoint: real("reorder_point"),
    maxQuantity: real("max_quantity"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    partIdx: index("idx_stock_part").on(table.partId),
    partNoIdx: index("idx_stock_part_no").on(table.partNo),
    orgPartIdx: index("idx_stock_org_part").on(table.orgId, table.partId),
  })
);

export const inventoryMovementsSqlite = sqliteTable(
  "inventory_movements",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partId: text("part_id").notNull(),
    movementType: text("movement_type").notNull(),
    quantity: integer("quantity").notNull(),
    fromLocation: text("from_location"),
    toLocation: text("to_location"),
    workOrderId: text("work_order_id"),
    reason: text("reason"),
    performedBy: text("performed_by"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    partIdx: index("idx_im_part").on(table.partId),
    typeIdx: index("idx_im_type").on(table.movementType),
  })
);

export const suppliersSqlite = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    code: text("code"),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    country: text("country"),
    currency: text("currency").default("USD"),
    paymentTerms: text("payment_terms"),
    leadTimeDays: integer("lead_time_days"),
    rating: real("rating"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_sup_org").on(table.orgId),
    codeIdx: index("idx_sup_code").on(table.code),
  })
);

export const purchaseOrdersSqlite = sqliteTable(
  "purchase_orders",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    poNumber: text("po_number").notNull(),
    supplierId: text("supplier_id").notNull(),
    status: text("status").notNull().default("draft"),
    totalAmount: real("total_amount").default(0),
    currency: text("currency").default("USD"),
    orderDate: integer("order_date", { mode: "timestamp" }),
    expectedDelivery: integer("expected_delivery", { mode: "timestamp" }),
    actualDelivery: integer("actual_delivery", { mode: "timestamp" }),
    notes: text("notes"),
    createdBy: text("created_by"),
    approvedBy: text("approved_by"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_po_org").on(table.orgId),
    supplierIdx: index("idx_po_supplier").on(table.supplierId),
    statusIdx: index("idx_po_status").on(table.status),
  })
);

export const purchaseOrderItemsSqlite = sqliteTable(
  "purchase_order_items",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    poId: text("po_id").notNull(),
    partId: text("part_id").notNull(),
    quantity: real("quantity").notNull(),
    unitPrice: real("unit_price").notNull(),
    totalPrice: real("total_price").notNull(),
    receivedQuantity: integer("received_quantity").default(0),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_poi_org").on(table.orgId),
    poIdx: index("idx_poi_po").on(table.poId),
    partIdx: index("idx_poi_part").on(table.partId),
  })
);

export const partsSqlite = sqliteTable(
  "parts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partNumber: text("part_number").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    subcategory: text("subcategory"),
    manufacturer: text("manufacturer"),
    manufacturerPartNumber: text("manufacturer_part_number"),
    unitOfMeasure: text("unit_of_measure").default("EA"),
    unitCost: real("unit_cost"),
    currency: text("currency").default("USD"),
    weight: real("weight"),
    dimensions: text("dimensions"),
    imageUrl: text("image_url"),
    specifications: text("specifications"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_parts_org").on(table.orgId),
    partNumberIdx: index("idx_parts_part_number").on(table.partNumber),
  })
);

export const inventoryPartsSqlite = sqliteTable(
  "inventory_parts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partId: text("part_id").notNull(),
    vesselId: text("vessel_id"),
    warehouseId: text("warehouse_id"),
    quantityOnHand: integer("quantity_on_hand").default(0),
    quantityReserved: integer("quantity_reserved").default(0),
    quantityOnOrder: integer("quantity_on_order").default(0),
    reorderPoint: integer("reorder_point").default(0),
    maxStock: integer("max_stock"),
    location: text("location"),
    binNumber: text("bin_number"),
    lastCountDate: integer("last_count_date", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    partIdx: index("idx_invp_part").on(table.partId),
    vesselIdx: index("idx_invp_vessel").on(table.vesselId),
  })
);

export const partSubstitutionsSqlite = sqliteTable(
  "part_substitutions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    originalPartId: text("original_part_id").notNull(),
    substitutePartId: text("substitute_part_id").notNull(),
    substitutionType: text("substitution_type").default("equivalent"),
    priority: integer("priority").default(1),
    notes: text("notes"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    originalIdx: index("idx_ps_original").on(table.originalPartId),
  })
);

export const partFailureHistorySqlite = sqliteTable(
  "part_failure_history",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partId: text("part_id").notNull(),
    equipmentId: text("equipment_id"),
    failureDate: integer("failure_date", { mode: "timestamp" }),
    failureMode: text("failure_mode"),
    rootCause: text("root_cause"),
    operatingHours: integer("operating_hours"),
    impactLevel: text("impact_level"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    partIdx: index("idx_pfh_part").on(table.partId),
  })
);

export const reservationsSqlite = sqliteTable(
  "reservations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partId: text("part_id").notNull(),
    workOrderId: text("work_order_id"),
    quantity: integer("quantity").notNull(),
    status: text("status").notNull().default("pending"),
    reservedBy: text("reserved_by"),
    reservedAt: integer("reserved_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    partIdx: index("idx_res_part").on(table.partId),
    workOrderIdx: index("idx_res_wo").on(table.workOrderId),
  })
);

export const storageConfigSqlite = sqliteTable(
  "storage_config",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    configType: text("config_type").notNull(),
    settings: text("settings"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgTypeIdx: index("idx_sc_org_type").on(table.orgId, table.configType),
  })
);
