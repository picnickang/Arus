/**
 * Schema Insights - Analytics Engine and LLM Cost Tracking
 * 
 * Fleet KPI snapshots, insight reports, and LLM cost/usage tracking.
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
  serial,
  index,
  createInsertSchema,
  z,
} from "./base.js";
import { organizations } from "./core.js";
import { vessels } from "./vessels.js";
import { equipment } from "./equipment.js";

// Insights and Analytics Engine - Fleet KPI Snapshots and Risk Analysis
export const insightSnapshots = pgTable("insight_snapshots", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  scope: text("scope").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  kpi: jsonb("kpi").notNull().$type<{
    fleet: {
      vessels: number;
      signalsMapped: number;
      signalsDiscovered: number;
      dq7d: number;
      latestGapVessels: string[];
    };
    perVessel: Record<
      string,
      {
        lastTs: string | null;
        dq7d: number;
        totalSignals: number;
        stale: boolean;
      }
    >;
  }>(),
  risks: jsonb("risks").notNull().$type<{
    critical: string[];
    warnings: string[];
  }>(),
  recommendations: jsonb("recommendations").notNull().$type<string[]>(),
  anomalies: jsonb("anomalies").notNull().$type<
    Array<{
      vesselId: string;
      src: string;
      sig: string;
      kind: string;
      severity: string;
      tStart: string;
      tEnd: string;
    }>
  >(),
  compliance: jsonb("compliance").notNull().$type<{
    horViolations7d?: number;
    notes?: string[];
  }>(),
});

export const insightReports = pgTable("insight_reports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  scope: text("scope").notNull(),
  periodStart: timestamp("period_start", { mode: "date" }).notNull(),
  periodEnd: timestamp("period_end", { mode: "date" }).notNull(),
  snapshotId: varchar("snapshot_id").references(() => insightSnapshots.id, {
    onDelete: "set null",
  }),
  llmSummary: text("llm_summary"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// LLM cost tracking - monitors AI API usage and costs
export const llmCostTracking = pgTable(
  "llm_cost_tracking",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .default("default-org-id"),
    requestId: varchar("request_id").notNull(),
    provider: varchar("provider").notNull(),
    model: varchar("model").notNull(),
    requestType: varchar("request_type").notNull(),
    reportType: varchar("report_type"),
    audience: varchar("audience"),
    vesselId: varchar("vessel_id").references(() => vessels.id, { onDelete: "set null" }),
    equipmentId: varchar("equipment_id").references(() => equipment.id, { onDelete: "set null" }),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    estimatedCost: real("estimated_cost").notNull(),
    actualCost: real("actual_cost"),
    latencyMs: integer("latency_ms"),
    success: boolean("success").notNull().default(true),
    errorMessage: text("error_message"),
    fallbackUsed: boolean("fallback_used").default(false),
    fallbackModel: varchar("fallback_model"),
    userId: varchar("user_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    orgDateIdx: index("idx_llm_cost_org_date").on(table.orgId, table.createdAt),
    providerModelIdx: index("idx_llm_cost_provider_model").on(table.provider, table.model),
    requestTypeIdx: index("idx_llm_cost_request_type").on(table.requestType),
    vesselIdx: index("idx_llm_cost_vessel").on(table.vesselId),
    successIdx: index("idx_llm_cost_success").on(table.success),
    dateProviderModelIdx: index("idx_llm_cost_date_provider_model").on(
      table.createdAt,
      table.provider,
      table.model
    ),
  })
);

// Insert schemas
export const insertInsightSnapshotSchema = createInsertSchema(insightSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertInsightReportSchema = createInsertSchema(insightReports).omit({
  id: true,
  createdAt: true,
});

export const insertLlmCostTrackingSchema = createInsertSchema(llmCostTracking).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsightSnapshot = typeof insightSnapshots.$inferSelect;
export type InsertInsightSnapshot = z.infer<typeof insertInsightSnapshotSchema>;
export type InsightReport = typeof insightReports.$inferSelect;
export type InsertInsightReport = z.infer<typeof insertInsightReportSchema>;
export type LlmCostTracking = typeof llmCostTracking.$inferSelect;
export type InsertLlmCostTracking = z.infer<typeof insertLlmCostTrackingSchema>;
