#!/usr/bin/env node
/**
 * Push A2 — Knowledge graph backfill.
 *
 * Re-projects historical relational rows (equipment, failure_history,
 * inventory_movements) through the same projectors used by the live
 * write paths. Idempotent: Cypher MERGE means re-running this script
 * does not duplicate nodes. Edge weights for HAS_FAILURE_MODE and
 * REQUIRES_PART will accumulate on repeat runs because every source
 * row legitimately represents one occurrence — pass `--reset` to drop
 * each tenant graph first if you want a clean rebuild.
 *
 * Usage:
 *   GRAPH_ENABLED=true node scripts/graph/backfill.mjs              # all orgs
 *   GRAPH_ENABLED=true node scripts/graph/backfill.mjs --org=acme   # one org
 *   GRAPH_ENABLED=true node scripts/graph/backfill.mjs --reset      # drop+rebuild
 *
 * Exits 0 on success, 1 on hard failure, 0 with a warning when the
 * graph substrate is unavailable (so CI / post-merge can call it
 * unconditionally and we still don't break the build).
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
        `SELECT equipment_id AS "equipmentId", failure_mode AS "failureMode",
                verified_by AS "technicianId", work_order_id AS "workOrderId"
           FROM failure_history WHERE org_id = $1`,
        [orgId]
      )
    ).rows;
    for (const r of fhRows) {
      await projectFailureHistory(orgId, r);
      failuresProjected += 1;
    }

    const mvRows = (
      await pool.query(
        `SELECT m.part_id AS "partId", m.work_order_id AS "workOrderId",
                p.primary_supplier_id AS "supplierId", p.name AS "partName"
           FROM inventory_movements m
           LEFT JOIN parts p ON p.id = m.part_id
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
