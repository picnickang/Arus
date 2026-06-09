-- Reverse migration for 0010_add_cost_justification_to_work_orders.sql
-- Drops the work_orders cost-justification column. Idempotent.

ALTER TABLE work_orders DROP COLUMN IF EXISTS cost_justification;
