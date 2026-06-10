-- 0041 down — revert financial columns to real (float4)
--
-- Precision beyond float4's ~7 significant digits is lost on the way
-- back; acceptable for a rollback to the pre-0041 state.

DO $$
DECLARE
  spec RECORD;
  clauses TEXT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('work_orders', ARRAY[
        'estimated_cost_per_hour','actual_cost_per_hour','total_parts_cost',
        'total_labor_cost','total_cost','downtime_cost_per_hour','labor_cost'
      ]),
      ('work_order_worklogs', ARRAY['labor_cost_per_hour','total_labor_cost']),
      ('work_order_parts', ARRAY['unit_cost','total_cost','actual_cost']),
      ('work_order_completions', ARRAY[
        'total_cost','total_parts_cost','total_labor_cost','labor_cost','parts_cost'
      ]),
      ('maintenance_costs', ARRAY['amount']),
      ('labor_rates', ARRAY['standard_rate','overtime_rate','emergency_rate','contractor_rate']),
      ('expenses', ARRAY['amount']),
      ('cost_model', ARRAY[
        'labor_rate_per_hour','downtime_per_hour','fuel_cost_per_liter',
        'inspection_cost_per_hour','emergency_multiplier'
      ]),
      ('cost_savings', ARRAY[
        'actual_cost','avoided_cost','total_savings','labor_savings',
        'parts_savings','downtime_savings','downtime_cost_per_hour',
        'emergency_labor_multiplier','emergency_parts_multiplier'
      ]),
      ('crew', ARRAY['hourly_rate','contract_penalty']),
      ('crew_employment_history', ARRAY['contract_penalty']),
      ('equipment', ARRAY[
        'purchase_value','salvage_value','downtime_cost_per_hour',
        'emergency_labor_multiplier','emergency_parts_multiplier','emergency_downtime_multiplier'
      ]),
      ('equipment_lifecycle', ARRAY['replacement_cost']),
      ('equipment_decommission_events', ARRAY['book_value_at_removal','residual_value']),
      ('parts', ARRAY['standard_cost','min_stock_qty','max_stock_qty']),
      ('parts_inventory', ARRAY['unit_cost']),
      ('parts_inventory_suppliers', ARRAY['unit_cost']),
      ('stock', ARRAY[
        'unit_cost','quantity_on_hand','quantity_reserved','quantity_on_order',
        'reorder_point','max_quantity'
      ]),
      ('purchase_orders', ARRAY['total_amount']),
      ('purchase_order_items', ARRAY['unit_price','total_price','quantity','received_quantity']),
      ('purchase_request_items', ARRAY['quantity','rob_snapshot','quantity_fulfilled']),
      ('item_suppliers', ARRAY['unit_cost']),
      ('service_requests', ARRAY['estimated_cost']),
      ('service_orders', ARRAY['quoted_amount','actual_amount','revised_amount']),
      ('reservations', ARRAY['quantity']),
      ('organizations', ARRAY[
        'emergency_labor_multiplier','emergency_parts_multiplier','emergency_downtime_multiplier'
      ])
    ) AS t(tbl, cols)
  LOOP
    SELECT string_agg(
        format('ALTER COLUMN %I TYPE real USING %I::real', c.column_name, c.column_name),
        ', '
      )
      INTO clauses
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.tbl
      AND c.column_name = ANY(spec.cols)
      AND c.data_type = 'numeric';

    IF clauses IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ', spec.tbl) || clauses;
    END IF;
  END LOOP;
END $$;
