# Schema Audit Report

**Generated:** 2025-11-07T07:00:38.863Z

## Summary

- **Total Tables:** 133
- **Tables with Issues:** 40
- **Tables with Warnings:** 120
- **Critical Issues:** 42
- **Missing orgId:** 40
- **Missing Primary Key:** 2
- **Missing Indexes:** 97

## Recommendations

1. Add org_id to 40 tables for multi-tenant isolation
2. Add primary keys to 2 tables
3. Add performance indexes to 97 tables
4. Review 26 tables with multiple warnings

## Table Details

### admin_audit_events

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 5
- Foreign Keys: 0

### admin_sessions

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: user_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 4
- Foreign Keys: 1

### admin_system_settings

**Warnings:**
- ⚠️ Missing index on FK column: updated_by

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 4
- Foreign Keys: 1

### alert_comments

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### alert_configurations

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 2

### alert_notifications

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 5
- Foreign Keys: 2

### alert_suppressions

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### anomaly_detections

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: model_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 1

### calibration_cache

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 1

### calibration_curves

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 1

### compliance_audit_log

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### compliance_bundles

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### component_degradation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### condition_monitoring

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### content_sources

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### context_events

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: vessel_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 6
- Foreign Keys: 3

### cost_savings

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: work_order_id
- ⚠️ Missing index on FK column: equipment_id
- ⚠️ Missing index on FK column: vessel_id
- ⚠️ Missing index on FK column: prediction_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 5
- Foreign Keys: 5

### crew_assignment

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: shift_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 3

### crew_cert

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: crew_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### crew_leave

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: crew_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### crew_rest_day

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation
- ❌ CRITICAL: Missing primary key

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: sheet_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✗
- Has Timestamps: ✗
- Indexes: 0
- Foreign Keys: 1

### crew_rest_sheet

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 4
- Foreign Keys: 2

### crew_skill

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation
- ❌ CRITICAL: Missing primary key

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: crew_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✗
- Has Timestamps: ✗
- Indexes: 0
- Foreign Keys: 1

### db_schema_version

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### device_registry

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### devices

**Warnings:**
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 2
- Foreign Keys: 2

### digital_twins

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing index on FK column: vessel_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 1

### discovered_signals

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### downtime_events

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: work_order_id
- ⚠️ Missing index on FK column: equipment_id
- ⚠️ Missing index on FK column: vessel_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 5
- Foreign Keys: 4

### drydock_window

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: vessel_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### dtc_definitions

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 3
- Foreign Keys: 0

### dtc_faults

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: equipment_id
- ⚠️ Missing index on FK column: device_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 5
- Foreign Keys: 3

### edge_diagnostic_logs

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: device_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 4
- Foreign Keys: 3

### edge_heartbeats

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: device_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### equipment_lifecycle

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 2
- Foreign Keys: 0

### equipment_telemetry

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 12
- Foreign Keys: 2

### error_logs

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 5
- Foreign Keys: 1

### expenses

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### failure_history

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 5
- Foreign Keys: 2

### failure_predictions

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 4
- Foreign Keys: 0

### feature_importances

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 5
- Foreign Keys: 2

### idempotency_log

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### industry_benchmarks

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 0

### insight_reports

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: snapshot_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 2

### insight_snapshots

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### inventory_parts

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 1

### j1939_configurations

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: device_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 2

### knowledge_base_items

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### labor_rates

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### llm_cost_tracking

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: vessel_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 7
- Foreign Keys: 3

### maintenance_checklist_completions

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: work_order_id
- ⚠️ Missing index on FK column: item_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 4
- Foreign Keys: 2

### maintenance_checklist_items

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: template_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 1

### maintenance_costs

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### maintenance_records

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### maintenance_templates

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 3
- Foreign Keys: 1

### metrics_history

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 2
- Foreign Keys: 1

### ml_models

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 3
- Foreign Keys: 1

### model_performance_validations

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: model_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 7
- Foreign Keys: 3

### mqtt_devices

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing index on FK column: device_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 2
- Foreign Keys: 1

