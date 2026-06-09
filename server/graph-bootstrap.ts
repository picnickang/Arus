/**
 * Push A2 — Apache AGE bootstrap.
 *
 * Mirrors the TimescaleDB opt-in pattern (`server/timescaledb-bootstrap.ts`,
 * Wave 2.8). The graph is gated behind `GRAPH_ENABLED=true`; if the
 * `age` extension is missing or the executing role lacks permission to
 * install it, we log a warning and continue. Downstream adapters
 * (`server/db/graph-adapter.ts`) check `isGraphAvailable()` and degrade
 * to a no-op so the application keeps booting.
 *
 * Tenant isolation: per ADR 001, each tenant gets its own named graph
 * `arus_graph_<orgId>` so cross-tenant traversal is impossible by
 * construction. We do NOT pre-create per-tenant graphs here — they are
 * created lazily on first projector write via `ensureTenantGraph()`.
 */

import type { Pool } from "pg";
import { createLogger } from "./lib/structured-logger";
import { pool } from "./db";

const logger = createLogger("GraphBootstrap");

let graphAvailable = false;
const ensuredTenantGraphs = new Set<string>();

/**
 * Apache AGE conventions:
 *   - `ag_catalog` is the SCHEMA the extension creates (where
 *     `ag_graph`, `cypher()`, etc. live).
 *   - `age` is the LIBRARY name passed to `LOAD` to register the
 *     per-session function set. Loading the schema as a library is
 *     a no-op-then-error path that the reviewer correctly flagged
 *     on the second cut.
 */
const AGE_SCHEMA = "ag_catalog";
const AGE_LIBRARY = "age";

export function isGraphEnabled(): boolean {
  return process.env["GRAPH_ENABLED"] === "true";
}

/** True iff the AGE extension was successfully installed/verified at boot. */
export function isGraphAvailable(): boolean {
  return graphAvailable;
}

function requirePool(): Pool {
  if (!pool) {
    throw new Error("Graph bootstrap requires a PostgreSQL pool");
  }
  return pool;
}

async function extensionInstalled(pg: Pool): Promise<boolean> {
  const res = await pg.query("SELECT 1 FROM pg_extension WHERE extname = 'age' LIMIT 1");
  return res.rowCount !== null && res.rowCount > 0;
}

async function ensureExtension(pg: Pool): Promise<boolean> {
  if (await extensionInstalled(pg)) {
    logger.info("[Graph] Apache AGE extension already installed");
    return true;
  }
  try {
    await pg.query("CREATE EXTENSION IF NOT EXISTS age CASCADE");
    logger.info("[Graph] Apache AGE extension installed");
    return true;
  } catch (err) {
    logger.warn("[Graph] Apache AGE extension not available — graph features disabled", {
      details: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Strict allowlist for graph names. AGE graph names are interpolated
 * into DDL (no bind params for SET / LOAD / create_graph identifiers),
 * so the source string MUST be sanitised the same way the org_id is
 * sanitised in `middleware/db-context.ts`.
 */
export function tenantGraphName(orgId: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(orgId)) {
    throw new Error(`Refusing to derive graph name from invalid orgId: ${orgId}`);
  }
  return `arus_graph_${orgId.replace(/-/g, "_")}`;
}

/**
 * Lazily ensure a per-tenant graph exists. No-ops when AGE is
 * unavailable or `GRAPH_ENABLED` is false. Memoised in-process so the
 * common path is a Set lookup.
 */
export async function ensureTenantGraph(orgId: string): Promise<boolean> {
  if (!graphAvailable) {
    return false;
  }
  const name = tenantGraphName(orgId);
  if (ensuredTenantGraphs.has(name)) {
    return true;
  }
  // LOAD / SET search_path are session-scoped — must run on the SAME
  // physical connection as the create_graph call. Without this, a
  // different pool connection could execute `create_graph` without
  // having `ag_catalog` loaded into its session and fail with
  // "function does not exist".
  const pg = requirePool() as object as {
    connect: () => Promise<{
      query: (q: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
      release: () => void;
    }>;
  };
  let client: {
    query: (q: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    release: () => void;
  } | null = null;
  try {
    client = await pg.connect();
    await client.query(`LOAD '${AGE_LIBRARY}'`);
    await client.query(`SET search_path = ${AGE_SCHEMA}, "$user", public`);
    await client.query(
      `SELECT create_graph($1) WHERE NOT EXISTS (
         SELECT 1 FROM ag_catalog.ag_graph WHERE name = $1
       )`,
      [name]
    );
    ensuredTenantGraphs.add(name);
    return true;
  } catch (err) {
    logger.warn(`[Graph] Failed to ensure tenant graph for ${orgId}`, {
      details: err instanceof Error ? err.message : String(err),
    });
    return false;
  } finally {
    client?.release();
  }
}

/**
 * Lightweight availability smoke check — runs a trivial Cypher
 * round-trip on a scratch tenant graph and logs latency. Reviewer's
 * seventh-pass non-blocking comment: surface empty-graph query
 * latency at startup so degraded AGE installations are visible in
 * boot logs without waiting for the first real query.
 */
async function logGraphSmoke(): Promise<void> {
  if (!graphAvailable) {
    return;
  }
  // Use a scratch tenant ('__smoke__') so we exercise the real
  // create_graph + cypher() round-trip — reviewer's eighth-pass
  // comment: a SELECT 1 doesn't validate the graph-query latency
  // budget, only PG round-trip. ensureTenantGraph is idempotent so
  // subsequent boots are a Set lookup.
  const smokeOrg = "__smoke__";
  const ok = await ensureTenantGraph(smokeOrg);
  if (!ok) {
    logger.warn(`[Graph] availability smoke skipped — tenant graph creation failed`);
    return;
  }
  const graph = tenantGraphName(smokeOrg);
  const pg = requirePool() as object as {
    connect: () => Promise<{
      query: (q: string) => Promise<{ rows: unknown[] }>;
      release: () => void;
    }>;
  };
  let client: { query: (q: string) => Promise<{ rows: unknown[] }>; release: () => void } | null =
    null;
  const started = Date.now();
  try {
    client = await pg.connect();
    await client.query(`LOAD '${AGE_LIBRARY}'`);
    await client.query(`SET search_path = ${AGE_SCHEMA}, "$user", public`);
    await client.query(`SELECT * FROM cypher('${graph}', $$ RETURN 1 $$) AS (r agtype)`);
    const ms = Date.now() - started;
    logger.info(`[Graph] availability smoke ok in ${ms}ms (budget <50ms for empty queries)`);
  } catch (err) {
    logger.warn(`[Graph] availability smoke failed`, {
      details: err instanceof Error ? err.message : String(err),
    });
  } finally {
    client?.release();
  }
}

export async function runGraphBootstrap(): Promise<void> {
  if (!isGraphEnabled()) {
    logger.info("[Graph] Disabled (set GRAPH_ENABLED=true to opt in)");
    return;
  }
  try {
    const pg = requirePool();
    graphAvailable = await ensureExtension(pg);
    if (graphAvailable) {
      logger.info("[Graph] Bootstrap complete — per-tenant graphs created lazily");
      await logGraphSmoke();
    }
  } catch (err) {
    logger.error("[Graph] Bootstrap failed (non-fatal, continuing without graph)", undefined, err);
    graphAvailable = false;
  }
}
