/**
 * Schema Inventory - Parts, Suppliers, Stock, and Inventory Management
 *
 * Inventory tracking, parts catalog, supplier management, and movements ledger.
 *
 * CONSOLIDATION NOTE (Task #8):
 * The canonical model is `parts` (catalog) + `stock` (per-location quantities).
 * `partsInventory` is DEPRECATED — kept for rollback but
 * all new code should use `parts` + `stock` instead.
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
  createInsertSchema,
  z,
} from "./base";
import { organizations } from "./core";
import { workOrders } from "./work-orders";

// Suppliers: Vendor and supplier management (includes both suppliers and service providers)
export const suppliers = pgTable(
  "suppliers",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    code: text("code").notNull(),
    type: text("type").notNull().default("supplier"),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    paymentTerms: text("payment_terms"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    leadTimeDays: integer("lead_time_days"),
    qualityRating: real("quality_rating"),
    defectRate: real("defect_rate"),
    isPreferred: boolean("is_preferred").notNull().default(false),
    serviceCapabilities: text("service_capabilities").array(),
    certifications: text("certifications").array(),
    responseSlaHours: integer("response_sla_hours"),
    equipmentTypesServiced: text("equipment_types_serviced").array(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniqueSupplierCode: sql`ALTER TABLE ${table} ADD CONSTRAINT unique_supplier_code_org UNIQUE (${table.orgId}, ${table.code})`,
    performanceIdx: sql`CREATE INDEX IF NOT EXISTS idx_suppliers_performance ON suppliers (quality_rating, defect_rate)`,
    searchIdx: sql`CREATE INDEX IF NOT EXISTS idx_suppliers_search ON suppliers (name, code)`,
    typeIdx: sql`CREATE INDEX IF NOT EXISTS idx_suppliers_type ON suppliers (type, is_active)`,
  })
);

// Parts Catalog: Canonical parts table (consolidated from parts + partsInventory + inventoryParts)
export const parts = pgTable(
  "parts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    partNo: text("part_no").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    unitOfMeasure: text("unit_of_measure").notNull().default("ea"),
    minStockQty: numeric("min_stock_qty", { precision: 12, scale: 3, mode: "number" }).default(0),
    maxStockQty: numeric("max_stock_qty", { precision: 12, scale: 3, mode: "number" }).default(0),
    standardCost: numeric("standard_cost", { precision: 12, scale: 2, mode: "number" }).default(0),
    leadTimeDays: integer("lead_time_days").default(7),
    criticality: text("criticality").default("medium"),
    specifications: jsonb("specifications"),
    compatibleEquipment: text("compatible_equipment").array(),
    primarySupplierId: varchar("primary_supplier_id").references(() => suppliers.id),
    alternateSupplierIds: text("alternate_supplier_ids").array(),
    riskLevel: text("risk_level").default("medium"),
    lastOrderDate: timestamp("last_order_date", { mode: "date" }),
    averageLeadTime: integer("average_lead_time"),
    demandVariability: real("demand_variability"),
    manufacturer: text("manufacturer"),
    isActive: boolean("is_active").notNull().default(true),
    lastUsage30d: integer("last_usage_30d").default(0),
    imoDgClass: text("imo_dg_class"),
    unNumber: text("un_number"),
    imdgCode: text("imdg_code"),
    isHazmat: boolean("is_hazmat").notNull().default(false),
    hazmatHandling: text("hazmat_handling"),
    shelfLifeDays: integer("shelf_life_days"),
    customsTariffCode: text("customs_tariff_code"),
    msdsUrl: text("msds_url"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniquePartNo: sql`ALTER TABLE ${table} ADD CONSTRAINT unique_part_no_org UNIQUE (${table.orgId}, ${table.partNo})`,
    searchIdx: sql`CREATE INDEX IF NOT EXISTS idx_parts_search ON parts USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')))`,
    partNoIdx: sql`CREATE INDEX IF NOT EXISTS idx_parts_part_no ON parts (part_no)`,
    categoryIdx: sql`CREATE INDEX IF NOT EXISTS idx_parts_category ON parts (category, criticality)`,
    supplierIdx: sql`CREATE INDEX IF NOT EXISTS idx_parts_supplier ON parts (primary_supplier_id)`,
    activeIdx: sql`CREATE INDEX IF NOT EXISTS idx_parts_active ON parts (is_active)`,
  })
);

/**
 * @deprecated Use `parts` + `stock` instead. Kept for rollback window.
 * CMMS-lite: Parts Inventory Management — DEPRECATED (Task #8)
 * All queries should use `parts` (catalog) joined with `stock` (quantities).
 */
export const partsInventory = pgTable(
  "parts_inventory",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    partNumber: text("part_number").notNull(),
    partName: text("part_name").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    manufacturer: text("manufacturer"),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2, mode: "number" }).notNull(),
    quantityOnHand: integer("quantity_on_hand").notNull().default(0),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    minStockLevel: integer("min_stock_level").default(1),
    maxStockLevel: integer("max_stock_level").default(100),
    location: text("location"),
    supplierName: text("supplier_name"),
    supplierPartNumber: text("supplier_part_number"),
    leadTimeDays: integer("lead_time_days").default(7),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    validReservedQuantity: sql`CHECK (quantity_reserved <= quantity_on_hand)`,
    nonNegativeOnHand: sql`CHECK (quantity_on_hand >= 0)`,
    nonNegativeReserved: sql`CHECK (quantity_reserved >= 0)`,
  })
);

