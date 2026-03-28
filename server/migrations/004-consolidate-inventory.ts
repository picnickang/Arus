/**
 * Data Migration: Consolidate Inventory Tables (Task #8)
 *
 * Copies data from deprecated `parts_inventory` and `inventory_parts` tables
 * into the canonical `parts` + `stock` tables, preserving all data.
 *
 * Idempotent: uses a tracking table `_migration_004_processed` to record
 * which source rows have already been migrated, preventing double-counting
 * on re-runs.
 *
 * Usage:
 *   npx tsx server/migrations/004-consolidate-inventory.ts
 */

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS _migration_004_processed (
        source_table TEXT NOT NULL,
        source_id TEXT NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (source_table, source_id)
      )
    `);

    console.log("[Migration] Phase 0: Additive schema ALTERs for consolidated parts columns");

    const additiveCols = [
      { col: "manufacturer", def: "ALTER TABLE parts ADD COLUMN IF NOT EXISTS manufacturer TEXT" },
      { col: "is_active", def: "ALTER TABLE parts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true" },
      { col: "last_usage_30d", def: "ALTER TABLE parts ADD COLUMN IF NOT EXISTS last_usage_30d INTEGER DEFAULT 0" },
      { col: "risk_level", def: "ALTER TABLE parts ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'medium'" },
    ];
    for (const c of additiveCols) {
      await client.query(c.def);
    }
    console.log(`  Added ${additiveCols.length} additive columns to parts (IF NOT EXISTS)`);

    console.log("[Migration] Phase 1: Migrate parts_inventory → parts + stock");

    const piRows = await client.query(`
      SELECT pi.* FROM parts_inventory pi
      WHERE NOT EXISTS (
        SELECT 1 FROM _migration_004_processed m
        WHERE m.source_table = 'parts_inventory' AND m.source_id = pi.id::text
      )
    `);

    let partsCreated = 0;
    let partsMerged = 0;
    let stockCreated = 0;
    let stockMerged = 0;
    let dependentRemapped = 0;

    for (const row of piRows.rows) {
      try {
        await client.query(`SAVEPOINT sp_pi_${row.id.replace(/[^a-zA-Z0-9]/g, '_')}`);

        const insertResult = await client.query(`
          INSERT INTO parts (
            id, org_id, part_no, name, description, category, unit_of_measure,
            min_stock_qty, max_stock_qty, standard_cost, lead_time_days,
            manufacturer, is_active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, 'ea',
            $7, $8, $9, $10,
            $11, $12, $13, $14
          )
          ON CONFLICT (org_id, part_no) DO UPDATE SET
            min_stock_qty = GREATEST(parts.min_stock_qty, EXCLUDED.min_stock_qty),
            max_stock_qty = GREATEST(parts.max_stock_qty, EXCLUDED.max_stock_qty),
            manufacturer = COALESCE(NULLIF(parts.manufacturer, ''), EXCLUDED.manufacturer),
            updated_at = NOW()
          RETURNING id, part_no, (xmax = 0) AS was_inserted
        `, [
          row.id,
          row.org_id, row.part_number, row.part_name, row.description,
          row.category, row.min_stock_level || 0, row.max_stock_level || 0,
          row.unit_cost, row.lead_time_days || 7,
          row.manufacturer, row.is_active ?? true,
          row.created_at || new Date(), row.updated_at || new Date(),
        ]);

        const resultRow = insertResult.rows[0];
        if (resultRow.was_inserted) { partsCreated++; } else { partsMerged++; }

        if (!resultRow.was_inserted && resultRow.id !== row.id) {
          const remap = await client.query(`
            UPDATE work_order_parts SET part_id = $1 WHERE part_id = $2 AND org_id = $3
          `, [resultRow.id, row.id, row.org_id]);
          const remapMov = await client.query(`
            UPDATE inventory_movements SET part_id = $1 WHERE part_id = $2 AND org_id = $3
          `, [resultRow.id, row.id, row.org_id]);
          dependentRemapped += (remap.rowCount || 0) + (remapMov.rowCount || 0);
        }

        const stockResult = await client.query(`
          INSERT INTO stock (
            org_id, part_id, part_no, location,
            quantity_on_hand, quantity_reserved, unit_cost,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9
          )
          ON CONFLICT (org_id, part_id, location) DO UPDATE SET
            quantity_on_hand = stock.quantity_on_hand + EXCLUDED.quantity_on_hand,
            quantity_reserved = stock.quantity_reserved + EXCLUDED.quantity_reserved,
            unit_cost = COALESCE(EXCLUDED.unit_cost, stock.unit_cost),
            updated_at = NOW()
          RETURNING (xmax = 0) AS was_inserted
        `, [
          row.org_id, resultRow.id, resultRow.part_no,
          row.location || "MAIN",
          row.quantity_on_hand || 0, row.quantity_reserved || 0,
          row.unit_cost || 0,
          new Date(), new Date(),
        ]);
        if (stockResult.rows[0]?.was_inserted) { stockCreated++; } else { stockMerged++; }

        await client.query(
          `INSERT INTO _migration_004_processed (source_table, source_id) VALUES ('parts_inventory', $1) ON CONFLICT DO NOTHING`,
          [row.id]
        );

        await client.query(`RELEASE SAVEPOINT sp_pi_${row.id.replace(/[^a-zA-Z0-9]/g, '_')}`);
      } catch (err: unknown) {
        await client.query(`ROLLBACK TO SAVEPOINT sp_pi_${row.id.replace(/[^a-zA-Z0-9]/g, '_')}`);
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Migration] Skipped parts_inventory row ${row.id}: ${msg}`);
      }
    }

    console.log(`  parts_inventory → parts: ${partsCreated} created, ${partsMerged} merged, ${dependentRemapped} dependent refs remapped`);
    console.log(`  parts_inventory → stock: ${stockCreated} created, ${stockMerged} merged`);

    console.log("[Migration] Phase 2: Migrate inventory_parts → parts + stock");

    const ipRows = await client.query(`
      SELECT ip.* FROM inventory_parts ip
      WHERE NOT EXISTS (
        SELECT 1 FROM _migration_004_processed m
        WHERE m.source_table = 'inventory_parts' AND m.source_id = ip.id::text
      )
    `);

    let ipPartsCreated = 0;
    let ipPartsMerged = 0;
    let ipStockCreated = 0;
    let ipStockMerged = 0;
    let ipDependentRemapped = 0;

    for (const row of ipRows.rows) {
      try {
        await client.query(`SAVEPOINT sp_ip_${row.id.toString().replace(/[^a-zA-Z0-9]/g, '_')}`);

        const insertResult = await client.query(`
          INSERT INTO parts (
            id, org_id, part_no, name, description, category, unit_of_measure,
            min_stock_qty, max_stock_qty, standard_cost, lead_time_days,
            risk_level, last_usage_30d, is_active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, 'general', 'ea',
            $6, $7, $8, $9,
            $10, $11, true, $12, $13
          )
          ON CONFLICT (org_id, part_no) DO UPDATE SET
            min_stock_qty = GREATEST(parts.min_stock_qty, EXCLUDED.min_stock_qty),
            max_stock_qty = GREATEST(parts.max_stock_qty, EXCLUDED.max_stock_qty),
            risk_level = COALESCE(NULLIF(parts.risk_level, 'medium'), EXCLUDED.risk_level),
            last_usage_30d = GREATEST(COALESCE(parts.last_usage_30d, 0), EXCLUDED.last_usage_30d),
            updated_at = NOW()
          RETURNING id, part_no, (xmax = 0) AS was_inserted
        `, [
          row.id,
          row.org_id, row.part_number, row.description, row.description,
          row.min_stock_level, row.max_stock_level,
          row.unit_cost || 0, row.lead_time_days,
          row.risk_level || "low", row.last_usage_30d || 0,
          row.created_at || new Date(), row.updated_at || new Date(),
        ]);

        const resultRow = insertResult.rows[0];
        if (resultRow.was_inserted) { ipPartsCreated++; } else { ipPartsMerged++; }

        if (!resultRow.was_inserted && resultRow.id !== row.id) {
          const remap = await client.query(`
            UPDATE work_order_parts SET part_id = $1 WHERE part_id = $2 AND org_id = $3
          `, [resultRow.id, row.id, row.org_id]);
          const remapMov = await client.query(`
            UPDATE inventory_movements SET part_id = $1 WHERE part_id = $2 AND org_id = $3
          `, [resultRow.id, row.id, row.org_id]);
          ipDependentRemapped += (remap.rowCount || 0) + (remapMov.rowCount || 0);
        }

        const stockResult = await client.query(`
          INSERT INTO stock (
            org_id, part_id, part_no, location,
            quantity_on_hand, quantity_reserved, unit_cost,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, 'MAIN',
            $4, 0, $5,
            $6, $7
          )
          ON CONFLICT (org_id, part_id, location) DO UPDATE SET
            quantity_on_hand = stock.quantity_on_hand + EXCLUDED.quantity_on_hand,
            unit_cost = COALESCE(EXCLUDED.unit_cost, stock.unit_cost),
            updated_at = NOW()
          RETURNING (xmax = 0) AS was_inserted
        `, [
          row.org_id, resultRow.id, resultRow.part_no,
          row.current_stock || 0, row.unit_cost || 0,
          new Date(), new Date(),
        ]);
        if (stockResult.rows[0]?.was_inserted) { ipStockCreated++; } else { ipStockMerged++; }

        await client.query(
          `INSERT INTO _migration_004_processed (source_table, source_id) VALUES ('inventory_parts', $1) ON CONFLICT DO NOTHING`,
          [row.id]
        );

        await client.query(`RELEASE SAVEPOINT sp_ip_${row.id.toString().replace(/[^a-zA-Z0-9]/g, '_')}`);
      } catch (err: unknown) {
        await client.query(`ROLLBACK TO SAVEPOINT sp_ip_${row.id.toString().replace(/[^a-zA-Z0-9]/g, '_')}`);
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Migration] Skipped inventory_parts row ${row.id}: ${msg}`);
      }
    }

    console.log(`  inventory_parts → parts: ${ipPartsCreated} created, ${ipPartsMerged} merged, ${ipDependentRemapped} dependent refs remapped`);
    console.log(`  inventory_parts → stock: ${ipStockCreated} created, ${ipStockMerged} merged`);

    console.log("[Migration] Phase 3: Merge columns from parts_inventory into existing parts");

    const mergeResult = await client.query(`
      UPDATE parts p SET
        manufacturer = COALESCE(p.manufacturer, pi.manufacturer),
        is_active = COALESCE(pi.is_active, p.is_active),
        updated_at = NOW()
      FROM parts_inventory pi
      WHERE p.part_no = pi.part_number
        AND p.org_id = pi.org_id
        AND (p.manufacturer IS NULL AND pi.manufacturer IS NOT NULL)
    `);
    console.log(`  Merged manufacturer data for ${mergeResult.rowCount} rows`);

    const usageMerge = await client.query(`
      UPDATE parts p SET
        last_usage_30d = COALESCE(ip.last_usage_30d, p.last_usage_30d),
        risk_level = COALESCE(NULLIF(p.risk_level, 'medium'), ip.risk_level, p.risk_level),
        updated_at = NOW()
      FROM inventory_parts ip
      WHERE p.part_no = ip.part_number
        AND p.org_id = ip.org_id
        AND (p.last_usage_30d IS NULL OR p.last_usage_30d = 0)
        AND ip.last_usage_30d > 0
    `);
    console.log(`  Merged usage data for ${usageMerge.rowCount} rows`);

    console.log("[Migration] Phase 4: Migrate inventory_movements FK from parts_inventory → parts");

    try {
      await client.query(`
        ALTER TABLE inventory_movements
        DROP CONSTRAINT IF EXISTS inventory_movements_part_id_parts_inventory_id_fk
      `);
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_part_id_parts_id_fk'
          ) THEN
            ALTER TABLE inventory_movements
            ADD CONSTRAINT inventory_movements_part_id_parts_id_fk
            FOREIGN KEY (part_id) REFERENCES parts(id);
          END IF;
        END $$
      `);
      console.log("  FK constraint updated: inventory_movements.part_id → parts.id");
    } catch (fkErr: unknown) {
      const msg = fkErr instanceof Error ? fkErr.message : String(fkErr);
      console.warn(`  FK migration skipped (non-fatal): ${msg}`);
    }

    await client.query("COMMIT");
    console.log("[Migration] Consolidation complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Migration] Failed, rolled back:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
