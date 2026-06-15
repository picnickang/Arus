-- Down: revert purchase_order_items.rejected_quantity to integer.
-- round() any fractional values so the integer cast can't fail.
ALTER TABLE purchase_order_items
  ALTER COLUMN rejected_quantity TYPE integer USING round(rejected_quantity)::integer;
ALTER TABLE purchase_order_items
  ALTER COLUMN rejected_quantity SET DEFAULT 0;
