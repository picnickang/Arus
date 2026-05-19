#!/usr/bin/env node
/**
 * Push A2 — Knowledge graph backfill.
 *
 * Re-projects relational truth (equipment, failure_history,
 * inventory_movements + their work_order → failure_mode linkage)
 * through the same projectors used by live write paths.
 *
 * Idempotent by construction: every counting edge is MERGE-keyed on
 * the originating relational row id (via `sourceId`), so re-running
 * this script writes the same tuples back to the graph and
 * `count(DISTINCT sourceId)`-based queries return the relational
 * truth. There is no need for a `--reset` flag to keep counts
 * accurate; it remains available for a clean rebuild if the schema
 * ever changes.
 *
 * Usage:
 *   GRAPH_ENABLED=true node scripts/graph/backfill.mjs              # all orgs
 *   GRAPH_ENABLED=true node scripts/graph/backfill.mjs --org=acme   # one org
 *   GRAPH_ENABLED=true node scripts/graph/backfill.mjs --reset      # drop+rebuild
 */

import process from "node:process";

const args = process.argv.slice(2);
const onlyOrg = args.find((a) => a.startsWith("--org="))?.split("=")[1];
const reset = args.includes("--reset");

async function main() {
  if (process.env.GRAPH_ENABLED !== "true") {
    console.log("[graph-backfill] GRAPH_ENABLED!=true — nothing to do");
    return;
  }

  const { runGraphBootstrap, isGraphAvailable, tenantGraphName } = await import(
    "../../server/graph-bootstrap.ts"
  );
  await runGraphBootstrap();
  if (!isGraphAvailable()) {
    console.warn("[graph-backfill] Graph substrate unavailable — skipped");
    return;
  }

  const { pool } = await import("../../server/db.ts");
  const {
    projectEquipment,
    projectFailureHistory,
    projectInventoryMovement,
  } = await import("../../server/graph/projector.ts");

  if (!pool) {
    console.warn("[graph-backfill] No Postgres pool — skipped");
    return;
  }

  const orgRows = onlyOrg
    ? [{ id: onlyOrg }]
    : (await pool.query("SELECT id FROM organizations")).rows;

  let equipmentProjected = 0;
  let failuresProjected = 0;
  let movementsProjected = 0;

  for (const org of orgRows) {
    const orgId = org.id;
    if (reset) {
      const graph = tenantGraphName(orgId);
      try {
        await pool.query(`LOAD 'ag_catalog'`);
        await pool.query(`SELECT drop_graph('${graph}', true)`);
        console.log(`[graph-backfill] Dropped ${graph}`);
      } catch (err) {
        console.warn(`[graph-backfill] drop_graph(${graph}) skipped`, err?.message);
      }
    }

    const eqRows = (
      await pool.query(
        `SELECT id, name, type, vessel_id AS "vesselId", system_type AS "systemType"
           FROM equipment WHERE org_id = $1`,
        [orgId]
      )
    ).rows;
    for (const r of eqRows) {
      await projectEquipment(orgId, r);
      equipmentProjected += 1;
    }

    const fhRows = (
      await pool.query(
        `SELECT id, equipment_id AS "equipmentId", failure_mode AS "failureMode",
                verified_by AS "technicianId", work_order_id AS "workOrderId"
           FROM failure_history WHERE org_id = $1`,
        [orgId]
      )
    ).rows;
    for (const r of fhRows) {
      await projectFailureHistory(orgId, { ...r, failureHistoryId: r.id });
      failuresProjected += 1;
    }

    // Inventory movements joined to failure_history via the shared
    // work_order_id, so REQUIRES_PART edges are populated deterministically
    // from relational truth (reviewer comment #3 on the first cut).
    const mvRows = (
      await pool.query(
        `SELECT m.id AS "movementId",
                m.part_id AS "partId",
                m.work_order_id AS "workOrderId",
                p.primary_supplier_id AS "supplierId",
                p.name AS "partName",
                fh.failure_mode AS "failureMode"
           FROM inventory_movements m
           LEFT JOIN parts p ON p.id = m.part_id
           LEFT JOIN failure_history fh
                  ON fh.work_order_id = m.work_order_id
                 AND fh.org_id = m.org_id
          WHERE m.org_id = $1`,
        [orgId]
      )
    ).rows;
    for (const r of mvRows) {
      await projectInventoryMovement(orgId, r);
      movementsProjected += 1;
    }
  }

  console.log(
    `[graph-backfill] Done — ${equipmentProjected} equipment, ` +
      `${failuresProjected} failures, ${movementsProjected} movements across ` +
      `${orgRows.length} orgs`
  );
}

main().catch((err) => {
  console.error("[graph-backfill] FAILED", err);
  process.exit(1);
});
