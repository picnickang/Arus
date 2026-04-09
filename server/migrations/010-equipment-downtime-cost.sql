-- Migration 010: Add downtime_cost_per_hour to equipment table
-- Allows equipment-level override of the global cost_model downtime rate

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS downtime_cost_per_hour REAL;
