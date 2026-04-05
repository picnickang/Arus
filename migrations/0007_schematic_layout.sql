-- Add schematic_layout JSONB column to vessels table
-- Stores per-vessel configurable zone/slot layout for the vessel cross-section schematic
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS schematic_layout jsonb;
