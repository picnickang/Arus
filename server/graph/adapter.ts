/**
 * Push A2 — Apache AGE adapter.
 *
 * Thin Cypher wrapper that:
 *   - Loads the AGE extension into the session.
 *   - Routes every statement at the per-tenant named graph
 *     (`arus_graph_<orgId>`) so cross-tenant traversal is structurally
 *     impossible.
 *   - Degrades to a no-op (writes return false; reads return []) when
 *     `GRAPH_ENABLED=false` or the extension is unavailable. Callers
 *     therefore never need to feature-flag at the call site.
 *
 * NOT a general Cypher API. Only the small surface needed by the
 * projectors and the three Copilot tools is exposed — keeping the
 * blast radius small while the substrate matures.
 */

import { pool } from "../db";
import { createLogger } from "../lib/structured-logger";
import {
  ensureTenantGraph,
  isGraphAvailable,
  tenantGraphName,
} from "../graph-bootstrap";
import type { EdgeType, NodeLabel } from "./types";

const logger = createLogger("GraphAdapter");

/**
 * Cypher identifier safety: AGE inlines the graph name and the Cypher
 * body into a SQL string. Labels and edge types come from our typed
 * `NodeLabel` / `EdgeType` constants (compile-time safe), but the
 * property bag passed by callers must be serialised through bind
 * parameters where possible. AGE 1.x has limited parameter support, so
 * we serialise property maps as JSON literals — every value is fed
 * through `escapeCypherString` (string fields) or `Number()`
 * (numeric fields) before interpolation.
 */
function escapeCypherString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function propsToCypherMap(props: Record<string, string | number | null | undefined>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(props)) {
    if (val == null) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (typeof val === "number" && Number.isFinite(val)) {
      parts.push(`${key}: ${val}`);
    } else {
      parts.push(`${key}: ${escapeCypherString(String(val))}`);
    }
  }
  return `{${parts.join(", ")}}`;
}

