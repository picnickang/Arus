-- 0045 down — remove the RLS policies and flags added by 0045_rls_catchup.
-- Touches EXACTLY the 0045 array; 0018/0038 coverage is left intact.
-- Idempotent: missing tables/policies are skipped.

DO $rls_down$
DECLARE
  t         text;
  has_table boolean;
  TENANT_TABLES text[] := ARRAY[
    'work_order_tasks','work_order_history','work_order_equipment',
    'purchase_order_events','purchase_request_events','purchase_request_items',
    'service_order_events','service_requests','item_suppliers',
    'parts_inventory',
    'maintenance_checklist_completions','oil_change_records','oil_analysis',
    'wear_particle_analysis','condition_monitoring',
    'threshold_optimizations','acoustic_events','sensor_fusion_snapshots',
    'rul_fit_history','weibull_estimates','feature_importances',
    'prediction_data_quality','inference_runs','model_drift_metrics',
    'model_versions','model_metrics','ml_models_legacy','model_artifacts',
    'training_runs','training_datasets',
    'asset_twin_templates',
    'raw_telemetry_archive','telemetry_batch_ack','equipment_heartbeat',
    'daily_metric_rollups','engineer_overrides','j1939_configurations',
    'sensor_bundles','sensor_templates',
    'diagnostic_runs','equipment_dependency_layouts','equipment_dependencies',
    'mqtt_devices','device_registry','transport_failovers',
    'serial_port_states','edge_diagnostic_logs','calibration_cache',
    'calibration_curves',
    'crew_cert','crew_task_events','crew_tasks','crew_alerts',
    'crew_employment_history','crew_notification_settings','crew_roles',
    'vessel_section_polygons','vessel_section_equipment_assignments',
    'vessel_diagram_validation_results','vessel_thumbnail_overrides',
    'vessel_section_maps','vessel_sections','vessel_diagram_versions',
    'vessel_diagrams','vessel_safety_alarm_acknowledgements',
    'vessel_safety_alarms','safety_alarm_types','safety_bulletins',
    'vessel_track_log','weather_cache',
    'stormgeo_snapshots','stormgeo_import_history','stormgeo_settings',
    'engine_log_hourly','engine_log_watch','engine_log_generator',
    'deck_log_hourly','deck_log_watch','condition_log_summary',
    'fuel_emissions_log','certificate_events','vessel_certificates',
    'compliance_findings','compliance_rules','compliance_docs',
    'data_subject_requests','cross_border_transfers','immutable_audit_trail',
    'alert_email_log','alert_thresholds','alert_settings_vessel',
    'alert_settings','alert_cooldown','crew_alert_settings',
    'notification_settings',
    'rag_semantic_cache','kb_embedding_cache',
    'agent_approvals','agent_drafts','agent_files','agent_findings',
    'agent_suggestions','agent_tasks','agent_briefings','agent_schedules',
    'agent_config','agent_conversations',
    'schedule_assignments','schedule_unfilled','cost_model',
    'role_dashboard_configs','user_vessel_assignments',
    'import_manifest','external_data_cache','sync_protocol_version',
    'patch_downloads','software_patches','fleet_update_status',
    'update_settings',
    'audit_runs','audit_webhook_subscriptions','config_audit_log',
    'context_events','beast_mode_config','integration_configs'
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

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'tenant_isolation_' || t, t);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$rls_down$ LANGUAGE plpgsql;
