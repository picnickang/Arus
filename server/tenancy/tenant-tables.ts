/**
 * Canonical registry of tenant-scoped tables.
 *
 * This list is the single source of truth for:
 *   1. Postgres RLS policies (migrations 0018_rls_policies.sql,
 *      0038_equipment_telemetry_native_partitioning.sql re-enable, and
 *      0045_rls_catchup.sql — generated from this list).
 *   2. The Wave 6.6 GDPR `TenantDeleteService` allowlist.
 *
 * Every entry MUST be backed by a real table with the tenant column —
 * `scripts/check-rls-coverage.mjs` (wired into `npm run check:guards`)
 * enforces this in both directions:
 *   - An org_id-bearing table in shared/schema that is missing here has
 *     no RLS policy and is skipped by GDPR tenant delete.
 *   - A phantom entry here (table renamed, dropped, or never created)
 *     makes `TenantDeleteService` throw "relation does not exist" and
 *     abort the whole tenant delete — its single transaction treats a
 *     failing scope as a hard error by design. This actually happened:
 *     the first draft of this list carried 13 aspirational names
 *     (`certificates` for vessel_certificates, `crew_certification` for
 *     crew_cert, `data_privacy_requests` for data_subject_requests,
 *     `vendor_quotes`, `stormgeo_weather_data`, `stormgeo_voyages`,
 *     `certificate_revocations`, `retention_policies`,
 *     `user_preferences`, `context_snapshots`, `briefing_packages`,
 *     `agent_interactions`, `agent_sessions` — none ever existed), and
 *     migration 0044 later dropped three more listed here
 *     (`inventory_parts`, `telemetry_aggregates`, `telemetry_rollups`).
 *     All 16 were removed when the guard was introduced.
 *
 * When adding a new tenant-scoped table:
 *   1. Append it here, child-first (see ordering note below).
 *   2. Add it to the next RLS catch-up migration (the guard fails until
 *      the table appears in an RLS migration's array or RLS_EXEMPT).
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
 * Tables exempt from row-level security. They still hold tenant rows
 * (and are therefore listed in TENANT_TABLES so GDPR delete covers
 * them), but their readers/writers legitimately run with NO tenant
 * context, so a fail-closed RLS policy would break them:
 *   - pre-auth paths run before org resolution,
 *   - infra pollers sweep all orgs on the shared connection,
 *   - hub-admin console views list across orgs (optional orgId filter).
 * Every entry needs a reason naming the cross-org code path; the
 * coverage guard rejects empty reasons and unknown table names.
 * Removing an entry here (i.e. enabling RLS on it) requires moving the
 * reader onto `withTenantContext` / per-org fan-out first.
 */
export const RLS_EXEMPT: ReadonlyArray<{ table: string; reason: string }> =
  Object.freeze([
    {
      table: "admin_sessions",
      reason:
        "pre-auth: getAdminSessionByToken runs before orgId is known (server/security/authentication.ts:148)",
    },
    {
      table: "login_events",
      reason:
        "pre-auth: login attempts are recorded before any tenant context exists",
    },
    {
      table: "email_queue",
      reason:
        "infra poller: purchasing email worker claims pending mail across orgs on the shared connection (server/purchasing/email-worker.ts:44)",
    },
    {
      table: "notification_queue",
      reason:
        "infra poller: digest processor sweeps the queue across orgs (server/services/email-notification/queue-processor.ts:95)",
    },
    {
      table: "event_outbox",
      reason:
        "infra poller: event-spine worker claims pending batches across orgs (server/lib/event-spine/worker.ts:88)",
    },
    {
      table: "error_logs",
      reason:
        "hub-admin console lists errors across orgs with an optional org filter (server/db/system-admin/index.ts:159)",
    },
    {
      table: "system_health_checks",
      reason:
        "hub-admin monitoring lists health checks across orgs — getSystemHealthChecks(orgId?) (server/db/system-admin/db-settings.ts:321)",
    },
    {
      table: "system_performance_metrics",
      reason:
        "hub-admin monitoring reads performance metrics across orgs (server/db/system-admin/db-settings.ts)",
    },
    {
      table: "tenant_quotas",
      reason:
        "hub-admin tenant lifecycle console lists/provisions quotas across orgs (server/domains/system-admin/infrastructure/tenant-repository.ts:46,62). 0018 listed it in its RLS array, but the DO block ran before the CREATE TABLE at the bottom of the same file, so RLS never actually applied — which is the behavior the cross-org console depends on.",
    },
    {
      table: "tenant_usage",
      reason:
        "hub-admin tenant lifecycle console reads usage across orgs; same 0018 ordering quirk as tenant_quotas",
    },
  ]);

