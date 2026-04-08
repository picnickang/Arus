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
  index,
  createInsertSchema,
  z,
} from "./base";

export const agentConversations = pgTable("agent_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  userId: varchar("user_id"),
  title: text("title"),
  status: text("status").notNull().default("active"),
  messageCount: integer("message_count").notNull().default(0),
  totalTokensUsed: integer("total_tokens_used").default(0),
  lastMessageAt: timestamp("last_message_at", { mode: "date" }),
  metadata: jsonb("metadata").default({}),
  contextSummary: text("context_summary"),
  summarizedUpTo: integer("summarized_up_to").default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => [
  index("idx_agent_conv_org").on(table.orgId),
  index("idx_agent_conv_user").on(table.userId),
  index("idx_agent_conv_status").on(table.status),
  index("idx_agent_conv_last_msg").on(table.lastMessageAt),
]);

export const agentMessages = pgTable("agent_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content"),
  toolCalls: jsonb("tool_calls"),
  tokenCount: integer("token_count"),
  model: text("model"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
}, (table) => [
  index("idx_agent_msg_conv").on(table.conversationId),
  index("idx_agent_msg_role").on(table.role),
  index("idx_agent_msg_created").on(table.createdAt),
]);

export const agentToolCalls = pgTable("agent_tool_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  messageId: varchar("message_id").notNull(),
  toolName: text("tool_name").notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  status: text("status").notNull().default("pending"),
  durationMs: integer("duration_ms"),
  error: text("error"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
}, (table) => [
  index("idx_agent_tc_conv").on(table.conversationId),
  index("idx_agent_tc_msg").on(table.messageId),
  index("idx_agent_tc_tool").on(table.toolName),
  index("idx_agent_tc_status").on(table.status),
]);

export const agentDrafts = pgTable("agent_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  conversationId: varchar("conversation_id").notNull(),
  draftType: text("draft_type").notNull(),
  title: text("title").notNull(),
  data: jsonb("data").notNull(),
  status: text("status").notNull().default("pending"),
  createdById: varchar("created_by_id"),
  reviewedById: varchar("reviewed_by_id"),
  reviewNote: text("review_note"),
  resultId: varchar("result_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => [
  index("idx_agent_draft_org").on(table.orgId),
  index("idx_agent_draft_conv").on(table.conversationId),
  index("idx_agent_draft_status").on(table.status),
  index("idx_agent_draft_type").on(table.draftType),
]);

export const agentApprovals = pgTable("agent_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  draftId: varchar("draft_id").notNull(),
  conversationId: varchar("conversation_id").notNull(),
  action: text("action").notNull(),
  reviewedById: varchar("reviewed_by_id"),
  reviewNote: text("review_note"),
  resultId: varchar("result_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
}, (table) => [
  index("idx_agent_appr_org").on(table.orgId),
  index("idx_agent_appr_draft").on(table.draftId),
  index("idx_agent_appr_conv").on(table.conversationId),
]);

