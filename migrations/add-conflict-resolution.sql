-- ARUS Marine Conflict Resolution Schema Migration
-- Phase 1: Add version tracking to critical tables

-- 1. sensor_configurations (already updated in schema.ts)
ALTER TABLE sensor_configurations 
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_modified_device VARCHAR(255);

-- 2. alert_configurations (already updated in schema.ts)
ALTER TABLE alert_configurations
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_modified_device VARCHAR(255);

-- 3. operating_parameters
ALTER TABLE operating_parameters
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_modified_device VARCHAR(255);

-- 4. work_orders
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_modified_device VARCHAR(255);

-- 5. equipment
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_modified_device VARCHAR(255);

-- 6. crew_assignment
ALTER TABLE crew_assignment
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_modified_device VARCHAR(255);

-- 7. dtc_faults
ALTER TABLE dtc_faults
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_modified_device VARCHAR(255);

-- Create sync_conflicts table for tracking conflicts
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id),
  
  -- Conflict identification
  table_name VARCHAR(255) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  field_name VARCHAR(255),
  
  -- Local (device) values
  local_value TEXT,
  local_version INTEGER,
  local_timestamp TIMESTAMP,
  local_user VARCHAR(255),
  local_device VARCHAR(255),
  
  -- Server values  
  server_value TEXT,
  server_version INTEGER,
  server_timestamp TIMESTAMP,
  server_user VARCHAR(255),
  server_device VARCHAR(255),
  
  -- Resolution
  resolution_strategy VARCHAR(50), -- 'manual', 'max', 'append', 'lww', 'priority', 'or'
  resolved BOOLEAN DEFAULT FALSE,
  resolved_value TEXT,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP,
  
  -- Safety classification
  is_safety_critical BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for unresolved conflicts
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_unresolved 
  ON sync_conflicts(org_id, resolved) WHERE resolved = FALSE;

-- Create index for safety-critical conflicts
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_safety 
  ON sync_conflicts(org_id, is_safety_critical, resolved) 
  WHERE is_safety_critical = TRUE AND resolved = FALSE;

-- Enhance syncJournal for field-level tracking
ALTER TABLE sync_journal
  ADD COLUMN IF NOT EXISTS field_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS old_value TEXT,
  ADD COLUMN IF NOT EXISTS new_value TEXT,
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS version_before INTEGER,
  ADD COLUMN IF NOT EXISTS version_after INTEGER;

-- Create index for field-level queries
CREATE INDEX IF NOT EXISTS idx_sync_journal_field_changes 
  ON sync_journal(entity_type, entity_id, field_name, created_at);

-- Initialize version numbers for existing records
UPDATE sensor_configurations SET version = 1 WHERE version IS NULL;
UPDATE alert_configurations SET version = 1 WHERE version IS NULL;
UPDATE operating_parameters SET version = 1 WHERE version IS NULL;
UPDATE work_orders SET version = 1 WHERE version IS NULL;
UPDATE equipment SET version = 1 WHERE version IS NULL;
UPDATE crew_assignment SET version = 1 WHERE version IS NULL;
UPDATE dtc_faults SET version = 1 WHERE version IS NULL;
