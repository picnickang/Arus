-- 0041 — Financial columns: real (float4) -> numeric
--
-- Money, quantity, and cost-multiplier columns were stored as IEEE-754
-- floats, accumulating rounding error in cost rollups, purchasing totals,
-- and inventory accounting. Converted by bucket:
--   * money       -> numeric(12,2)   (costs, prices, rates, amounts, savings)
--   * quantities  -> numeric(12,3)   (stock levels, order quantities — exact
--                                     fractional units: litres, metres)
--   * multipliers -> numeric(6,3)    (emergency cost multipliers — they
--                                     multiply money)
--
-- Deliberately LEFT as real (measurements/statistics, where float is the
-- semantically right type): hours/durations (estimated/actual/downtime/
-- labor hours, mtbf/mttr, operating/service-life hours), scores & ratios
-- (roi, completion_rate, quality_score/rating, defect_rate,
-- demand_variability, confidence_score, efficiency/reliability/
-- availability, fleet_health, depreciation_rate), llm_cost_tracking's
-- token-cost estimates, optimizer planning estimates, the deprecated
-- inventory_parts table, and all telemetry.
--
-- Each table is rewritten ONCE per precision bucket (multi-column ALTER).
-- The information_schema guard converts only columns still 'real', so
-- re-running is a no-op and push-bootstrapped databases (already numeric
-- from the TS schema) are untouched.
--
-- NOTE: ALTER COLUMN TYPE takes an ACCESS EXCLUSIVE lock and rewrites the
-- table. None of these tables are high-volume telemetry, but on a large
-- installation run via `npm run db:migrate:deploy` in a maintenance
-- window rather than MIGRATE_ON_BOOT.

DO $$
DECLARE
  spec RECORD;
  clauses TEXT;
  n_cols INTEGER;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      -- ── money -> numeric(12,2) ──────────────────────────────────────
      ('work_orders', ARRAY[
        'estimated_cost_per_hour','actual_cost_per_hour','total_parts_cost',
        'total_labor_cost','total_cost','downtime_cost_per_hour','labor_cost'
      ], 12, 2),
      ('work_order_worklogs', ARRAY['labor_cost_per_hour','total_labor_cost'], 12, 2),
      ('work_order_parts', ARRAY['unit_cost','total_cost','actual_cost'], 12, 2),
      ('work_order_completions', ARRAY[
        'total_cost','total_parts_cost','total_labor_cost','labor_cost','parts_cost'
      ], 12, 2),
      ('maintenance_costs', ARRAY['amount'], 12, 2),
      ('labor_rates', ARRAY['standard_rate','overtime_rate','emergency_rate','contractor_rate'], 12, 2),
      ('expenses', ARRAY['amount'], 12, 2),
      ('cost_model', ARRAY[
        'labor_rate_per_hour','downtime_per_hour','fuel_cost_per_liter','inspection_cost_per_hour'
      ], 12, 2),
      ('cost_savings', ARRAY[
        'actual_cost','avoided_cost','total_savings','labor_savings',
        'parts_savings','downtime_savings','downtime_cost_per_hour'
      ], 12, 2),
      ('crew', ARRAY['hourly_rate','contract_penalty'], 12, 2),
      ('crew_employment_history', ARRAY['contract_penalty'], 12, 2),
      ('equipment', ARRAY['purchase_value','salvage_value','downtime_cost_per_hour'], 12, 2),
      ('equipment_lifecycle', ARRAY['replacement_cost'], 12, 2),
      ('equipment_decommission_events', ARRAY['book_value_at_removal','residual_value'], 12, 2),
      ('parts', ARRAY['standard_cost'], 12, 2),
      ('parts_inventory', ARRAY['unit_cost'], 12, 2),
      ('parts_inventory_suppliers', ARRAY['unit_cost'], 12, 2),
      ('stock', ARRAY['unit_cost'], 12, 2),
      ('purchase_orders', ARRAY['total_amount'], 12, 2),
      ('purchase_order_items', ARRAY['unit_price','total_price'], 12, 2),
      ('item_suppliers', ARRAY['unit_cost'], 12, 2),
      ('service_requests', ARRAY['estimated_cost'], 12, 2),
      ('service_orders', ARRAY['quoted_amount','actual_amount','revised_amount'], 12, 2),
      -- ── quantities -> numeric(12,3) ─────────────────────────────────
      ('stock', ARRAY[
        'quantity_on_hand','quantity_reserved','quantity_on_order','reorder_point','max_quantity'
      ], 12, 3),
      ('parts', ARRAY['min_stock_qty','max_stock_qty'], 12, 3),
      ('reservations', ARRAY['quantity'], 12, 3),
      ('purchase_order_items', ARRAY['quantity','received_quantity'], 12, 3),
      ('purchase_request_items', ARRAY['quantity','rob_snapshot','quantity_fulfilled'], 12, 3),
      -- ── cost multipliers -> numeric(6,3) ────────────────────────────
      ('organizations', ARRAY[
        'emergency_labor_multiplier','emergency_parts_multiplier','emergency_downtime_multiplier'
      ], 6, 3),
      ('equipment', ARRAY[
        'emergency_labor_multiplier','emergency_parts_multiplier','emergency_downtime_multiplier'
      ], 6, 3),
      ('cost_model', ARRAY['emergency_multiplier'], 6, 3),
      ('cost_savings', ARRAY['emergency_labor_multiplier','emergency_parts_multiplier'], 6, 3)
    ) AS t(tbl, cols, p, s)
  LOOP
    SELECT
      string_agg(
        format('ALTER COLUMN %I TYPE numeric(%s,%s) USING round(%I::numeric, %s)',
               c.column_name, spec.p, spec.s, c.column_name, spec.s),
        ', '
      ),
      count(*)
      INTO clauses, n_cols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.tbl
      AND c.column_name = ANY(spec.cols)
      AND c.data_type = 'real';

    IF clauses IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ', spec.tbl) || clauses;
      RAISE NOTICE '0041: %.{%} -> numeric(%,%) (% column(s))',
        spec.tbl, array_to_string(spec.cols, ','), spec.p, spec.s, n_cols;
    END IF;
  END LOOP;
END $$;
