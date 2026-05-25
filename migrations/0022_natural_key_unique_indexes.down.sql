-- Reverse migration for 0022_natural_key_unique_indexes.sql
-- Drops the unique natural-key indexes added in the forward
-- migration. Safe to re-run.

DROP INDEX IF EXISTS uq_parts_inventory_org_part_number;
DROP INDEX IF EXISTS uq_inventory_parts_org_part_number;
DROP INDEX IF EXISTS uq_maintenance_templates_org_name_eqtype;
