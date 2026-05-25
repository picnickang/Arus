-- Reverse migration for 0023_fk_cascade_strategy.sql
-- Restores the two FKs to the Postgres default NO ACTION (RESTRICT).
-- Uses the same conkey/relname metadata match as the up-migration so
-- the wrong constraint can never be dropped. Idempotent.

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
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id);

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
    FOREIGN KEY (pr_id) REFERENCES purchase_requests(id);
END $$;
