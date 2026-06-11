-- ============================================================================
-- 0045  RLS catch-up — close the tenant-isolation gap left after 0018
-- ============================================================================
-- 0018 enabled FORCE RLS on the tenant tables known at the time (Push B1,
-- Nov 2026), but the registry it was generated from carried phantom names
-- and missed ~120 org_id-bearing tables added before and since — including
-- GDPR/compliance (data_subject_requests, compliance_docs,
-- cross_border_transfers), HR (crew_employment_history, crew_cert), agent
-- conversations/drafts, logbooks, vessel diagrams, StormGeo, iot-edge and
-- ops-deployment tables. Those tables relied on app-layer WHERE clauses
-- alone. This migration brings every remaining registry table under the
-- same fail-closed policy shape as 0018.
--
-- DESIGN (identical to 0018 — see its header for the full rationale)
--   * Policies key on current_setting('app.current_org_id', true):
--     unset session variable == NULL == no rows (fail-closed).
--   * FORCE ROW LEVEL SECURITY so the table-owner role is not exempt.
--   * Idempotent: pg_policies guard per table; missing tables skipped;
--     a listed table existing WITHOUT org_id aborts (fail-closed).
--
-- SOURCE OF TRUTH
--   The array below is generated from server/tenancy/tenant-tables.ts
--   (TENANT_TABLES minus tables already covered by 0018/0038 minus
--   RLS_EXEMPT). scripts/check-rls-coverage.mjs enforces lockstep: a
--   registry table missing from every RLS migration fails check:guards.
--
-- DELIBERATELY NOT COVERED (RLS_EXEMPT in tenant-tables.ts — their
-- readers/writers legitimately run with no tenant context):
--   admin_sessions, login_events        (pre-auth paths)
--   email_queue, notification_queue,
--   event_outbox                        (cross-org infra pollers)
--   error_logs, system_health_checks,
--   system_performance_metrics          (hub-admin cross-org views)
--
-- OPERATIONAL NOTE
--   ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY takes a brief
--   ACCESS EXCLUSIVE lock per table (metadata-only, ~125 tables, locks
--   held until COMMIT). On a busy installation run via
--   `npm run db:migrate:deploy` in a maintenance window rather than
--   MIGRATE_ON_BOOT (0041 precedent).
-- ============================================================================

DO $rls$
DECLARE
  t           text;
  policy_name text;
  has_table   boolean;
  has_col     boolean;
  TENANT_TABLES text[] := ARRAY[
    -- Work orders
    'work_order_tasks','work_order_history','work_order_equipment',
    -- Purchasing / services
    'purchase_order_events','purchase_request_events','purchase_request_items',
    'service_order_events','service_requests','item_suppliers',
    'parts_inventory',
    -- Maintenance
    'maintenance_checklist_completions','oil_change_records','oil_analysis',
    'wear_particle_analysis','condition_monitoring',
    -- ML / analytics
    'threshold_optimizations','acoustic_events','sensor_fusion_snapshots',
    'rul_fit_history','weibull_estimates','feature_importances',
    'prediction_data_quality','inference_runs','model_drift_metrics',
    'model_versions','model_metrics','ml_models_legacy','model_artifacts',
    'training_runs','training_datasets',
    -- Digital twin
    'asset_twin_templates',
    -- Telemetry
    'raw_telemetry_archive','telemetry_batch_ack','equipment_heartbeat',
    'daily_metric_rollups','engineer_overrides','j1939_configurations',
    -- Sensors
    'sensor_bundles','sensor_templates',
    -- Equipment & operations
    'diagnostic_runs','equipment_dependency_layouts','equipment_dependencies',
    -- IoT edge
    'mqtt_devices','device_registry','transport_failovers',
    'serial_port_states','edge_diagnostic_logs','calibration_cache',
    'calibration_curves',
    -- Crew
    'crew_cert','crew_task_events','crew_tasks','crew_alerts',
    'crew_employment_history','crew_notification_settings','crew_roles',
    -- Vessels: diagrams / safety alarms / tracks
    'vessel_section_polygons','vessel_section_equipment_assignments',
    'vessel_diagram_validation_results','vessel_thumbnail_overrides',
    'vessel_section_maps','vessel_sections','vessel_diagram_versions',
    'vessel_diagrams','vessel_safety_alarm_acknowledgements',
    'vessel_safety_alarms','safety_alarm_types','safety_bulletins',
    'vessel_track_log','weather_cache',
    -- StormGeo
    'stormgeo_snapshots','stormgeo_import_history','stormgeo_settings',
    -- Logbooks / compliance / certificates
    'engine_log_hourly','engine_log_watch','engine_log_generator',
    'deck_log_hourly','deck_log_watch','condition_log_summary',
    'fuel_emissions_log','certificate_events','vessel_certificates',
    'compliance_findings','compliance_rules','compliance_docs',
    'data_subject_requests','cross_border_transfers','immutable_audit_trail',
    -- Alerts / notifications
    'alert_email_log','alert_thresholds','alert_settings_vessel',
    'alert_settings','alert_cooldown','crew_alert_settings',
    'notification_settings',
    -- RAG / knowledge base
    'rag_semantic_cache','kb_embedding_cache',
    -- Agent
    'agent_approvals','agent_drafts','agent_files','agent_findings',
    'agent_suggestions','agent_tasks','agent_briefings','agent_schedules',
    'agent_config','agent_conversations',
    -- Scheduling / costs / dashboards
    'schedule_assignments','schedule_unfilled','cost_model',
    'role_dashboard_configs','user_vessel_assignments',
    -- Sync / import / cache
    'import_manifest','external_data_cache','sync_protocol_version',
    -- Ops deployment
    'patch_downloads','software_patches','fleet_update_status',
    'update_settings',
    -- Admin
    'audit_runs','audit_webhook_subscriptions','config_audit_log',
    'context_events','beast_mode_config','integration_configs'
  ];
BEGIN
  FOREACH t IN ARRAY TENANT_TABLES LOOP
    -- Skip tables that don't exist yet (older deployments missing newer
    -- feature tables). A missing table is not a security regression —
    -- there's nothing to protect.
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM information_schema.tables
         WHERE table_schema = current_schema() AND table_name = %L)', t
    ) INTO has_table;
    IF NOT has_table THEN
      CONTINUE;
    END IF;

    -- Require an `org_id` column. A listed table without one would be
    -- silently unprotected — abort instead (fail-closed, 0018 posture).
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = %L
         AND column_name = ''org_id'')', t
    ) INTO has_col;
    IF NOT has_col THEN
      RAISE EXCEPTION
        '0045_rls_catchup: table % is registered as tenant-scoped but has no org_id column; refusing to leave it unprotected', t;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    policy_name := 'tenant_isolation_' || t;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = current_schema() AND tablename = t
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I
           USING (org_id = current_setting(''app.current_org_id'', true))
           WITH CHECK (org_id = current_setting(''app.current_org_id'', true))',
        policy_name, t
      );
    END IF;
  END LOOP;
END
$rls$ LANGUAGE plpgsql;
