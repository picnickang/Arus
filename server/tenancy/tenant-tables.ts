/**
 * Canonical registry of tenant-scoped tables.
 *
 * This list is the single source of truth for:
 *   1. Postgres RLS policies (migration 0018_rls_policies.sql).
 *   2. The Wave 6.6 GDPR `TenantDeleteService` allowlist.
 *   3. Per-tenant quota usage queries (`server/tenancy/quota-service.ts`).
 *
 * Every entry MUST have an `org_id` column in physical Postgres. Drift
 * between this list and the live schema breaks tenant isolation in two
 * ways:
 *   - A table left out of this list has no RLS policy and is readable
 *     across tenants if a query forgets `WHERE org_id = …`.
 *   - A table named here that lacks `org_id` will cause the migration to
 *     fail at apply time, which is the desired fail-closed behaviour.
 *
 * The list mirrors the schema explored at the start of Push B1 (Nov 2026).
 * When adding a new tenant-scoped table:
 *   1. Append it here.
 *   2. Re-run `npm run db:migrate` so migration 0018 picks it up.
 *   3. If the table contains PII, also add it to the GDPR retention
 *      allowlist in `server/composition/gdpr-tenant-delete.ts`.
 */

export interface TenantTableSpec {
  /** Physical Postgres table name. */
  table: string;
  /** Override column name when the table uses something other than `org_id`. */
  tenantColumn?: string;
  /** Free-form notes that survive in the migration as SQL comments. */
  description?: string;
}

/**
 * Tables ordered child-first so that the GDPR delete service can walk
 * them in dependency order. RLS policies don't care about order — but
 * the deleter does, and we want one ordered list rather than two.
 */
