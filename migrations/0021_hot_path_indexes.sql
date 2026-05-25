-- ============================================================================
-- 0021  P1 #15 — hot-path indexes
-- ============================================================================
-- Adds covering composite indexes for the three highest-traffic read paths
-- identified during the P1 readiness audit. All use IF NOT EXISTS so the
-- migration is idempotent and safe to re-apply. We deliberately do NOT use
-- CREATE INDEX CONCURRENTLY here — drizzle-kit wraps migrations in a single
-- transaction by default and CONCURRENTLY is forbidden inside a tx block.
-- These are small tables in the canonical dev/test snapshot; for the
-- production cutover the operator may rerun each statement out-of-band
-- with CONCURRENTLY if the table is large.
--
-- INDEX RATIONALE
--   * work_orders(org_id, vessel_id, status) — the bridge dashboard and
--     vessel-detail "active work" panel both filter by (org, vessel,
--     status='open'|'in_progress'). Existing org_status and vessel
--     indexes leave vessel-scoped status queries doing a heap scan.
--   * alert_notifications(org_id, equipment_id, alert_type) — the per-
--     equipment alert feed groups by alert_type per org. Schema notes
--     that the real table has no `severity` column (the previous design
--     was reconciled away on 2026-05-17), so alert_type is the correct
--     secondary key.
--   * maintenance_schedules(equipment_id, scheduled_date) — the
--     scheduler/today-panel reads upcoming maintenance per equipment
--     ordered by scheduled_date; today there is no supporting index.
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_work_orders_org_vessel_status"
  ON "work_orders" ("org_id", "vessel_id", "status");

CREATE INDEX IF NOT EXISTS "idx_alert_notifications_org_equipment_type"
  ON "alert_notifications" ("org_id", "equipment_id", "alert_type");

CREATE INDEX IF NOT EXISTS "idx_maintenance_schedules_equipment_date"
  ON "maintenance_schedules" ("equipment_id", "scheduled_date");
