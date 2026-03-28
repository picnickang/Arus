/**
 * Data Migration: Consolidate Inventory Tables (Task #8)
 *
 * Copies data from deprecated `parts_inventory` and `inventory_parts` tables
 * into the canonical `parts` + `stock` tables, preserving all data.
 *
 * Safe to run multiple times (idempotent — skips existing rows by part_no + org_id).
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

    console.log("[Migration] Phase 1: Migrate parts_inventory → parts + stock");

    const piRows = await client.query(`
      SELECT pi.*
      FROM parts_inventory pi
      LEFT JOIN parts p ON p.part_no = pi.part_number AND p.org_id = pi.org_id
      WHERE p.id IS NULL
    `);

    let partsCreated = 0;
    let stockCreated = 0;
    let skipped = 0;

    for (const row of piRows.rows) {
      try {
        const insertResult = await client.query(`
          INSERT INTO parts (
            id, org_id, part_no, name, description, category, unit_of_measure,
            min_stock_qty, max_stock_qty, standard_cost, lead_time_days,
            manufacturer, is_active, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, 'ea',
            $6, $7, $8, $9,
            $10, $11, $12, $13
          )
          ON CONFLICT (org_id, part_no) DO NOTHING
          RETURNING id, part_no
        `, [
          row.org_id, row.part_number, row.part_name, row.description,
          row.category, row.min_stock_level || 0, row.max_stock_level || 0,
          row.unit_cost, row.lead_time_days || 7,
          row.manufacturer, row.is_active ?? true,
          row.created_at || new Date(), row.updated_at || new Date(),
        ]);

        if (insertResult.rows.length > 0) {
          const newPart = insertResult.rows[0];
          partsCreated++;

          await client.query(`
            INSERT INTO stock (
              org_id, part_id, part_no, location,
              quantity_on_hand, quantity_reserved, unit_cost,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7,
              $8, $9
            )
            ON CONFLICT (org_id, part_id, location) DO NOTHING
          `, [
            row.org_id, newPart.id, newPart.part_no,
            row.location || "MAIN",
            row.quantity_on_hand || 0, row.quantity_reserved || 0,
            row.unit_cost || 0,
            new Date(), new Date(),
          ]);
          stockCreated++;
        } else {
          skipped++;
        }
      } catch (err: any) {
        console.warn(`[Migration] Skipped parts_inventory row ${row.id}: ${err.message}`);
        skipped++;
      }
    }

    console.log(`  parts_inventory → parts: ${partsCreated} created, ${skipped} skipped`);
    console.log(`  parts_inventory → stock: ${stockCreated} created`);

    console.log("[Migration] Phase 2: Migrate inventory_parts → parts + stock");

    const ipRows = await client.query(`
      SELECT ip.*
      FROM inventory_parts ip
      LEFT JOIN parts p ON p.part_no = ip.part_number AND p.org_id = ip.org_id
      WHERE p.id IS NULL
    `);

    let ipPartsCreated = 0;
    let ipStockCreated = 0;
    let ipSkipped = 0;

    for (const row of ipRows.rows) {
      try {
        const insertResult = await client.query(`
          INSERT INTO parts (
            id, org_id, part_no, name, description, category, unit_of_measure,
            min_stock_qty, max_stock_qty, standard_cost, lead_time_days,
            risk_level, last_usage_30d, is_active, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, 'general', 'ea',
            $5, $6, $7, $8,
            $9, $10, true, $11, $12
          )
          ON CONFLICT (org_id, part_no) DO NOTHING
          RETURNING id, part_no
        `, [
          row.org_id, row.part_number, row.description, row.description,
          row.min_stock_level, row.max_stock_level,
          row.unit_cost || 0, row.lead_time_days,
          row.risk_level || "low", row.last_usage_30d || 0,
          row.created_at || new Date(), row.updated_at || new Date(),
        ]);

        if (insertResult.rows.length > 0) {
          const newPart = insertResult.rows[0];
          ipPartsCreated++;

          await client.query(`
            INSERT INTO stock (
              org_id, part_id, part_no, location,
              quantity_on_hand, quantity_reserved, unit_cost,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, 'MAIN',
              $4, 0, $5,
              $6, $7
            )
            ON CONFLICT (org_id, part_id, location) DO NOTHING
          `, [
            row.org_id, newPart.id, newPart.part_no,
            row.current_stock || 0, row.unit_cost || 0,
            new Date(), new Date(),
          ]);
          ipStockCreated++;
        } else {
          ipSkipped++;
        }
      } catch (err: any) {
        console.warn(`[Migration] Skipped inventory_parts row ${row.id}: ${err.message}`);
        ipSkipped++;
      }
    }

    console.log(`  inventory_parts → parts: ${ipPartsCreated} created, ${ipSkipped} skipped`);
    console.log(`  inventory_parts → stock: ${ipStockCreated} created`);

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
