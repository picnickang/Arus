/**
 * Schema Costs - Labor Rates, Expenses, Cost Model, Cost Savings
 *
 * Financial tracking for maintenance ROI and expense management.
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
  index,
  createInsertSchema,
  z,
} from "./base";
import { organizations } from "./core";
import { users } from "./core";
import { vessels } from "./vessels";
import { workOrders } from "./work-orders";
import { equipment } from "./equipment";
import { failurePredictions } from "./ml-analytics-core";

// ============================================================================
// LABOR RATES
// ============================================================================

export const laborRates = pgTable("labor_rates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  skillLevel: text("skill_level").notNull(),
  position: text("position").notNull(),
  standardRate: numeric("standard_rate", { precision: 12, scale: 2, mode: "number" }).notNull(),
  overtimeRate: numeric("overtime_rate", { precision: 12, scale: 2, mode: "number" }).notNull(),
  emergencyRate: numeric("emergency_rate", { precision: 12, scale: 2, mode: "number" }).notNull(),
  contractorRate: numeric("contractor_rate", { precision: 12, scale: 2, mode: "number" }).notNull(),
  currency: text("currency").notNull().default("USD"),
  effectiveDate: timestamp("effective_date", { mode: "date" }).defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const insertLaborRateSchema = createInsertSchema(laborRates)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    skillLevel: z.enum([
      "trainee",
      "apprentice",
      "technician",
      "senior_technician",
      "supervisor",
      "specialist",
    ]),
    position: z.enum([
      "engine_technician",
      "mechanical_engineer",
      "electrical_technician",
      "electronics_technician",
      "hvac_technician",
      "deck_hand",
      "maintenance_supervisor",
    ]),
    standardRate: z.number().min(0.01),
    overtimeRate: z.number().min(0.01),
    emergencyRate: z.number().min(0.01),
    contractorRate: z.number().min(0.01),
  });

export type LaborRate = typeof laborRates.$inferSelect;
export type InsertLaborRate = z.infer<typeof insertLaborRateSchema>;

// ============================================================================
// EXPENSES
// ============================================================================

export const expenses = pgTable("expenses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
  currency: text("currency").notNull().default("USD"),
  description: text("description").notNull(),
  vendor: text("vendor"),
  invoiceNumber: text("invoice_number"),
  workOrderId: varchar("work_order_id").references(() => workOrders.id),
  vesselName: text("vessel_name"),
  expenseDate: timestamp("expense_date", { mode: "date" }).notNull(),
  approvalStatus: text("approval_status").notNull().default("pending"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { mode: "date" }),
  receipt: text("receipt"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expenses)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    type: z.enum([
      "vendor_invoice",
      "labor_cost",
      "downtime_cost",
      "emergency_repair",
      "port_fees",
      "fuel_cost",
      "other",
    ]),
    amount: z.number().min(0.01),
    approvalStatus: z.enum(["pending", "approved", "rejected"]).default("pending"),
  });

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

// ============================================================================
// COST MODEL
// ============================================================================

export const costModel = pgTable(
  "cost_model",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    currency: text("currency").notNull().default("USD"),
    laborRatePerHour: numeric("labor_rate_per_hour", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(50),
    downtimePerHour: numeric("downtime_per_hour", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(1000),
    fuelCostPerLiter: numeric("fuel_cost_per_liter", { precision: 12, scale: 2, mode: "number" }),
    inspectionCostPerHour: numeric("inspection_cost_per_hour", {
      precision: 12,
      scale: 2,
      mode: "number",
    }),
    emergencyMultiplier: numeric("emergency_multiplier", {
      precision: 6,
      scale: 3,
      mode: "number",
    }).default(2),
    description: text("description"),
    isActive: boolean("is_active").default(true),
    effectiveFrom: timestamp("effective_from", { mode: "date" }).defaultNow(),
    effectiveTo: timestamp("effective_to", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgActiveIdx: sql`CREATE INDEX IF NOT EXISTS idx_cost_model_org_active ON cost_model (org_id, is_active, effective_from)`,
  })
);

export const insertCostModelSchema = createInsertSchema(costModel).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CostModel = typeof costModel.$inferSelect;
export type InsertCostModel = z.infer<typeof insertCostModelSchema>;

// ============================================================================
// COST SAVINGS
// ============================================================================

export const costSavings = pgTable(
  "cost_savings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    workOrderId: varchar("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    predictionId: integer("prediction_id").references(() => failurePredictions.id, {
      onDelete: "set null",
    }),
    maintenanceType: text("maintenance_type").notNull(),
    actualCost: numeric("actual_cost", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    avoidedCost: numeric("avoided_cost", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    totalSavings: numeric("total_savings", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    laborSavings: numeric("labor_savings", { precision: 12, scale: 2, mode: "number" }).default(0),
    partsSavings: numeric("parts_savings", { precision: 12, scale: 2, mode: "number" }).default(0),
    downtimeSavings: numeric("downtime_savings", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).default(0),
    estimatedDowntimePrevented: real("estimated_downtime_prevented").default(0),
    downtimeCostPerHour: numeric("downtime_cost_per_hour", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).default(0),
    triggeredBy: text("triggered_by"),
    confidenceScore: real("confidence_score"),
    emergencyLaborMultiplier: numeric("emergency_labor_multiplier", {
      precision: 6,
      scale: 3,
      mode: "number",
    }).default(3),
    emergencyPartsMultiplier: numeric("emergency_parts_multiplier", {
      precision: 6,
      scale: 3,
      mode: "number",
    }).default(1.5),
    validationStatus: varchar("validation_status", { length: 20 }).default("valid").notNull(),
    validationChangedBy: text("validation_changed_by"),
    validationChangedAt: timestamp("validation_changed_at", { mode: "date" }),
    validationReason: text("validation_reason"),
    notes: text("notes"),
    calculatedAt: timestamp("calculated_at", { mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgSavingsIdx: index("idx_cost_savings_org").on(table.orgId, table.calculatedAt),
    equipmentSavingsIdx: index("idx_cost_savings_equipment").on(
      table.equipmentId,
      table.calculatedAt
    ),
    vesselSavingsIdx: index("idx_cost_savings_vessel").on(table.vesselId, table.calculatedAt),
    workOrderIdx: index("idx_cost_savings_work_order").on(table.workOrderId),
  })
);

export const validationStatusEnum = z.enum(["valid", "disputed", "voided"]);

export const insertCostSavingsSchema = createInsertSchema(costSavings)
  .omit({
    id: true,
    calculatedAt: true,
    createdAt: true,
  })
  .extend({
    orgId: z.string().min(1),
    equipmentId: z.string().min(1),
    maintenanceType: z.enum(["preventive", "predictive", "corrective", "emergency"]),
    actualCost: z.number().min(0),
    avoidedCost: z.number().min(0),
    totalSavings: z.number(),
    validationStatus: validationStatusEnum.default("valid"),
  });

export const updateValidationStatusSchema = z.object({
  validationStatus: validationStatusEnum,
  reason: z.string().min(1, "Reason is required").max(500),
});

export type CostSavings = typeof costSavings.$inferSelect;
export type InsertCostSavings = z.infer<typeof insertCostSavingsSchema>;

// ============================================================================
// COST SAVINGS API VALIDATION SCHEMAS
// ============================================================================

export const costSavingsSummaryQuerySchema = z.object({
  months: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((n) => n >= 1 && n <= 60, { message: "Months must be between 1 and 60" })
    .default("12"),
});

export const costSavingsTrendQuerySchema = z.object({
  months: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((n) => n >= 1 && n <= 60, { message: "Months must be between 1 and 60" })
    .default("12"),
});

export const costSavingsCalculateOptionsSchema = z
  .object({
    emergencyLaborMultiplier: z.number().min(1).max(10).optional(),
    emergencyPartsMultiplier: z.number().min(1).max(5).optional(),
    emergencyDowntimeMultiplier: z.number().min(1).max(10).optional(),
  })
  .optional();

export const costSavingsListQuerySchema = z.object({
  equipmentId: z.string().uuid().optional(),
  vesselId: z.string().uuid().optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((n) => n >= 1 && n <= 500, { message: "Limit must be between 1 and 500" })
    .default("50"),
});

export const downtimeCostValidationSchema = z.object({
  downtimeCostPerHour: z.number().min(100).max(50000, {
    message: "Downtime cost per hour must be between $100 and $50,000",
  }),
});
