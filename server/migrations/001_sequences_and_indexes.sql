-- ============================================================
-- Migration: Replace MAX()+1 number generation with sequences
-- Improvement #3: Concurrency-safe PO/PR/SO number generation
--
-- Run this migration ONCE before deploying the updated code.
-- After running, the application code will use nextval() instead
-- of the MAX(CAST(...)) pattern.
-- ============================================================

-- Purchase Request sequence
-- Starts from the current MAX to avoid collisions with existing data
DO $$
DECLARE
  current_max INTEGER;
  current_year TEXT := TO_CHAR(NOW(), 'YYYY');
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(request_number FROM 'PR-\d{4}-(\d+)') AS INTEGER)), 0
  ) INTO current_max
  FROM purchase_requests
  WHERE request_number LIKE 'PR-' || current_year || '-%';

  EXECUTE format(
    'CREATE SEQUENCE IF NOT EXISTS pr_number_seq_%s START WITH %s INCREMENT BY 1',
    current_year,
    current_max + 1
  );
END $$;

-- Purchase Order sequence
DO $$
DECLARE
  current_max INTEGER;
  current_year TEXT := TO_CHAR(NOW(), 'YYYY');
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(order_number FROM 'PO-\d{4}-(\d+)') AS INTEGER)), 0
  ) INTO current_max
  FROM purchase_orders
  WHERE order_number LIKE 'PO-' || current_year || '-%';

  EXECUTE format(
    'CREATE SEQUENCE IF NOT EXISTS po_number_seq_%s START WITH %s INCREMENT BY 1',
    current_year,
    current_max + 1
  );
END $$;

-- Service Order sequence (single global sequence, not year-scoped)
DO $$
DECLARE
  current_max INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(so_number FROM 'SO-(\d+)') AS INTEGER)), 0
  ) INTO current_max
  FROM service_orders
  WHERE so_number ~ '^SO-\d+$';

  EXECUTE format(
    'CREATE SEQUENCE IF NOT EXISTS so_number_seq START WITH %s INCREMENT BY 1',
    current_max + 1
  );
END $$;

-- Index to speed up the low-stock query used by replenishment suggestions (#6)
CREATE INDEX IF NOT EXISTS idx_parts_inventory_stock_status
  ON parts_inventory (org_id, quantity_on_hand, min_stock_level)
  WHERE is_active = true;

-- Index for inventory movements audit trail (#2)
CREATE INDEX IF NOT EXISTS idx_inventory_movements_part_org
  ON inventory_movements (org_id, part_id, created_at DESC);

-- Index for PO items linked to a PO (used heavily in receipt flow #10)
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id
  ON purchase_order_items (po_id);

-- Column for rejected quantity on PO items (#6 - partial rejection flow)
ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS rejected_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;

-- Column for cost revision tracking on service orders (#8)
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS revised_amount    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS revision_notes    TEXT,
  ADD COLUMN IF NOT EXISTS revised_at        TIMESTAMPTZ;