/**
 * Tables created by SQL migrations rather than the Drizzle schema
 * (no shared/schema definition exists). The coverage guard skips its
 * schema-backing check for these; everything else about them (RLS,
 * GDPR delete) behaves like any other entry.
 */
export const MIGRATION_CREATED_TENANT_TABLES: ReadonlySet<string> = new Set([
  "tenant_quotas", // created by 0018_rls_policies.sql
  "tenant_usage", // created by 0018_rls_policies.sql
]);

/**
 * Tables ordered child-first so that the GDPR delete service can walk
 * them in dependency order. RLS policies don't care about order — but
 * the deleter does, and we want one ordered list rather than two.
 * "Child-first" means: a table whose rows reference another tenant
 * table's rows (FK or logical parent) appears BEFORE that table.
 */
export const TENANT_TABLES: readonly TenantTableSpec[] = Object.freeze([
  // --- Work orders (children first) ---
  { table: "work_order_worklogs" },
  { table: "work_order_checklists" },
  { table: "work_order_parts" },
  { table: "work_order_completions" },
  { table: "work_order_tasks" },
  { table: "work_order_history" },
  { table: "work_order_equipment" },

  // --- Purchasing / services (events before parents) ---
  { table: "purchase_order_events" },
  { table: "purchase_order_items" },
  { table: "purchase_orders" },
  { table: "purchase_request_events" },
  { table: "purchase_request_items" },
  { table: "purchase_requests" },
  { table: "service_order_events" },
  { table: "service_orders" },
  { table: "service_requests" },
  { table: "part_substitutions" },
  { table: "reservations" },
  { table: "inventory_movements" },
  { table: "item_suppliers" },
  { table: "stock" },
  // `parts_inventory` is the deprecated pre-consolidation duplicate of
  // parts+stock; listed while it still exists (drop planned in 0050).
  { table: "parts_inventory" },
  { table: "parts" },
  { table: "suppliers" },
  // `storage_config` was listed here historically, but the Pg table
  // (shared/schema/admin.ts) has no `org_id` column and the runtime
  // service (server/storage-config.ts) is a no-op stub. If/when it
  // grows real per-tenant rows, add `org_id` and re-list it.

  // --- Maintenance ---
  { table: "maintenance_costs" },
  { table: "maintenance_records" },
  { table: "maintenance_checklist_completions" },
  { table: "maintenance_checklist_items" },
  { table: "maintenance_windows" },
  { table: "maintenance_templates" },
  { table: "maintenance_schedules" },
  { table: "oil_change_records" },
  { table: "oil_analysis" },
  { table: "wear_particle_analysis" },
  { table: "condition_monitoring" },

  { table: "work_orders" },

  // --- ML / analytics (children & history before model parents) ---
  { table: "prediction_outcomes" },
  { table: "anomaly_detections" },
  { table: "component_degradation" },
  { table: "failure_history" },
  { table: "failure_predictions" },
  { table: "threshold_optimizations" },
  { table: "model_performance_validations" },
  { table: "prediction_feedback" },
  { table: "acoustic_events" },
  { table: "sensor_fusion_snapshots" },
  { table: "vibration_features" },
  { table: "rul_fit_history" },
  { table: "rul_models" },
  { table: "weibull_estimates" },
  { table: "vibration_analysis" },
  { table: "pdm_baseline" },
  { table: "pdm_alerts" },
  { table: "real_time_predictions" },
  { table: "model_deployments" },
  { table: "llm_budget_configs" },
  { table: "retraining_triggers" },
  { table: "feature_importances" },
  { table: "prediction_data_quality" },
  { table: "inference_runs" },
  { table: "model_drift_metrics" },
  { table: "digital_twins" },
  { table: "model_registry" },
  { table: "model_versions" },
  { table: "model_metrics" },
  { table: "ml_models" },
  // ml_models_legacy dropped in 0050 (0040 had retargeted all FKs off it).
  { table: "model_artifacts" },
  { table: "training_runs" },
  { table: "training_datasets" },
  { table: "equipment_features" },
  { table: "fleet_baselines" },

  // --- Digital twin ---
  { table: "twin_events" },
  { table: "twin_scenarios" },
  { table: "twin_residuals" },
  { table: "asset_twin_state" },
  { table: "asset_twins" },
  { table: "asset_twin_templates" },
  { table: "vessel_3d_models" },

  // --- Telemetry ---
  // `raw_telemetry` is writer-less and scheduled for drop in 0050;
  // listed while it still exists.
  { table: "raw_telemetry" },
  { table: "raw_telemetry_archive" },
  { table: "equipment_telemetry" },
  { table: "telemetry_batch_ack" },
  { table: "equipment_heartbeat" },
  { table: "daily_metric_rollups" },
  { table: "engineer_overrides" },
  { table: "j1939_configurations" },

  // --- Sensors ---
  { table: "discovered_signals" },
  { table: "sensor_states" },
  { table: "sensor_configurations" },
  { table: "sensor_thresholds" },
  { table: "sensor_mapping" },
  { table: "sensor_bundles" },
  { table: "sensor_templates" },
  // `sensor_types` remains unlisted: the Pg table has no org_id column.

  // --- Equipment & operations ---
  { table: "operating_condition_alerts" },
  { table: "operating_parameters" },
  { table: "part_failure_history" },
  { table: "downtime_events" },
  { table: "equipment_decommission_events" },
  { table: "performance_metrics" },
  { table: "equipment_lifecycle" },
  { table: "pdm_score_logs" },
  { table: "edge_heartbeats" },
  { table: "diagnostic_runs" },
  { table: "equipment_dependency_layouts" },
  { table: "equipment_dependencies" },
  { table: "devices" },
  { table: "equipment" },

  // --- IoT edge ---
  { table: "mqtt_devices" },
  { table: "device_registry" },
  { table: "transport_failovers" },
  { table: "serial_port_states" },
  { table: "edge_diagnostic_logs" },
  { table: "calibration_cache" },
  { table: "calibration_curves" },

  // --- Crew ---
  { table: "crew_rest_day" },
  { table: "crew_rest_sheet" },
  { table: "crew_documents" },
  { table: "crew_cert" },
  { table: "crew_assignment" },
  { table: "shift_template" },
  { table: "crew_leave" },
  { table: "crew_skill" },
  { table: "skills" },
  { table: "crew_task_events" },
  { table: "crew_tasks" },
  { table: "crew_alerts" },
  { table: "crew_employment_history" },
  { table: "crew_notification_settings" },
  { table: "crew_roles" },
  { table: "crew" },

  // --- Vessels & voyages (diagram/alarm children before vessels) ---
  { table: "vessel_section_polygons" },
  { table: "vessel_section_equipment_assignments" },
  { table: "vessel_diagram_validation_results" },
  { table: "vessel_thumbnail_overrides" },
  { table: "vessel_section_maps" },
  { table: "vessel_sections" },
  { table: "vessel_diagram_versions" },
  { table: "vessel_diagrams" },
  { table: "vessel_safety_alarm_acknowledgements" },
  { table: "vessel_safety_alarms" },
  { table: "safety_alarm_types" },
  { table: "safety_bulletins" },
  { table: "vessel_track_log" },
  { table: "weather_cache" },
  { table: "drydock_window" },
  { table: "port_call" },
  { table: "vessels" },

  // --- StormGeo ---
  { table: "stormgeo_snapshots" },
  { table: "stormgeo_import_history" },
  { table: "stormgeo_settings" },

  // --- Compliance / certificates / logbooks ---
  { table: "engine_log_events" },
  { table: "engine_log_hourly" },
  { table: "engine_log_watch" },
  { table: "engine_log_generator" },
  { table: "engine_log_daily" },
  { table: "deck_log_events" },
  { table: "deck_log_hourly" },
  { table: "deck_log_watch" },
  { table: "deck_log_daily" },
  { table: "condition_log_summary" },
  { table: "fuel_emissions_log" },
  { table: "certificate_events" },
  { table: "vessel_certificates" },
  { table: "compliance_bundles" },
  { table: "compliance_findings" },
  { table: "compliance_rules" },
  { table: "compliance_docs" },
  { table: "data_subject_requests" },
  { table: "cross_border_transfers" },
  { table: "immutable_audit_trail" },
  // `compliance_audit_log`, `kb_doc_versions`, `rag_messages`, and
  // `permission_grants` remain unlisted: those Pg tables still have no
  // org_id column (children scoped through their parents).

  // --- Alerts / notifications / insights ---
  { table: "alert_comments" },
  { table: "alert_suppressions" },
  { table: "alert_notifications" },
  { table: "alert_configurations" },
  { table: "alert_email_log" },
  { table: "alert_thresholds" },
  { table: "alert_settings_vessel" },
  { table: "alert_settings" },
  { table: "alert_cooldown" },
  { table: "crew_alert_settings" },
  { table: "notification_settings" },
  { table: "email_queue" },
  { table: "notification_queue" },
  { table: "actionable_insights" },
  { table: "insight_reports" },
  { table: "insight_snapshots" },
  { table: "llm_cost_tracking" },

  // --- RAG / knowledge base ---
  { table: "rag_feedback" },
  { table: "rag_semantic_cache" },
  { table: "rag_conversations" },
  { table: "kb_embedding_cache" },
  { table: "kb_docs" },
  { table: "rag_search_queries" },
  { table: "knowledge_base_items" },
  { table: "content_sources" },

  // --- Agent ---
  { table: "agent_approvals" },
  { table: "agent_drafts" },
  { table: "agent_files" },
  { table: "agent_findings" },
  { table: "agent_suggestions" },
  { table: "agent_tasks" },
  { table: "agent_briefings" },
  { table: "agent_schedules" },
  { table: "agent_config" },
  { table: "agent_conversations" },

  // --- DTC / optimizer / scheduling / reports ---
  { table: "dtc_faults" },
  { table: "schedule_assignments" },
  { table: "schedule_unfilled" },
  { table: "scheduler_runs" },
  { table: "schedule_optimizations" },
  { table: "optimization_results" },
  { table: "resource_constraints" },
  { table: "optimizer_configurations" },
  { table: "scheduling_settings" },
  { table: "generated_reports" },
  { table: "report_schedules" },

  // --- Costs ---
  { table: "cost_savings" },
  { table: "cost_model" },
  { table: "labor_rates" },
  { table: "expenses" },

  // --- Permissions / dashboards ---
  { table: "user_role_assignments" },
  { table: "role_dashboard_configs" },
  { table: "user_vessel_assignments" },
  { table: "user_dashboard_preferences" },
  { table: "roles" },

  // --- Sync / import / cache ---
  { table: "event_outbox" },
  { table: "import_manifest" },
  { table: "external_data_cache" },
  { table: "sync_protocol_version" },

  // --- Ops deployment ---
  { table: "patch_downloads" },
  { table: "software_patches" },
  { table: "fleet_update_status" },
  { table: "update_settings" },

  // --- SSO / Admin ---
  { table: "sso_configs" },
  { table: "admin_system_settings" },
  { table: "admin_audit_events" },
  { table: "audit_runs" },
  { table: "audit_webhook_subscriptions" },
  { table: "config_audit_log" },
  { table: "context_events" },
  { table: "beast_mode_config" },
  { table: "integration_configs" },
  { table: "error_logs" },
  { table: "system_health_checks" },
  { table: "system_performance_metrics" },
  { table: "email_settings" },
  { table: "metrics_history" },

  // --- Quotas (Push B1 step 6) — created by migration 0018 ---
  { table: "tenant_quotas" },
  { table: "tenant_usage" },

  // --- Users / sessions / org root (delete last) ---
  { table: "admin_sessions" },
  { table: "login_events" },
  { table: "user_sessions" },
  { table: "users" },
]);

export const TENANT_TABLE_NAMES: readonly string[] = TENANT_TABLES.map(
  (t) => t.table
);
