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
  timestamp,
  boolean,
  index,
  createInsertSchema,
  z,
} from "./base.js";
import { organizations } from "./core.js";
import { users } from "./core.js";
import { vessels } from "./vessels.js";
import { workOrders } from "./work-orders.js";
import { equipment } from "./equipment.js";
import { failurePredictions } from "./ml-analytics-core.js";

// ============================================================================
// LABOR RATES
// ============================================================================

export const laborRates = pgTable("labor_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  skillLevel: text("skill_level").notNull(),
  position: text("position").notNull(),
  standardRate: real("standard_rate").notNull(),
  overtimeRate: real("overtime_rate").notNull(),
  emergencyRate: real("emergency_rate").notNull(),
  contractorRate: real("contractor_rate").notNull(),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
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
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    currency: text("currency").notNull().default("USD"),
    laborRatePerHour: real("labor_rate_per_hour").notNull().default(50),
    downtimePerHour: real("downtime_per_hour").notNull().default(1000),
    fuelCostPerLiter: real("fuel_cost_per_liter"),
    inspectionCostPerHour: real("inspection_cost_per_hour"),
    emergencyMultiplier: real("emergency_multiplier").default(2),
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
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    workOrderId: varchar("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }),
    equipmentId: varchar("equipment_id").notNull().references(() => equipment.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    predictionId: integer("prediction_id").references(() => failurePredictions.id, { onDelete: "set null" }),
    maintenanceType: text("maintenance_type").notNull(),
    actualCost: real("actual_cost").notNull().default(0),
    avoidedCost: real("avoided_cost").notNull().default(0),
    totalSavings: real("total_savings").notNull().default(0),
    laborSavings: real("labor_savings").default(0),
    partsSavings: real("parts_savings").default(0),
    downtimeSavings: real("downtime_savings").default(0),
    estimatedDowntimePrevented: real("estimated_downtime_prevented").default(0),
    downtimeCostPerHour: real("downtime_cost_per_hour").default(0),
    triggeredBy: text("triggered_by"),
    confidenceScore: real("confidence_score"),
    emergencyLaborMultiplier: real("emergency_labor_multiplier").default(3),
    emergencyPartsMultiplier: real("emergency_parts_multiplier").default(1.5),
    notes: text("notes"),
    calculatedAt: timestamp("calculated_at", { mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgSavingsIdx: index("idx_cost_savings_org").on(table.orgId, table.calculatedAt),
    equipmentSavingsIdx: index("idx_cost_savings_equipment").on(table.equipmentId, table.calculatedAt),
    vesselSavingsIdx: index("idx_cost_savings_vessel").on(table.vesselId, table.calculatedAt),
    workOrderIdx: index("idx_cost_savings_work_order").on(table.workOrderId),
  })
);

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
