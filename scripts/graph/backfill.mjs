#!/usr/bin/env node
/**
 * Push A2 — Knowledge graph backfill.
 *
 * Re-projects relational truth (equipment, failure_history,
 * inventory_movements + their work_order → failure_mode linkage)
 * into the per-tenant Apache AGE graph. Standalone Node script —
 * uses `pg` directly and inlines the Cypher MERGE statements so it
 * runs without a TS loader (matches the pattern of
 * `scripts/ml/backfill-prediction-outcomes.mjs`). The TS projector
 * remains the canonical write path for the live application code;
 * this script intentionally mirrors its edge-shape contract so a
 * replay produces the same `(from, to, type, sourceId)` tuples.
 *
 * Idempotent by construction: every counting edge is MERGE-keyed on
 * the originating relational row id (via `sourceId`), so re-running
 * this script writes the same tuples back to the graph and
 * `count(DISTINCT sourceId)`-based queries return relational truth.
 *
 * Usage:
 *   GRAPH_ENABLED=true node scripts/graph/backfill.mjs              # all orgs
 *   GRAPH_ENABLED=true node scripts/graph/backfill.mjs --org=acme   # one org
 *   GRAPH_ENABLED=true node scripts/graph/backfill.mjs --reset      # drop+rebuild
 */

import { argv, exit, env } from "node:process";
import pg from "pg";

const STATIC_EDGE_SOURCE = "static";

function parseArgs(args) {
  const out = { reset: false };
  for (const a of args.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    out[m[1]] = m[2] ?? true;
  }
  return out;
}

function sanitizeOrgId(orgId) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(orgId)) {
    throw new Error(`Unsafe orgId for graph name: ${orgId}`);
  }
  return orgId.replace(/-/g, "_");
}
const tenantGraphName = (orgId) => `arus_graph_${sanitizeOrgId(orgId)}`;

function cypherStr(v) {
  return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

async function ensureGraph(client, graph) {
  await client.query(`LOAD 'age'`);
  await client.query(`SET search_path = ag_catalog, "$user", public`);
  const { rows } = await client.query(
    `SELECT 1 FROM ag_catalog.ag_graph WHERE name = $1`,
    [graph]
  );
  if (rows.length === 0) {
    await client.query(`SELECT create_graph('${graph}')`);
  }
}

async function exec(client, graph, cypher) {
  const sql = `SELECT * FROM cypher('${graph}', $$ ${cypher} $$) AS (r agtype)`;
  try {
    await client.query(sql);
    return true;
  } catch (err) {
    console.warn(`[graph-backfill] cypher failed: ${err.message}`);
    return false;
  }
}

async function upsertNode(client, graph, label, id, props = {}) {
  const setParts = [];
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
    setParts.push(`${k}: ${cypherStr(v)}`);
  }
  const setMap = setParts.length ? `{${setParts.join(", ")}}` : "{}";
  await exec(
    client,
    graph,
    `MERGE (n:${label} {id: ${cypherStr(id)}}) SET n += ${setMap} RETURN n.id`
  );
}

async function upsertEdge(client, graph, fromLabel, fromId, edge, toLabel, toId, sourceId) {
  await exec(
    client,
    graph,
    `MATCH (a:${fromLabel} {id: ${cypherStr(fromId)}}), (b:${toLabel} {id: ${cypherStr(toId)}}) ` +
      `MERGE (a)-[r:${edge} {sourceId: ${cypherStr(sourceId)}}]->(b) RETURN r`
  );
}