// Junction table: Links parts inventory items to multiple suppliers
export const partsInventorySuppliers = pgTable(
  "parts_inventory_suppliers",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    inventoryItemId: varchar("inventory_item_id")
      .notNull()
      .references(() => partsInventory.id, { onDelete: "cascade" }),
    supplierId: varchar("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    supplierPartNumber: text("supplier_part_number"),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2, mode: "number" }),
    leadTimeDays: integer("lead_time_days"),
    isPreferred: boolean("is_preferred").default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniqueInventorySupplier: sql`ALTER TABLE ${table} ADD CONSTRAINT unique_inventory_supplier UNIQUE (${table.inventoryItemId}, ${table.supplierId})`,
    supplierIdx: sql`CREATE INDEX IF NOT EXISTS idx_parts_inv_suppliers_supplier ON parts_inventory_suppliers (supplier_id)`,
    inventoryIdx: sql`CREATE INDEX IF NOT EXISTS idx_parts_inv_suppliers_inventory ON parts_inventory_suppliers (inventory_item_id)`,
  })
);

// Stock Levels: Inventory tracking by location
export const stock = pgTable(
  "stock",
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
    partNo: text("part_no").notNull(),
    location: text("location").notNull().default("MAIN"),
    quantityOnHand: numeric("quantity_on_hand", {
      precision: 12,
      scale: 3,
      mode: "number",
    }).default(0),
    quantityReserved: numeric("quantity_reserved", {
      precision: 12,
      scale: 3,
      mode: "number",
    }).default(0),
    quantityOnOrder: numeric("quantity_on_order", {
      precision: 12,
      scale: 3,
      mode: "number",
    }).default(0),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2, mode: "number" }).default(0),
    lastCountDate: timestamp("last_count_date", { mode: "date" }),
    binLocation: text("bin_location"),
    supplierId: varchar("supplier_id").references(() => suppliers.id),
    reorderPoint: numeric("reorder_point", { precision: 12, scale: 3, mode: "number" }),
    maxQuantity: numeric("max_quantity", { precision: 12, scale: 3, mode: "number" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniquePartLocation: sql`ALTER TABLE ${table} ADD CONSTRAINT unique_part_location UNIQUE (${table.orgId}, ${table.partId}, ${table.location})`,
    partNoIdx: sql`CREATE INDEX IF NOT EXISTS idx_stock_part_no ON stock (part_no)`,
    lowStockIdx: sql`CREATE INDEX IF NOT EXISTS idx_stock_low_stock ON stock (quantity_on_hand, reorder_point)`,
    supplierIdx: sql`CREATE INDEX IF NOT EXISTS idx_stock_supplier ON stock (supplier_id)`,
    orgPartIdx: sql`CREATE INDEX IF NOT EXISTS idx_stock_org_part ON stock (org_id, part_id)`,
  })
);

// Part Substitutions: Alternative parts mapping
export const partSubstitutions = pgTable(
  "part_substitutions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    primaryPartNo: text("primary_part_no").notNull(),
    alternatePartNo: text("alternate_part_no").notNull(),
    substitutionType: text("substitution_type").default("equivalent"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    primaryPartIdx: sql`CREATE INDEX IF NOT EXISTS idx_substitutions_primary ON part_substitutions (primary_part_no, substitution_type)`,
    alternatePartIdx: sql`CREATE INDEX IF NOT EXISTS idx_substitutions_alternate ON part_substitutions (alternate_part_no)`,
  })
);

// CMMS-lite: Inventory Movements Ledger
export const inventoryMovements = pgTable("inventory_movements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  partId: varchar("part_id")
    .notNull()
    .references(() => parts.id),
  workOrderId: varchar("work_order_id").references(() => workOrders.id),
  movementType: text("movement_type").notNull(),
  quantity: integer("quantity").notNull(),
  quantityBefore: integer("quantity_before").notNull(),
  quantityAfter: integer("quantity_after").notNull(),
  reservedBefore: integer("reserved_before").notNull().default(0),
  reservedAfter: integer("reserved_after").notNull().default(0),
  performedBy: text("performed_by").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});
// Insert schemas
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartSchema = createInsertSchema(parts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** @deprecated Use insertPartSchema + insertStockSchema instead */
export const insertPartsInventorySchema = createInsertSchema(partsInventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartsInventorySuppliersSchema = createInsertSchema(partsInventorySuppliers).omit(
  {
    id: true,
    createdAt: true,
  }
);

export const insertStockSchema = createInsertSchema(stock).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartSubstitutionSchema = createInsertSchema(partSubstitutions).omit({
  id: true,
  createdAt: true,
});

export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({
  id: true,
  createdAt: true,
});

/** @deprecated Use insertPartSchema instead */
// Types
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type Part = typeof parts.$inferSelect;
export type InsertPart = z.infer<typeof insertPartSchema>;

/** @deprecated Use Part type instead */
export type PartsInventory = typeof partsInventory.$inferSelect;
/** @deprecated Use InsertPart instead */
export type InsertPartsInventory = z.infer<typeof insertPartsInventorySchema>;

export type PartsInventorySupplier = typeof partsInventorySuppliers.$inferSelect;
export type InsertPartsInventorySupplier = z.infer<typeof insertPartsInventorySuppliersSchema>;

export type Stock = typeof stock.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;

export type PartSubstitution = typeof partSubstitutions.$inferSelect;
export type InsertPartSubstitution = z.infer<typeof insertPartSubstitutionSchema>;

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;

/** @deprecated Use Part type instead */
/** @deprecated Use InsertPart instead */

/**
 * Consolidated view type: Part with stock data joined.
 * Used as the canonical return type for inventory queries that
 * previously returned PartsInventory rows.
 */
export type PartWithStock = Part & {
  stock: Stock | null;
};
