/**
 * WO ↔ SO Bridge — Schema Migration
 *
 * Adds the bi-directional link between work orders and service orders:
 *
 * 1. service_orders.work_order_id — FK to work_orders.id (nullable)
 * 2. work_orders status gains "awaiting_service" value
 * 3. Database view: work_orders_with_service_orders (joins for quick lookups)
 *
 * Run this migration AFTER existing tables are in place.
 */

import { sql } from "drizzle-orm";

export async function migrateWorkOrderServiceOrderBridge(db: any) {
  // 1. Add work_order_id column to service_orders if it doesn't exist
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_orders' AND column_name = 'work_order_id'
      ) THEN
        ALTER TABLE service_orders
          ADD COLUMN work_order_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL;

        CREATE INDEX idx_service_orders_work_order_id
          ON service_orders(work_order_id)
          WHERE work_order_id IS NOT NULL;

        COMMENT ON COLUMN service_orders.work_order_id IS
          'FK to originating work order. A WO spawns an SO when external service is needed.';
      END IF;
    END $$;
  `);

  // 2. Add work_order_number column for display (denormalized for search)
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_orders' AND column_name = 'work_order_number'
      ) THEN
        ALTER TABLE service_orders
          ADD COLUMN work_order_number TEXT;

        COMMENT ON COLUMN service_orders.work_order_number IS
          'Denormalized WO number for display and search. Set when work_order_id is assigned.';
      END IF;
    END $$;
  `);

  // 3. Add service_order_count to work_orders for quick badge display
  // (This is a computed column approach — alternatively use a view)
  await db.execute(sql`
    CREATE OR REPLACE VIEW work_orders_with_service_info AS
    SELECT
      wo.*,
      COALESCE(so_agg.service_order_count, 0) AS service_order_count,
      so_agg.service_order_ids,
      so_agg.service_order_numbers,
      so_agg.active_service_orders,
      so_agg.latest_so_status
    FROM work_orders wo
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS service_order_count,
        ARRAY_AGG(so.id) AS service_order_ids,
        ARRAY_AGG(so.so_number) AS service_order_numbers,
        COUNT(*) FILTER (WHERE so.status NOT IN ('completed', 'cancelled'))::int AS active_service_orders,
        (ARRAY_AGG(so.status ORDER BY so.updated_at DESC))[1] AS latest_so_status
      FROM service_orders so
      WHERE so.work_order_id = wo.id
    ) so_agg ON TRUE;
  `);

  // 4. Backfill existing service orders that reference work orders
  // (The form was already sending workOrderId, it just wasn't persisted as a column)
  await db.execute(sql`
    UPDATE service_orders so
    SET
      work_order_number = wo.wo_number
    FROM work_orders wo
    WHERE so.work_order_id = wo.id
      AND so.work_order_number IS NULL
      AND so.work_order_id IS NOT NULL;
  `);
}
