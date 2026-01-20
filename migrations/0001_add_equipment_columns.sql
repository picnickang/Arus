-- Migration: Add missing equipment columns for schema sync
-- Date: 2026-01-05
-- Purpose: Fix schema mismatch causing dashboard/summary 500 errors

-- Add decommissioning-related columns
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS decommissioned_by varchar(255);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS reinstated_at timestamp;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS reinstated_by varchar(255);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS decommission_status varchar(255) DEFAULT 'active';
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS decommission_event_id varchar(255);

-- Add extended equipment attributes
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS plain_language_name varchar(255);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS system_type varchar(255);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS component_type varchar(255);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS criticality_level varchar(255) DEFAULT 'medium';
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS default_service_provider_id varchar(255);

-- Add financial tracking columns
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchase_value real;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchase_date timestamp;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchase_currency varchar(10) DEFAULT 'USD';
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS service_life_hours real;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS service_life_years real;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS depreciation_method varchar(50) DEFAULT 'straight_line';
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS depreciation_rate real;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS salvage_value real;

-- Add version tracking columns
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS last_modified_by varchar(255);
