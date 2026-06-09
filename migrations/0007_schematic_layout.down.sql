-- Reverse migration for 0007_schematic_layout.sql
-- Drops the per-vessel schematic layout column. Idempotent.

ALTER TABLE vessels DROP COLUMN IF EXISTS schematic_layout;