async function execCypher(
  orgId: string,
  cypher: string,
  returnColumns: string
): Promise<Array<Record<string, unknown>>> {
  if (!isGraphAvailable()) return [];
  const ok = await ensureTenantGraph(orgId);
  if (!ok || !pool) return [];
  const graph = tenantGraphName(orgId);
  // returnColumns is a static template fragment provided by the caller —
  // never derived from user input. It declares the (col agtype) tuple
  // shape AGE requires after `cypher(...)`.
  const sql = `SELECT * FROM cypher('${graph}', $$ ${cypher} $$) AS (${returnColumns})`;
  try {
    const pg = pool as unknown as { query: (q: string) => Promise<{ rows: Array<Record<string, unknown>> }> };
    await pg.query(`LOAD 'ag_catalog'`);
    await pg.query(`SET search_path = ag_catalog, "$user", public`);
    const result = await pg.query(sql);
    return result.rows;
  } catch (err) {
    logger.warn("[Graph] Cypher exec failed", {
      orgId,
      details: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Idempotent node upsert. Uses Cypher MERGE so re-running the backfill
 * never duplicates nodes. The node's business id is the MERGE key.
 */
export async function upsertNode(
  orgId: string,
  label: NodeLabel,
  id: string,
  extraProps: Record<string, string | number | null | undefined> = {}
): Promise<boolean> {
  if (!isGraphAvailable()) return false;
  const ok = await ensureTenantGraph(orgId);
  if (!ok) return false;
  const propsMap = propsToCypherMap({ ...extraProps, id });
  const cypher = `MERGE (n:${label} {id: ${escapeCypherString(id)}}) SET n += ${propsMap}`;
  const rows = await execCypher(orgId, cypher + " RETURN n.id", "id agtype");
  return rows.length >= 0;
}

/**
 * Idempotent edge upsert. The (from,to,type) triple is the MERGE key;
 * an optional numeric `weight` is incremented on conflict so
 * "how many times has this part appeared for this failure" stays
 * accurate after re-runs.
 */
export async function upsertEdge(
  orgId: string,
  fromLabel: NodeLabel,
  fromId: string,
  edge: EdgeType,
  toLabel: NodeLabel,
  toId: string,
  incrementWeight: number = 1
): Promise<boolean> {
  if (!isGraphAvailable()) return false;
  const ok = await ensureTenantGraph(orgId);
  if (!ok) return false;
  const cypher =
    `MATCH (a:${fromLabel} {id: ${escapeCypherString(fromId)}}), ` +
    `(b:${toLabel} {id: ${escapeCypherString(toId)}}) ` +
    `MERGE (a)-[r:${edge}]->(b) ` +
    `ON CREATE SET r.weight = ${incrementWeight} ` +
    `ON MATCH SET r.weight = coalesce(r.weight, 0) + ${incrementWeight}`;
  const rows = await execCypher(orgId, cypher + " RETURN r", "r agtype");
  return rows.length >= 0;
}

/**
 * Returns failure modes observed on equipment of the same `type` as
 * `equipmentId`, ranked by occurrence count. Empty when graph is
 * unavailable — callers should treat empty as "no data" and may fall
 * back to a relational JOIN.
 */
export async function findSimilarFailures(
  orgId: string,
  equipmentId: string
): Promise<Array<{ failureMode: string; occurrences: number }>> {
  const cypher =
    `MATCH (e:Equipment {id: ${escapeCypherString(equipmentId)}}) ` +
    `MATCH (peer:Equipment)-[r:HAS_FAILURE_MODE]->(fm:FailureMode) ` +
    `WHERE peer.type = e.type ` +
    `RETURN fm.id AS failureMode, sum(r.weight) AS occurrences ` +
    `ORDER BY occurrences DESC LIMIT 10`;
  const rows = await execCypher(orgId, cypher, "failureMode agtype, occurrences agtype");
  return rows.map((r) => ({
    failureMode: String(r.failureMode ?? "").replace(/"/g, ""),
    occurrences: Number(r.occurrences ?? 0),
  }));
}

/**
 * Returns the parts historically required for a given failure mode,
 * ranked by occurrence count.
 */
export async function whatPartsForFailureMode(
  orgId: string,
  failureMode: string
): Promise<Array<{ partId: string; occurrences: number }>> {
  const cypher =
    `MATCH (fm:FailureMode {id: ${escapeCypherString(failureMode)}}) ` +
    `MATCH (fm)-[r:REQUIRES_PART]->(p:Part) ` +
    `RETURN p.id AS partId, sum(r.weight) AS occurrences ` +
    `ORDER BY occurrences DESC LIMIT 25`;
  const rows = await execCypher(orgId, cypher, "partId agtype, occurrences agtype");
  return rows.map((r) => ({
    partId: String(r.partId ?? "").replace(/"/g, ""),
    occurrences: Number(r.occurrences ?? 0),
  }));
}

/**
 * Returns equipment downstream of the given equipment via DEPENDS_ON
 * edges (admin-curated dependency graph). Used by failure-propagation
 * reasoning: "if pump A fails, what else degrades?"
 */
export async function failurePropagation(
  orgId: string,
  equipmentId: string,
  maxHops: number = 3
): Promise<Array<{ equipmentId: string; hops: number }>> {
  const safeHops = Math.max(1, Math.min(5, Math.trunc(maxHops)));
  const cypher =
    `MATCH path = (src:Equipment {id: ${escapeCypherString(equipmentId)}})` +
    `-[:DEPENDS_ON*1..${safeHops}]->(downstream:Equipment) ` +
    `RETURN DISTINCT downstream.id AS equipmentId, length(path) AS hops ` +
    `ORDER BY hops ASC LIMIT 50`;
  const rows = await execCypher(orgId, cypher, "equipmentId agtype, hops agtype");
  return rows.map((r) => ({
    equipmentId: String(r.equipmentId ?? "").replace(/"/g, ""),
    hops: Number(r.hops ?? 0),
  }));
}
