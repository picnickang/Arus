-- Reverse migration for 0018_rls_policies.sql
--
-- Drops the per-table RLS policies and disables/un-forces RLS on
-- every tenant-scoped table the up-migration touched. Also drops the
-- tenant_quotas and tenant_usage tables created in the same migration
-- and removes the suspension columns added to organizations.
--
-- THIS REMOVES THE PRIMARY DEFENSE-IN-DEPTH TENANT BARRIER. Only run
-- in dev / restore-from-clean scenarios — never in production with
-- live multi-tenant data.
--
-- Idempotent: every drop uses IF EXISTS / dynamic existence checks
-- so re-running is safe; tables that never existed are skipped.

DO $rls_down$
DECLARE
  t           text;
  policy_name text;
  has_table   boolean;
  TENANT_TABLES text[] := ARRAY[
    'work_order_worklogs','work_order_checklists','work_order_parts',
    'work_order_completions','purchase_order_items','purchase_orders',
    'purchase_requests','vendor_quotes','service_orders','part_substitutions',
    'reservations','inventory_movements','stock','inventory_parts','parts',
    'suppliers','storage_config','maintenance_costs','maintenance_records',
    'maintenance_checklist_items','maintenance_windows','maintenance_templates',
    'maintenance_schedules','work_orders','prediction_outcomes',
    'anomaly_detections','component_degradation','failure_history',
    'failure_predictions','model_performance_validations','prediction_feedback',
    'vibration_features','rul_models','vibration_analysis','pdm_baseline',
    'pdm_alerts','real_time_predictions','model_deployments','llm_budget_configs',
    'retraining_triggers','digital_twins','model_registry','ml_models',
    'equipment_features','fleet_baselines','twin_events','twin_scenarios',
    'twin_residuals','asset_twin_state','asset_twins','vessel_3d_models',
    'telemetry_aggregates','telemetry_rollups','raw_telemetry',
    'equipment_telemetry','discovered_signals','sensor_states',
    'sensor_configurations','sensor_thresholds','sensor_mapping','sensor_types',
    'operating_condition_alerts','operating_parameters','part_failure_history',
    'downtime_events','equipment_decommission_events','performance_metrics',
    'equipment_lifecycle','pdm_score_logs','edge_heartbeats','devices',
    'equipment','crew_rest_day','crew_rest_sheet','crew_documents',
    'crew_certification','crew_assignment','shift_template','crew_leave',
    'crew_skill','skills','crew','drydock_window','port_call',
    'stormgeo_weather_data','stormgeo_voyages','vessels','engine_log_events',
    'engine_log_daily','deck_log_events','deck_log_daily',
    'certificate_revocations','certificates','compliance_bundles',
    'data_privacy_requests','retention_policies','compliance_audit_log',
    'alert_comments','alert_suppressions','alert_notifications',
    'alert_configurations','actionable_insights','insight_reports',
    'insight_snapshots','llm_cost_tracking','rag_feedback','rag_messages',
    'rag_conversations','kb_doc_versions','kb_docs','rag_search_queries',
    'knowledge_base_items','content_sources','user_preferences',
    'context_snapshots','briefing_packages','agent_interactions',
    'agent_sessions','dtc_faults','scheduler_runs','schedule_optimizations',
    'optimization_results','resource_constraints','optimizer_configurations',
    'scheduling_settings','generated_reports','report_schedules','cost_savings',
    'labor_rates','expenses','user_role_assignments','permission_grants',
    'roles','sso_configs','admin_system_settings','admin_audit_events',
    'email_settings','metrics_history','tenant_quotas','tenant_usage',
    'user_sessions','users'
  ];
BEGIN
  FOREACH t IN ARRAY TENANT_TABLES LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM information_schema.tables
         WHERE table_schema = current_schema() AND table_name = %L)', t
    ) INTO has_table;
    IF NOT has_table THEN
      CONTINUE;
    END IF;

    policy_name := 'tenant_isolation_' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, t);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$rls_down$ LANGUAGE plpgsql;

DROP INDEX IF EXISTS idx_tenant_usage_recorded;
DROP TABLE IF EXISTS tenant_usage;
DROP TABLE IF EXISTS tenant_quotas;

ALTER TABLE organizations
  DROP COLUMN IF EXISTS suspension_reason,
  DROP COLUMN IF EXISTS suspended_at;
