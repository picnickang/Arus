/**
 * SQLite Schema Crew Module
 * Crew members, skills, leave, assignments, certifications, rest sheets
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const crewSqlite = sqliteTable(
  "crew",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    employeeId: text("employee_id"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    rank: text("rank"),
    department: text("department"),
    watchKeeping: text("watch_keeping"),
    vesselId: text("vessel_id"),
    userId: text("user_id"),
    joinDate: integer("join_date", { mode: "timestamp" }),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    notes: text("notes"),
    photoPath: text("photo_path"),
    crewCode: text("crew_code"),
    status: text("status").default("active"),
    employmentType: text("employment_type"),
    reportsToId: text("reports_to_id"),
    rotationOnDays: integer("rotation_on_days"),
    rotationOffDays: integer("rotation_off_days"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_crew_org").on(table.orgId),
    vesselIdx: index("idx_crew_vessel").on(table.vesselId),
  })
);

export const skillsSqlite = sqliteTable(
  "skills",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    description: text("description"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_skills_org").on(table.orgId),
  })
);

export const crewSkillSqlite = sqliteTable(
  "crew_skills",
  {
    id: text("id").primaryKey(),
    crewId: text("crew_id").notNull(),
    skillId: text("skill_id").notNull(),
    proficiencyLevel: integer("proficiency_level").default(1),
    certifiedDate: integer("certified_date", { mode: "timestamp" }),
    expiryDate: integer("expiry_date", { mode: "timestamp" }),
    notes: text("notes"),
  },
  (table) => ({
    crewIdx: index("idx_cs_crew").on(table.crewId),
    skillIdx: index("idx_cs_skill").on(table.skillId),
  })
);

export const crewLeaveSqlite = sqliteTable(
  "crew_leave",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    crewId: text("crew_id").notNull(),
    leaveType: text("leave_type").notNull(),
    startDate: integer("start_date", { mode: "timestamp" }).notNull(),
    endDate: integer("end_date", { mode: "timestamp" }).notNull(),
    status: text("status").notNull().default("pending"),
    approvedBy: text("approved_by"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    crewIdx: index("idx_cl_crew").on(table.crewId),
    dateIdx: index("idx_cl_dates").on(table.startDate, table.endDate),
  })
);

export const shiftTemplateSqlite = sqliteTable(
  "shift_templates",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    durationHours: real("duration_hours"),
    breakMinutes: integer("break_minutes").default(0),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_st_org").on(table.orgId),
  })
);

export const crewAssignmentSqlite = sqliteTable(
  "crew_assignments",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    crewId: text("crew_id").notNull(),
    workOrderId: text("work_order_id"),
    vesselId: text("vessel_id"),
    shiftId: text("shift_id"),
    assignmentDate: integer("assignment_date", { mode: "timestamp" }).notNull(),
    startTime: integer("start_time", { mode: "timestamp" }),
    endTime: integer("end_time", { mode: "timestamp" }),
    status: text("status").notNull().default("scheduled"),
    role: text("role"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    crewIdx: index("idx_ca_crew").on(table.crewId),
    workOrderIdx: index("idx_ca_work_order").on(table.workOrderId),
    dateIdx: index("idx_ca_date").on(table.assignmentDate),
  })
);

export const schedulerRunsSqlite = sqliteTable(
  "scheduler_runs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    vesselId: text("vessel_id"),
    runDate: integer("run_date", { mode: "timestamp" }).notNull(),
    scheduleStartDate: integer("schedule_start_date", { mode: "timestamp" }),
    scheduleEndDate: integer("schedule_end_date", { mode: "timestamp" }),
    status: text("status").notNull().default("running"),
    totalAssignments: integer("total_assignments").default(0),
    unfilledSlots: integer("unfilled_slots").default(0),
    optimizationScore: real("optimization_score"),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_sr_org").on(table.orgId),
    runDateIdx: index("idx_sr_run_date").on(table.runDate),
  })
);

export const scheduleAssignmentsSqlite = sqliteTable(
  "schedule_assignments",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    schedulerRunId: text("scheduler_run_id").notNull(),
    runId: text("run_id"),
    crewId: text("crew_id").notNull(),
    shiftId: text("shift_id"),
    assignmentDate: integer("assignment_date", { mode: "timestamp" }).notNull(),
    date: text("date"),
    vesselId: text("vessel_id"),
    startTime: integer("start_time", { mode: "timestamp" }),
    endTime: integer("end_time", { mode: "timestamp" }),
    start: integer("start", { mode: "timestamp" }),
    end: integer("end", { mode: "timestamp" }),
    role: text("role"),
    executed: integer("executed", { mode: "boolean" }).default(false),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    runIdx: index("idx_sa_run").on(table.schedulerRunId),
    crewIdx: index("idx_sa_crew").on(table.crewId),
    dateIdx: index("idx_sa_date").on(table.assignmentDate),
  })
);

export const scheduleUnfilledSqlite = sqliteTable(
  "schedule_unfilled",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    schedulerRunId: text("scheduler_run_id").notNull(),
    runId: text("run_id"),
    shiftId: text("shift_id"),
    assignmentDate: integer("assignment_date", { mode: "timestamp" }).notNull(),
    day: text("day"),
    need: integer("need"),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    runIdx: index("idx_su_run").on(table.schedulerRunId),
  })
);

export const crewCertificationSqlite = sqliteTable(
  "crew_certifications",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    crewId: text("crew_id").notNull(),
    certificationType: text("certification_type").notNull(),
    certificateNumber: text("certificate_number"),
    issuedBy: text("issued_by"),
    issueDate: integer("issue_date", { mode: "timestamp" }),
    expiryDate: integer("expiry_date", { mode: "timestamp" }),
    status: text("status").notNull().default("active"),
    documentUrl: text("document_url"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    crewIdx: index("idx_cc_crew").on(table.crewId),
    expiryIdx: index("idx_cc_expiry").on(table.expiryDate),
  })
);

export const crewDocumentsSqlite = sqliteTable(
  "crew_documents",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    crewId: text("crew_id").notNull(),
    documentType: text("document_type").notNull(),
    documentNumber: text("document_number"),
    filePath: text("file_path"),
    title: text("title"),
    description: text("description"),
    issueDate: integer("issue_date", { mode: "timestamp" }),
    expiryDate: integer("expiry_date", { mode: "timestamp" }),
    issuingAuthority: text("issuing_authority"),
    documentUrl: text("document_url"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    crewIdx: index("idx_cd_crew").on(table.crewId),
    expiryIdx: index("idx_cd_expiry").on(table.expiryDate),
  })
);

export const crewRestSheetSqlite = sqliteTable(
  "crew_rest_sheets",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    crewId: text("crew_id").notNull(),
    vesselId: text("vessel_id"),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    status: text("status").notNull().default("draft"),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    complianceStatus: text("compliance_status"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    crewIdx: index("idx_crs_crew").on(table.crewId),
    monthYearIdx: index("idx_crs_month_year").on(table.month, table.year),
  })
);

export const crewRestDaySqlite = sqliteTable(
  "crew_rest_days",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    restSheetId: text("rest_sheet_id").notNull(),
    date: integer("date", { mode: "timestamp" }).notNull(),
    restHours: text("rest_hours"),
    workHours: text("work_hours"),
    totalRestHours: real("total_rest_hours"),
    totalWorkHours: real("total_work_hours"),
    isCompliant: integer("is_compliant", { mode: "boolean" }),
    violations: text("violations"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    sheetIdx: index("idx_crd_sheet").on(table.restSheetId),
    dateIdx: index("idx_crd_date").on(table.date),
  })
);
