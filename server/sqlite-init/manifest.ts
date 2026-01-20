/**
 * SQLite Init - Domain Manifest
 * Defines all 142+ tables organized by domain for SQLite offline mode
 */

export const SqliteDomains = {
  core: { description: 'Core multi-tenancy and sync tables', tables: ['organizations', 'users', 'sync_journal', 'sync_outbox'], indexes: ['idx_sync_journal_entity', 'idx_sync_journal_status', 'idx_sync_outbox_processed'] },

  vessels: { description: 'Vessel registry and equipment management', tables: ['vessels', 'equipment', 'devices', 'downtime_events', 'port_call', 'drydock_window', 'digital_twins'], indexes: ['idx_vessels_org', 'idx_equipment_org', 'idx_equipment_vessel', 'idx_devices_org', 'idx_devices_equipment', 'idx_downtime_equipment', 'idx_downtime_org', 'idx_downtime_time', 'idx_downtime_vessel', 'idx_downtime_work_order', 'idx_pc_vessel', 'idx_pc_start', 'idx_dw_vessel', 'idx_dw_start'] },

  telemetry: { description: 'Sensor data, telemetry readings, and heartbeats', tables: ['equipment_telemetry', 'raw_telemetry', 'telemetry_rollups', 'telemetry_aggregates', 'edge_heartbeats', 'metrics_history', 'pdm_score_logs', 'sensor_types', 'sensor_mapping', 'sensor_thresholds', 'sensor_configurations', 'sensor_states', 'discovered_signals', 'calibration_cache', 'operating_parameters'], indexes: ['idx_telemetry_equipment_ts', 'idx_telemetry_org', 'idx_telemetry_sensor_ts', 'idx_telemetry_status', 'idx_raw_telem_equipment_ts', 'idx_metrics_history_org', 'idx_pdm_score_equipment', 'idx_sensor_types_active', 'idx_sensor_types_category', 'idx_sensor_config_equipment_sensor', 'idx_sensor_config_org', 'idx_sensor_state_equipment_sensor', 'idx_sensor_state_org'] },

  workOrders: { description: 'Work order management and tracking', tables: ['work_orders', 'work_order_completions', 'work_order_parts', 'work_order_checklists', 'work_order_worklogs'], indexes: ['idx_wo_equipment_status', 'idx_wo_org', 'idx_wo_status', 'idx_wo_vessel', 'idx_wo_schedule', 'idx_woc_work_order', 'idx_woc_equipment', 'idx_woc_org', 'idx_woc_vessel', 'idx_woc_completed_at', 'idx_wop_work_order', 'idx_wop_part', 'idx_wo_checklist_wo', 'idx_wo_worklog_wo'] },

  maintenance: { description: 'Maintenance schedules, records, and lifecycle', tables: ['maintenance_schedules', 'maintenance_records', 'maintenance_costs', 'maintenance_templates', 'maintenance_checklist_items', 'maintenance_checklist_completions', 'equipment_lifecycle', 'performance_metrics', 'maintenance_windows'], indexes: ['idx_ms_equipment', 'idx_ms_scheduled_date', 'idx_ms_status', 'idx_ms_vessel', 'idx_mr_equipment', 'idx_mr_schedule', 'idx_mc_equipment', 'idx_mc_work_order', 'idx_mt_active', 'idx_mt_type', 'idx_mci_template', 'idx_mcc_item', 'idx_mcc_work_order', 'idx_el_equipment', 'idx_pm_equipment', 'idx_pm_date', 'idx_mw_org', 'idx_mw_status'] },

  alerts: { description: 'Alert configurations and notifications', tables: ['alert_configurations', 'alert_notifications', 'alert_suppressions', 'alert_comments', 'actionable_insights', 'operating_condition_alerts', 'pdm_alerts'], indexes: ['idx_alert_config_equipment', 'idx_alert_config_org', 'idx_alert_notif_equipment', 'idx_alert_notif_org'] },

  inventory: { description: 'Parts, stock, and inventory management', tables: ['parts_inventory', 'stock', 'inventory_movements', 'suppliers', 'purchase_orders', 'purchase_order_items', 'parts', 'inventory_parts', 'part_substitutions', 'part_failure_history', 'reservations', 'storage_config'], indexes: ['idx_pi_org', 'idx_pi_part_number', 'idx_pi_category', 'idx_stock_org_part_location', 'idx_stock_part_no', 'idx_stock_supplier', 'idx_im_part', 'idx_im_type', 'idx_im_work_order', 'idx_suppliers_org_code', 'idx_suppliers_name', 'idx_po_status', 'idx_po_supplier', 'idx_po_order_number', 'idx_poi_po', 'idx_poi_part', 'idx_parts_org', 'idx_parts_partno', 'idx_inv_parts_org', 'idx_part_fail_equipment'] },

  crew: { description: 'Crew management and STCW compliance', tables: ['crew', 'skills', 'crew_skill', 'crew_leave', 'shift_template', 'crew_assignment', 'crew_cert', 'crew_rest_sheet', 'crew_rest_day'], indexes: ['idx_crew_org', 'idx_crew_vessel', 'idx_crew_active', 'idx_skills_org', 'idx_skills_name', 'idx_crew_skill_crew', 'idx_crew_leave_crew', 'idx_crew_leave_dates', 'idx_shift_template_vessel', 'idx_shift_template_role', 'idx_crew_assignment_crew_date', 'idx_crew_assignment_shift', 'idx_crew_assignment_vessel', 'idx_crew_assignment_status', 'idx_crew_cert_crew', 'idx_crew_cert_expiry', 'idx_crew_rest_sheet_crew_month', 'idx_crew_rest_sheet_vessel', 'idx_crew_rest_day_sheet'] },

  ml: { description: 'Machine learning models and predictions', tables: ['ml_models', 'failure_predictions', 'anomaly_detections', 'prediction_feedback', 'component_degradation', 'failure_history', 'model_performance_validations', 'retraining_triggers', 'threshold_optimizations', 'vibration_features', 'model_registry', 'rul_models', 'rul_fit_history', 'weibull_estimates', 'pdm_baseline'], indexes: ['idx_ml_models_org', 'idx_ml_models_name_version', 'idx_failure_prediction_time', 'idx_failure_equipment_risk', 'idx_anomaly_equipment_time', 'idx_anomaly_severity', 'idx_feedback_prediction', 'idx_feedback_equipment', 'idx_feedback_status', 'idx_feedback_user', 'idx_component_deg_equipment_time', 'idx_component_deg_component', 'idx_failure_history_equipment', 'idx_failure_history_mode', 'idx_failure_history_severity', 'idx_perf_val_model', 'idx_perf_val_equipment', 'idx_perf_val_classification', 'idx_perf_val_model_equipment', 'idx_perf_val_prediction_time', 'idx_perf_val_prediction_lookup', 'idx_retrain_model', 'idx_retrain_trigger_type', 'idx_retrain_status', 'idx_retrain_priority', 'idx_retrain_scheduled', 'idx_threshold_opt_equipment_time', 'idx_threshold_opt_org', 'idx_threshold_opt_status', 'idx_vibration_equipment_time', 'idx_vibration_org', 'idx_vibration_vessel', 'idx_model_registry_org', 'idx_model_registry_component', 'idx_model_registry_active'] },

  dtc: { description: 'Diagnostic trouble codes and faults', tables: ['dtc_definitions', 'dtc_faults'], indexes: ['idx_dtc_definitions_spn', 'idx_dtc_definitions_severity', 'idx_dtc_faults_device_active', 'idx_dtc_faults_org_eq_active', 'idx_dtc_faults_last_seen'] },

  conditionMonitoring: { description: 'Oil analysis, vibration, and wear monitoring', tables: ['condition_monitoring', 'oil_analysis', 'vibration_analysis', 'wear_particle_analysis', 'oil_change_records'], indexes: ['idx_cond_mon_equipment', 'idx_oil_analysis_equipment', 'idx_vib_analysis_equipment'] },

  llm: { description: 'LLM costs, reports, and insights', tables: ['llm_budget_configs', 'llm_cost_tracking', 'insight_reports', 'insight_snapshots', 'visualization_assets', 'cost_savings'], indexes: ['idx_llm_cost_org_date', 'idx_insight_reports_org', 'idx_cost_savings_equipment'] },

  knowledgeBase: { description: 'Knowledge base and RAG search', tables: ['knowledge_base_items', 'rag_search_queries', 'content_sources'], indexes: ['idx_kb_items_org', 'idx_kb_items_type', 'idx_rag_search_org', 'idx_content_sources_org', 'idx_content_sources_type'] },

  settings: { description: 'System settings and admin configuration', tables: ['system_settings', 'admin_system_settings', 'admin_audit_events', 'integration_configs', 'error_logs', 'transport_settings', 'transport_failovers', 'serial_port_states', 'db_schema_version', 'telemetry_retention_policies', 'beast_mode_config', 'edge_diagnostic_logs', 'update_settings'], indexes: ['idx_admin_audit_org', 'idx_error_logs_org'] },

  sync: { description: 'Hub sync and conflict resolution', tables: ['request_idempotency', 'idempotency_log', 'sheet_lock', 'sheet_version', 'replay_incoming', 'sync_conflicts', 'device_registry', 'mqtt_devices'], indexes: ['idx_sync_conflicts_org', 'idx_sync_conflicts_table', 'idx_device_reg_org', 'idx_mqtt_devices_device'] },

  optimizer: { description: 'Schedule optimization and constraints', tables: ['optimizer_configurations', 'resource_constraints', 'optimization_results', 'schedule_optimizations', 'ops_db_staged'], indexes: [] },

  compliance: { description: 'Audit logs and compliance bundles', tables: ['compliance_audit_log', 'compliance_bundles'], indexes: [] },

  finance: { description: 'Expenses and labor rates', tables: ['expenses', 'labor_rates'], indexes: ['idx_exp_org', 'idx_exp_date', 'idx_exp_work_order', 'idx_lr_org', 'idx_lr_active'] },

  j1939: { description: 'J1939 CAN bus configuration', tables: ['j1939_configurations'], indexes: ['idx_j1939_org', 'idx_j1939_device'] },

  benchmarks: { description: 'Industry benchmarks and data quality', tables: ['industry_benchmarks', 'data_quality_metrics'], indexes: [] },

  logbooks: { description: 'Digital logbooks (deck and engine room)', tables: ['deck_log_daily', 'deck_log_hourly', 'deck_log_watch', 'deck_log_events', 'deck_log_hourly_autofill', 'engine_log_daily', 'engine_log_hourly', 'engine_log_generator', 'engine_log_watch', 'engine_log_events'], indexes: ['idx_deck_log_daily_vessel_date', 'idx_deck_log_daily_org', 'idx_deck_log_daily_status', 'idx_deck_log_hourly_daily', 'idx_deck_log_watch_daily', 'idx_deck_log_events_day', 'idx_deck_log_events_vessel', 'idx_deck_log_events_org', 'idx_deck_log_events_type', 'idx_deck_log_events_timestamp', 'idx_deck_log_hourly_autofill_hourly', 'idx_engine_log_daily_vessel_date', 'idx_engine_log_daily_org', 'idx_engine_log_daily_status', 'idx_engine_log_hourly_daily', 'idx_engine_log_gen_daily', 'idx_engine_log_watch_daily', 'idx_engine_log_events_day', 'idx_engine_log_events_vessel', 'idx_engine_log_events_org', 'idx_engine_log_events_type', 'idx_engine_log_events_timestamp'] },
} as const;

export type SqliteDomainName = keyof typeof SqliteDomains;
