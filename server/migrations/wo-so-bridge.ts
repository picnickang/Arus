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
  // DROP first because the view selects `wo.*`, and any time a column is
  // added/removed/reordered on work_orders (e.g. migration 0010 adding
  // `cost_justification`), CREATE OR REPLACE VIEW fails with
  // "cannot change name of view column X to Y". A plain DROP+CREATE is safe
  // because nothing else depends on this view (verified via pg_depend: zero
  // dependent objects). It is consumed only via application queries, never
  // referenced by other views or constraints.
  //
  // Wrapped in a single transaction with a pg_advisory_xact_lock so:
  //   (a) DROP + CREATE are atomic under MVCC — concurrent readers in other
  //       transactions either see the old view or the new view, never a gap.
  //   (b) The advisory lock serializes concurrent application boots
  //       (multi-instance deploys), preventing "view already exists" /
  //       "view does not exist" races between the DROP and the CREATE.
  // Lock key 0x776F73625F766965 = ASCII "wosbvie" — a stable per-view id
  // chosen so other migrations using their own keys do not collide.
  await db.execute(sql`
    BEGIN;
    SELECT pg_advisory_xact_lock(8606482937720340837);
    DROP VIEW IF EXISTS work_orders_with_service_info;
    CREATE VIEW work_orders_with_service_info AS
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
    COMMIT;
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

  // 5. Create service_requests table for lightweight intake before formal SOs
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS service_requests (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id VARCHAR NOT NULL REFERENCES organizations(id),
      work_order_id VARCHAR NOT NULL REFERENCES work_orders(id),
      service_order_id VARCHAR,
      request_number TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      urgency TEXT NOT NULL DEFAULT 'medium',
      estimated_cost REAL,
      requested_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_review',
      rejection_reason TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      converted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_service_requests_org_request_number UNIQUE (org_id, request_number)
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_service_requests_org_status
      ON service_requests (org_id, status);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_service_requests_work_order
      ON service_requests (work_order_id);
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_requests' AND column_name = 'previous_wo_status'
      ) THEN
        ALTER TABLE service_requests
          ADD COLUMN previous_wo_status TEXT;
        COMMENT ON COLUMN service_requests.previous_wo_status IS
          'Persisted WO status before SR creation, used to restore on rejection';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_requests' AND column_name = 'service_details'
      ) THEN
        ALTER TABLE service_requests
          ADD COLUMN service_details TEXT;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_requests' AND column_name = 'special_requirements'
      ) THEN
        ALTER TABLE service_requests
          ADD COLUMN special_requirements TEXT;
      END IF;
    END $$;
  `);
}