export const agentConfig = pgTable("agent_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  defaultModel: text("default_model").notNull().default("gpt-4o-mini"),
  maxIterationsPerRun: integer("max_iterations_per_run").notNull().default(10),
  maxTokensPerConversation: integer("max_tokens_per_conversation").default(50000),
  dailyTokenLimit: integer("daily_token_limit").default(500000),
  monthlyTokenLimit: integer("monthly_token_limit").default(5000000),
  customSystemPrompt: text("custom_system_prompt"),
  enabledTools: jsonb("enabled_tools"),
  contextCompaction: boolean("context_compaction").notNull().default(true),
  compactionThreshold: integer("compaction_threshold").notNull().default(30),
  toolOutputCharLimit: integer("tool_output_char_limit").notNull().default(4000),
  deferredToolLoading: boolean("deferred_tool_loading").notNull().default(true),
  permissionTier: text("permission_tier").notNull().default("strict"),
  autoTriggerEnabled: boolean("auto_trigger_enabled").notNull().default(false),
  autoTriggerThreshold: real("auto_trigger_threshold").notNull().default(0.85),
  suggestionPreferences: jsonb("suggestion_preferences"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => [
  index("idx_agent_config_org").on(table.orgId),
]);

export const agentSuggestions = pgTable("agent_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  triggerType: text("trigger_type").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  severity: text("severity").notNull().default("info"),
  status: text("status").notNull().default("pending"),
  context: jsonb("context"),
  actedOn: boolean("acted_on").default(false),
  outcome: text("outcome"),
  outcomeReason: text("outcome_reason"),
  outcomeAt: timestamp("outcome_at", { mode: "date" }),
  outcomeBy: varchar("outcome_by"),
  linkedPredictionId: varchar("linked_prediction_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
}, (table) => [
  index("idx_agent_sug_org").on(table.orgId),
  index("idx_agent_sug_status").on(table.status),
  index("idx_agent_sug_trigger").on(table.triggerType),
  index("idx_agent_sug_created").on(table.createdAt),
  index("idx_agent_sug_outcome").on(table.outcome),
]);

export const agentSchedules = pgTable("agent_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  cronExpression: text("cron_expression").notNull(),
  allowedTools: jsonb("allowed_tools"),
  outputDestination: text("output_destination").notNull().default("notification"),
  allowWriteTools: boolean("allow_write_tools").notNull().default(false),
  maxTokenBudget: integer("max_token_budget").default(4000),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => [
  index("idx_agent_sched_org").on(table.orgId),
  index("idx_agent_sched_enabled").on(table.enabled),
]);

export const agentScheduleRuns = pgTable("agent_schedule_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").notNull(),
  status: text("status").notNull().default("running"),
  output: jsonb("output"),
  tokenUsage: integer("token_usage"),
  error: text("error"),
  startedAt: timestamp("started_at", { mode: "date" }).defaultNow(),
  completedAt: timestamp("completed_at", { mode: "date" }),
}, (table) => [
  index("idx_agent_sched_run_sched").on(table.scheduleId),
  index("idx_agent_sched_run_status").on(table.status),
]);

export const insertAgentConversationSchema = createInsertSchema(agentConversations)
  .omit({ id: true, createdAt: true, updatedAt: true, messageCount: true, totalTokensUsed: true, lastMessageAt: true, contextSummary: true, summarizedUpTo: true });

export const insertAgentMessageSchema = createInsertSchema(agentMessages)
  .omit({ id: true, createdAt: true });

export const insertAgentDraftSchema = createInsertSchema(agentDrafts)
  .omit({ id: true, createdAt: true, updatedAt: true, reviewedById: true, reviewNote: true, resultId: true });

export const insertAgentApprovalSchema = createInsertSchema(agentApprovals)
  .omit({ id: true, createdAt: true });

export const insertAgentConfigSchema = createInsertSchema(agentConfig)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertAgentSuggestionSchema = createInsertSchema(agentSuggestions)
  .omit({ id: true, createdAt: true });

export const insertAgentScheduleSchema = createInsertSchema(agentSchedules)
  .omit({ id: true, createdAt: true, updatedAt: true, lastRunAt: true });

export type AgentConversation = typeof agentConversations.$inferSelect;
export type InsertAgentConversation = z.infer<typeof insertAgentConversationSchema>;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type InsertAgentMessage = z.infer<typeof insertAgentMessageSchema>;
export type AgentToolCall = typeof agentToolCalls.$inferSelect;
export type AgentDraft = typeof agentDrafts.$inferSelect;
export type InsertAgentDraft = z.infer<typeof insertAgentDraftSchema>;
export type AgentApproval = typeof agentApprovals.$inferSelect;
export type InsertAgentApproval = z.infer<typeof insertAgentApprovalSchema>;
export type AgentConfigType = typeof agentConfig.$inferSelect;
export type InsertAgentConfig = z.infer<typeof insertAgentConfigSchema>;
export type AgentSuggestion = typeof agentSuggestions.$inferSelect;
export type InsertAgentSuggestion = z.infer<typeof insertAgentSuggestionSchema>;
export type AgentSchedule = typeof agentSchedules.$inferSelect;
export type InsertAgentSchedule = z.infer<typeof insertAgentScheduleSchema>;
export type AgentScheduleRun = typeof agentScheduleRuns.$inferSelect;

