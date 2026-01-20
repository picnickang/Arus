-- PostgreSQL Row-Level Security Policies for Multi-Tenant Data Isolation
-- This file adds database-level security to prevent cross-tenant data access
-- Even if application code has bugs, the database will enforce org boundaries

-- Enable RLS on critical tables
ALTER TABLE vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdm_score_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;

-- Create security policies for vessels
-- SECURITY: Deny all access if app.current_org_id is not set (NULL check prevents bypass)
CREATE POLICY tenant_isolation_vessels ON vessels
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true)
  );

CREATE POLICY tenant_isolation_vessels_insert ON vessels
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true)
  );

-- Create security policies for equipment
CREATE POLICY tenant_isolation_equipment ON equipment
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true)
  );

CREATE POLICY tenant_isolation_equipment_insert ON equipment
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true)
  );

-- Create security policies for devices
CREATE POLICY tenant_isolation_devices ON devices
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true)
  );

CREATE POLICY tenant_isolation_devices_insert ON devices
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true)
  );

-- Create security policies for work_orders
CREATE POLICY tenant_isolation_work_orders ON work_orders
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true)
  );

CREATE POLICY tenant_isolation_work_orders_insert ON work_orders
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true)
  );

-- Create security policies for parts_inventory
CREATE POLICY tenant_isolation_parts_inventory ON parts_inventory
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_parts_inventory_insert ON parts_inventory
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Create security policies for crew
CREATE POLICY tenant_isolation_crew ON crew
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_crew_insert ON crew
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Create security policies for ml_models
CREATE POLICY tenant_isolation_ml_models ON ml_models
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_ml_models_insert ON ml_models
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Create security policies for failure_predictions
CREATE POLICY tenant_isolation_failure_predictions ON failure_predictions
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_failure_predictions_insert ON failure_predictions
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Create security policies for equipment_telemetry
CREATE POLICY tenant_isolation_equipment_telemetry ON equipment_telemetry
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_equipment_telemetry_insert ON equipment_telemetry
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Create security policies for edge_heartbeats
CREATE POLICY tenant_isolation_edge_heartbeats ON edge_heartbeats
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_edge_heartbeats_insert ON edge_heartbeats
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Create security policies for pdm_score_logs
CREATE POLICY tenant_isolation_pdm_score_logs ON pdm_score_logs
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_pdm_score_logs_insert ON pdm_score_logs
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Create security policies for users
CREATE POLICY tenant_isolation_users ON users
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_users_insert ON users
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Create security policies for maintenance_schedules
CREATE POLICY tenant_isolation_maintenance_schedules ON maintenance_schedules
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_maintenance_schedules_insert ON maintenance_schedules
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Create security policies for maintenance_records
CREATE POLICY tenant_isolation_maintenance_records ON maintenance_records
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_maintenance_records_insert ON maintenance_records
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Create security policies for alert_configurations
CREATE POLICY tenant_isolation_alert_configurations ON alert_configurations
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_alert_configurations_insert ON alert_configurations
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Create security policies for alert_notifications
CREATE POLICY tenant_isolation_alert_notifications ON alert_notifications
  USING (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_alert_notifications_insert ON alert_notifications
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NOT NULL 
    AND org_id = current_setting('app.current_org_id', true));

-- Instructions for applying:
-- 1. Connect to your PostgreSQL database
-- 2. Run: psql -d your_database < server/db-security-policies.sql
-- 3. Verify: SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- NOTE: Row-Level Security requires setting app.current_org_id before queries
-- This is done in the application middleware - see server/middleware/db-context.ts
