/**
 * Schema Work Orders - Work Order Management
 *
 * Work orders, completions, checklists, tasks, and history.
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
  uuidPrimaryKey,
  timestamps,
  tenantColumn,
  versionTracking,
} from "./base";
import { organizations } from "./core";
import { vessels } from "./vessels";
import { equipment } from "./equipment";

// Work Orders - uses shared column builders to reduce duplication
export const workOrders = pgTable(
  "work_orders",
  {
    ...uuidPrimaryKey(),
    woNumber: text("wo_number").unique(),
    ...tenantColumn(organizations),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    status: text("status").notNull().default("open"),
    priority: integer("priority").notNull().default(3),
    maintenanceType: text("maintenance_type"),
    reason: text("reason"),
    description: text("description"),
    estimatedHours: real("estimated_hours"),
    actualHours: real("actual_hours"),
    estimatedCostPerHour: real("estimated_cost_per_hour"),
    actualCostPerHour: real("actual_cost_per_hour"),
    estimatedDowntimeHours: real("estimated_downtime_hours"),
    actualDowntimeHours: real("actual_downtime_hours"),
    totalPartsCost: real("total_parts_cost").default(0),
    totalLaborCost: real("total_labor_cost").default(0),
    totalCost: real("total_cost").default(0),
    roi: real("roi"),
    downtimeCostPerHour: real("downtime_cost_per_hour"),
    affectsVesselDowntime: boolean("affects_vessel_downtime").default(false),
    vesselDowntimeStartedAt: timestamp("vessel_downtime_started_at", { mode: "date" }),
    assignedCrewId: varchar("assigned_crew_id"),
    requiredSkills: text("required_skills").array(),
    laborHours: real("labor_hours"),
    laborCost: real("labor_cost"),
    portCallId: varchar("port_call_id"),
    drydockWindowId: varchar("drydock_window_id"),
    maintenanceWindow: jsonb("maintenance_window"),
    costJustification: text("cost_justification"),
    maintenanceTemplateId: varchar("maintenance_template_id"),
    scheduleId: varchar("schedule_id"),
    plannedStartDate: timestamp("planned_start_date", { mode: "date" }),
    plannedEndDate: timestamp("planned_end_date", { mode: "date" }),
    actualStartDate: timestamp("actual_start_date", { mode: "date" }),
    actualEndDate: timestamp("actual_end_date", { mode: "date" }),
    ...versionTracking(),
    ...timestamps(),
  },
  (table) => ({
    equipmentStatusIdx: sql`CREATE INDEX IF NOT EXISTS idx_work_orders_equipment_status ON work_orders (equipment_id, status)`,
    costAnalysisIdx: sql`CREATE INDEX IF NOT EXISTS idx_work_orders_cost_analysis ON work_orders (total_cost, created_at)`,
    scheduleIdx: sql`CREATE INDEX IF NOT EXISTS idx_work_orders_schedule ON work_orders (schedule_id)`,
    vesselIdx: sql`CREATE INDEX IF NOT EXISTS idx_work_orders_vessel ON work_orders (vessel_id)`,
    priorityIdx: sql`CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders (priority, status)`,
    dueDateIdx: sql`CREATE INDEX IF NOT EXISTS idx_work_orders_due_date ON work_orders (planned_end_date)`,
    assignedCrewIdx: sql`CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_crew ON work_orders (assigned_crew_id)`,
    orgStatusIdx: sql`CREATE INDEX IF NOT EXISTS idx_work_orders_org_status ON work_orders (org_id, status, created_at DESC)`,
  })
);

// Work Order Checklists - uses shared column builders
export const workOrderChecklists = pgTable("work_order_checklists", {
  ...uuidPrimaryKey(),
  ...tenantColumn(organizations),
  workOrderId: varchar("work_order_id")
    .notNull()
    .references(() => workOrders.id),
  templateName: text("template_name").notNull(),
  checklistItems: text("checklist_items").notNull(),
  completedItems: text("completed_items").notNull().default("[]"),
  completionRate: real("completion_rate").default(0),
  completedBy: text("completed_by"),
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Work Order Worklogs - uses shared column builders
export const workOrderWorklogs = pgTable("work_order_worklogs", {
  ...uuidPrimaryKey(),
  ...tenantColumn(organizations),
  workOrderId: varchar("work_order_id")
    .notNull()
    .references(() => workOrders.id),
  technicianName: text("technician_name").notNull(),
  startTime: timestamp("start_time", { mode: "date" }).notNull(),
  endTime: timestamp("end_time", { mode: "date" }),
  durationMinutes: integer("duration_minutes"),
  description: text("description").notNull(),
  laborType: text("labor_type").notNull().default("standard"),
  laborCostPerHour: real("labor_cost_per_hour").default(75),
  totalLaborCost: real("total_labor_cost"),
  status: text("status").notNull().default("in_progress"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Work Order Tasks
export const workOrderTasks = pgTable("work_order_tasks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  workOrderId: varchar("work_order_id")
    .notNull()
    .references(() => workOrders.id),
  description: text("description").notNull(),
  isCompleted: boolean("is_completed").default(false),
  completedBy: text("completed_by"),
  completedByName: text("completed_by_name"),
  completedAt: timestamp("completed_at", { mode: "date" }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Work Order History
export const workOrderHistory = pgTable(
  "work_order_history",
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
    eventType: text("event_type").notNull(),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    fieldName: text("field_name"),
    description: text("description").notNull(),
    performedBy: text("performed_by").notNull(),
    performedByName: text("performed_by_name"),
    metadata: text("metadata"),
    sequenceNumber: integer("sequence_number"),
    previousHash: text("previous_hash"),
    entryHash: text("entry_hash"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    workOrderIdx: index("idx_woh_work_order").on(table.workOrderId),
    orgIdx: index("idx_woh_org").on(table.orgId),
    eventTypeIdx: index("idx_woh_event_type").on(table.eventType),
    createdAtIdx: index("idx_woh_created_at").on(table.createdAt),
    sequenceIdx: index("idx_woh_sequence").on(table.orgId, table.workOrderId, table.sequenceNumber),
  })
);

// Work Order Parts
export const workOrderParts = pgTable(
  "work_order_parts",
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
    partId: varchar("part_id").notNull(),
    quantityUsed: integer("quantity_used").notNull().default(0),
    unitCost: real("unit_cost").default(0),
    totalCost: real("total_cost").default(0),
    actualCost: real("actual_cost"),
    usedBy: text("used_by"),
    usedAt: timestamp("used_at", { mode: "date" }),
    notes: text("notes"),
    supplierId: varchar("supplier_id"),
    estimatedDeliveryDate: timestamp("estimated_delivery_date", { mode: "date" }),
    actualDeliveryDate: timestamp("actual_delivery_date", { mode: "date" }),
    deliveryStatus: text("delivery_status"),
    inventoryMovementId: varchar("inventory_movement_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    workOrderIdx: index("idx_wop_work_order").on(table.workOrderId),
    partIdx: index("idx_wop_part").on(table.partId),
  })
);

// Work Order Equipment linking
export const workOrderEquipment = pgTable(
  "work_order_equipment",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    workOrderId: varchar("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id),
    isPrimary: boolean("is_primary").default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    workOrderIdx: sql`CREATE INDEX IF NOT EXISTS idx_work_order_equipment_wo ON work_order_equipment (work_order_id)`,
    equipmentIdx: sql`CREATE INDEX IF NOT EXISTS idx_work_order_equipment_eq ON work_order_equipment (equipment_id)`,
    uniqueWoEquipment: unique("uq_work_order_equipment").on(table.workOrderId, table.equipmentId),
  })
);

// Work Order Completions tracking
export const workOrderCompletions = pgTable(
  "work_order_completions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    workOrderId: varchar("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    equipmentId: varchar("equipment_id").notNull(),
    vesselId: varchar("vessel_id"),
    completedBy: varchar("completed_by"),
    completedByName: text("completed_by_name"),
    completedAt: timestamp("completed_at", { mode: "date" }).notNull().defaultNow(),
    actualDurationMinutes: integer("actual_duration_minutes"),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    plannedStartDate: timestamp("planned_start_date", { mode: "date" }),
    plannedEndDate: timestamp("planned_end_date", { mode: "date" }),
    actualStartDate: timestamp("actual_start_date", { mode: "date" }),
    actualEndDate: timestamp("actual_end_date", { mode: "date" }),
    totalCost: real("total_cost").default(0),
    totalPartsCost: real("total_parts_cost").default(0),
    totalLaborCost: real("total_labor_cost").default(0),
    estimatedDowntimeHours: real("estimated_downtime_hours"),
    actualDowntimeHours: real("actual_downtime_hours"),
    affectsVesselDowntime: boolean("affects_vessel_downtime").default(false),
    vesselDowntimeHours: real("vessel_downtime_hours"),
    partsUsed: jsonb("parts_used"),
    partsCount: integer("parts_count").default(0),
    completionStatus: text("completion_status").default("completed"),
    complianceFlags: text("compliance_flags").array(),
    qualityCheckPassed: boolean("quality_check_passed"),
    notes: text("notes"),
    completionNotes: text("completion_notes"),
    actualDurationHours: real("actual_duration_hours"),
    laborCost: real("labor_cost"),
    partsCost: real("parts_cost"),
    qualityScore: real("quality_score"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    workOrderIdx: index("idx_work_order_completions_wo").on(table.workOrderId),
    orgIdx: index("idx_work_order_completions_org").on(table.orgId),
  })
);

// Insert schemas
export const insertWorkOrderSchema = createInsertSchema(workOrders)
  .omit({ id: true, woNumber: true, createdAt: true, updatedAt: true })
  .extend({
    actualStartDate: z.coerce.date().optional(),
    actualEndDate: z.coerce.date().optional(),
    plannedStartDate: z.coerce.date().optional(),
    plannedEndDate: z.coerce.date().optional(),
  });

export const updateWorkOrderSchema = insertWorkOrderSchema.partial();

export const insertWorkOrderChecklistSchema = createInsertSchema(workOrderChecklists).omit({
  id: true,
  createdAt: true,
});

export const insertWorkOrderWorklogSchema = createInsertSchema(workOrderWorklogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkOrderTaskSchema = createInsertSchema(workOrderTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkOrderHistorySchema = createInsertSchema(workOrderHistory).omit({
  id: true,
  createdAt: true,
});

export const insertWorkOrderPartsSchema = createInsertSchema(workOrderParts).omit({
  id: true,
  createdAt: true,
});

export const insertWorkOrderEquipmentSchema = createInsertSchema(workOrderEquipment).omit({
  id: true,
  createdAt: true,
});

export const insertWorkOrderCompletionSchema = createInsertSchema(workOrderCompletions).omit({
  id: true,
  createdAt: true,
});

// Types
export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type WorkOrderChecklist = typeof workOrderChecklists.$inferSelect;
export type WorkOrderWorklog = typeof workOrderWorklogs.$inferSelect;
export type WorkOrderTask = typeof workOrderTasks.$inferSelect;
export type WorkOrderHistory = typeof workOrderHistory.$inferSelect;
export type WorkOrderPart = typeof workOrderParts.$inferSelect;
export type WorkOrderEquipment = typeof workOrderEquipment.$inferSelect;
export type InsertWorkOrderEquipment = z.infer<typeof insertWorkOrderEquipmentSchema>;
export type WorkOrderCompletion = typeof workOrderCompletions.$inferSelect;
export type InsertWorkOrderCompletion = z.infer<typeof insertWorkOrderCompletionSchema>;
export type InsertWorkOrderChecklist = z.infer<typeof insertWorkOrderChecklistSchema>;
export type InsertWorkOrderWorklog = z.infer<typeof insertWorkOrderWorklogSchema>;
export type InsertWorkOrderTask = z.infer<typeof insertWorkOrderTaskSchema>;
export type InsertWorkOrderHistory = z.infer<typeof insertWorkOrderHistorySchema>;
export type InsertWorkOrderParts = z.infer<typeof insertWorkOrderPartsSchema>;
export type WorkOrderParts = typeof workOrderParts.$inferSelect;
