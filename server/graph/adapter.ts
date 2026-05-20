/**
 * Push A2 — Apache AGE adapter.
 *
 * Thin Cypher wrapper that:
 *   - Loads the AGE extension into the session.
 *   - Routes every statement at the per-tenant named graph
 *     (`arus_graph_<orgId>`) so cross-tenant traversal is structurally
 *     impossible.
 *   - Degrades to a no-op when `GRAPH_ENABLED=false` or the extension
 *     is unavailable. Writers return `false`, readers return `[]`.
 *
 * NOT a general Cypher API. Only the small surface needed by the
 * projectors and the three Copilot tools is exposed.
 *
 * Idempotency contract (the reviewer caught this — see ADR 001):
 *   - Nodes MERGE on `id`, no count drift.
 *   - Edges MERGE on `(from, to, type, sourceId)` where `sourceId` is
 *     a stable identifier of the *originating relational row*
 *     (work_order_id, failure_history_id, etc.). Re-running the
 *     backfill therefore writes the same edge tuple back to the graph
 *     and `count()`-based queries return the relational truth.
 *   - "Pure relational facts" (Equipment INSTALLED_ON Vessel, Part
 *     SUPPLIED_BY Supplier) carry sourceId='static' so MERGE collapses
 *     to a single edge — no count semantics, no drift.
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

function escapeCypherString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function propsToCypherMap(
  props: Record<string, string | number | null | undefined>
): string {
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

interface CypherExecResult {
  ok: boolean;
  rows: Array<Record<string, unknown>>;
}

async function execCypher(
  orgId: string,
  cypher: string,
  returnColumns: string
): Promise<CypherExecResult> {
  if (!isGraphAvailable()) return { ok: false, rows: [] };
  const ok = await ensureTenantGraph(orgId);
  if (!ok || !pool) return { ok: false, rows: [] };
  const graph = tenantGraphName(orgId);
  // `returnColumns` is a static template fragment provided by the caller —
  // never derived from user input — declaring the AGE (col agtype) tuple.
  const sql = `SELECT * FROM cypher('${graph}', $$ ${cypher} $$) AS (${returnColumns})`;
  // CRITICAL: `LOAD 'age'` and `SET search_path` are SESSION-scoped.
  // `pool.query` can return a different physical connection on each
  // call, so we MUST check out a single client and run the prelude +
  // cypher on it (the reviewer caught this as a non-deterministic
  // production failure on the fourth pass). Always released in
  // `finally`.
  const pg = pool as unknown as {
    connect: () => Promise<{
      query: (q: string) => Promise<{ rows: Array<Record<string, unknown>> }>;
      release: () => void;
    }>;
  };
  let client: Awaited<ReturnType<typeof pg.connect>> | null = null;
  try {
    client = await pg.connect();
    // `age` is the LIBRARY name; `ag_catalog` is the schema.
    await client.query(`LOAD 'age'`);
    await client.query(`SET search_path = ag_catalog, "$user", public`);
    const result = await client.query(sql);
    return { ok: true, rows: result.rows };
  } catch (err) {
    logger.warn("[Graph] Cypher exec failed", {
      orgId,
      details: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, rows: [] };
  } finally {
    client?.release();
  }
}

/** Sentinel sourceId for pure relational facts (no count semantics). */
export const STATIC_EDGE_SOURCE = "static";

/**
 * Idempotent node upsert. Returns true only when the write actually
 * committed against AGE. Re-runs produce zero drift (MERGE keyed on
 * `id`).
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
  const cypher = `MERGE (n:${label} {id: ${escapeCypherString(id)}}) SET n += ${propsMap} RETURN n.id`;
  const res = await execCypher(orgId, cypher, "id agtype");
  return res.ok && res.rows.length > 0;
}

/**
 * Idempotent edge upsert keyed on (from, to, type, sourceId). The
 * sourceId comes from the originating relational row so re-projecting
 * the same row writes the same tuple back — no count drift on replay.
 * "Pure relational fact" edges should pass `STATIC_EDGE_SOURCE`.
 */
export async function upsertEdge(
  orgId: string,
  fromLabel: NodeLabel,
  fromId: string,
  edge: EdgeType,
  toLabel: NodeLabel,
  toId: string,
  sourceId: string = STATIC_EDGE_SOURCE
): Promise<boolean> {
  if (!isGraphAvailable()) return false;
  const ok = await ensureTenantGraph(orgId);
  if (!ok) return false;
  const cypher =
    `MATCH (a:${fromLabel} {id: ${escapeCypherString(fromId)}}), ` +
    `(b:${toLabel} {id: ${escapeCypherString(toId)}}) ` +
    `MERGE (a)-[r:${edge} {sourceId: ${escapeCypherString(sourceId)}}]->(b) ` +
    `RETURN r`;
  const res = await execCypher(orgId, cypher, "r agtype");
  return res.ok && res.rows.length > 0;
}