export const agentFiles = pgTable("agent_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  conversationId: varchar("conversation_id").notNull(),
  filename: varchar("filename").notNull(),
  mimetype: varchar("mimetype").notNull(),
  size: integer("size").notNull(),
  storedPath: text("stored_path").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
}, (table) => [
  index("idx_agent_files_conv").on(table.conversationId),
  index("idx_agent_files_org").on(table.orgId),
]);

export type AgentFile = typeof agentFiles.$inferSelect;

export const agentBriefings = pgTable("agent_briefings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  generatedAt: timestamp("generated_at", { mode: "date" }).defaultNow(),
  periodStart: timestamp("period_start", { mode: "date" }).notNull(),
  periodEnd: timestamp("period_end", { mode: "date" }).notNull(),
  sections: jsonb("sections").$type<Array<{ key: string; title: string; icon?: string; items: Array<{ id: string; title: string; description: string; severity?: string; entityType?: string; entityId?: string; linkTo?: string; metadata?: Record<string, unknown> }>; emptyMessage?: string }>>().notNull().default([]),
  aiSummary: text("ai_summary"),
  status: text("status").notNull().default("generating"),
  scheduleRunId: varchar("schedule_run_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
}, (table) => [
  index("idx_agent_briefings_org").on(table.orgId),
  index("idx_agent_briefings_generated").on(table.generatedAt),
  index("idx_agent_briefings_status").on(table.status),
]);

export const insertAgentBriefingSchema = createInsertSchema(agentBriefings)
  .omit({ id: true, createdAt: true });

export type AgentBriefing = typeof agentBriefings.$inferSelect;
export type InsertAgentBriefing = z.infer<typeof insertAgentBriefingSchema>;

export const agentTasks = pgTable("agent_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  source: text("source").notNull().default("user"),
  parentTaskId: varchar("parent_task_id"),
  equipmentId: varchar("equipment_id"),
  vesselId: varchar("vessel_id"),
  predictionId: varchar("prediction_id"),
  conversationId: varchar("conversation_id"),
  outcome: text("outcome"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  completedAt: timestamp("completed_at", { mode: "date" }),
}, (table) => [
  index("idx_agent_tasks_org").on(table.orgId),
  index("idx_agent_tasks_status").on(table.status),
  index("idx_agent_tasks_source").on(table.source),
  index("idx_agent_tasks_parent").on(table.parentTaskId),
  index("idx_agent_tasks_equipment").on(table.equipmentId),
  index("idx_agent_tasks_vessel").on(table.vesselId),
]);

export const insertAgentTaskSchema = createInsertSchema(agentTasks)
  .omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });

export type AgentTask = typeof agentTasks.$inferSelect;
export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;

export const agentFindings = pgTable("agent_findings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  findingType: text("finding_type").notNull().default("recommendation"),
  severity: text("severity").notNull().default("info"),
  title: text("title").notNull(),
  evidenceSummary: text("evidence_summary"),
  recommendedAction: text("recommended_action"),
  status: text("status").notNull().default("new"),
  taskId: varchar("task_id"),
  equipmentId: varchar("equipment_id"),
  vesselId: varchar("vessel_id"),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  conversationId: varchar("conversation_id"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => [
  index("idx_agent_findings_org").on(table.orgId),
  index("idx_agent_findings_type").on(table.findingType),
  index("idx_agent_findings_severity").on(table.severity),
  index("idx_agent_findings_status").on(table.status),
  index("idx_agent_findings_task").on(table.taskId),
  index("idx_agent_findings_equipment").on(table.equipmentId),
]);

export const insertAgentFindingSchema = createInsertSchema(agentFindings)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type AgentFinding = typeof agentFindings.$inferSelect;
export type InsertAgentFinding = z.infer<typeof insertAgentFindingSchema>;
