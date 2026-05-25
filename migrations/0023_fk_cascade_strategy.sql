-- P2 #16 — FK CASCADE strategy
--
-- Product decision (May 2026):
--   * CASCADE only for exclusive child-owned rows (line items,
--     attachments, generated child records, join rows).
--   * RESTRICT (or leave the Postgres default NO ACTION) for audit
--     logs, compliance records, telemetry history, financial records,
--     and cross-aggregate references that must preserve history.
--
-- Audit of every FK in shared/schema/**:
--   * Already CASCADE (no change required, listed for traceability):
--       work_order_parts.work_order_id, work_order_items.work_order_id,
--       deck_log_entries|watches|observations|hourly_vitals.*_id,
--       engine_log_parameters|events|watches|fluid_levels.*_id,
--       vessel_certificate_files.vessel_certificate_id,
--       model_outcomes.model_id, model_predictions.model_version_id,
--       training_jobs.model_version_id (set null).
--   * Already RESTRICT (Postgres NO ACTION default, no change):
--       work_orders.{equipment_id,vessel_id}, alerts.equipment_id,
--       crew.vessel_id, vessel_3d_models.vessel_id,
--       maintenance_records.oil_analysis_id,
--       equipment_health_history.{lastOilAnalysisId,lastWearAnalysisId},
--       oil_change_history.drained_oil_analysis_id,
--       prediction_audit_log.model_id,
--       prediction_outcome_history.model_id,
--       maintenance_checklist_completions.* (compliance — proof of
--       checklist execution, history must survive item deletion).
--   * Promoted to CASCADE by this migration (exclusive line items):
--       purchase_order_items.po_id  -> purchase_orders.id
--       purchase_request_items.pr_id -> purchase_requests.id
--
-- The PO and PR header rows have no value without their line items;
-- deleting a PO/PR should atomically remove its items (currently
-- requires manual delete-then-delete or fails on FK violation).
-- All other line-item / generated-child FKs were already CASCADE,
-- so this migration only touches the two missing cases.
--
-- Defensive name lookup: tables created via drizzle-kit push may
-- carry either the explicit `_fk` suffix or the postgres default
-- `_fkey` suffix depending on when they were generated, so we look
-- up the existing constraint by (conrelid, confrelid, conkey)
-- rather than by name. Re-running is safe — if the constraint is
-- already CASCADE we drop+recreate identically.

DO $$
DECLARE
  con_name TEXT;
BEGIN
  -- purchase_order_items.po_id -> purchase_orders.id
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class r  ON r.oid = c.conrelid
  JOIN pg_class rr ON rr.oid = c.confrelid
  WHERE c.contype = 'f'
    AND r.relname = 'purchase_order_items'
    AND rr.relname = 'purchase_orders'
    AND c.conkey = (
      SELECT array_agg(a.attnum ORDER BY a.attnum)
      FROM pg_attribute a
      WHERE a.attrelid = r.oid AND a.attname = 'po_id'
    );
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE purchase_order_items DROP CONSTRAINT %I', con_name);
  END IF;
  ALTER TABLE purchase_order_items
    ADD CONSTRAINT purchase_order_items_po_id_purchase_orders_id_fk
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;

  -- purchase_request_items.pr_id -> purchase_requests.id
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class r  ON r.oid = c.conrelid
  JOIN pg_class rr ON rr.oid = c.confrelid
  WHERE c.contype = 'f'
    AND r.relname = 'purchase_request_items'
    AND rr.relname = 'purchase_requests'
    AND c.conkey = (
      SELECT array_agg(a.attnum ORDER BY a.attnum)
      FROM pg_attribute a
      WHERE a.attrelid = r.oid AND a.attname = 'pr_id'
    );
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE purchase_request_items DROP CONSTRAINT %I', con_name);
  END IF;
  ALTER TABLE purchase_request_items
    ADD CONSTRAINT purchase_request_items_pr_id_purchase_requests_id_fk
    FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE CASCADE;
END $$;
