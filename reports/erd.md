# ARUS Database Schema - ERD

```mermaid
erDiagram
    admin_audit_events {
        character varying id PK
        character varying org_id
        character varying user_id?
        character varying admin_email?
        character varying action
        character varying resource_type?
        character varying resource_id?
        character varying outcome
    }
    admin_sessions {
        character varying id PK
        character varying session_token
        character varying user_id?
        character varying admin_email?
        character varying ip_address?
        text user_agent?
        timestamp without time zone expires_at
        timestamp without time zone last_activity_at?
    }
    admin_system_settings {
        character varying id PK
        character varying org_id
        character varying category
        character varying key
        text value?
        character varying data_type
        text description?
        boolean is_sensitive?
    }
    alert_comments {
        character varying id PK
        text alert_id
        text comment
        text commented_by
        timestamp without time zone created_at?
    }
    alert_configurations {
        character varying id PK
        character varying equipment_id
        text sensor_type
        real warning_threshold?
        real critical_threshold?
        boolean enabled?
        boolean notify_email?
        boolean notify_in_app?
    }
    alert_notifications {
        character varying id PK
        character varying equipment_id
        text sensor_type
        text alert_type
        text message
        real value
        real threshold
        boolean acknowledged?
    }
    alert_suppressions {
        character varying id PK
        text equipment_id
        text sensor_type
        text alert_type?
        text suppressed_by
        text reason?
        timestamp without time zone suppress_until
        boolean active?
    }
    anomaly_detections {
        integer id PK
        character varying org_id
        character varying equipment_id
        character varying sensor_type
        timestamp with time zone detection_timestamp?
        real anomaly_score
        character varying anomaly_type?
        character varying severity
    }
    beast_mode_config {
        character varying id PK
        character varying org_id
        text feature_name
        boolean enabled?
        jsonb configuration?
        text last_modified_by?
        timestamp without time zone created_at?
        timestamp without time zone updated_at?
    }
    calibration_cache {
        character varying id PK
        character varying org_id
        text equipment_type
        text manufacturer
        text model
        text sensor_type
        text calibration_source
        jsonb coefficients
    }
    calibration_curves {
        character varying id PK
        character varying org_id
        character varying model_type
        character varying equipment_type
        character varying method
        jsonb parameters
        integer training_size
        timestamp with time zone training_date
    }
    compliance_audit_log {
        character varying id PK
        text action
        text entity_type
        text entity_id
        text performed_by
        timestamp without time zone timestamp?
        text details?
        text compliance_standard?
    }
    compliance_bundles {
        character varying id PK
        character varying org_id
        text bundle_id
        text kind
        text title
        text description?
        timestamp without time zone generated_at?
        text sha256_hash
    }
    component_degradation {
        integer id PK
        character varying org_id
        character varying equipment_id
        character varying component_type
        timestamp with time zone measurement_timestamp?
        double precision degradation_metric?
        double precision vibration_level?
        double precision temperature?
    }
    condition_monitoring {
        character varying id PK
        character varying org_id
        character varying equipment_id
        timestamp without time zone assessment_date
        integer oil_condition_score?
        integer wear_condition_score?
        integer vibration_score?
        integer thermal_score?
    }
    content_sources {
        character varying id PK
        character varying org_id
        character varying source_type
        character varying source_id
        character varying entity_name?
        timestamp without time zone last_modified?
        real data_quality?
        character varying access_level?
    }
    context_events {
        character varying id PK
        character varying org_id
        character varying vessel_id?
        character varying equipment_id?
        character varying type
        timestamp without time zone timestamp
        integer duration?
        character varying title
    }
    cost_savings {
        character varying id PK
        character varying org_id
        character varying work_order_id?
        character varying equipment_id
        character varying vessel_id?
        integer prediction_id?
        text maintenance_type
        real actual_cost
    }
    crew {
        character varying id PK
        character varying org_id
        text name
        text rank?
        character varying vessel_id
        real max_hours_7d?
        real min_rest_h?
        boolean active?
    }
    crew_assignment {
        character varying id PK
        text date
        character varying shift_id?
        character varying crew_id
        character varying vessel_id?
        timestamp without time zone start
        timestamp without time zone end
        text role?
    }
    crew_cert {
        character varying id PK
        character varying crew_id
        text cert
        timestamp without time zone expires_at
        text issued_by?
        timestamp without time zone created_at?
    }
    crew_leave {
        character varying id PK
        character varying crew_id
        timestamp without time zone start
        timestamp without time zone end
        text reason?
        timestamp without time zone created_at?
    }
    crew_rest_day {
        character varying sheet_id
        text date
        integer h0?
        integer h1?
        integer h2?
        integer h3?
        integer h4?
        integer h5?
    }
    crew_rest_sheet {
        character varying id PK
        character varying vessel_id?
        character varying crew_id
        text crew_name
        text rank?
        text month
        integer year
        timestamp without time zone created_at?
    }
    crew_skill {
        character varying crew_id
        text skill
        integer level?
    }
    db_schema_version {
        integer id PK
        text name
        timestamp without time zone applied_at?
    }
    device_registry {
        text id PK
        text label?
        timestamp without time zone created_at?
    }
    devices {
        character varying id PK
        text vessel?
        jsonb buses?
        jsonb sensors?
        jsonb config?
        text hmac_key?
        timestamp without time zone updated_at?
        character varying org_id
    }
    digital_twins {
        character varying id PK
        character varying vessel_id
        character varying twin_type
        character varying name
        jsonb specifications?
        jsonb cad_model?
        jsonb physics_model?
        jsonb current_state?
    }
    discovered_signals {
        character varying id PK
        character varying org_id
        text vessel_id
        text source_id
        text signal_id
        text unit?
        timestamp without time zone first_seen?
        timestamp without time zone last_seen?
    }
    downtime_events {
        character varying id PK
        character varying org_id
        character varying work_order_id?
        character varying equipment_id?
        character varying vessel_id?
        text downtime_type
        timestamp without time zone start_time
        timestamp without time zone end_time?
    }
    drydock_window {
        character varying id PK
        character varying vessel_id
        text yard?
        timestamp without time zone start
        timestamp without time zone end
        text work_type?
        text status?
        timestamp without time zone created_at?
    }
    dtc_definitions {
        integer spn PK
        integer fmi PK
        text manufacturer PK
        text spn_name
        text fmi_name
        text description
        integer severity
        timestamp without time zone created_at?
    }
    dtc_faults {
        character varying id PK
        character varying org_id
        character varying equipment_id
        character varying device_id
        integer spn
        integer fmi
        integer oc?
        integer sa?
    }
    edge_diagnostic_logs {
        character varying id PK
        character varying org_id
        character varying device_id?
        character varying equipment_id?
        text event_type
        text severity
        text status
        text message
    }
    edge_heartbeats {
        character varying device_id PK
        timestamp without time zone ts?
        real cpu_pct?
        real mem_pct?
        real disk_free_gb?
        integer buffer_rows?
        text sw_version?
    }
    equipment {
        character varying id PK
        character varying org_id
        text vessel_name?
        text name
        text type
        text manufacturer?
        text model?
        text serial_number?
    }
    equipment_lifecycle {
        character varying id PK
        text equipment_id
        text manufacturer?
        text model?
        text serial_number?
        timestamp without time zone installation_date?
        timestamp without time zone warranty_expiry?
        integer expected_lifespan?
    }
    equipment_telemetry {
        character varying id PK
        timestamp without time zone ts PK
        character varying equipment_id
        text sensor_type
        real value
        text unit?
        real threshold?
        text status
    }
    error_logs {
        character varying id PK
        character varying org_id
        timestamp without time zone timestamp
        text severity
        text category
        text message
        text stack_trace?
        jsonb context?
    }
    expenses {
        character varying id PK
        character varying org_id
        text type
        real amount
        text currency
        text description
        text vendor?
        text invoice_number?
    }
    failure_history {
        integer id PK
        character varying org_id
        character varying equipment_id
        timestamp with time zone failure_timestamp
        character varying failure_mode
        character varying failure_severity?
        numeric downtime_hours?
        character varying maintenance_action?
    }
    failure_predictions {
        integer id PK
        character varying org_id
        character varying equipment_id
        timestamp with time zone prediction_timestamp?
        real failure_probability
        timestamp with time zone predicted_failure_date?
        integer remaining_useful_life?
        jsonb confidence_interval?
    }
    feature_importances {
        integer id PK
        character varying org_id
        character varying equipment_id
        character varying model_id
        timestamp with time zone calculated_at?
        real base_value
        jsonb features
        timestamp without time zone created_at?
    }
    idempotency_log {
        character varying key PK
        text endpoint
        timestamp without time zone timestamp?
    }
    industry_benchmarks {
        character varying id PK
        text equipment_type
        text manufacturer?
        text model?
        text vessel_type?
        integer average_mtbf?
        integer average_mttr?
        jsonb typical_failure_modes?
    }
    insight_reports {
        character varying id PK
        character varying org_id
        text scope
        timestamp without time zone period_start
        timestamp without time zone period_end
        character varying snapshot_id?
        text llm_summary?
        timestamp without time zone created_at?
    }
    insight_snapshots {
        character varying id PK
        character varying org_id
        text scope
        timestamp without time zone created_at?
        jsonb kpi
        jsonb risks
        jsonb recommendations
        jsonb anomalies
    }
    inventory_parts {
        character varying id PK
        character varying org_id
        text part_number
        text description
        integer current_stock
        integer min_stock_level
        integer max_stock_level
        integer lead_time_days
    }
    j1939_configurations {
        character varying id PK
        character varying org_id
        character varying device_id?
        text name
        text description?
        text can_interface?
        integer baud_rate?
        jsonb mappings
    }
    knowledge_base_items {
        character varying id PK
        character varying org_id
        character varying content_type
        character varying source_id
        character varying title
        text content
        character varying summary?
        jsonb metadata?
    }
    labor_rates {
        character varying id PK
        character varying org_id
        text skill_level
        text position
        real standard_rate
        real overtime_rate
        real emergency_rate
        real contractor_rate
    }
    llm_budget_configs {
        integer id PK
        character varying org_id
        character varying provider?
        real daily_limit?
        real monthly_limit?
        real alert_threshold?
        real current_daily_spend?
        real current_monthly_spend?
    }
    llm_cost_tracking {
        integer id PK
        character varying org_id
        character varying request_id
        character varying provider
        character varying model
        character varying request_type
        character varying report_type?
        character varying audience?
    }
    maintenance_checklist_completions {
        character varying id PK
        character varying work_order_id
        character varying item_id
        timestamp without time zone completed_at?
        character varying completed_by?
        text completed_by_name?
        text status
        boolean passed?
    }
    maintenance_checklist_items {
        character varying id PK
        character varying template_id
        integer step_number
        text title
        text description?
        text category?
        boolean required?
        text image_url?
    }
    maintenance_costs {
        character varying id PK
        text record_id?
        text schedule_id?
        text equipment_id
        text cost_type
        real amount
        text currency
        text description?
    }
    maintenance_records {
        character varying id PK
        text schedule_id
        text equipment_id
        text maintenance_type
        timestamp without time zone actual_start_time?
        timestamp without time zone actual_end_time?
        integer actual_duration?
        text technician?
    }
    maintenance_schedules {
        character varying id PK
        character varying equipment_id
        timestamp without time zone scheduled_date
        text maintenance_type
        integer priority
        integer estimated_duration?
        text description?
        text status
    }
    maintenance_templates {
        character varying id PK
        character varying org_id
        text name
        text description?
        text equipment_type
        text manufacturer?
        text model?
        text maintenance_type
    }
    metrics_history {
        integer id PK
        character varying org_id
        timestamp without time zone recorded_at
        integer active_devices
        real fleet_health
        integer open_work_orders
        integer risk_alerts
        integer total_equipment
    }
    ml_models {
        character varying id PK
        character varying name
        character varying version
        character varying model_type
        character varying target_equipment_type?
        jsonb training_data_features?
        jsonb hyperparameters?
        jsonb performance?
    }
    model_performance_validations {
        integer id PK
        character varying org_id
        character varying model_id
        character varying equipment_id
        integer prediction_id?
        character varying prediction_type
        timestamp with time zone prediction_timestamp
        jsonb predicted_outcome
    }
    mqtt_devices {
        character varying id PK
        character varying device_id
        character varying mqtt_client_id
        character varying broker_endpoint
        character varying topic_prefix
        integer qos_level?
        timestamp with time zone last_seen?
        character varying connection_status?
    }
    oil_analysis {
        character varying id PK
        character varying org_id
        character varying equipment_id
        timestamp without time zone sample_date
        character varying sample_location?
        real service_hours?
        real viscosity_40c?
        real viscosity_100c?
    }
    oil_change_records {
        character varying id PK
        character varying org_id
        character varying equipment_id
        timestamp without time zone change_date
        integer service_hours?
        character varying oil_type?
        character varying oil_grade?
        real quantity_liters?
    }
    operating_condition_alerts {
        character varying id PK
        character varying org_id
        character varying equipment_id
        character varying parameter_id
        text parameter_name
        real current_value
        real optimal_min?
        real optimal_max?
    }
    operating_parameters {
        character varying id PK
        character varying org_id
        text equipment_type
        text manufacturer?
        text model?
        text parameter_name
        text parameter_type
        text unit
    }
    ops_db_staged {
        integer id PK
        text url?
        timestamp without time zone created_at?
    }
    optimization_results {
        character varying id PK
        character varying org_id
        text configuration_id
        text run_status
        timestamp without time zone start_time?
        timestamp without time zone end_time?
        integer execution_time_ms?
        text equipment_scope?
    }
    optimizer_configurations {
        character varying id PK
        character varying org_id
        text name
        text algorithm_type
        boolean enabled?
        text config
        integer max_scheduling_horizon?
        real cost_weight_factor?
    }
    organizations {
        character varying id PK
        text name
        text slug
        text domain?
        text billing_email?
        integer max_users?
        integer max_equipment?
        text subscription_tier
    }
    part_failure_history {
        character varying id PK
        character varying org_id
        character varying part_id
        character varying equipment_id
        character varying supplier_id?
        character varying work_order_id?
        timestamp without time zone failure_date
        timestamp without time zone install_date?
    }
    part_substitutions {
        character varying id PK
        character varying org_id
        text primary_part_no
        text alternate_part_no
        text substitution_type?
        text notes?
        timestamp without time zone created_at?
    }
    parts {
        character varying id PK
        character varying org_id
        text part_no
        text name
        text description?
        text category?
        text unit_of_measure
        real min_stock_qty?
    }
    parts_inventory {
        character varying id PK
        character varying org_id
        text part_number
        text part_name
        text description?
        text category
        text manufacturer?
        real unit_cost
    }
    pdm_alerts {
        integer id PK
        character varying org_id
        character varying vessel_name
        character varying asset_id
        character varying asset_class
        character varying feature
        real value
        real score_z
    }
    pdm_baseline {
        integer id PK
        character varying org_id
        character varying vessel_name
        character varying asset_id
        character varying asset_class
        character varying feature
        real mu
        real sigma
    }
    pdm_score_logs {
        character varying id PK
        timestamp without time zone ts?
        character varying equipment_id
        real health_idx?
        real p_fail_30d?
        timestamp without time zone predicted_due_date?
        jsonb context_json?
        character varying org_id
    }
    performance_metrics {
        character varying id PK
        text equipment_id
        timestamp without time zone metric_date
        real efficiency?
        real reliability?
        real availability?
        real mtbf_hours?
        real mttr_hours?
    }
    port_call {
        character varying id PK
        character varying vessel_id
        text port
        timestamp without time zone start
        timestamp without time zone end
        text status?
        timestamp without time zone created_at?
    }
    prediction_feedback {
        integer id PK
        character varying org_id
        integer prediction_id
        character varying prediction_type
        character varying equipment_id
        character varying user_id
        character varying feedback_type
        integer rating?
    }
    purchase_order_items {
        character varying id PK
        character varying po_id
        character varying part_id
        real quantity
        real unit_price
        real total_price
        real received_quantity?
        text notes?
    }
    purchase_orders {
        character varying id PK
        character varying org_id
        character varying supplier_id
        text order_number
        timestamp without time zone expected_date?
        real total_amount?
        text currency?
        text status
    }
    rag_search_queries {
        character varying id PK
        character varying org_id
        text query
        character varying search_type
        jsonb filters?
        integer result_count?
        integer execution_time_ms?
        ARRAY result_ids?
    }
    raw_telemetry {
        character varying id PK
        text vessel
        timestamp without time zone ts
        text src
        text sig
        real value?
        text unit?
        timestamp without time zone created_at?
    }
    replay_incoming {
        character varying id PK
        text device_id?
        text endpoint?
        text key?
        timestamp without time zone received_at?
    }
    request_idempotency {
        text key PK
        text endpoint
        text method
        integer response_status?
        text response_body?
        timestamp without time zone created_at?
        timestamp without time zone expires_at
    }
    reservations {
        character varying id PK
        character varying org_id
        character varying part_id
        character varying work_order_id
        real quantity
        text reserved_by?
        timestamp without time zone expires_at?
        text status
    }
    resource_constraints {
        character varying id PK
        character varying org_id
        text resource_type
        text resource_id
        text resource_name
        text availability_window
        integer max_concurrent_tasks?
        real cost_per_hour?
    }
    retraining_triggers {
        integer id PK
        character varying org_id
        character varying model_id
        character varying equipment_type?
        character varying trigger_type
        text trigger_reason
        jsonb trigger_metrics
        jsonb current_performance?
    }
    rul_fit_history {
        character varying id PK
        character varying org_id
        text model_id
        real shape_k
        real scale_lambda
        integer training_size?
        real goodness_of_fit?
        timestamp without time zone fitted_at?
    }
    rul_models {
        character varying id PK
        character varying org_id
        text model_id
        text component_class
        text equipment_type?
        real shape_k
        real scale_lambda
        real confidence_lo?
    }
    schedule_assignments {
        character varying id PK
        character varying run_id
        character varying org_id
        character varying date
        character varying shift_id
        character varying crew_id
        character varying vessel_id?
        timestamp without time zone start
    }
    schedule_optimizations {
        character varying id PK
        character varying org_id
        text optimization_result_id
        text equipment_id
        text current_schedule_id?
        timestamp without time zone recommended_schedule_date
        text recommended_maintenance_type
        integer recommended_priority
    }
    schedule_unfilled {
        character varying id PK
        character varying run_id
        character varying org_id
        character varying day
        character varying shift_id
        integer need
        character varying reason
        timestamp without time zone created_at?
    }
    scheduler_runs {
        character varying id PK
        character varying org_id
        timestamp without time zone started_at
        timestamp without time zone finished_at?
        character varying mode
        character varying input_hash
        jsonb stats?
        boolean success?
    }
    sensor_configurations {
        character varying id PK
        character varying org_id
        text equipment_id
        text sensor_type
        boolean enabled?
        real sample_rate_hz?
        real gain?
        real offset?
    }
    sensor_mapping {
        character varying id PK
        character varying org_id
        text vessel_id
        text source_id
        text signal_id
        text sensor_type_id
        text equipment_id?
        text preferred_unit?
    }
    sensor_states {
        character varying id PK
        character varying org_id
        text equipment_id
        text sensor_type
        real last_value?
        real ema?
        timestamp without time zone last_ts?
        timestamp without time zone updated_at?
    }
    sensor_thresholds {
        character varying id PK
        character varying org_id
        character varying device_id
        text sensor_type
        jsonb rule
        real min_value?
        real max_value?
        real warning_threshold?
    }
    sensor_types {
        text id PK
        text name
        text category
        text default_unit
        jsonb units
        text description?
        real min_value?
        real max_value?
    }
    serial_port_states {
        character varying id PK
        character varying org_id
        character varying device_id
        text port_path
        text port_type
        text protocol?
        integer baud_rate?
        text parity?
    }
    sheet_lock {
        text sheet_key PK
        text token?
        text holder?
        timestamp without time zone expires_at?
        timestamp without time zone created_at?
    }
    sheet_version {
        text sheet_key PK
        integer version?
        timestamp without time zone last_modified?
        text last_modified_by?
    }
    shift_template {
        character varying id PK
        character varying vessel_id?
        text equipment_id?
        text role
        text start
        text end
        real duration_h
        text required_skills?
    }
    skills {
        character varying id PK
        character varying org_id
        text name
        text category?
        text description?
        integer max_level?
        boolean active?
        timestamp without time zone created_at?
    }
    stock {
        character varying id PK
        character varying org_id
        text part_no
        text location
        real quantity_on_hand?
        real quantity_reserved?
        real quantity_on_order?
        timestamp without time zone last_count_date?
    }
    storage_config {
        character varying id PK
        character varying kind
        character varying provider
        boolean is_default?
        boolean mirror?
        jsonb cfg
        timestamp without time zone created_at?
        timestamp without time zone updated_at?
    }
    suppliers {
        character varying id PK
        character varying org_id
        text name
        text code
        jsonb contact_info?
        integer lead_time_days?
        real quality_rating?
        text payment_terms?
    }
    sync_conflicts {
        character varying id PK
        character varying org_id
        character varying table_name
        character varying record_id
        character varying field_name?
        text local_value?
        integer local_version?
        timestamp without time zone local_timestamp?
    }
    sync_journal {
        character varying id PK
        text entity_type
        character varying entity_id
        text operation
        jsonb payload?
        character varying user_id?
        timestamp without time zone created_at?
        text sync_status?
    }
    sync_outbox {
        character varying id PK
        text event_type
        jsonb payload?
        boolean processed?
        integer processing_attempts?
        timestamp without time zone created_at?
        timestamp without time zone processed_at?
    }
    system_settings {
        character varying id PK
        boolean hmac_required?
        integer max_payload_bytes?
        boolean strict_units?
        boolean llm_enabled?
        text llm_model?
        text openai_api_key?
        integer ai_insights_throttle_minutes?
    }
    telemetry_aggregates {
        integer id PK
        character varying org_id
        character varying equipment_id
        character varying sensor_type
        character varying time_window
        timestamp with time zone window_start
        timestamp with time zone window_end
        real avg_value?
    }
    telemetry_retention_policies {
        integer id PK
        integer retention_days?
        boolean rollup_enabled?
        text rollup_bucket?
        boolean compression_enabled?
        integer compression_after_days?
        timestamp without time zone updated_at?
    }
    telemetry_rollups {
        character varying id PK
        character varying org_id
        text equipment_id
        text sensor_type
        timestamp without time zone bucket
        text bucket_size
        real avg_value?
        real min_value?
    }
    threshold_optimizations {
        integer id PK
        character varying org_id
        character varying equipment_id
        character varying sensor_type
        timestamp with time zone optimization_timestamp?
        jsonb current_thresholds?
        jsonb optimized_thresholds?
        jsonb improvement_metrics?
    }
    transport_failovers {
        character varying id PK
        character varying org_id
        character varying device_id
        text from_transport
        text to_transport
        text reason
        timestamp without time zone failed_at?
        timestamp without time zone recovered_at?
    }
    transport_settings {
        character varying id PK
        boolean enable_http_ingest?
        boolean enable_mqtt_ingest?
        text mqtt_host?
        integer mqtt_port?
        text mqtt_user?
        text mqtt_pass?
        text mqtt_topic?
    }
    update_settings {
        character varying id PK
        character varying org_id
        character varying vessel_id?
        boolean auto_update_enabled?
        boolean auto_update_critical_only?
        character varying update_channel?
        integer check_interval?
        character varying maintenance_window_start?
    }
    users {
        character varying id PK
        character varying org_id
        text email
        text name
        text role
        boolean is_active?
        timestamp without time zone last_login_at?
        timestamp without time zone created_at?
    }
    vessels {
        character varying id PK
        character varying org_id
        text name
        text imo?
        text flag?
        text vessel_type?
        integer dwt?
        integer year_built?
    }
    vibration_analysis {
        character varying id PK
        character varying org_id
        character varying equipment_id
        real sample_rate
        real shaft_rpm?
        text window_type
        jsonb raw_data
        jsonb spectrum_data
    }
    vibration_features {
        character varying id PK
        character varying org_id
        text equipment_id
        character varying vessel_id?
        timestamp without time zone timestamp?
        real rpm?
        real rms?
        real crest_factor?
    }
    wear_particle_analysis {
        character varying id PK
        character varying org_id
        character varying equipment_id
        integer pq_index?
        integer d_index?
        integer large_particles?
        integer small_particles?
        integer cutting_particles?
    }
    weather_cache {
        character varying id PK
        character varying vessel_id
        character varying org_id
        real latitude
        real longitude
        real temperature?
        real humidity?
        real pressure?
    }
    weibull_estimates {
        character varying id PK
        character varying org_id
        character varying equipment_id
        real current_age_days
        jsonb sample_data
        real shape_parameter
        real scale_parameter
        text fitting_method
    }
    work_order_checklists {
        character varying id PK
        character varying org_id
        character varying work_order_id
        text template_name
        text checklist_items
        text completed_items
        real completion_rate?
        text completed_by?
    }
    work_order_completions {
        character varying id PK
        character varying org_id
        character varying work_order_id
        character varying equipment_id
        character varying vessel_id?
        timestamp without time zone completed_at
        character varying completed_by?
        text completed_by_name?
    }
    work_order_parts {
        character varying id PK
        character varying org_id
        character varying work_order_id
        character varying part_id
        integer quantity_used
        real unit_cost
        real total_cost
        text used_by
    }
    work_order_worklogs {
        character varying id PK
        character varying org_id
        character varying work_order_id
        text technician_name
        timestamp without time zone start_time
        timestamp without time zone end_time?
        integer duration_minutes?
        text description
    }
    work_orders {
        character varying id PK
        character varying equipment_id
        text status
        integer priority
        text reason?
        timestamp without time zone created_at?
        text description?
        character varying org_id
    }
    admin_sessions }|--|| users : "user_id"
    admin_system_settings }|--|| users : "updated_by"
    alert_configurations }|--|| organizations : "org_id"
    alert_configurations }|--|| equipment : "equipment_id"
    alert_notifications }|--|| organizations : "org_id"
    alert_notifications }|--|| equipment : "equipment_id"
    anomaly_detections }|--|| ml_models : "model_id"
    beast_mode_config }|--|| organizations : "org_id"
    calibration_cache }|--|| organizations : "org_id"
    calibration_curves }|--|| organizations : "org_id"
    compliance_bundles }|--|| organizations : "org_id"
    context_events }|--|| organizations : "org_id"
    context_events }|--|| vessels : "vessel_id"
    context_events }|--|| equipment : "equipment_id"
    cost_savings }|--|| organizations : "org_id"
    cost_savings }|--|| work_orders : "work_order_id"
    cost_savings }|--|| equipment : "equipment_id"
    cost_savings }|--|| vessels : "vessel_id"
    cost_savings }|--|| failure_predictions : "prediction_id"
    crew }|--|| organizations : "org_id"
    crew }|--|| vessels : "vessel_id"
    crew_assignment }|--|| shift_template : "shift_id"
    crew_assignment }|--|| crew : "crew_id"
    crew_assignment }|--|| vessels : "vessel_id"
    crew_cert }|--|| crew : "crew_id"
    crew_leave }|--|| crew : "crew_id"
    crew_rest_day }|--|| crew_rest_sheet : "sheet_id"
    crew_rest_sheet }|--|| vessels : "vessel_id"
    crew_rest_sheet }|--|| crew : "crew_id"
    crew_skill }|--|| crew : "crew_id"
    devices }|--|| organizations : "org_id"
    devices }|--|| equipment : "equipment_id"
    digital_twins }|--|| vessels : "vessel_id"
    discovered_signals }|--|| organizations : "org_id"
    downtime_events }|--|| organizations : "org_id"
    downtime_events }|--|| work_orders : "work_order_id"
    downtime_events }|--|| equipment : "equipment_id"
    downtime_events }|--|| vessels : "vessel_id"
    drydock_window }|--|| vessels : "vessel_id"
    dtc_faults }|--|| organizations : "org_id"
    dtc_faults }|--|| equipment : "equipment_id"
    dtc_faults }|--|| devices : "device_id"
    edge_diagnostic_logs }|--|| organizations : "org_id"
    edge_diagnostic_logs }|--|| devices : "device_id"
    edge_diagnostic_logs }|--|| equipment : "equipment_id"
    edge_heartbeats }|--|| devices : "device_id"
    equipment }|--|| organizations : "org_id"
    equipment }|--|| vessels : "vessel_id"
    equipment_telemetry }|--|| organizations : "org_id"
    equipment_telemetry }|--|| equipment : "equipment_id"
    error_logs }|--|| organizations : "org_id"
    failure_history }|--|| organizations : "org_id"
    failure_history }|--|| equipment : "equipment_id"
    feature_importances }|--|| organizations : "org_id"
    feature_importances }|--|| equipment : "equipment_id"
    insight_reports }|--|| organizations : "org_id"
    insight_reports }|--|| insight_snapshots : "snapshot_id"
    insight_snapshots }|--|| organizations : "org_id"
    inventory_parts }|--|| organizations : "org_id"
    j1939_configurations }|--|| organizations : "org_id"
    j1939_configurations }|--|| devices : "device_id"
    llm_budget_configs }|--|| organizations : "org_id"
    llm_cost_tracking }|--|| organizations : "org_id"
    llm_cost_tracking }|--|| vessels : "vessel_id"
    llm_cost_tracking }|--|| equipment : "equipment_id"
    maintenance_checklist_completions }|--|| work_orders : "work_order_id"
    maintenance_checklist_completions }|--|| maintenance_checklist_items : "item_id"
    maintenance_checklist_items }|--|| maintenance_templates : "template_id"
    maintenance_schedules }|--|| organizations : "org_id"
    maintenance_schedules }|--|| equipment : "equipment_id"
    maintenance_schedules }|--|| vessels : "vessel_id"
    maintenance_templates }|--|| organizations : "org_id"
    metrics_history }|--|| organizations : "org_id"
    ml_models }|--|| organizations : "org_id"
    model_performance_validations }|--|| organizations : "org_id"
    model_performance_validations }|--|| ml_models : "model_id"
    model_performance_validations }|--|| equipment : "equipment_id"
    mqtt_devices }|--|| devices : "device_id"
    oil_change_records }|--|| oil_analysis : "drained_oil_analysis_id"
    operating_condition_alerts }|--|| organizations : "org_id"
    operating_condition_alerts }|--|| equipment : "equipment_id"
    operating_condition_alerts }|--|| operating_parameters : "parameter_id"
    operating_parameters }|--|| organizations : "org_id"
    part_failure_history }|--|| organizations : "org_id"
    part_failure_history }|--|| parts_inventory : "part_id"
    part_failure_history }|--|| equipment : "equipment_id"
    part_failure_history }|--|| suppliers : "supplier_id"
    part_failure_history }|--|| work_orders : "work_order_id"
    part_substitutions }|--|| organizations : "org_id"
    parts }|--|| organizations : "org_id"
    parts }|--|| suppliers : "primary_supplier_id"
    parts_inventory }|--|| organizations : "org_id"
    pdm_score_logs }|--|| organizations : "org_id"
    pdm_score_logs }|--|| equipment : "equipment_id"
    port_call }|--|| vessels : "vessel_id"
    prediction_feedback }|--|| organizations : "org_id"
    prediction_feedback }|--|| equipment : "equipment_id"
    retraining_triggers }|--|| organizations : "org_id"
    retraining_triggers }|--|| ml_models : "model_id"
    retraining_triggers }|--|| ml_models : "new_model_id"
    rul_fit_history }|--|| organizations : "org_id"
    rul_models }|--|| organizations : "org_id"
    schedule_assignments }|--|| scheduler_runs : "run_id"
    schedule_unfilled }|--|| scheduler_runs : "run_id"
    sensor_configurations }|--|| organizations : "org_id"
    sensor_mapping }|--|| organizations : "org_id"
    sensor_mapping }|--|| sensor_types : "sensor_type_id"
    sensor_states }|--|| organizations : "org_id"
    serial_port_states }|--|| organizations : "org_id"
    serial_port_states }|--|| devices : "device_id"
    shift_template }|--|| vessels : "vessel_id"
    skills }|--|| organizations : "org_id"
    stock }|--|| organizations : "org_id"
    stock }|--|| parts : "part_id"
    stock }|--|| suppliers : "supplier_id"
    suppliers }|--|| organizations : "org_id"
    sync_conflicts }|--|| organizations : "org_id"
    telemetry_rollups }|--|| organizations : "org_id"
    transport_failovers }|--|| organizations : "org_id"
    transport_failovers }|--|| devices : "device_id"
    update_settings }|--|| organizations : "org_id"
    update_settings }|--|| vessels : "vessel_id"
    users }|--|| organizations : "org_id"
    vessels }|--|| organizations : "org_id"
    vibration_analysis }|--|| organizations : "org_id"
    vibration_analysis }|--|| equipment : "equipment_id"
    vibration_features }|--|| organizations : "org_id"
    vibration_features }|--|| vessels : "vessel_id"
    weather_cache }|--|| vessels : "vessel_id"
    weather_cache }|--|| organizations : "org_id"
    weibull_estimates }|--|| organizations : "org_id"
    weibull_estimates }|--|| equipment : "equipment_id"
    work_order_checklists }|--|| organizations : "org_id"
    work_order_checklists }|--|| work_orders : "work_order_id"
    work_order_completions }|--|| organizations : "org_id"
    work_order_completions }|--|| work_orders : "work_order_id"
    work_order_completions }|--|| equipment : "equipment_id"
    work_order_completions }|--|| vessels : "vessel_id"
    work_order_completions }|--|| maintenance_schedules : "maintenance_schedule_id"
    work_order_parts }|--|| organizations : "org_id"
    work_order_parts }|--|| work_orders : "work_order_id"
    work_order_parts }|--|| parts_inventory : "part_id"
    work_order_worklogs }|--|| organizations : "org_id"
    work_order_worklogs }|--|| work_orders : "work_order_id"
    work_orders }|--|| organizations : "org_id"
    work_orders }|--|| equipment : "equipment_id"
    work_orders }|--|| vessels : "vessel_id"
```