/**
 * Idempotent edge deletion. Removes every edge matching
 * (from, type, to) — the deletion contract is "this relational fact
 * is gone, drop the projected edge entirely". For DEPENDS_ON
 * (admin-curated, sourceId=STATIC_EDGE_SOURCE) this is a 1:1
 * correspondence with the relational row; counted edges that share
 * (from, to, type) across many sourceIds should not use this helper.
 */
export async function deleteEdge(
  orgId: string,
  fromLabel: NodeLabel,
  fromId: string,
  edge: EdgeType,
  toLabel: NodeLabel,
  toId: string
): Promise<boolean> {
  if (!isGraphAvailable()) return false;
  const ok = await ensureTenantGraph(orgId);
  if (!ok) return false;
  // `execCypher` always wraps with `AS (${returnColumns})`, so the
  // Cypher MUST end in a RETURN with at least one column or the
  // generated SQL is invalid (`AS ()`). A constant `1` keeps the
  // delete tally cheap and matches the agtype contract.
  const cypher =
    `MATCH (a:${fromLabel} {id: ${escapeCypherString(fromId)}})` +
    `-[r:${edge}]->` +
    `(b:${toLabel} {id: ${escapeCypherString(toId)}}) ` +
    `DELETE r ` +
    `RETURN 1 AS deleted`;
  const res = await execCypher(orgId, cypher, "deleted agtype");
  return res.ok;
}

/**
 * Failure modes observed on equipment of the same `type` as the given
 * equipment, ranked by occurrence count. Counts are derived from
 * distinct edge `sourceId`s so re-running the backfill never inflates
 * the count.
 */
/**
 * Decode an AGE agtype value into a plain JS value. Centralised so
 * that adapter callers don't open-code `String(v).replace(/"/g, '')`
 * everywhere (reviewer's eighth-pass non-blocking comment — brittle
 * inline string-stripping was a regression risk as query shapes
 * expand).
 *
 * AGE returns agtype as a string in node-postgres: scalars come back
 * as JSON-ish ('"foo"' for strings, '123' for numbers, 'null'); we
 * try JSON.parse first and only fall back to raw-string stripping
 * when the value isn't parseable.
 */
function decodeAgtype(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  const s = String(v);
  try {
    return JSON.parse(s);
  } catch {
    // Last-resort: strip quote artifacts so legacy paths keep working.
    return s.replace(/^"|"$/g, "");
  }
}
function agString(v: unknown): string {
  const d = decodeAgtype(v);
  return d === null || d === undefined ? "" : String(d);
}
function agNumber(v: unknown): number {
  const d = decodeAgtype(v);
  const n = typeof d === "number" ? d : Number(d);
  return Number.isFinite(n) ? n : 0;
}

export async function findSimilarFailures(
  orgId: string,
  equipmentId: string
): Promise<Array<{ failureMode: string; occurrences: number }>> {
  const cypher =
    `MATCH (e:Equipment {id: ${escapeCypherString(equipmentId)}}) ` +
    `MATCH (peer:Equipment)-[r:HAS_FAILURE_MODE]->(fm:FailureMode) ` +
    `WHERE peer.type = e.type ` +
    `RETURN fm.id AS failureMode, count(DISTINCT r.sourceId) AS occurrences ` +
    `ORDER BY occurrences DESC LIMIT 10`;
  const res = await execCypher(orgId, cypher, "failureMode agtype, occurrences agtype");
  return res.rows.map((r) => ({
    failureMode: agString(r.failureMode),
    occurrences: agNumber(r.occurrences),
  }));
}

/**
 * Parts historically required for a given failure mode, ranked by
 * distinct-source-row count. Idempotent under backfill replay.
 */
export async function whatPartsForFailureMode(
  orgId: string,
  failureMode: string
): Promise<Array<{ partId: string; occurrences: number }>> {
  const cypher =
    `MATCH (fm:FailureMode {id: ${escapeCypherString(failureMode)}}) ` +
    `MATCH (fm)-[r:REQUIRES_PART]->(p:Part) ` +
    `RETURN p.id AS partId, count(DISTINCT r.sourceId) AS occurrences ` +
    `ORDER BY occurrences DESC LIMIT 25`;
  const res = await execCypher(orgId, cypher, "partId agtype, occurrences agtype");
  return res.rows.map((r) => ({
    partId: agString(r.partId),
    occurrences: agNumber(r.occurrences),
  }));
}

/**
 * Equipment downstream of the given equipment via DEPENDS_ON edges
 * (admin-curated dependency graph).
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
  const res = await execCypher(orgId, cypher, "equipmentId agtype, hops agtype");
  return res.rows.map((r) => ({
    equipmentId: agString(r.equipmentId),
    hops: agNumber(r.hops),
  }));
}