async function main() {
  const args = parseArgs(argv);
  if (env.GRAPH_ENABLED !== "true") {
    console.log("[graph-backfill] GRAPH_ENABLED!=true — nothing to do");
    return;
  }
  if (!env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    exit(2);
  }

  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    // Probe AGE availability — refuse to silently no-op.
    try {
      await client.query(`LOAD 'age'`);
    } catch (err) {
      console.warn(`[graph-backfill] Apache AGE unavailable: ${err.message}`);
      return;
    }

    const orgRows = args.org
      ? [{ id: args.org }]
      : (await client.query(`SELECT id FROM organizations`)).rows;

    let eqCount = 0;
    let fhCount = 0;
    let mvCount = 0;

    for (const org of orgRows) {
      const orgId = org.id;
      const graph = tenantGraphName(orgId);

      if (args.reset) {
        try {
          await client.query(`SELECT drop_graph('${graph}', true)`);
          console.log(`[graph-backfill] Dropped ${graph}`);
        } catch (err) {
          console.warn(`[graph-backfill] drop_graph(${graph}) skipped: ${err.message}`);
        }
      }
      await ensureGraph(client, graph);

      const eqRows = (
        await client.query(
          `SELECT id, name, type, vessel_id AS "vesselId", system_type AS "systemType"
             FROM equipment WHERE org_id = $1`,
          [orgId]
        )
      ).rows;
      for (const r of eqRows) {
        await upsertNode(client, graph, "Equipment", r.id, {
          name: r.name,
          type: r.type,
          systemType: r.systemType,
        });
        if (r.vesselId) {
          await upsertNode(client, graph, "Vessel", r.vesselId, {});
          await upsertEdge(
            client,
            graph,
            "Equipment",
            r.id,
            "INSTALLED_ON",
            "Vessel",
            r.vesselId,
            STATIC_EDGE_SOURCE
          );
        }
        eqCount += 1;
      }

      const fhRows = (
        await client.query(
          `SELECT id, equipment_id AS "equipmentId", failure_mode AS "failureMode",
                  verified_by AS "technicianId", work_order_id AS "workOrderId"
             FROM failure_history WHERE org_id = $1`,
          [orgId]
        )
      ).rows;
      for (const r of fhRows) {
        const sourceId = `fh:${r.id}`;
        await upsertNode(client, graph, "FailureMode", r.failureMode, {});
        await upsertEdge(
          client,
          graph,
          "Equipment",
          r.equipmentId,
          "HAS_FAILURE_MODE",
          "FailureMode",
          r.failureMode,
          sourceId
        );
        if (r.technicianId) {
          await upsertNode(client, graph, "Technician", r.technicianId, {});
          await upsertEdge(
            client,
            graph,
            "FailureMode",
            r.failureMode,
            "RESOLVED_BY",
            "Technician",
            r.technicianId,
            sourceId
          );
        }
        fhCount += 1;
      }

      // inventory_movements joined to failure_history via work_order_id so
      // REQUIRES_PART edges follow relational truth (reviewer comment #3
      // on the first cut).
      //
      // Movement-type filter: REQUIRES_PART means "parts actually needed
      // to resolve this failure mode". `release` cancels a reservation
      // and `return` undoes a use, so including them would double-count
      // (or even flip-count) the requirement signal — that was the
      // semantics drift the reviewer flagged on the third pass. We
      // count `reserve` and `consume` (forward consumption) only.
      const mvRows = (
        await client.query(
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
            WHERE m.org_id = $1
              AND m.movement_type IN ('reserve', 'consume')`,
          [orgId]
        )
      ).rows;
      for (const r of mvRows) {
        const sourceId = `mv:${r.movementId}`;
        await upsertNode(client, graph, "Part", r.partId, { name: r.partName });
        if (r.supplierId) {
          await upsertNode(client, graph, "Supplier", r.supplierId, {});
          await upsertEdge(
            client,
            graph,
            "Part",
            r.partId,
            "SUPPLIED_BY",
            "Supplier",
            r.supplierId,
            STATIC_EDGE_SOURCE
          );
        }
        if (r.failureMode) {
          await upsertNode(client, graph, "FailureMode", r.failureMode, {});
          await upsertEdge(
            client,
            graph,
            "FailureMode",
            r.failureMode,
            "REQUIRES_PART",
            "Part",
            r.partId,
            sourceId
          );
        }
        mvCount += 1;
      }
    }

    console.log(
      `[graph-backfill] Done — ${eqCount} equipment, ${fhCount} failures, ` +
        `${mvCount} movements across ${orgRows.length} orgs`
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[graph-backfill] FAILED", err);
  exit(1);
});
