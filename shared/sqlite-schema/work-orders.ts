/**
 * SQLite Schema Work Orders Module
 * Work orders, completions, parts, checklists, tasks, history
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const workOrdersSqlite = sqliteTable(
  "work_orders",
  {
    id: text("id").primaryKey(),
    woNumber: text("wo_number"),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    vesselId: text("vessel_id"),
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
    affectsVesselDowntime: integer("affects_vessel_downtime", { mode: "boolean" }).default(false),
    vesselDowntimeStartedAt: integer("vessel_downtime_started_at", { mode: "timestamp" }),
    assignedCrewId: text("assigned_crew_id"),
    requiredSkills: text("required_skills"),
    laborHours: real("labor_hours"),
    laborCost: real("labor_cost"),
    portCallId: text("port_call_id"),
    drydockWindowId: text("drydock_window_id"),
    maintenanceWindow: text("maintenance_window"),
    costJustification: text("cost_justification"),
    maintenanceTemplateId: text("maintenance_template_id"),
    scheduleId: text("schedule_id"),
    plannedStartDate: integer("planned_start_date", { mode: "timestamp" }),
    plannedEndDate: integer("planned_end_date", { mode: "timestamp" }),
    actualStartDate: integer("actual_start_date", { mode: "timestamp" }),
    actualEndDate: integer("actual_end_date", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
    version: integer("version").default(1),
    lastModifiedBy: text("last_modified_by"),
    lastModifiedDevice: text("last_modified_device"),
  },
  (table) => ({
    orgIdx: index("idx_wo_org").on(table.orgId),
    equipmentStatusIdx: index("idx_wo_equipment_status").on(table.equipmentId, table.status),
    vesselIdx: index("idx_wo_vessel").on(table.vesselId),
    scheduleIdx: index("idx_wo_schedule").on(table.scheduleId),
    statusIdx: index("idx_wo_status").on(table.status),
  })
);

export const workOrderCompletionsSqlite = sqliteTable(
  "work_order_completions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    vesselId: text("vessel_id"),
    completedAt: integer("completed_at", { mode: "timestamp" }).notNull(),
    completedBy: text("completed_by"),
    completedByName: text("completed_by_name"),
    actualDurationMinutes: integer("actual_duration_minutes"),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    plannedStartDate: integer("planned_start_date", { mode: "timestamp" }),
    plannedEndDate: integer("planned_end_date", { mode: "timestamp" }),
    actualStartDate: integer("actual_start_date", { mode: "timestamp" }),
    actualEndDate: integer("actual_end_date", { mode: "timestamp" }),
    totalCost: real("total_cost").default(0),
    totalPartsCost: real("total_parts_cost").default(0),
    totalLaborCost: real("total_labor_cost").default(0),
    estimatedDowntimeHours: real("estimated_downtime_hours"),
    actualDowntimeHours: real("actual_downtime_hours"),
    affectsVesselDowntime: integer("affects_vessel_downtime", { mode: "boolean" }).default(false),
    vesselDowntimeHours: real("vessel_downtime_hours"),
    partsUsed: text("parts_used"),
    partsCount: integer("parts_count").default(0),
    completionStatus: text("completion_status").default("completed"),
    complianceFlags: text("compliance_flags"),
    qualityCheckPassed: integer("quality_check_passed", { mode: "boolean" }),
    notes: text("notes"),
    predictiveContext: text("predictive_context"),
    maintenanceScheduleId: text("maintenance_schedule_id"),
    maintenanceType: text("maintenance_type"),
    onTimeCompletion: integer("on_time_completion", { mode: "boolean" }),
    durationVariancePercent: real("duration_variance_percent"),
    costVariancePercent: real("cost_variance_percent"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_woc_org").on(table.orgId),
    completedAtIdx: index("idx_woc_completed_at").on(table.completedAt),
    equipmentIdx: index("idx_woc_equipment").on(table.equipmentId),
    vesselIdx: index("idx_woc_vessel").on(table.vesselId),
    workOrderIdx: index("idx_woc_work_order").on(table.workOrderId),
  })
);

export const workOrderPartsSqlite = sqliteTable(
  "work_order_parts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    partId: text("part_id").notNull(),
    quantityUsed: integer("quantity_used").notNull().default(0),
    unitCost: real("unit_cost").default(0),
    totalCost: real("total_cost").default(0),
    actualCost: real("actual_cost"),
    usedBy: text("used_by"),
    usedAt: integer("used_at", { mode: "timestamp" }),
    notes: text("notes"),
    supplierId: text("supplier_id"),
    estimatedDeliveryDate: integer("estimated_delivery_date", { mode: "timestamp" }),
    actualDeliveryDate: integer("actual_delivery_date", { mode: "timestamp" }),
    deliveryStatus: text("delivery_status").default("pending"),
    inventoryMovementId: text("inventory_movement_id"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    workOrderIdx: index("idx_wop_work_order").on(table.workOrderId),
    partIdx: index("idx_wop_part").on(table.partId),
    orgIdx: index("idx_wop_org").on(table.orgId),
  })
);

export const workOrderChecklistsSqlite = sqliteTable(
  "work_order_checklists",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    templateId: text("template_id"),
    name: text("name").notNull(),
    status: text("status").notNull().default("pending"),
    totalItems: integer("total_items").default(0),
    completedItems: integer("completed_items").default(0),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    workOrderIdx: index("idx_wocl_work_order").on(table.workOrderId),
  })
);

export const workOrderWorklogsSqlite = sqliteTable(
  "work_order_worklogs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    crewId: text("crew_id"),
    crewName: text("crew_name"),
    startTime: integer("start_time", { mode: "timestamp" }),
    endTime: integer("end_time", { mode: "timestamp" }),
    durationMinutes: integer("duration_minutes"),
    laborType: text("labor_type"),
    hourlyRate: real("hourly_rate"),
    totalCost: real("total_cost"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    workOrderIdx: index("idx_wowl_work_order").on(table.workOrderId),
  })
);

export const workOrderTasksSqlite = sqliteTable(
  "work_order_tasks",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    taskNumber: integer("task_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("pending"),
    assignedTo: text("assigned_to"),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    completedBy: text("completed_by"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    workOrderIdx: index("idx_wot_work_order").on(table.workOrderId),
  })
);

export const workOrderHistorySqlite = sqliteTable(
  "work_order_history",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    action: text("action").notNull(),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    changedBy: text("changed_by"),
    changedByName: text("changed_by_name"),
    changeReason: text("change_reason"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    workOrderIdx: index("idx_woh_work_order").on(table.workOrderId),
    createdAtIdx: index("idx_woh_created_at").on(table.createdAt),
  })
);
