/**
 * SQLite Schema Insights Module
 * LLM reports, cost tracking, insight snapshots, visualizations
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const llmBudgetConfigsSqlite = sqliteTable(
  "llm_budget_configs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    monthlyBudget: real("monthly_budget"),
    dailyLimit: real("daily_limit"),
    perRequestLimit: real("per_request_limit"),
    currency: text("currency").default("USD"),
    alertThreshold: real("alert_threshold").default(0.8),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_lbc_org").on(table.orgId),
  })
);

export const llmCostTrackingSqlite = sqliteTable(
  "llm_cost_tracking",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    requestId: text("request_id"),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    cost: real("cost"),
    currency: text("currency").default("USD"),
    requestType: text("request_type"),
    latencyMs: integer("latency_ms"),
    status: text("status").notNull().default("completed"),
    errorMessage: text("error_message"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_lct_org").on(table.orgId),
    createdAtIdx: index("idx_lct_created_at").on(table.createdAt),
    modelIdx: index("idx_lct_model").on(table.model),
  })
);

export const insightReportsSqlite = sqliteTable(
  "insight_reports",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    reportType: text("report_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    content: text("content"),
    vesselId: text("vessel_id"),
    equipmentId: text("equipment_id"),
    periodStart: integer("period_start", { mode: "timestamp" }),
    periodEnd: integer("period_end", { mode: "timestamp" }),
    generatedBy: text("generated_by"),
    status: text("status").notNull().default("draft"),
    fileUrl: text("file_url"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_ir_org").on(table.orgId),
    typeIdx: index("idx_ir_type").on(table.reportType),
  })
);

export const insightSnapshotsSqlite = sqliteTable(
  "insight_snapshots",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    snapshotType: text("snapshot_type").notNull(),
    snapshotDate: integer("snapshot_date", { mode: "timestamp" }).notNull(),
    data: text("data"),
    metrics: text("metrics"),
    vesselId: text("vessel_id"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgTypeIdx: index("idx_is_org_type").on(table.orgId, table.snapshotType),
    dateIdx: index("idx_is_date").on(table.snapshotDate),
  })
);

export const visualizationAssetsSqlite = sqliteTable(
  "visualization_assets",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    reportId: text("report_id"),
    assetType: text("asset_type").notNull(),
    title: text("title"),
    description: text("description"),
    chartConfig: text("chart_config"),
    dataQuery: text("data_query"),
    fileUrl: text("file_url"),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    reportIdx: index("idx_va_report").on(table.reportId),
  })
);

export const costSavingsSqlite = sqliteTable(
  "cost_savings",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id"),
    vesselId: text("vessel_id"),
    savingsType: text("savings_type").notNull(),
    description: text("description"),
    estimatedSavings: real("estimated_savings"),
    actualSavings: real("actual_savings"),
    currency: text("currency").default("USD"),
    periodStart: integer("period_start", { mode: "timestamp" }),
    periodEnd: integer("period_end", { mode: "timestamp" }),
    calculationMethod: text("calculation_method"),
    metadata: text("metadata"),
    validatedBy: text("validated_by"),
    validatedAt: integer("validated_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_cs_org").on(table.orgId),
    typeIdx: index("idx_cs_type").on(table.savingsType),
  })
);

export const knowledgeBaseItemsSqlite = sqliteTable("knowledge_base_items", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  category: text("category"),
  tags: text("tags"),
  sourceType: text("source_type"),
  sourceUrl: text("source_url"),
  embedding: text("embedding"),
  metadata: text("metadata"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const ragSearchQueriesSqlite = sqliteTable("rag_search_queries", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  query: text("query").notNull(),
  resultCount: integer("result_count"),
  topResultIds: text("top_result_ids"),
  searchLatencyMs: integer("search_latency_ms"),
  feedbackScore: real("feedback_score"),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

export const contentSourcesSqlite = sqliteTable("content_sources", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  connectionConfig: text("connection_config"),
  syncSchedule: text("sync_schedule"),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
  lastSyncStatus: text("last_sync_status"),
  itemCount: integer("item_count").default(0),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});
