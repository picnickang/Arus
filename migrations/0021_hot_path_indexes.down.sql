-- Reverse migration for 0021_hot_path_indexes.sql
-- Drops the P1 #15 covering indexes. Performance regresses to the
-- pre-0021 plan (heap scan on vessel-scoped status queries, etc.),
-- but correctness is unaffected. Idempotent.

DROP INDEX IF EXISTS "idx_maintenance_schedules_equipment_date";
DROP INDEX IF EXISTS "idx_alert_notifications_org_equipment_type";
DROP INDEX IF EXISTS "idx_work_orders_org_vessel_status";