### oil_analysis

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### oil_change_records

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: drained_oil_analysis_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 1

### operating_condition_alerts

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: equipment_id
- ⚠️ Missing index on FK column: parameter_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 5
- Foreign Keys: 3

### operating_parameters

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 3
- Foreign Keys: 1

### ops_db_staged

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### optimization_results

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### optimizer_configurations

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### organizations

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 3
- Foreign Keys: 0

### part_failure_history

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: part_id
- ⚠️ Missing index on FK column: equipment_id
- ⚠️ Missing index on FK column: supplier_id
- ⚠️ Missing index on FK column: work_order_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 5
- Foreign Keys: 5

### part_substitutions

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### parts

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: primary_supplier_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 2

### pdm_alerts

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 2
- Foreign Keys: 0

### pdm_score_logs

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 2
- Foreign Keys: 2

### performance_metrics

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### port_call

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: vessel_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### prediction_feedback

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 6
- Foreign Keys: 2

### purchase_order_items

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### purchase_orders

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### rag_search_queries

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### raw_telemetry

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 2
- Foreign Keys: 0

### replay_incoming

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### request_idempotency

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### reservations

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### resource_constraints

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### retraining_triggers

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: model_id
- ⚠️ Missing index on FK column: new_model_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 6
- Foreign Keys: 3

### rul_fit_history

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### rul_models

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 2
- Foreign Keys: 1

### schedule_assignments

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: run_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 1

### schedule_optimizations

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### schedule_unfilled

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: run_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 1

### scheduler_runs

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 2
- Foreign Keys: 0

### sensor_configurations

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 2
- Foreign Keys: 1

### sensor_mapping

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: sensor_type_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 2

### sensor_states

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 2
- Foreign Keys: 1

### sensor_thresholds

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### sensor_types

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### serial_port_states

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: device_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 2

### sheet_lock

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### sheet_version

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### shift_template

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on FK column: vessel_id

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### skills

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 3
- Foreign Keys: 1

### stock

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: part_id
- ⚠️ Missing index on FK column: supplier_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 3

### storage_config

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### suppliers

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 1

### sync_conflicts

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 1

### sync_outbox

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 2
- Foreign Keys: 0

### system_settings

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### telemetry_aggregates

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 0

### telemetry_retention_policies

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### telemetry_rollups

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 1

### threshold_optimizations

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### transport_failovers

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: device_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 3
- Foreign Keys: 2

### transport_settings

**Issues:**
- ❌ CRITICAL: Missing org_id for multi-tenant isolation

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps

**Info:**
- Has orgId: ✗
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 0

### update_settings

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: vessel_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 2
- Foreign Keys: 2

### users

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 1

### vessels

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 2
- Foreign Keys: 1

### vibration_analysis

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 2

### vibration_features

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: vessel_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 2

### wear_particle_analysis

**Warnings:**
- ⚠️ Missing index on org_id for query performance

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 0

### weather_cache

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: vessel_id
- ⚠️ Missing index on FK column: org_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 3
- Foreign Keys: 2

### weibull_estimates

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: equipment_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 2

### work_order_checklists

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: work_order_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 2

### work_order_completions

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: work_order_id
- ⚠️ Missing index on FK column: equipment_id
- ⚠️ Missing index on FK column: vessel_id
- ⚠️ Missing index on FK column: maintenance_schedule_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 7
- Foreign Keys: 5

### work_order_parts

**Warnings:**
- ⚠️ Missing created_at/updated_at timestamps
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: work_order_id
- ⚠️ Missing index on FK column: part_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✗
- Indexes: 1
- Foreign Keys: 3

### work_order_worklogs

**Warnings:**
- ⚠️ Missing index on org_id for query performance
- ⚠️ Missing index on FK column: org_id
- ⚠️ Missing index on FK column: work_order_id

**Info:**
- Has orgId: ✓
- Has Primary Key: ✓
- Has Timestamps: ✓
- Indexes: 1
- Foreign Keys: 2

