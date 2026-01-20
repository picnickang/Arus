import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";
import { index } from "drizzle-orm/sqlite-core";
const vesselsSqlite = sqliteTable(
  "vessels",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    imo: text("imo"),
    flag: text("flag"),
    vesselType: text("vessel_type"),
    vesselClass: text("vessel_class"),
    condition: text("condition").default("good"),
    onlineStatus: text("online_status").default("unknown"),
    lastHeartbeat: integer("last_heartbeat", { mode: "timestamp" }),
    dwt: integer("dwt"),
    yearBuilt: integer("year_built"),
    active: integer("active", { mode: "boolean" }).default(true),
    notes: text("notes"),
    // Financial tracking (numeric → real)
    dayRateSgd: real("day_rate_sgd"),
    downtimeDays: real("downtime_days").default(0),
    downtimeResetAt: integer("downtime_reset_at", { mode: "timestamp" }),
    operationDays: real("operation_days").default(0),
    operationResetAt: integer("operation_reset_at", { mode: "timestamp" }),
    lastDailyUpdateDate: text("last_daily_update_date"),
    commissionDate: integer("commission_date", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_vessels_org").on(table.orgId)
  })
);
const equipmentSqlite = sqliteTable(
  "equipment",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    vesselId: text("vessel_id"),
    vesselName: text("vessel_name"),
    name: text("name").notNull(),
    plainLanguageName: text("plain_language_name"),
    type: text("type").notNull(),
    systemType: text("system_type"),
    componentType: text("component_type"),
    criticalityLevel: text("criticality_level").default("medium"),
    manufacturer: text("manufacturer"),
    model: text("model"),
    serialNumber: text("serial_number"),
    location: text("location"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    specifications: text("specifications"),
    // jsonb → text (store as JSON string)
    operatingParameters: text("operating_parameters"),
    // jsonb → text
    maintenanceSchedule: text("maintenance_schedule"),
    // jsonb → text
    emergencyLaborMultiplier: real("emergency_labor_multiplier"),
    emergencyPartsMultiplier: real("emergency_parts_multiplier"),
    emergencyDowntimeMultiplier: real("emergency_downtime_multiplier"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
    version: integer("version").default(1),
    lastModifiedBy: text("last_modified_by"),
    lastModifiedDevice: text("last_modified_device")
  },
  (table) => ({
    orgIdx: index("idx_equipment_org").on(table.orgId),
    vesselIdx: index("idx_equipment_vessel").on(table.vesselId)
  })
);
const devicesSqlite = sqliteTable(
  "devices",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id"),
    label: text("label"),
    vessel: text("vessel"),
    buses: text("buses"),
    sensors: text("sensors"),
    config: text("config"),
    hmacKey: text("hmac_key"),
    deviceType: text("device_type").default("generic"),
    j1939Config: text("j1939_config"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_devices_org").on(table.orgId),
    equipmentIdx: index("idx_devices_equipment").on(table.equipmentId)
  })
);
const equipmentTelemetrySqlite = sqliteTable(
  "equipment_telemetry",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    ts: integer("ts", { mode: "timestamp" }).notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    value: real("value").notNull(),
    unit: text("unit").notNull(),
    threshold: real("threshold"),
    status: text("status").notNull().default("normal")
  },
  (table) => ({
    orgIdx: index("idx_telemetry_org").on(table.orgId),
    equipmentTsIdx: index("idx_telemetry_equipment_ts").on(table.equipmentId, table.ts),
    sensorTsIdx: index("idx_telemetry_sensor_ts").on(table.sensorType, table.ts),
    statusIdx: index("idx_telemetry_status").on(table.status)
  })
);
const downtimeEventsSqlite = sqliteTable(
  "downtime_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id"),
    equipmentId: text("equipment_id"),
    vesselId: text("vessel_id"),
    downtimeType: text("downtime_type").notNull(),
    startTime: integer("start_time", { mode: "timestamp" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp" }),
    durationHours: real("duration_hours"),
    reason: text("reason"),
    impactLevel: text("impact_level").default("medium"),
    revenueImpact: real("revenue_impact"),
    opportunityCost: real("opportunity_cost"),
    rootCause: text("root_cause"),
    preventable: integer("preventable", { mode: "boolean" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_downtime_org").on(table.orgId),
    workOrderIdx: index("idx_downtime_work_order").on(table.workOrderId),
    equipmentIdx: index("idx_downtime_equipment").on(table.equipmentId),
    vesselIdx: index("idx_downtime_vessel").on(table.vesselId),
    timeIdx: index("idx_downtime_time").on(table.startTime)
  })
);
const workOrdersSqlite = sqliteTable(
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
    // Cost tracking (numeric → real)
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
    // Vessel downtime tracking (boolean → integer)
    affectsVesselDowntime: integer("affects_vessel_downtime", { mode: "boolean" }).default(false),
    vesselDowntimeStartedAt: integer("vessel_downtime_started_at", { mode: "timestamp" }),
    // Crew and labor
    assignedCrewId: text("assigned_crew_id"),
    requiredSkills: text("required_skills"),
    // array → text
    laborHours: real("labor_hours"),
    laborCost: real("labor_cost"),
    // Port and drydock scheduling
    portCallId: text("port_call_id"),
    drydockWindowId: text("drydock_window_id"),
    maintenanceWindow: text("maintenance_window"),
    // jsonb → text
    maintenanceTemplateId: text("maintenance_template_id"),
    scheduleId: text("schedule_id"),
    // Timestamps
    plannedStartDate: integer("planned_start_date", { mode: "timestamp" }),
    plannedEndDate: integer("planned_end_date", { mode: "timestamp" }),
    actualStartDate: integer("actual_start_date", { mode: "timestamp" }),
    actualEndDate: integer("actual_end_date", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
    // Optimistic locking
    version: integer("version").default(1),
    lastModifiedBy: text("last_modified_by"),
    lastModifiedDevice: text("last_modified_device")
  },
  (table) => ({
    orgIdx: index("idx_wo_org").on(table.orgId),
    equipmentStatusIdx: index("idx_wo_equipment_status").on(table.equipmentId, table.status),
    vesselIdx: index("idx_wo_vessel").on(table.vesselId),
    scheduleIdx: index("idx_wo_schedule").on(table.scheduleId),
    statusIdx: index("idx_wo_status").on(table.status)
  })
);
const workOrderCompletionsSqlite = sqliteTable(
  "work_order_completions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    vesselId: text("vessel_id"),
    // Completion details
    completedAt: integer("completed_at", { mode: "timestamp" }).notNull(),
    completedBy: text("completed_by"),
    completedByName: text("completed_by_name"),
    // Duration tracking
    actualDurationMinutes: integer("actual_duration_minutes"),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    plannedStartDate: integer("planned_start_date", { mode: "timestamp" }),
    plannedEndDate: integer("planned_end_date", { mode: "timestamp" }),
    actualStartDate: integer("actual_start_date", { mode: "timestamp" }),
    actualEndDate: integer("actual_end_date", { mode: "timestamp" }),
    // Cost tracking
    totalCost: real("total_cost").default(0),
    totalPartsCost: real("total_parts_cost").default(0),
    totalLaborCost: real("total_labor_cost").default(0),
    // Downtime tracking
    estimatedDowntimeHours: real("estimated_downtime_hours"),
    actualDowntimeHours: real("actual_downtime_hours"),
    affectsVesselDowntime: integer("affects_vessel_downtime", { mode: "boolean" }).default(false),
    vesselDowntimeHours: real("vessel_downtime_hours"),
    // Parts usage
    partsUsed: text("parts_used"),
    // jsonb → text
    partsCount: integer("parts_count").default(0),
    // Compliance and quality
    completionStatus: text("completion_status").default("completed"),
    complianceFlags: text("compliance_flags"),
    // array → text
    qualityCheckPassed: integer("quality_check_passed", { mode: "boolean" }),
    notes: text("notes"),
    // Predictive context
    predictiveContext: text("predictive_context"),
    // jsonb → text
    maintenanceScheduleId: text("maintenance_schedule_id"),
    maintenanceType: text("maintenance_type"),
    // Performance metrics
    onTimeCompletion: integer("on_time_completion", { mode: "boolean" }),
    durationVariancePercent: real("duration_variance_percent"),
    costVariancePercent: real("cost_variance_percent"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_woc_org").on(table.orgId),
    completedAtIdx: index("idx_woc_completed_at").on(table.completedAt),
    equipmentIdx: index("idx_woc_equipment").on(table.equipmentId),
    vesselIdx: index("idx_woc_vessel").on(table.vesselId),
    workOrderIdx: index("idx_woc_work_order").on(table.workOrderId)
  })
);
const workOrderPartsSqlite = sqliteTable(
  "work_order_parts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    partId: text("part_id").notNull(),
    quantityUsed: integer("quantity_used").notNull(),
    unitCost: real("unit_cost").notNull(),
    totalCost: real("total_cost").notNull(),
    usedBy: text("used_by").notNull(),
    usedAt: integer("used_at", { mode: "timestamp" }),
    notes: text("notes"),
    // Supply chain tracking
    supplierId: text("supplier_id"),
    estimatedDeliveryDate: integer("estimated_delivery_date", { mode: "timestamp" }),
    actualDeliveryDate: integer("actual_delivery_date", { mode: "timestamp" }),
    actualCost: real("actual_cost"),
    deliveryStatus: text("delivery_status").default("pending"),
    inventoryMovementId: text("inventory_movement_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    workOrderIdx: index("idx_wop_work_order").on(table.workOrderId),
    partIdx: index("idx_wop_part").on(table.partId)
  })
);
const maintenanceSchedulesSqlite = sqliteTable(
  "maintenance_schedules",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    vesselId: text("vessel_id"),
    scheduledDate: integer("scheduled_date", { mode: "timestamp" }).notNull(),
    maintenanceType: text("maintenance_type").notNull(),
    priority: integer("priority").notNull().default(2),
    estimatedDuration: integer("estimated_duration"),
    description: text("description"),
    status: text("status").notNull().default("scheduled"),
    assignedTo: text("assigned_to"),
    pdmScore: real("pdm_score"),
    autoGenerated: integer("auto_generated", { mode: "boolean" }).default(false),
    workOrderId: text("work_order_id"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    equipmentIdx: index("idx_ms_equipment").on(table.equipmentId),
    vesselIdx: index("idx_ms_vessel").on(table.vesselId),
    scheduledDateIdx: index("idx_ms_scheduled_date").on(table.scheduledDate),
    statusIdx: index("idx_ms_status").on(table.status)
  })
);
const maintenanceRecordsSqlite = sqliteTable(
  "maintenance_records",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    scheduleId: text("schedule_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    maintenanceType: text("maintenance_type").notNull(),
    actualStartTime: integer("actual_start_time", { mode: "timestamp" }),
    actualEndTime: integer("actual_end_time", { mode: "timestamp" }),
    actualDuration: integer("actual_duration"),
    technician: text("technician"),
    notes: text("notes"),
    partsUsed: text("parts_used"),
    // JSON array → text
    laborHours: real("labor_hours"),
    downtimeMinutes: integer("downtime_minutes"),
    completionStatus: text("completion_status").notNull().default("completed"),
    followUpRequired: integer("follow_up_required", { mode: "boolean" }).default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    scheduleIdx: index("idx_mr_schedule").on(table.scheduleId),
    equipmentIdx: index("idx_mr_equipment").on(table.equipmentId)
  })
);
const maintenanceCostsSqlite = sqliteTable(
  "maintenance_costs",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id"),
    scheduleId: text("schedule_id"),
    equipmentId: text("equipment_id").notNull(),
    workOrderId: text("work_order_id"),
    costType: text("cost_type").notNull(),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    description: text("description"),
    incurredAt: integer("incurred_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    equipmentIdx: index("idx_mc_equipment").on(table.equipmentId),
    workOrderIdx: index("idx_mc_work_order").on(table.workOrderId)
  })
);
const maintenanceTemplatesSqlite = sqliteTable(
  "maintenance_templates",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    equipmentType: text("equipment_type").notNull(),
    manufacturer: text("manufacturer"),
    model: text("model"),
    maintenanceType: text("maintenance_type").notNull(),
    frequencyDays: integer("frequency_days"),
    frequencyHours: integer("frequency_hours"),
    estimatedDurationHours: real("estimated_duration_hours"),
    priority: integer("priority").default(3),
    requiredSkills: text("required_skills"),
    // array → text
    requiredParts: text("required_parts"),
    // jsonb → text
    safetyNotes: text("safety_notes"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    typeIdx: index("idx_mt_type").on(table.equipmentType),
    activeIdx: index("idx_mt_active").on(table.isActive)
  })
);
const maintenanceChecklistItemsSqlite = sqliteTable(
  "maintenance_checklist_items",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").notNull(),
    stepNumber: integer("step_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    required: integer("required", { mode: "boolean" }).default(true),
    imageUrl: text("image_url"),
    estimatedMinutes: integer("estimated_minutes"),
    safetyWarning: text("safety_warning"),
    expectedResult: text("expected_result"),
    acceptanceCriteria: text("acceptance_criteria")
  },
  (table) => ({
    templateIdx: index("idx_mci_template").on(table.templateId, table.stepNumber)
  })
);
const maintenanceChecklistCompletionsSqlite = sqliteTable(
  "maintenance_checklist_completions",
  {
    id: text("id").primaryKey(),
    workOrderId: text("work_order_id").notNull(),
    itemId: text("item_id").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    completedBy: text("completed_by"),
    completedByName: text("completed_by_name"),
    status: text("status").notNull().default("pending"),
    passed: integer("passed", { mode: "boolean" }),
    actualValue: text("actual_value"),
    notes: text("notes"),
    photoUrls: text("photo_urls")
    // array → text
  },
  (table) => ({
    workOrderIdx: index("idx_mcc_work_order").on(table.workOrderId),
    itemIdx: index("idx_mcc_item").on(table.itemId)
  })
);
const equipmentLifecycleSqlite = sqliteTable(
  "equipment_lifecycle",
  {
    id: text("id").primaryKey(),
    equipmentId: text("equipment_id").notNull(),
    manufacturer: text("manufacturer"),
    model: text("model"),
    serialNumber: text("serial_number"),
    installationDate: integer("installation_date", { mode: "timestamp" }),
    warrantyExpiry: integer("warranty_expiry", { mode: "timestamp" }),
    expectedLifespan: integer("expected_lifespan"),
    replacementCost: real("replacement_cost"),
    operatingHours: integer("operating_hours").default(0),
    maintenanceCount: integer("maintenance_count").default(0),
    lastMajorOverhaul: integer("last_major_overhaul", { mode: "timestamp" }),
    nextRecommendedReplacement: integer("next_recommended_replacement", { mode: "timestamp" }),
    condition: text("condition").notNull().default("good"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    equipmentIdx: index("idx_el_equipment").on(table.equipmentId)
  })
);
const performanceMetricsSqlite = sqliteTable(
  "performance_metrics",
  {
    id: text("id").primaryKey(),
    equipmentId: text("equipment_id").notNull(),
    metricDate: integer("metric_date", { mode: "timestamp" }).notNull(),
    efficiency: real("efficiency"),
    reliability: real("reliability"),
    availability: real("availability"),
    mtbfHours: real("mtbf_hours"),
    mttrHours: real("mttr_hours"),
    totalDowntimeMinutes: integer("total_downtime_minutes"),
    plannedDowntimeMinutes: integer("planned_downtime_minutes"),
    unplannedDowntimeMinutes: integer("unplanned_downtime_minutes"),
    operatingHours: real("operating_hours"),
    energyConsumption: real("energy_consumption"),
    performanceScore: real("performance_score"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    equipmentIdx: index("idx_pm_equipment").on(table.equipmentId),
    dateIdx: index("idx_pm_date").on(table.metricDate)
  })
);
const maintenanceWindowsSqlite = sqliteTable(
  "maintenance_windows",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    severity: text("severity").notNull().default("low"),
    status: text("status").notNull().default("scheduled"),
    startTime: integer("start_time", { mode: "timestamp" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp" }).notNull(),
    actualStartTime: integer("actual_start_time", { mode: "timestamp" }),
    actualEndTime: integer("actual_end_time", { mode: "timestamp" }),
    affectedServices: text("affected_services"),
    // array → text
    maintenanceTasks: text("maintenance_tasks"),
    // jsonb → text
    completedTasks: text("completed_tasks"),
    // jsonb → text
    rollbackPlan: text("rollback_plan"),
    createdBy: text("created_by"),
    assignedTo: text("assigned_to"),
    notifyUsers: text("notify_users"),
    // array → text
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_mw_org").on(table.orgId),
    statusIdx: index("idx_mw_status").on(table.status)
  })
);
const portCallSqlite = sqliteTable(
  "port_call",
  {
    id: text("id").primaryKey(),
    vesselId: text("vessel_id").notNull(),
    port: text("port").notNull(),
    start: integer("start", { mode: "timestamp" }).notNull(),
    end: integer("end", { mode: "timestamp" }).notNull(),
    status: text("status").default("scheduled"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    vesselIdx: index("idx_pc_vessel").on(table.vesselId),
    startIdx: index("idx_pc_start").on(table.start)
  })
);
const drydockWindowSqlite = sqliteTable(
  "drydock_window",
  {
    id: text("id").primaryKey(),
    vesselId: text("vessel_id").notNull(),
    yard: text("yard"),
    start: integer("start", { mode: "timestamp" }).notNull(),
    end: integer("end", { mode: "timestamp" }).notNull(),
    workType: text("work_type"),
    status: text("status").default("scheduled"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    vesselIdx: index("idx_dw_vessel").on(table.vesselId),
    startIdx: index("idx_dw_start").on(table.start)
  })
);
const expensesSqlite = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    type: text("type").notNull(),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    description: text("description").notNull(),
    vendor: text("vendor"),
    invoiceNumber: text("invoice_number"),
    workOrderId: text("work_order_id"),
    vesselName: text("vessel_name"),
    expenseDate: integer("expense_date", { mode: "timestamp" }).notNull(),
    approvalStatus: text("approval_status").notNull().default("pending"),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    receipt: text("receipt"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_exp_org").on(table.orgId),
    workOrderIdx: index("idx_exp_work_order").on(table.workOrderId),
    dateIdx: index("idx_exp_date").on(table.expenseDate)
  })
);
const laborRatesSqlite = sqliteTable(
  "labor_rates",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    skillLevel: text("skill_level").notNull(),
    position: text("position").notNull(),
    standardRate: real("standard_rate").notNull(),
    overtimeRate: real("overtime_rate").notNull(),
    emergencyRate: real("emergency_rate").notNull(),
    contractorRate: real("contractor_rate").notNull(),
    currency: text("currency").notNull().default("USD"),
    effectiveDate: integer("effective_date", { mode: "timestamp" }),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_lr_org").on(table.orgId),
    activeIdx: index("idx_lr_active").on(table.isActive)
  })
);
const partsInventorySqlite = sqliteTable(
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
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_pi_org").on(table.orgId),
    partNumberIdx: index("idx_pi_part_number").on(table.partNumber),
    categoryIdx: index("idx_pi_category").on(table.category)
  })
);
const stockSqlite = sqliteTable(
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
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgPartLocationIdx: index("idx_stock_org_part_location").on(
      table.orgId,
      table.partId,
      table.location
    ),
    partNoIdx: index("idx_stock_part_no").on(table.partNo),
    supplierIdx: index("idx_stock_supplier").on(table.supplierId)
  })
);
const inventoryMovementsSqlite = sqliteTable(
  "inventory_movements",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partId: text("part_id").notNull(),
    workOrderId: text("work_order_id"),
    movementType: text("movement_type").notNull(),
    quantity: integer("quantity").notNull(),
    quantityBefore: integer("quantity_before").notNull(),
    quantityAfter: integer("quantity_after").notNull(),
    reservedBefore: integer("reserved_before").notNull().default(0),
    reservedAfter: integer("reserved_after").notNull().default(0),
    performedBy: text("performed_by").notNull(),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    partIdx: index("idx_im_part").on(table.partId),
    workOrderIdx: index("idx_im_work_order").on(table.workOrderId),
    typeIdx: index("idx_im_type").on(table.movementType)
  })
);
const suppliersSqlite = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    contactInfo: text("contact_info"),
    // jsonb → text
    leadTimeDays: integer("lead_time_days").default(14),
    qualityRating: real("quality_rating").default(5),
    reliabilityScore: real("reliability_score").default(5),
    costRating: real("cost_rating").default(5),
    paymentTerms: text("payment_terms"),
    isPreferred: integer("is_preferred", { mode: "boolean" }).default(false),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    // Performance tracking
    onTimeDeliveryRate: real("on_time_delivery_rate"),
    defectRate: real("defect_rate").default(0),
    averageLeadTime: integer("average_lead_time"),
    totalOrderValue: real("total_order_value").default(0),
    totalOrders: integer("total_orders").default(0),
    lastOrderDate: integer("last_order_date", { mode: "timestamp" }),
    // Risk assessment
    riskLevel: text("risk_level").default("medium"),
    backupSuppliers: text("backup_suppliers"),
    // array → text
    minimumOrderValue: real("minimum_order_value"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgCodeIdx: index("idx_suppliers_org_code").on(table.orgId, table.code),
    nameIdx: index("idx_suppliers_name").on(table.name)
  })
);
const purchaseOrdersSqlite = sqliteTable(
  "purchase_orders",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    supplierId: text("supplier_id").notNull(),
    orderNumber: text("order_number").notNull(),
    expectedDate: integer("expected_date", { mode: "timestamp" }),
    totalAmount: real("total_amount"),
    currency: text("currency").default("USD"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    supplierIdx: index("idx_po_supplier").on(table.supplierId),
    statusIdx: index("idx_po_status").on(table.status),
    orderNumberIdx: index("idx_po_order_number").on(table.orderNumber)
  })
);
const purchaseOrderItemsSqlite = sqliteTable(
  "purchase_order_items",
  {
    id: text("id").primaryKey(),
    poId: text("po_id").notNull(),
    partId: text("part_id").notNull(),
    quantity: real("quantity").notNull(),
    unitPrice: real("unit_price").notNull(),
    totalPrice: real("total_price").notNull(),
    receivedQuantity: real("received_quantity").default(0),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    poIdx: index("idx_poi_po").on(table.poId),
    partIdx: index("idx_poi_part").on(table.partId)
  })
);
const crewSqlite = sqliteTable(
  "crew",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    rank: text("rank"),
    vesselId: text("vessel_id"),
    maxHours7d: real("max_hours_7d").default(72),
    minRestH: real("min_rest_h").default(10),
    active: integer("active", { mode: "boolean" }).default(true),
    onDuty: integer("on_duty", { mode: "boolean" }).default(false),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_crew_org").on(table.orgId),
    vesselIdx: index("idx_crew_vessel").on(table.vesselId),
    activeIdx: index("idx_crew_active").on(table.active)
  })
);
const skillsSqlite = sqliteTable(
  "skills",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    description: text("description"),
    maxLevel: integer("max_level").default(5),
    active: integer("active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_skills_org").on(table.orgId),
    nameIdx: index("idx_skills_name").on(table.name)
  })
);
const crewSkillSqlite = sqliteTable(
  "crew_skill",
  {
    crewId: text("crew_id").notNull(),
    skill: text("skill").notNull(),
    level: integer("level").default(1)
  },
  (table) => ({
    pk: primaryKey({ columns: [table.crewId, table.skill] }),
    crewIdx: index("idx_crew_skill_crew").on(table.crewId)
  })
);
const crewLeaveSqlite = sqliteTable(
  "crew_leave",
  {
    id: text("id").primaryKey(),
    crewId: text("crew_id").notNull(),
    start: integer("start", { mode: "timestamp" }).notNull(),
    end: integer("end", { mode: "timestamp" }).notNull(),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    crewIdx: index("idx_crew_leave_crew").on(table.crewId),
    dateIdx: index("idx_crew_leave_dates").on(table.start, table.end)
  })
);
const shiftTemplateSqlite = sqliteTable(
  "shift_template",
  {
    id: text("id").primaryKey(),
    vesselId: text("vessel_id"),
    equipmentId: text("equipment_id"),
    role: text("role").notNull(),
    start: text("start").notNull(),
    end: text("end").notNull(),
    durationH: real("duration_h").notNull(),
    requiredSkills: text("required_skills"),
    rankMin: text("rank_min"),
    certRequired: text("cert_required"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    vesselIdx: index("idx_shift_template_vessel").on(table.vesselId),
    roleIdx: index("idx_shift_template_role").on(table.role)
  })
);
const crewAssignmentSqlite = sqliteTable(
  "crew_assignment",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    shiftId: text("shift_id"),
    crewId: text("crew_id").notNull(),
    vesselId: text("vessel_id"),
    start: integer("start", { mode: "timestamp" }).notNull(),
    end: integer("end", { mode: "timestamp" }).notNull(),
    role: text("role"),
    status: text("status").default("scheduled"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    version: integer("version").default(1),
    lastModifiedBy: text("last_modified_by"),
    lastModifiedDevice: text("last_modified_device")
  },
  (table) => ({
    crewDateIdx: index("idx_crew_assignment_crew_date").on(table.crewId, table.date),
    vesselIdx: index("idx_crew_assignment_vessel").on(table.vesselId),
    shiftIdx: index("idx_crew_assignment_shift").on(table.shiftId),
    statusIdx: index("idx_crew_assignment_status").on(table.status)
  })
);
const crewCertificationSqlite = sqliteTable(
  "crew_cert",
  {
    id: text("id").primaryKey(),
    crewId: text("crew_id").notNull(),
    cert: text("cert").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    issuedBy: text("issued_by"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    crewIdx: index("idx_crew_cert_crew").on(table.crewId),
    expiryIdx: index("idx_crew_cert_expiry").on(table.expiresAt)
  })
);
const crewRestSheetSqlite = sqliteTable(
  "crew_rest_sheet",
  {
    id: text("id").primaryKey(),
    crewId: text("crew_id").notNull(),
    month: text("month").notNull(),
    vesselId: text("vessel_id"),
    signedBy: text("signed_by"),
    signedAt: integer("signed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    crewMonthIdx: index("idx_crew_rest_sheet_crew_month").on(table.crewId, table.month),
    vesselIdx: index("idx_crew_rest_sheet_vessel").on(table.vesselId)
  })
);
const crewRestDaySqlite = sqliteTable(
  "crew_rest_day",
  {
    sheetId: text("sheet_id").notNull(),
    date: text("date").notNull(),
    h0: integer("h0").default(0),
    h1: integer("h1").default(0),
    h2: integer("h2").default(0),
    h3: integer("h3").default(0),
    h4: integer("h4").default(0),
    h5: integer("h5").default(0),
    h6: integer("h6").default(0),
    h7: integer("h7").default(0),
    h8: integer("h8").default(0),
    h9: integer("h9").default(0),
    h10: integer("h10").default(0),
    h11: integer("h11").default(0),
    h12: integer("h12").default(0),
    h13: integer("h13").default(0),
    h14: integer("h14").default(0),
    h15: integer("h15").default(0),
    h16: integer("h16").default(0),
    h17: integer("h17").default(0),
    h18: integer("h18").default(0),
    h19: integer("h19").default(0),
    h20: integer("h20").default(0),
    h21: integer("h21").default(0),
    h22: integer("h22").default(0),
    h23: integer("h23").default(0)
  },
  (table) => ({
    pk: primaryKey({ columns: [table.sheetId, table.date] }),
    sheetIdx: index("idx_crew_rest_day_sheet").on(table.sheetId)
  })
);
const mlModelsSqlite = sqliteTable(
  "ml_models",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    // lstm, xgboost, random_forest
    status: text("status").notNull().default("training"),
    // training, deployed, failed, archived
    accuracy: real("accuracy"),
    // 0.00 to 100.00
    precision: real("precision"),
    recall: real("recall"),
    f1Score: real("f1_score"),
    trainedOn: integer("trained_on", { mode: "timestamp" }),
    deployedOn: integer("deployed_on", { mode: "timestamp" }),
    archivedOn: integer("archived_on", { mode: "timestamp" }),
    dataPoints: integer("data_points"),
    // Number of data points used for training
    equipmentType: text("equipment_type"),
    // Engine, Compressor, Pump, etc.
    dataWindowDays: integer("data_window_days"),
    // 90, 180, 365, 730+
    trainingDurationMs: integer("training_duration_ms"),
    // How long training took
    version: text("version").default("1.0"),
    hyperparameters: text("hyperparameters"),
    // jsonb → text (store as JSON string)
    featureImportance: text("feature_importance"),
    // jsonb → text (SHAP values or feature importance scores)
    trainingMetrics: text("training_metrics"),
    // jsonb → text (Loss curves, validation scores, etc.)
    errorMessage: text("error_message"),
    // Error details if training failed
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgStatusIdx: index("idx_ml_models_org_status").on(table.orgId, table.status),
    orgTypeIdx: index("idx_ml_models_org_type").on(table.orgId, table.type)
  })
);
const failurePredictionsSqlite = sqliteTable(
  "failure_predictions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    predictionTimestamp: integer("prediction_timestamp", { mode: "timestamp" }),
    failureProbability: real("failure_probability").notNull(),
    predictedFailureDate: integer("predicted_failure_date", { mode: "timestamp" }),
    remainingUsefulLife: integer("remaining_useful_life"),
    confidenceInterval: text("confidence_interval"),
    // jsonb → text
    failureMode: text("failure_mode"),
    riskLevel: text("risk_level").notNull(),
    modelId: text("model_id"),
    inputFeatures: text("input_features"),
    // jsonb → text
    maintenanceRecommendations: text("maintenance_recommendations"),
    // jsonb → text
    costImpact: text("cost_impact"),
    // jsonb → text
    resolvedByWorkOrderId: text("resolved_by_work_order_id"),
    actualFailureDate: integer("actual_failure_date", { mode: "timestamp" }),
    actualFailureMode: text("actual_failure_mode"),
    predictionAccuracy: real("prediction_accuracy"),
    timeToFailureError: integer("time_to_failure_error"),
    outcomeLabel: text("outcome_label"),
    outcomeVerifiedAt: integer("outcome_verified_at", { mode: "timestamp" }),
    outcomeVerifiedBy: text("outcome_verified_by"),
    metadata: text("metadata")
    // jsonb → text
  },
  (table) => ({
    equipmentRiskIdx: index("idx_failure_equipment_risk").on(table.equipmentId, table.riskLevel),
    predictionTimeIdx: index("idx_failure_prediction_time").on(table.predictionTimestamp)
  })
);
const anomalyDetectionsSqlite = sqliteTable(
  "anomaly_detections",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    detectionTimestamp: integer("detection_timestamp", { mode: "timestamp" }),
    anomalyScore: real("anomaly_score").notNull(),
    anomalyType: text("anomaly_type"),
    severity: text("severity").notNull(),
    detectedValue: real("detected_value"),
    expectedValue: real("expected_value"),
    deviation: real("deviation"),
    modelId: text("model_id"),
    contributingFactors: text("contributing_factors"),
    // jsonb → text
    recommendedActions: text("recommended_actions"),
    // jsonb → text
    acknowledgedBy: text("acknowledged_by"),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
    resolvedByWorkOrderId: text("resolved_by_work_order_id"),
    actualFailureOccurred: integer("actual_failure_occurred", { mode: "boolean" }),
    outcomeLabel: text("outcome_label"),
    outcomeVerifiedAt: integer("outcome_verified_at", { mode: "timestamp" }),
    outcomeVerifiedBy: text("outcome_verified_by"),
    metadata: text("metadata")
    // jsonb → text
  },
  (table) => ({
    equipmentTimeIdx: index("idx_anomaly_equipment_time").on(
      table.equipmentId,
      table.detectionTimestamp
    ),
    severityIdx: index("idx_anomaly_severity").on(table.severity)
  })
);
const predictionFeedbackSqlite = sqliteTable(
  "prediction_feedback",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    predictionId: text("prediction_id").notNull(),
    predictionType: text("prediction_type").notNull(),
    equipmentId: text("equipment_id").notNull(),
    userId: text("user_id").notNull(),
    feedbackType: text("feedback_type").notNull(),
    rating: integer("rating"),
    isAccurate: integer("is_accurate", { mode: "boolean" }),
    correctedValue: text("corrected_value"),
    // jsonb → text
    comments: text("comments"),
    actualFailureDate: integer("actual_failure_date", { mode: "timestamp" }),
    actualFailureMode: text("actual_failure_mode"),
    flagReason: text("flag_reason"),
    useForRetraining: integer("use_for_retraining", { mode: "boolean" }).default(1),
    feedbackStatus: text("feedback_status").default("pending"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
    reviewNotes: text("review_notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    predictionIdx: index("idx_feedback_prediction").on(table.predictionId, table.predictionType),
    equipmentIdx: index("idx_feedback_equipment").on(table.equipmentId),
    userIdx: index("idx_feedback_user").on(table.userId),
    statusIdx: index("idx_feedback_status").on(table.feedbackStatus)
  })
);
const componentDegradationSqlite = sqliteTable(
  "component_degradation",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    componentType: text("component_type").notNull(),
    measurementTimestamp: integer("measurement_timestamp", { mode: "timestamp" }),
    degradationMetric: real("degradation_metric").notNull(),
    degradationRate: real("degradation_rate"),
    vibrationLevel: real("vibration_level"),
    temperature: real("temperature"),
    oilCondition: real("oil_condition"),
    acousticSignature: real("acoustic_signature"),
    wearParticleCount: integer("wear_particle_count"),
    operatingHours: integer("operating_hours"),
    cycleCount: integer("cycle_count"),
    loadFactor: real("load_factor"),
    environmentConditions: text("environment_conditions"),
    // jsonb → text
    trendAnalysis: text("trend_analysis"),
    // jsonb → text
    predictedFailureDate: integer("predicted_failure_date", { mode: "timestamp" }),
    confidenceScore: real("confidence_score"),
    metadata: text("metadata")
    // jsonb → text
  },
  (table) => ({
    equipmentTimeIdx: index("idx_component_deg_equipment_time").on(
      table.equipmentId,
      table.measurementTimestamp
    ),
    componentIdx: index("idx_component_deg_component").on(table.componentType)
  })
);
const failureHistorySqlite = sqliteTable(
  "failure_history",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    failureTimestamp: integer("failure_timestamp", { mode: "timestamp" }).notNull(),
    failureMode: text("failure_mode").notNull(),
    failureSeverity: text("failure_severity").notNull(),
    rootCause: text("root_cause"),
    componentAffected: text("component_affected"),
    ageAtFailure: integer("age_at_failure"),
    cyclesAtFailure: integer("cycles_at_failure"),
    priorWarnings: text("prior_warnings"),
    // jsonb → text
    degradationHistory: text("degradation_history"),
    // jsonb → text
    environmentalFactors: text("environmental_factors"),
    // jsonb → text
    maintenanceHistory: text("maintenance_history"),
    // jsonb → text
    repairCost: real("repair_cost"),
    downtimeHours: real("downtime_hours"),
    replacementPartsCost: real("replacement_parts_cost"),
    totalCost: real("total_cost"),
    wasPreventable: integer("was_preventable", { mode: "boolean" }),
    preventabilityAnalysis: text("preventability_analysis"),
    lessonsLearned: text("lessons_learned"),
    workOrderId: text("work_order_id"),
    verifiedBy: text("verified_by"),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    metadata: text("metadata"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    equipmentFailureIdx: index("idx_failure_history_equipment").on(
      table.equipmentId,
      table.failureTimestamp
    ),
    failureModeIdx: index("idx_failure_history_mode").on(table.failureMode),
    severityIdx: index("idx_failure_history_severity").on(table.failureSeverity)
  })
);
const dtcDefinitionsSqlite = sqliteTable(
  "dtc_definitions",
  {
    spn: integer("spn").notNull(),
    fmi: integer("fmi").notNull(),
    manufacturer: text("manufacturer").notNull().default(""),
    spnName: text("spn_name").notNull(),
    fmiName: text("fmi_name").notNull(),
    description: text("description").notNull(),
    severity: integer("severity").notNull().default(3),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.spn, table.fmi, table.manufacturer] }),
    spnIdx: index("idx_dtc_definitions_spn").on(table.spn),
    severityIdx: index("idx_dtc_definitions_severity").on(table.severity)
  })
);
const dtcFaultsSqlite = sqliteTable(
  "dtc_faults",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    deviceId: text("device_id").notNull(),
    spn: integer("spn").notNull(),
    fmi: integer("fmi").notNull(),
    oc: integer("oc"),
    sa: integer("sa"),
    pgn: integer("pgn"),
    lamp: text("lamp"),
    // jsonb → text
    active: integer("active", { mode: "boolean" }).notNull().default(1),
    firstSeen: integer("first_seen", { mode: "timestamp" }).notNull(),
    lastSeen: integer("last_seen", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }),
    version: integer("version").default(1),
    lastModifiedBy: text("last_modified_by"),
    lastModifiedDevice: text("last_modified_device")
  },
  (table) => ({
    orgEquipmentActiveIdx: index("idx_dtc_faults_org_eq_active").on(
      table.orgId,
      table.equipmentId,
      table.active
    ),
    deviceActiveIdx: index("idx_dtc_faults_device_active").on(table.deviceId, table.active),
    lastSeenIdx: index("idx_dtc_faults_last_seen").on(table.orgId, table.lastSeen)
  })
);
const modelPerformanceValidationsSqlite = sqliteTable(
  "model_performance_validations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    modelId: text("model_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    predictionId: integer("prediction_id"),
    predictionType: text("prediction_type").notNull(),
    predictionTimestamp: integer("prediction_timestamp", { mode: "timestamp" }).notNull(),
    predictedOutcome: text("predicted_outcome").notNull(),
    // jsonb → text
    actualOutcome: text("actual_outcome"),
    // jsonb → text
    validatedAt: integer("validated_at", { mode: "timestamp" }),
    validatedBy: text("validated_by"),
    accuracyScore: real("accuracy_score"),
    timeToFailureError: integer("time_to_failure_error"),
    classificationLabel: text("classification_label"),
    modelVersion: text("model_version"),
    performanceMetrics: text("performance_metrics"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    modelIdIdx: index("idx_perf_val_model").on(table.modelId),
    equipmentIdIdx: index("idx_perf_val_equipment").on(table.equipmentId),
    predictionTimeIdx: index("idx_perf_val_prediction_time").on(table.predictionTimestamp),
    classificationIdx: index("idx_perf_val_classification").on(table.classificationLabel),
    modelEquipmentIdx: index("idx_perf_val_model_equipment").on(table.modelId, table.equipmentId),
    predictionLookupIdx: index("idx_perf_val_prediction_lookup").on(
      table.predictionType,
      table.predictionId
    )
  })
);
const retrainingTriggersSqlite = sqliteTable(
  "retraining_triggers",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    modelId: text("model_id").notNull(),
    equipmentType: text("equipment_type"),
    triggerType: text("trigger_type").notNull(),
    triggerReason: text("trigger_reason").notNull(),
    triggerMetrics: text("trigger_metrics").notNull(),
    // jsonb → text
    currentPerformance: text("current_performance"),
    // jsonb → text
    performanceThreshold: real("performance_threshold"),
    newDataPoints: integer("new_data_points"),
    negativeFeedbackCount: integer("negative_feedback_count"),
    lastTrainingDate: integer("last_training_date", { mode: "timestamp" }),
    daysSinceTraining: integer("days_since_training"),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("pending"),
    scheduledFor: integer("scheduled_for", { mode: "timestamp" }),
    processingStartedAt: integer("processing_started_at", { mode: "timestamp" }),
    processingCompletedAt: integer("processing_completed_at", { mode: "timestamp" }),
    newModelId: text("new_model_id"),
    retrainingDuration: integer("retraining_duration"),
    retrainingResult: text("retraining_result"),
    // jsonb → text
    errorMessage: text("error_message"),
    triggeredBy: text("triggered_by"),
    reviewedBy: text("reviewed_by"),
    reviewNotes: text("review_notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    modelIdIdx: index("idx_retrain_model").on(table.modelId),
    statusIdx: index("idx_retrain_status").on(table.status),
    priorityIdx: index("idx_retrain_priority").on(table.priority),
    scheduledIdx: index("idx_retrain_scheduled").on(table.scheduledFor),
    triggerTypeIdx: index("idx_retrain_trigger_type").on(table.triggerType)
  })
);
const sensorConfigurationsSqlite = sqliteTable(
  "sensor_configurations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).default(1),
    sampleRateHz: real("sample_rate_hz"),
    gain: real("gain").default(1),
    offset: real("offset").default(0),
    deadband: real("deadband").default(0),
    minValid: real("min_valid"),
    maxValid: real("max_valid"),
    warnLo: real("warn_lo"),
    warnHi: real("warn_hi"),
    critLo: real("crit_lo"),
    critHi: real("crit_hi"),
    hysteresis: real("hysteresis").default(0),
    emaAlpha: real("ema_alpha"),
    targetUnit: text("target_unit"),
    notes: text("notes"),
    expectedIntervalMs: integer("expected_interval_ms"),
    graceMultiplier: real("grace_multiplier").default(2),
    version: integer("version").default(1),
    lastModifiedBy: text("last_modified_by"),
    lastModifiedDevice: text("last_modified_device"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    equipmentSensorIdx: index("idx_sensor_config_equipment_sensor").on(
      table.equipmentId,
      table.sensorType,
      table.orgId
    ),
    orgIdx: index("idx_sensor_config_org").on(table.orgId)
  })
);
const sensorStatesSqlite = sqliteTable(
  "sensor_states",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    lastValue: real("last_value"),
    ema: real("ema"),
    lastTs: integer("last_ts", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    equipmentSensorIdx: index("idx_sensor_state_equipment_sensor").on(
      table.equipmentId,
      table.sensorType,
      table.orgId
    ),
    orgIdx: index("idx_sensor_state_org").on(table.orgId)
  })
);
const thresholdOptimizationsSqlite = sqliteTable(
  "threshold_optimizations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    optimizationTimestamp: integer("optimization_timestamp", { mode: "timestamp" }),
    currentThresholds: text("current_thresholds"),
    // jsonb → text
    optimizedThresholds: text("optimized_thresholds"),
    // jsonb → text
    improvementMetrics: text("improvement_metrics"),
    // jsonb → text
    optimizationMethod: text("optimization_method"),
    validationResults: text("validation_results"),
    // jsonb → text
    appliedAt: integer("applied_at", { mode: "timestamp" }),
    status: text("status").default("pending"),
    performance: text("performance"),
    // jsonb → text
    metadata: text("metadata")
    // jsonb → text
  },
  (table) => ({
    equipmentTimeIdx: index("idx_threshold_opt_equipment_time").on(
      table.equipmentId,
      table.optimizationTimestamp
    ),
    orgIdx: index("idx_threshold_opt_org").on(table.orgId),
    statusIdx: index("idx_threshold_opt_status").on(table.status)
  })
);
const vibrationFeaturesSqlite = sqliteTable(
  "vibration_features",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    vesselId: text("vessel_id"),
    timestamp: integer("timestamp", { mode: "timestamp" }),
    rpm: real("rpm"),
    rms: real("rms"),
    crestFactor: real("crest_factor"),
    kurtosis: real("kurtosis"),
    peakFrequency: real("peak_frequency"),
    band1Power: real("band_1_power"),
    band2Power: real("band_2_power"),
    band3Power: real("band_3_power"),
    band4Power: real("band_4_power"),
    rawDataLength: integer("raw_data_length"),
    sampleRate: real("sample_rate"),
    analysisMetadata: text("analysis_metadata"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    equipmentTimeIdx: index("idx_vibration_equipment_time").on(table.equipmentId, table.timestamp),
    vesselIdx: index("idx_vibration_vessel").on(table.vesselId),
    orgIdx: index("idx_vibration_org").on(table.orgId)
  })
);
const modelRegistrySqlite = sqliteTable(
  "model_registry",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    componentClass: text("component_class").notNull(),
    modelType: text("model_type").notNull(),
    version: text("version").notNull(),
    algorithm: text("algorithm"),
    windowDays: integer("window_days"),
    features: text("features"),
    // jsonb → text
    metrics: text("metrics"),
    // jsonb → text
    isActive: integer("is_active", { mode: "boolean" }).default(1),
    deployedAt: integer("deployed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    componentIdx: index("idx_model_registry_component").on(table.componentClass, table.modelType),
    activeIdx: index("idx_model_registry_active").on(table.isActive, table.deployedAt),
    orgIdx: index("idx_model_registry_org").on(table.orgId)
  })
);
const sensorTypesSqlite = sqliteTable(
  "sensor_types",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    defaultUnit: text("default_unit").notNull(),
    units: text("units").notNull(),
    // jsonb → text (array of supported units)
    description: text("description"),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    isActive: integer("is_active", { mode: "boolean" }).default(1),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    categoryIdx: index("idx_sensor_types_category").on(table.category),
    activeIdx: index("idx_sensor_types_active").on(table.isActive)
  })
);
const sqliteJsonHelpers = {
  stringify: (obj) => obj ? JSON.stringify(obj) : null,
  parse: (str) => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }
};
const alertConfigurationsSqlite = sqliteTable(
  "alert_configurations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    warningThreshold: real("warning_threshold"),
    criticalThreshold: real("critical_threshold"),
    enabled: integer("enabled", { mode: "boolean" }).default(1),
    notifyEmail: integer("notify_email", { mode: "boolean" }).default(0),
    notifyInApp: integer("notify_in_app", { mode: "boolean" }).default(1),
    version: integer("version").default(1),
    lastModifiedBy: text("last_modified_by"),
    lastModifiedDevice: text("last_modified_device"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_alert_config_org").on(table.orgId),
    equipmentIdx: index("idx_alert_config_equipment").on(table.equipmentId),
    sensorIdx: index("idx_alert_config_sensor").on(table.sensorType)
  })
);
const alertNotificationsSqlite = sqliteTable(
  "alert_notifications",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    alertType: text("alert_type").notNull(),
    message: text("message").notNull(),
    value: real("value").notNull(),
    threshold: real("threshold").notNull(),
    acknowledged: integer("acknowledged", { mode: "boolean" }).default(0),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
    acknowledgedBy: text("acknowledged_by"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_alert_notif_org").on(table.orgId),
    equipmentIdx: index("idx_alert_notif_equipment").on(table.equipmentId),
    acknowledgedIdx: index("idx_alert_notif_ack").on(table.acknowledged),
    createdIdx: index("idx_alert_notif_created").on(table.createdAt)
  })
);
const alertSuppressionsSqlite = sqliteTable(
  "alert_suppressions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id"),
    sensorType: text("sensor_type"),
    suppressUntil: integer("suppress_until", { mode: "timestamp" }).notNull(),
    reason: text("reason"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_alert_supp_org").on(table.orgId),
    equipmentIdx: index("idx_alert_supp_equipment").on(table.equipmentId),
    untilIdx: index("idx_alert_supp_until").on(table.suppressUntil)
  })
);
const alertCommentsSqlite = sqliteTable(
  "alert_comments",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    alertId: text("alert_id").notNull(),
    comment: text("comment").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_alert_comment_org").on(table.orgId),
    alertIdx: index("idx_alert_comment_alert").on(table.alertId)
  })
);
const operatingConditionAlertsSqlite = sqliteTable(
  "operating_condition_alerts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    parameterId: text("parameter_id").notNull(),
    parameterName: text("parameter_name").notNull(),
    // Denormalized for faster queries
    conditionType: text("condition_type").notNull(),
    severity: text("severity").notNull(),
    message: text("message").notNull(),
    detectedAt: integer("detected_at", { mode: "timestamp" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_op_cond_alert_org").on(table.orgId),
    equipmentIdx: index("idx_op_cond_alert_equipment").on(table.equipmentId),
    severityIdx: index("idx_op_cond_alert_severity").on(table.severity)
  })
);
const pdmAlertsSqlite = sqliteTable(
  "pdm_alerts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    predictionId: text("prediction_id"),
    alertType: text("alert_type").notNull(),
    severity: text("severity").notNull(),
    message: text("message").notNull(),
    acknowledged: integer("acknowledged", { mode: "boolean" }).default(0),
    acknowledgedBy: text("acknowledged_by"),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_pdm_alert_org").on(table.orgId),
    equipmentIdx: index("idx_pdm_alert_equipment").on(table.equipmentId),
    severityIdx: index("idx_pdm_alert_severity").on(table.severity),
    acknowledgedIdx: index("idx_pdm_alert_ack").on(table.acknowledged)
  })
);
const partsSqlite = sqliteTable(
  "parts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partNo: text("part_no").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    unitOfMeasure: text("unit_of_measure").notNull().default("ea"),
    minStockQty: real("min_stock_qty").default(0),
    maxStockQty: real("max_stock_qty").default(0),
    standardCost: real("standard_cost").default(0),
    leadTimeDays: integer("lead_time_days").default(7),
    criticality: text("criticality").default("medium"),
    specifications: text("specifications"),
    // jsonb → text
    compatibleEquipment: text("compatible_equipment"),
    // array → text
    primarySupplierId: text("primary_supplier_id"),
    alternateSupplierIds: text("alternate_supplier_ids"),
    // array → text
    riskLevel: text("risk_level").default("medium"),
    lastOrderDate: integer("last_order_date", { mode: "timestamp" }),
    averageLeadTime: integer("average_lead_time"),
    demandVariability: real("demand_variability"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgPartNoIdx: index("idx_parts_org_partno").on(table.orgId, table.partNo),
    categoryIdx: index("idx_parts_category").on(table.category),
    criticalityIdx: index("idx_parts_criticality").on(table.criticality)
  })
);
const inventoryPartsSqlite = sqliteTable(
  "inventory_parts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partNumber: text("part_number").notNull(),
    description: text("description").notNull(),
    currentStock: integer("current_stock").notNull().default(0),
    minStockLevel: integer("min_stock_level").notNull(),
    maxStockLevel: integer("max_stock_level").notNull(),
    leadTimeDays: integer("lead_time_days").notNull(),
    unitCost: real("unit_cost"),
    supplier: text("supplier"),
    lastUsage30d: integer("last_usage_30d").default(0),
    riskLevel: text("risk_level").notNull().default("low"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_inv_parts_org").on(table.orgId),
    partNumberIdx: index("idx_inv_parts_partnum").on(table.partNumber)
  })
);
const partSubstitutionsSqlite = sqliteTable(
  "part_substitutions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    originalPartId: text("original_part_id").notNull(),
    substitutePartId: text("substitute_part_id").notNull(),
    substitutionType: text("substitution_type").notNull(),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_part_sub_org").on(table.orgId),
    originalIdx: index("idx_part_sub_original").on(table.originalPartId)
  })
);
const partFailureHistorySqlite = sqliteTable(
  "part_failure_history",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partId: text("part_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    failureDate: integer("failure_date", { mode: "timestamp" }).notNull(),
    failureMode: text("failure_mode"),
    hoursInService: integer("hours_in_service"),
    replacementCost: real("replacement_cost"),
    downtimeHours: real("downtime_hours"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_part_fail_org").on(table.orgId),
    partIdx: index("idx_part_fail_part").on(table.partId),
    equipmentIdx: index("idx_part_fail_equipment").on(table.equipmentId)
  })
);
const reservationsSqlite = sqliteTable(
  "reservations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    partId: text("part_id").notNull(),
    workOrderId: text("work_order_id"),
    quantity: integer("quantity").notNull(),
    reservedBy: text("reserved_by").notNull(),
    reservedAt: integer("reserved_at", { mode: "timestamp" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_reservations_org").on(table.orgId),
    partIdx: index("idx_reservations_part").on(table.partId),
    workOrderIdx: index("idx_reservations_wo").on(table.workOrderId)
  })
);
const storageConfigSqlite = sqliteTable(
  "storage_config",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    locationName: text("location_name").notNull(),
    locationType: text("location_type").notNull(),
    vesselId: text("vessel_id"),
    capacity: real("capacity"),
    currentUtilization: real("current_utilization").default(0),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_storage_config_org").on(table.orgId),
    vesselIdx: index("idx_storage_config_vessel").on(table.vesselId)
  })
);
const workOrderChecklistsSqlite = sqliteTable(
  "work_order_checklists",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    templateName: text("template_name").notNull(),
    checklistItems: text("checklist_items").notNull(),
    // JSON array
    completedItems: text("completed_items").notNull().default("[]"),
    // JSON array
    completionRate: real("completion_rate").default(0),
    completedBy: text("completed_by"),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_wo_checklist_org").on(table.orgId),
    woIdx: index("idx_wo_checklist_wo").on(table.workOrderId)
  })
);
const workOrderWorklogsSqlite = sqliteTable(
  "work_order_worklogs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    technicianName: text("technician_name").notNull(),
    startTime: integer("start_time", { mode: "timestamp" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp" }),
    durationMinutes: integer("duration_minutes"),
    description: text("description").notNull(),
    laborType: text("labor_type").notNull().default("standard"),
    laborCostPerHour: real("labor_cost_per_hour").default(75),
    totalLaborCost: real("total_labor_cost"),
    status: text("status").notNull().default("in_progress"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_wo_worklog_org").on(table.orgId),
    woIdx: index("idx_wo_worklog_wo").on(table.workOrderId)
  })
);
const llmBudgetConfigsSqlite = sqliteTable(
  "llm_budget_configs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orgId: text("org_id").notNull().unique(),
    provider: text("provider"),
    dailyLimit: real("daily_limit"),
    monthlyLimit: real("monthly_limit"),
    alertThreshold: real("alert_threshold").default(0.8),
    currentDailySpend: real("current_daily_spend").default(0),
    currentMonthlySpend: real("current_monthly_spend").default(0),
    lastResetDate: integer("last_reset_date", { mode: "timestamp" }),
    isEnabled: integer("is_enabled", { mode: "boolean" }).default(1),
    notifyEmail: text("notify_email"),
    blockWhenExceeded: integer("block_when_exceeded", { mode: "boolean" }).default(0),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_llm_budget_org").on(table.orgId)
  })
);
const llmCostTrackingSqlite = sqliteTable(
  "llm_cost_tracking",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orgId: text("org_id").notNull(),
    requestId: text("request_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    requestType: text("request_type").notNull(),
    reportType: text("report_type"),
    audience: text("audience"),
    vesselId: text("vessel_id"),
    equipmentId: text("equipment_id"),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    estimatedCost: real("estimated_cost").notNull(),
    actualCost: real("actual_cost"),
    latencyMs: integer("latency_ms"),
    success: integer("success", { mode: "boolean" }).notNull().default(1),
    errorMessage: text("error_message"),
    fallbackUsed: integer("fallback_used", { mode: "boolean" }).default(0),
    fallbackModel: text("fallback_model"),
    userId: text("user_id"),
    metadata: text("metadata"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgDateIdx: index("idx_llm_cost_org_date").on(table.orgId, table.createdAt),
    providerModelIdx: index("idx_llm_cost_provider_model").on(table.provider, table.model),
    requestTypeIdx: index("idx_llm_cost_request_type").on(table.requestType)
  })
);
const insightReportsSqlite = sqliteTable(
  "insight_reports",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    reportType: text("report_type").notNull(),
    vesselId: text("vessel_id"),
    equipmentId: text("equipment_id"),
    content: text("content").notNull(),
    // jsonb → text
    audience: text("audience").notNull(),
    generatedAt: integer("generated_at", { mode: "timestamp" }).notNull(),
    validUntil: integer("valid_until", { mode: "timestamp" }),
    metadata: text("metadata"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_insight_reports_org").on(table.orgId),
    typeIdx: index("idx_insight_reports_type").on(table.reportType),
    vesselIdx: index("idx_insight_reports_vessel").on(table.vesselId)
  })
);
const insightSnapshotsSqlite = sqliteTable(
  "insight_snapshots",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    scope: text("scope").notNull(),
    // 'fleet' or specific vesselId
    snapshotType: text("snapshot_type").notNull(),
    vesselId: text("vessel_id"),
    snapshotData: text("snapshot_data").notNull(),
    // jsonb → text
    capturedAt: integer("captured_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_insight_snapshots_org").on(table.orgId),
    typeIdx: index("idx_insight_snapshots_type").on(table.snapshotType)
  })
);
const visualizationAssetsSqlite = sqliteTable(
  "visualization_assets",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    assetType: text("asset_type").notNull(),
    vesselId: text("vessel_id"),
    equipmentId: text("equipment_id"),
    assetData: text("asset_data").notNull(),
    // jsonb → text (chart config, image URL, etc.)
    generatedAt: integer("generated_at", { mode: "timestamp" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_viz_assets_org").on(table.orgId),
    typeIdx: index("idx_viz_assets_type").on(table.assetType)
  })
);
const costSavingsSqlite = sqliteTable(
  "cost_savings",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    vesselId: text("vessel_id"),
    equipmentId: text("equipment_id").notNull(),
    savingsType: text("savings_type").notNull(),
    predictionId: text("prediction_id"),
    workOrderId: text("work_order_id"),
    estimatedSavings: real("estimated_savings").notNull(),
    actualSavings: real("actual_savings"),
    calculationMethod: text("calculation_method").notNull(),
    baseline: text("baseline"),
    // jsonb → text
    actual: text("actual"),
    // jsonb → text
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_cost_savings_org").on(table.orgId),
    vesselIdx: index("idx_cost_savings_vessel").on(table.vesselId),
    equipmentIdx: index("idx_cost_savings_equipment").on(table.equipmentId),
    typeIdx: index("idx_cost_savings_type").on(table.savingsType)
  })
);
const rawTelemetrySqlite = sqliteTable(
  "raw_telemetry",
  {
    id: text("id").notNull(),
    orgId: text("org_id").notNull(),
    ts: integer("ts", { mode: "timestamp" }).notNull(),
    equipmentId: text("equipment_id").notNull(),
    deviceId: text("device_id"),
    payload: text("payload").notNull(),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgTsIdx: index("idx_raw_telem_org_ts").on(table.orgId, table.ts),
    equipmentTsIdx: index("idx_raw_telem_equipment_ts").on(table.equipmentId, table.ts)
  })
);
const telemetryAggregatesSqlite = sqliteTable(
  "telemetry_aggregates",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    periodStart: integer("period_start", { mode: "timestamp" }).notNull(),
    periodEnd: integer("period_end", { mode: "timestamp" }).notNull(),
    aggregationType: text("aggregation_type").notNull(),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    avgValue: real("avg_value"),
    sumValue: real("sum_value"),
    count: integer("count").notNull(),
    stdDev: real("std_dev"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgPeriodIdx: index("idx_telem_agg_org_period").on(table.orgId, table.periodStart),
    equipmentSensorIdx: index("idx_telem_agg_equip_sensor").on(table.equipmentId, table.sensorType)
  })
);
const telemetryRollupsSqlite = sqliteTable(
  "telemetry_rollups",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    rollupPeriod: text("rollup_period").notNull(),
    periodStart: integer("period_start", { mode: "timestamp" }).notNull(),
    rollupData: text("rollup_data").notNull(),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgPeriodIdx: index("idx_telem_rollup_org_period").on(table.orgId, table.periodStart),
    equipmentIdx: index("idx_telem_rollup_equipment").on(table.equipmentId)
  })
);
const telemetryRetentionPoliciesSqlite = sqliteTable(
  "telemetry_retention_policies",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    policyName: text("policy_name").notNull(),
    dataType: text("data_type").notNull(),
    retentionDays: integer("retention_days").notNull(),
    compressionEnabled: integer("compression_enabled", { mode: "boolean" }).default(1),
    isActive: integer("is_active", { mode: "boolean" }).default(1),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_telem_retention_org").on(table.orgId)
  })
);
const metricsHistorySqlite = sqliteTable(
  "metrics_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orgId: text("org_id").notNull(),
    recordedAt: integer("recorded_at", { mode: "timestamp" }).notNull(),
    activeDevices: integer("active_devices").notNull().default(0),
    fleetHealth: real("fleet_health").notNull().default(0),
    openWorkOrders: integer("open_work_orders").notNull().default(0),
    riskAlerts: integer("risk_alerts").notNull().default(0),
    totalEquipment: integer("total_equipment").notNull().default(0),
    healthyEquipment: integer("healthy_equipment").notNull().default(0),
    warningEquipment: integer("warning_equipment").notNull().default(0),
    criticalEquipment: integer("critical_equipment").notNull().default(0)
  },
  (table) => ({
    orgTimeIdx: index("idx_metrics_history_org_time").on(table.orgId, table.recordedAt)
  })
);
const dailyMetricRollupsSqlite = sqliteTable(
  "daily_metric_rollups",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    date: integer("date", { mode: "timestamp" }).notNull(),
    metricType: text("metric_type").notNull(),
    metricData: text("metric_data").notNull(),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgDateIdx: index("idx_daily_metrics_org_date").on(table.orgId, table.date)
  })
);
const pdmScoreLogsSqlite = sqliteTable(
  "pdm_score_logs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    score: real("score").notNull(),
    trend: text("trend"),
    factors: text("factors"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_pdm_score_org").on(table.orgId),
    equipmentTsIdx: index("idx_pdm_score_equip_ts").on(table.equipmentId, table.timestamp)
  })
);
const edgeHeartbeatsSqlite = sqliteTable(
  "edge_heartbeats",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    vesselId: text("vessel_id"),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    status: text("status").notNull(),
    uptimeSeconds: integer("uptime_seconds"),
    cpuUsage: real("cpu_usage"),
    memoryUsage: real("memory_usage"),
    diskUsage: real("disk_usage"),
    metadata: text("metadata"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_edge_hb_org").on(table.orgId),
    deviceTsIdx: index("idx_edge_hb_device_ts").on(table.deviceId, table.timestamp)
  })
);
const edgeDiagnosticLogsSqlite = sqliteTable(
  "edge_diagnostic_logs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    logLevel: text("log_level").notNull(),
    message: text("message").notNull(),
    context: text("context"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_edge_diag_org").on(table.orgId),
    deviceTsIdx: index("idx_edge_diag_device_ts").on(table.deviceId, table.timestamp),
    levelIdx: index("idx_edge_diag_level").on(table.logLevel)
  })
);
const systemHealthChecksSqlite = sqliteTable(
  "system_health_checks",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    checkType: text("check_type").notNull(),
    checkName: text("check_name").notNull(),
    status: text("status").notNull(),
    lastCheckAt: integer("last_check_at", { mode: "timestamp" }).notNull(),
    responseTimeMs: integer("response_time_ms"),
    errorMessage: text("error_message"),
    metadata: text("metadata"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_sys_health_org").on(table.orgId),
    typeIdx: index("idx_sys_health_type").on(table.checkType),
    statusIdx: index("idx_sys_health_status").on(table.status)
  })
);
const systemPerformanceMetricsSqlite = sqliteTable(
  "system_performance_metrics",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    metricName: text("metric_name").notNull(),
    metricValue: real("metric_value").notNull(),
    unit: text("unit"),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    tags: text("tags"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgTsIdx: index("idx_sys_perf_org_ts").on(table.orgId, table.timestamp),
    nameIdx: index("idx_sys_perf_name").on(table.metricName)
  })
);
const systemSettingsSqlite = sqliteTable("system_settings", {
  id: text("id").primaryKey().default("system"),
  hmacRequired: integer("hmac_required", { mode: "boolean" }).default(0),
  maxPayloadBytes: integer("max_payload_bytes").default(2097152),
  strictUnits: integer("strict_units", { mode: "boolean" }).default(0),
  llmEnabled: integer("llm_enabled", { mode: "boolean" }).default(1),
  llmModel: text("llm_model").default("gpt-4o-mini"),
  openaiApiKey: text("openai_api_key"),
  aiInsightsThrottleMinutes: integer("ai_insights_throttle_minutes").default(2),
  timestampToleranceMinutes: integer("timestamp_tolerance_minutes").default(5)
});
const adminSystemSettingsSqlite = sqliteTable(
  "admin_system_settings",
  {
    id: text("id").primaryKey(),
    settingKey: text("setting_key").notNull().unique(),
    settingValue: text("setting_value"),
    settingType: text("setting_type").notNull(),
    description: text("description"),
    updatedBy: text("updated_by"),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    keyIdx: index("idx_admin_settings_key").on(table.settingKey)
  })
);
const adminAuditEventsSqlite = sqliteTable(
  "admin_audit_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id"),
    adminId: text("admin_id").notNull(),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    actionDetails: text("action_details"),
    // jsonb → text
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_admin_audit_org").on(table.orgId),
    adminIdx: index("idx_admin_audit_admin").on(table.adminId),
    typeIdx: index("idx_admin_audit_type").on(table.eventType),
    timestampIdx: index("idx_admin_audit_ts").on(table.timestamp)
  })
);
const integrationConfigsSqlite = sqliteTable(
  "integration_configs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    integrationType: text("integration_type").notNull(),
    configName: text("config_name").notNull(),
    configData: text("config_data").notNull(),
    // jsonb → text (encrypted)
    isEnabled: integer("is_enabled", { mode: "boolean" }).default(1),
    lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_integration_config_org").on(table.orgId),
    typeIdx: index("idx_integration_config_type").on(table.integrationType)
  })
);
const errorLogsSqlite = sqliteTable(
  "error_logs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    severity: text("severity").notNull(),
    // 'info' | 'warning' | 'error' | 'critical'
    category: text("category").notNull(),
    // 'frontend' | 'backend' | 'api' | 'database' | 'security' | 'performance'
    message: text("message").notNull(),
    stackTrace: text("stack_trace"),
    context: text("context"),
    // jsonb → text
    errorCode: text("error_code"),
    resolved: integer("resolved", { mode: "boolean" }).default(0),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    resolvedBy: text("resolved_by"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_error_logs_org").on(table.orgId),
    timestampIdx: index("idx_error_logs_timestamp").on(table.timestamp),
    severityIdx: index("idx_error_logs_severity").on(table.severity),
    categoryIdx: index("idx_error_logs_category").on(table.category),
    resolvedIdx: index("idx_error_logs_resolved").on(table.resolved)
  })
);
const opsDbStagedSqlite = sqliteTable(
  "ops_db_staged",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dataType: text("data_type").notNull(),
    stagedData: text("staged_data").notNull(),
    // jsonb → text
    status: text("status").notNull().default("pending"),
    processedAt: integer("processed_at", { mode: "timestamp" }),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_ops_staged_org").on(table.orgId),
    statusIdx: index("idx_ops_staged_status").on(table.status)
  })
);
const conditionMonitoringSqlite = sqliteTable(
  "condition_monitoring",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    monitoringType: text("monitoring_type").notNull(),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    readings: text("readings").notNull(),
    // jsonb → text
    status: text("status").notNull(),
    anomaliesDetected: text("anomalies_detected"),
    // jsonb → text
    recommendations: text("recommendations"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_cond_mon_org").on(table.orgId),
    equipmentTsIdx: index("idx_cond_mon_equip_ts").on(table.equipmentId, table.timestamp)
  })
);
const oilAnalysisSqlite = sqliteTable(
  "oil_analysis",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sampleDate: integer("sample_date", { mode: "timestamp" }).notNull(),
    hoursOnOil: integer("hours_on_oil"),
    viscosity: real("viscosity"),
    waterContent: real("water_content"),
    particleCount: integer("particle_count"),
    acidity: real("acidity"),
    oxidation: real("oxidation"),
    metalContent: text("metal_content"),
    // jsonb → text
    condition: text("condition").notNull(),
    recommendations: text("recommendations"),
    labReportUrl: text("lab_report_url"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_oil_analysis_org").on(table.orgId),
    equipmentIdx: index("idx_oil_analysis_equipment").on(table.equipmentId),
    dateIdx: index("idx_oil_analysis_date").on(table.sampleDate)
  })
);
const oilChangeRecordsSqlite = sqliteTable(
  "oil_change_records",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    changeDate: integer("change_date", { mode: "timestamp" }).notNull(),
    oilType: text("oil_type").notNull(),
    quantityLiters: real("quantity_liters").notNull(),
    filterChanged: integer("filter_changed", { mode: "boolean" }).default(1),
    cost: real("cost"),
    performedBy: text("performed_by"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_oil_change_org").on(table.orgId),
    equipmentIdx: index("idx_oil_change_equipment").on(table.equipmentId)
  })
);
const wearParticleAnalysisSqlite = sqliteTable(
  "wear_particle_analysis",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sampleDate: integer("sample_date", { mode: "timestamp" }).notNull(),
    particleSize: text("particle_size").notNull(),
    // jsonb → text (distribution)
    particleType: text("particle_type").notNull(),
    // jsonb → text (composition)
    severity: text("severity").notNull(),
    interpretation: text("interpretation"),
    recommendations: text("recommendations"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_wear_part_org").on(table.orgId),
    equipmentIdx: index("idx_wear_part_equipment").on(table.equipmentId)
  })
);
const vibrationAnalysisSqlite = sqliteTable(
  "vibration_analysis",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    overallVelocity: real("overall_velocity"),
    overallAcceleration: real("overall_acceleration"),
    frequencySpectrum: text("frequency_spectrum"),
    // jsonb → text
    bearingCondition: text("bearing_condition"),
    imbalanceDetected: integer("imbalance_detected", { mode: "boolean" }),
    misalignmentDetected: integer("misalignment_detected", { mode: "boolean" }),
    status: text("status").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_vib_analysis_org").on(table.orgId),
    equipmentTsIdx: index("idx_vib_analysis_equip_ts").on(table.equipmentId, table.timestamp)
  })
);
const calibrationCacheSqlite = sqliteTable(
  "calibration_cache",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    calibrationData: text("calibration_data").notNull(),
    // jsonb → text
    lastCalibrated: integer("last_calibrated", { mode: "timestamp" }).notNull(),
    nextCalibrationDue: integer("next_calibration_due", { mode: "timestamp" }),
    calibratedBy: text("calibrated_by"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_calib_cache_org").on(table.orgId),
    deviceIdx: index("idx_calib_cache_device").on(table.deviceId)
  })
);
const sensorMappingSqlite = sqliteTable(
  "sensor_mapping",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorIdentifier: text("sensor_identifier").notNull(),
    sensorType: text("sensor_type").notNull(),
    measurementPoint: text("measurement_point"),
    mappingConfig: text("mapping_config"),
    // jsonb → text
    isActive: integer("is_active", { mode: "boolean" }).default(1),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_sensor_map_org").on(table.orgId),
    deviceIdx: index("idx_sensor_map_device").on(table.deviceId),
    equipmentIdx: index("idx_sensor_map_equipment").on(table.equipmentId)
  })
);
const sensorThresholdsSqlite = sqliteTable(
  "sensor_thresholds",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    warningLow: real("warning_low"),
    warningHigh: real("warning_high"),
    criticalLow: real("critical_low"),
    criticalHigh: real("critical_high"),
    unit: text("unit").notNull(),
    autoAdjust: integer("auto_adjust", { mode: "boolean" }).default(0),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_sensor_thresh_org").on(table.orgId),
    equipmentSensorIdx: index("idx_sensor_thresh_equip_sensor").on(
      table.equipmentId,
      table.sensorType
    )
  })
);
const operatingParametersSqlite = sqliteTable(
  "operating_parameters",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    parameterName: text("parameter_name").notNull(),
    normalValue: real("normal_value"),
    normalRange: text("normal_range"),
    // jsonb → text
    currentValue: real("current_value"),
    deviation: real("deviation"),
    unit: text("unit").notNull(),
    lastUpdated: integer("last_updated", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_op_params_org").on(table.orgId),
    equipmentIdx: index("idx_op_params_equipment").on(table.equipmentId)
  })
);
const discoveredSignalsSqlite = sqliteTable(
  "discovered_signals",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    signalIdentifier: text("signal_identifier").notNull(),
    signalType: text("signal_type"),
    discoveredAt: integer("discovered_at", { mode: "timestamp" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
    sampleData: text("sample_data"),
    // jsonb → text
    mapped: integer("mapped", { mode: "boolean" }).default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_disc_signals_org").on(table.orgId),
    deviceIdx: index("idx_disc_signals_device").on(table.deviceId)
  })
);
const rulModelsSqlite = sqliteTable(
  "rul_models",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentType: text("equipment_type").notNull(),
    modelName: text("model_name").notNull(),
    modelVersion: text("model_version").notNull(),
    algorithm: text("algorithm").notNull(),
    features: text("features").notNull(),
    // jsonb → text
    hyperparameters: text("hyperparameters"),
    // jsonb → text
    trainingMetrics: text("training_metrics"),
    // jsonb → text
    isActive: integer("is_active", { mode: "boolean" }).default(1),
    trainedAt: integer("trained_at", { mode: "timestamp" }),
    deployedAt: integer("deployed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_rul_models_org").on(table.orgId),
    typeIdx: index("idx_rul_models_type").on(table.equipmentType)
  })
);
const rulFitHistorySqlite = sqliteTable(
  "rul_fit_history",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    modelId: text("model_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    fittedAt: integer("fitted_at", { mode: "timestamp" }).notNull(),
    predictedRul: real("predicted_rul").notNull(),
    confidenceInterval: text("confidence_interval"),
    // jsonb → text
    actualRul: real("actual_rul"),
    accuracy: real("accuracy"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_rul_fit_org").on(table.orgId),
    modelIdx: index("idx_rul_fit_model").on(table.modelId),
    equipmentIdx: index("idx_rul_fit_equipment").on(table.equipmentId)
  })
);
const weibullEstimatesSqlite = sqliteTable(
  "weibull_estimates",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentType: text("equipment_type").notNull(),
    componentType: text("component_type").notNull(),
    shapeParameter: real("shape_parameter").notNull(),
    scaleParameter: real("scale_parameter").notNull(),
    locationParameter: real("location_parameter"),
    confidence: real("confidence").notNull(),
    sampleSize: integer("sample_size").notNull(),
    calculatedAt: integer("calculated_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_weibull_org").on(table.orgId),
    typeIdx: index("idx_weibull_type").on(table.equipmentType, table.componentType)
  })
);
const pdmBaselineSqlite = sqliteTable(
  "pdm_baseline",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentType: text("equipment_type").notNull(),
    sensorType: text("sensor_type").notNull(),
    baselineValues: text("baseline_values").notNull(),
    // jsonb → text
    calculatedFrom: integer("calculated_from", { mode: "timestamp" }).notNull(),
    calculatedTo: integer("calculated_to", { mode: "timestamp" }).notNull(),
    sampleCount: integer("sample_count").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).default(1),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_pdm_baseline_org").on(table.orgId),
    typeIdx: index("idx_pdm_baseline_type").on(table.equipmentType, table.sensorType)
  })
);
const digitalTwinsSqlite = sqliteTable(
  "digital_twins",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull().unique(),
    twinModel: text("twin_model").notNull(),
    // jsonb → text
    currentState: text("current_state").notNull(),
    // jsonb → text
    lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
    accuracy: real("accuracy"),
    isActive: integer("is_active", { mode: "boolean" }).default(1),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_digital_twins_org").on(table.orgId),
    equipmentIdx: index("idx_digital_twins_equipment").on(table.equipmentId)
  })
);
const twinSimulationsSqlite = sqliteTable(
  "twin_simulations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    twinId: text("twin_id").notNull(),
    simulationType: text("simulation_type").notNull(),
    inputParameters: text("input_parameters").notNull(),
    // jsonb → text
    outputResults: text("output_results").notNull(),
    // jsonb → text
    executedAt: integer("executed_at", { mode: "timestamp" }).notNull(),
    durationMs: integer("duration_ms"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_twin_sim_org").on(table.orgId),
    twinIdx: index("idx_twin_sim_twin").on(table.twinId)
  })
);
const industryBenchmarksSqlite = sqliteTable(
  "industry_benchmarks",
  {
    id: text("id").primaryKey(),
    equipmentType: text("equipment_type").notNull(),
    metricName: text("metric_name").notNull(),
    benchmarkValue: real("benchmark_value").notNull(),
    unit: text("unit").notNull(),
    percentile: integer("percentile"),
    source: text("source"),
    validFrom: integer("valid_from", { mode: "timestamp" }),
    validTo: integer("valid_to", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    typeIdx: index("idx_benchmark_type").on(table.equipmentType),
    metricIdx: index("idx_benchmark_metric").on(table.metricName)
  })
);
const costModelSqlite = sqliteTable(
  "cost_model",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentType: text("equipment_type").notNull(),
    costType: text("cost_type").notNull(),
    baselineCost: real("baseline_cost").notNull(),
    costFactors: text("cost_factors"),
    // jsonb → text
    modelVersion: text("model_version").notNull(),
    lastUpdated: integer("last_updated", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_cost_model_org").on(table.orgId),
    typeIdx: index("idx_cost_model_type").on(table.equipmentType)
  })
);
const dataQualityMetricsSqlite = sqliteTable(
  "data_quality_metrics",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dataSource: text("data_source").notNull(),
    metricType: text("metric_type").notNull(),
    metricValue: real("metric_value").notNull(),
    threshold: real("threshold"),
    status: text("status").notNull(),
    measuredAt: integer("measured_at", { mode: "timestamp" }).notNull(),
    details: text("details"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_data_quality_org").on(table.orgId),
    sourceIdx: index("idx_data_quality_source").on(table.dataSource),
    statusIdx: index("idx_data_quality_status").on(table.status)
  })
);
const deviceRegistrySqlite = sqliteTable(
  "device_registry",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceType: text("device_type").notNull(),
    serialNumber: text("serial_number"),
    manufacturer: text("manufacturer"),
    model: text("model"),
    firmwareVersion: text("firmware_version"),
    vesselId: text("vessel_id"),
    equipmentId: text("equipment_id"),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
    status: text("status").notNull().default("active"),
    metadata: text("metadata"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_device_reg_org").on(table.orgId),
    vesselIdx: index("idx_device_reg_vessel").on(table.vesselId),
    serialIdx: index("idx_device_reg_serial").on(table.serialNumber)
  })
);
const mqttDevicesSqlite = sqliteTable(
  "mqtt_devices",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull().unique(),
    mqttClientId: text("mqtt_client_id").notNull().unique(),
    topicPrefix: text("topic_prefix").notNull(),
    credentials: text("credentials"),
    // jsonb → text (encrypted)
    isActive: integer("is_active", { mode: "boolean" }).default(1),
    lastConnectedAt: integer("last_connected_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_mqtt_devices_org").on(table.orgId),
    deviceIdx: index("idx_mqtt_devices_device").on(table.deviceId)
  })
);
const serialPortStatesSqlite = sqliteTable(
  "serial_port_states",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    portName: text("port_name").notNull(),
    baudRate: integer("baud_rate").notNull(),
    parity: text("parity"),
    stopBits: integer("stop_bits"),
    protocol: text("protocol").notNull(),
    isOpen: integer("is_open", { mode: "boolean" }).default(0),
    lastActivity: integer("last_activity", { mode: "timestamp" }),
    errorCount: integer("error_count").default(0),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_serial_port_org").on(table.orgId),
    deviceIdx: index("idx_serial_port_device").on(table.deviceId)
  })
);
const transportSettingsSqlite = sqliteTable(
  "transport_settings",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    transportType: text("transport_type").notNull(),
    config: text("config").notNull(),
    // jsonb → text
    priority: integer("priority").default(100),
    isEnabled: integer("is_enabled", { mode: "boolean" }).default(1),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_transport_settings_org").on(table.orgId),
    typeIdx: index("idx_transport_settings_type").on(table.transportType)
  })
);
const transportFailoversSqlite = sqliteTable(
  "transport_failovers",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    primaryTransport: text("primary_transport").notNull(),
    backupTransport: text("backup_transport").notNull(),
    lastFailoverAt: integer("last_failover_at", { mode: "timestamp" }),
    failoverCount: integer("failover_count").default(0),
    currentlyActive: text("currently_active").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_transport_failover_org").on(table.orgId)
  })
);
const complianceAuditLogSqlite = sqliteTable(
  "compliance_audit_log",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    vesselId: text("vessel_id"),
    auditType: text("audit_type").notNull(),
    auditDate: integer("audit_date", { mode: "timestamp" }).notNull(),
    auditor: text("auditor").notNull(),
    findings: text("findings"),
    // jsonb → text
    nonCompliances: text("non_compliances"),
    // jsonb → text
    correctiveActions: text("corrective_actions"),
    // jsonb → text
    status: text("status").notNull(),
    reportUrl: text("report_url"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_comp_audit_org").on(table.orgId),
    vesselIdx: index("idx_comp_audit_vessel").on(table.vesselId),
    dateIdx: index("idx_comp_audit_date").on(table.auditDate)
  })
);
const complianceBundlesSqlite = sqliteTable(
  "compliance_bundles",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    bundleName: text("bundle_name").notNull(),
    regulation: text("regulation").notNull(),
    requirements: text("requirements").notNull(),
    // jsonb → text
    applicableVessels: text("applicable_vessels"),
    // array → text
    validFrom: integer("valid_from", { mode: "timestamp" }),
    validTo: integer("valid_to", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_comp_bundle_org").on(table.orgId)
  })
);
const complianceDocsSqlite = sqliteTable(
  "compliance_docs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    vesselId: text("vessel_id"),
    documentType: text("document_type").notNull(),
    documentName: text("document_name").notNull(),
    documentUrl: text("document_url"),
    issueDate: integer("issue_date", { mode: "timestamp" }),
    expiryDate: integer("expiry_date", { mode: "timestamp" }),
    issuingAuthority: text("issuing_authority"),
    status: text("status").notNull(),
    renewalRequired: integer("renewal_required", { mode: "boolean" }).default(0),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_comp_docs_org").on(table.orgId),
    vesselIdx: index("idx_comp_docs_vessel").on(table.vesselId),
    expiryIdx: index("idx_comp_docs_expiry").on(table.expiryDate)
  })
);
const arMaintenanceProceduresSqlite = sqliteTable(
  "ar_maintenance_procedures",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentType: text("equipment_type").notNull(),
    procedureName: text("procedure_name").notNull(),
    arContent: text("ar_content").notNull(),
    // jsonb → text (3D model refs, annotations)
    steps: text("steps").notNull(),
    // jsonb → text
    duration: integer("duration"),
    difficulty: text("difficulty"),
    isPublished: integer("is_published", { mode: "boolean" }).default(0),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_ar_proc_org").on(table.orgId),
    typeIdx: index("idx_ar_proc_type").on(table.equipmentType)
  })
);
const optimizerConfigurationsSqlite = sqliteTable(
  "optimizer_configurations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    configName: text("config_name").notNull(),
    optimizationType: text("optimization_type").notNull(),
    objectives: text("objectives").notNull(),
    // jsonb → text
    constraints: text("constraints").notNull(),
    // jsonb → text
    isActive: integer("is_active", { mode: "boolean" }).default(1),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_opt_config_org").on(table.orgId),
    typeIdx: index("idx_opt_config_type").on(table.optimizationType)
  })
);
const optimizationResultsSqlite = sqliteTable(
  "optimization_results",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    configId: text("config_id").notNull(),
    runAt: integer("run_at", { mode: "timestamp" }).notNull(),
    inputData: text("input_data").notNull(),
    // jsonb → text
    outputSchedule: text("output_schedule").notNull(),
    // jsonb → text
    objectiveValue: real("objective_value").notNull(),
    solutionQuality: text("solution_quality"),
    executionTimeMs: integer("execution_time_ms"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_opt_results_org").on(table.orgId),
    configIdx: index("idx_opt_results_config").on(table.configId),
    runAtIdx: index("idx_opt_results_run_at").on(table.runAt)
  })
);
const resourceConstraintsSqlite = sqliteTable(
  "resource_constraints",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    vesselId: text("vessel_id"),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    constraintType: text("constraint_type").notNull(),
    constraintValue: text("constraint_value").notNull(),
    // jsonb → text
    validFrom: integer("valid_from", { mode: "timestamp" }),
    validTo: integer("valid_to", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_res_constraints_org").on(table.orgId),
    vesselIdx: index("idx_res_constraints_vessel").on(table.vesselId)
  })
);
const scheduleOptimizationsSqlite = sqliteTable(
  "schedule_optimizations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    optimizationType: text("optimization_type").notNull(),
    targetEntity: text("target_entity").notNull(),
    entityId: text("entity_id"),
    optimizedSchedule: text("optimized_schedule").notNull(),
    // jsonb → text
    improvementMetrics: text("improvement_metrics"),
    // jsonb → text
    appliedAt: integer("applied_at", { mode: "timestamp" }),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_sched_opt_org").on(table.orgId),
    statusIdx: index("idx_sched_opt_status").on(table.status)
  })
);
const beastModeConfigSqlite = sqliteTable(
  "beast_mode_config",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().unique(),
    isEnabled: integer("is_enabled", { mode: "boolean" }).default(0),
    features: text("features").notNull(),
    // jsonb → text (enabled features)
    performanceMode: text("performance_mode").default("balanced"),
    enabledBy: text("enabled_by"),
    enabledAt: integer("enabled_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_beast_mode_org").on(table.orgId)
  })
);
const replayIncomingSqlite = sqliteTable(
  "replay_incoming",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    source: text("source").notNull(),
    payload: text("payload").notNull(),
    // jsonb → text
    processed: integer("processed", { mode: "boolean" }).default(0),
    processedAt: integer("processed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_replay_org").on(table.orgId),
    timestampIdx: index("idx_replay_timestamp").on(table.timestamp),
    processedIdx: index("idx_replay_processed").on(table.processed)
  })
);
const requestIdempotencySqlite = sqliteTable(
  "request_idempotency",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    requestId: text("request_id").notNull().unique(),
    endpoint: text("endpoint").notNull(),
    responseCode: integer("response_code"),
    responseBody: text("response_body"),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
  },
  (table) => ({
    orgIdx: index("idx_req_idemp_org").on(table.orgId),
    requestIdx: index("idx_req_idemp_request").on(table.requestId),
    expiresIdx: index("idx_req_idemp_expires").on(table.expiresAt)
  })
);
const idempotencyLogSqlite = sqliteTable(
  "idempotency_log",
  {
    id: text("id").primaryKey(),
    requestKey: text("request_key").notNull().unique(),
    status: text("status").notNull(),
    response: text("response"),
    // jsonb → text
    createdAt: integer("created_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" })
  },
  (table) => ({
    keyIdx: index("idx_idemp_log_key").on(table.requestKey),
    expiresIdx: index("idx_idemp_log_expires").on(table.expiresAt)
  })
);
const dbSchemaVersionSqlite = sqliteTable("db_schema_version", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  version: integer("version").notNull().unique(),
  description: text("description"),
  appliedAt: integer("applied_at", { mode: "timestamp" }).notNull()
});
const sheetLockSqlite = sqliteTable(
  "sheet_lock",
  {
    id: text("id").primaryKey(),
    sheetId: text("sheet_id").notNull().unique(),
    lockedBy: text("locked_by").notNull(),
    lockedAt: integer("locked_at", { mode: "timestamp" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull()
  },
  (table) => ({
    sheetIdx: index("idx_sheet_lock_sheet").on(table.sheetId),
    expiresIdx: index("idx_sheet_lock_expires").on(table.expiresAt)
  })
);
const sheetVersionSqlite = sqliteTable(
  "sheet_version",
  {
    id: text("id").primaryKey(),
    sheetId: text("sheet_id").notNull(),
    version: integer("version").notNull(),
    data: text("data").notNull(),
    // jsonb → text
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull()
  },
  (table) => ({
    sheetVersionIdx: index("idx_sheet_version_sheet_ver").on(table.sheetId, table.version)
  })
);
const contentSourcesSqlite = sqliteTable("content_sources", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  entityName: text("entity_name"),
  lastModified: integer("last_modified", { mode: "timestamp" }),
  dataQuality: real("data_quality").default(1),
  accessLevel: text("access_level").default("public"),
  tags: text("tags"),
  // JSON array
  relatedSources: text("related_sources"),
  // JSON array
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
});
const j1939ConfigurationsSqlite = sqliteTable("j1939_configurations", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  deviceId: text("device_id"),
  name: text("name").notNull(),
  description: text("description"),
  canInterface: text("can_interface").default("can0"),
  baudRate: integer("baud_rate").default(25e4),
  mappings: text("mappings").notNull(),
  // JSON string
  isActive: integer("is_active", { mode: "boolean" }).default(1),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
});
const knowledgeBaseItemsSqlite = sqliteTable("knowledge_base_items", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  contentType: text("content_type").notNull(),
  sourceId: text("source_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  metadata: text("metadata").default("{}"),
  // JSON string
  keywords: text("keywords"),
  // JSON array
  relevanceScore: real("relevance_score").default(1),
  isActive: integer("is_active", { mode: "boolean" }).default(1),
  lastUpdated: integer("last_updated", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
});
const ragSearchQueriesSqlite = sqliteTable("rag_search_queries", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  query: text("query").notNull(),
  searchType: text("search_type").notNull(),
  filters: text("filters").default("{}"),
  // JSON string
  resultCount: integer("result_count").default(0),
  executionTimeMs: integer("execution_time_ms"),
  resultIds: text("result_ids"),
  // JSON array
  relevanceScores: text("relevance_scores"),
  // JSON array (of reals)
  reportContext: text("report_context"),
  aiModelUsed: text("ai_model_used"),
  successful: integer("successful", { mode: "boolean" }).default(1),
  createdAt: integer("created_at", { mode: "timestamp" })
});
const syncConflictsSqlite = sqliteTable("sync_conflicts", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  fieldName: text("field_name").notNull(),
  localValue: text("local_value"),
  localVersion: integer("local_version"),
  localTimestamp: integer("local_timestamp", { mode: "timestamp" }),
  localUser: text("local_user"),
  localDevice: text("local_device"),
  serverValue: text("server_value"),
  serverVersion: integer("server_version"),
  serverTimestamp: integer("server_timestamp", { mode: "timestamp" }),
  serverUser: text("server_user"),
  serverDevice: text("server_device"),
  resolutionStrategy: text("resolution_strategy"),
  resolved: integer("resolved", { mode: "boolean" }),
  resolvedValue: text("resolved_value"),
  resolvedBy: text("resolved_by"),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  isSafetyCritical: integer("is_safety_critical", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp" })
});
const updateSettingsSqlite = sqliteTable("update_settings", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  vesselId: text("vessel_id"),
  autoUpdateEnabled: integer("auto_update_enabled", { mode: "boolean" }).default(0),
  autoUpdateCriticalOnly: integer("auto_update_critical_only", { mode: "boolean" }).default(1),
  updateChannel: text("update_channel").default("stable"),
  checkInterval: integer("check_interval").default(21600),
  maintenanceWindowStart: text("maintenance_window_start"),
  maintenanceWindowEnd: text("maintenance_window_end"),
  maintenanceWindowTimezone: text("maintenance_window_timezone").default("UTC"),
  deferUpdatesUntilPort: integer("defer_updates_until_port", { mode: "boolean" }).default(0),
  maxDownloadBandwidthKbps: integer("max_download_bandwidth_kbps"),
  requireManualApproval: integer("require_manual_approval", { mode: "boolean" }).default(0),
  notifyOnUpdateAvailable: integer("notify_on_update_available", { mode: "boolean" }).default(1),
  notifyOnUpdateApplied: integer("notify_on_update_applied", { mode: "boolean" }).default(1),
  lastCheckAt: integer("last_check_at", { mode: "timestamp" }),
  lastUpdateAt: integer("last_update_at", { mode: "timestamp" }),
  currentVersion: text("current_version"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
});
export {
  adminAuditEventsSqlite,
  adminSystemSettingsSqlite,
  alertCommentsSqlite,
  alertConfigurationsSqlite,
  alertNotificationsSqlite,
  alertSuppressionsSqlite,
  anomalyDetectionsSqlite,
  arMaintenanceProceduresSqlite,
  beastModeConfigSqlite,
  calibrationCacheSqlite,
  complianceAuditLogSqlite,
  complianceBundlesSqlite,
  complianceDocsSqlite,
  componentDegradationSqlite,
  conditionMonitoringSqlite,
  contentSourcesSqlite,
  costModelSqlite,
  costSavingsSqlite,
  crewAssignmentSqlite,
  crewCertificationSqlite,
  crewLeaveSqlite,
  crewRestDaySqlite,
  crewRestSheetSqlite,
  crewSkillSqlite,
  crewSqlite,
  dailyMetricRollupsSqlite,
  dataQualityMetricsSqlite,
  dbSchemaVersionSqlite,
  deviceRegistrySqlite,
  devicesSqlite,
  digitalTwinsSqlite,
  discoveredSignalsSqlite,
  downtimeEventsSqlite,
  drydockWindowSqlite,
  dtcDefinitionsSqlite,
  dtcFaultsSqlite,
  edgeDiagnosticLogsSqlite,
  edgeHeartbeatsSqlite,
  equipmentLifecycleSqlite,
  equipmentSqlite,
  equipmentTelemetrySqlite,
  errorLogsSqlite,
  expensesSqlite,
  failureHistorySqlite,
  failurePredictionsSqlite,
  idempotencyLogSqlite,
  industryBenchmarksSqlite,
  insightReportsSqlite,
  insightSnapshotsSqlite,
  integrationConfigsSqlite,
  inventoryMovementsSqlite,
  inventoryPartsSqlite,
  j1939ConfigurationsSqlite,
  knowledgeBaseItemsSqlite,
  laborRatesSqlite,
  llmBudgetConfigsSqlite,
  llmCostTrackingSqlite,
  maintenanceChecklistCompletionsSqlite,
  maintenanceChecklistItemsSqlite,
  maintenanceCostsSqlite,
  maintenanceRecordsSqlite,
  maintenanceSchedulesSqlite,
  maintenanceTemplatesSqlite,
  maintenanceWindowsSqlite,
  metricsHistorySqlite,
  mlModelsSqlite,
  modelPerformanceValidationsSqlite,
  modelRegistrySqlite,
  mqttDevicesSqlite,
  oilAnalysisSqlite,
  oilChangeRecordsSqlite,
  operatingConditionAlertsSqlite,
  operatingParametersSqlite,
  opsDbStagedSqlite,
  optimizationResultsSqlite,
  optimizerConfigurationsSqlite,
  partFailureHistorySqlite,
  partSubstitutionsSqlite,
  partsInventorySqlite,
  partsSqlite,
  pdmAlertsSqlite,
  pdmBaselineSqlite,
  pdmScoreLogsSqlite,
  performanceMetricsSqlite,
  portCallSqlite,
  predictionFeedbackSqlite,
  purchaseOrderItemsSqlite,
  purchaseOrdersSqlite,
  ragSearchQueriesSqlite,
  rawTelemetrySqlite,
  replayIncomingSqlite,
  requestIdempotencySqlite,
  reservationsSqlite,
  resourceConstraintsSqlite,
  retrainingTriggersSqlite,
  rulFitHistorySqlite,
  rulModelsSqlite,
  scheduleOptimizationsSqlite,
  sensorConfigurationsSqlite,
  sensorMappingSqlite,
  sensorStatesSqlite,
  sensorThresholdsSqlite,
  sensorTypesSqlite,
  serialPortStatesSqlite,
  sheetLockSqlite,
  sheetVersionSqlite,
  shiftTemplateSqlite,
  skillsSqlite,
  sqliteJsonHelpers,
  stockSqlite,
  storageConfigSqlite,
  suppliersSqlite,
  syncConflictsSqlite,
  systemHealthChecksSqlite,
  systemPerformanceMetricsSqlite,
  systemSettingsSqlite,
  telemetryAggregatesSqlite,
  telemetryRetentionPoliciesSqlite,
  telemetryRollupsSqlite,
  thresholdOptimizationsSqlite,
  transportFailoversSqlite,
  transportSettingsSqlite,
  twinSimulationsSqlite,
  updateSettingsSqlite,
  vesselsSqlite,
  vibrationAnalysisSqlite,
  vibrationFeaturesSqlite,
  visualizationAssetsSqlite,
  wearParticleAnalysisSqlite,
  weibullEstimatesSqlite,
  workOrderChecklistsSqlite,
  workOrderCompletionsSqlite,
  workOrderPartsSqlite,
  workOrderWorklogsSqlite,
  workOrdersSqlite
};