export const TENANT_TABLES: readonly TenantTableSpec[] = Object.freeze([
  // --- Leaf / child tables (delete first) ---
  { table: "work_order_worklogs" },
  { table: "work_order_checklists" },
  { table: "work_order_parts" },
  { table: "work_order_completions" },
  { table: "purchase_order_items" },
  { table: "purchase_orders" },
  { table: "purchase_requests" },
  { table: "vendor_quotes" },
  { table: "service_orders" },
  { table: "part_substitutions" },
  { table: "reservations" },
  { table: "inventory_movements" },
  { table: "stock" },
  { table: "inventory_parts" },
  { table: "parts" },
  { table: "suppliers" },
  // `storage_config` was listed here historically, but the Pg table
  // (shared/schema/admin.ts:1109) has no `org_id` column and the
  // runtime service (server/storage-config.ts) is a no-op stub
  // (list → [], upsert/delete → no-op). Including it caused migration
  // 0018_rls_policies to fail-closed with "registered as tenant-
  // scoped but has no org_id column". The table holds no per-tenant
  // data today; if/when storage_config grows real per-tenant rows,
  // add an `org_id` column via a fresh migration and re-list it here.

  { table: "maintenance_costs" },
  { table: "maintenance_records" },
  { table: "maintenance_checklist_items" },
  { table: "maintenance_windows" },
  { table: "maintenance_templates" },
  { table: "maintenance_schedules" },

  { table: "work_orders" },

  // ML / analytics
  { table: "prediction_outcomes" },
  { table: "anomaly_detections" },
  { table: "component_degradation" },
  { table: "failure_history" },
  { table: "failure_predictions" },
  { table: "model_performance_validations" },
  { table: "prediction_feedback" },
  { table: "vibration_features" },
  { table: "rul_models" },
  { table: "vibration_analysis" },
  { table: "pdm_baseline" },
  { table: "pdm_alerts" },
  { table: "real_time_predictions" },
  { table: "model_deployments" },
  { table: "llm_budget_configs" },
  { table: "retraining_triggers" },
  { table: "digital_twins" },
  { table: "model_registry" },
  { table: "ml_models" },
  { table: "equipment_features" },
  { table: "fleet_baselines" },

  // Digital twin
  { table: "twin_events" },
  { table: "twin_scenarios" },
  { table: "twin_residuals" },
  { table: "asset_twin_state" },
  { table: "asset_twins" },
  { table: "vessel_3d_models" },

  // Telemetry
  { table: "telemetry_aggregates" },
  { table: "telemetry_rollups" },
  { table: "raw_telemetry" },
  { table: "equipment_telemetry" },

  // Sensors
  { table: "discovered_signals" },
  { table: "sensor_states" },
  { table: "sensor_configurations" },
  { table: "sensor_thresholds" },
  { table: "sensor_mapping" },
  // `sensor_types`, `compliance_audit_log`, `kb_doc_versions`,
  // `rag_messages`, `permission_grants` removed in lockstep with
  // migration 0018: those Pg tables have no `org_id` column today
  // and including them aborted the migration with a fail-closed
  // guard. They remain candidates for a follow-up backfill +
  // re-listing once the columns exist.

  // Equipment & operations
  { table: "operating_condition_alerts" },
  { table: "operating_parameters" },
  { table: "part_failure_history" },
  { table: "downtime_events" },
  { table: "equipment_decommission_events" },
  { table: "performance_metrics" },
  { table: "equipment_lifecycle" },
  { table: "pdm_score_logs" },
  { table: "edge_heartbeats" },
  { table: "devices" },
  { table: "equipment" },

  // Crew
  { table: "crew_rest_day" },
  { table: "crew_rest_sheet" },
  { table: "crew_documents" },
  { table: "crew_certification" },
  { table: "crew_assignment" },
  { table: "shift_template" },
  { table: "crew_leave" },
  { table: "crew_skill" },
  { table: "skills" },
  { table: "crew" },

  // Vessels & voyages
  { table: "drydock_window" },
  { table: "port_call" },
  { table: "stormgeo_weather_data" },
  { table: "stormgeo_voyages" },
  { table: "vessels" },

  // Compliance / certificates / logbooks
  { table: "engine_log_events" },
  { table: "engine_log_daily" },
  { table: "deck_log_events" },
  { table: "deck_log_daily" },
  { table: "certificate_revocations" },
  { table: "certificates" },
  { table: "compliance_bundles" },
  { table: "data_privacy_requests" },
  { table: "retention_policies" },
  // { table: "compliance_audit_log" }, // removed: no org_id column (see 0018)

  // Alerts / insights
  { table: "alert_comments" },
  { table: "alert_suppressions" },
  { table: "alert_notifications" },
  { table: "alert_configurations" },
  { table: "actionable_insights" },
  { table: "insight_reports" },
  { table: "insight_snapshots" },
  { table: "llm_cost_tracking" },

  // RAG / knowledge base
  { table: "rag_feedback" },
  // { table: "rag_messages" }, // removed: no org_id column (see 0018)
  { table: "rag_conversations" },
  // { table: "kb_doc_versions" }, // removed: no org_id column (see 0018)
  { table: "kb_docs" },
  { table: "rag_search_queries" },
  { table: "knowledge_base_items" },
  { table: "content_sources" },

  // Agent
  { table: "user_preferences" },
  { table: "context_snapshots" },
  { table: "briefing_packages" },
  { table: "agent_interactions" },
  { table: "agent_sessions" },

  // DTC / optimizer / scheduling / reports
  { table: "dtc_faults" },
  { table: "scheduler_runs" },
  { table: "schedule_optimizations" },
  { table: "optimization_results" },
  { table: "resource_constraints" },
  { table: "optimizer_configurations" },
  { table: "scheduling_settings" },
  { table: "generated_reports" },
  { table: "report_schedules" },

  // Costs
  { table: "cost_savings" },
  { table: "labor_rates" },
  { table: "expenses" },

  // Permissions
  { table: "user_role_assignments" },
  // { table: "permission_grants" }, // removed: no org_id column (see 0018)
  { table: "roles" },

  // SSO / Admin
  { table: "sso_configs" },
  { table: "admin_system_settings" },
  { table: "admin_audit_events" },
  { table: "email_settings" },
  { table: "metrics_history" },

  // Quotas (Push B1 step 6) — self-referential tenant rows
  { table: "tenant_quotas" },
  { table: "tenant_usage" },

  // Users / sessions / org root (delete last)
  { table: "user_sessions" },
  { table: "users" },
]);

export const TENANT_TABLE_NAMES: readonly string[] = TENANT_TABLES.map(
  (t) => t.table
);
