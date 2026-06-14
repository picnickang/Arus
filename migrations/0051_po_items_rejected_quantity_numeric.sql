-- 0051: purchase_order_items.rejected_quantity  integer -> numeric(12,3)
--
-- quantity and received_quantity are numeric(12,3) but rejected_quantity was an
-- integer, so a decimal rejection (e.g. 1.5 units) truncated. Align the type.
-- Idempotent: a no-op when the column is already numeric (fresh db:push DBs).
ALTER TABLE purchase_order_items
  ALTER COLUMN rejected_quantity TYPE numeric(12, 3) USING rejected_quantity::numeric;
ALTER TABLE purchase_order_items
  ALTER COLUMN rejected_quantity SET DEFAULT 0;
