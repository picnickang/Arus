/**
 * Shared helpers for forms + journeys integration tests.
 *
 * Conventions:
 *   - Tests run against the live dev server at TEST_BASE_URL || http://localhost:5000.
 *   - Org context is "default-org-id" via the x-org-id header (single-tenant dev).
 *   - Every record a test creates carries the suite's RUN_ID in a string field
 *     (name / title / description / notes / wo_number / etc) so afterAll can
 *     cascade-delete them via direct SQL on the dev DB without touching unrelated rows.
 *   - For surfaces that are eventually consistent (briefings, attention queues,
 *     dashboards), use `retry()` with a short bounded budget.
 */

import { Pool } from "pg";

export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";
export const TEST_ORG_ID = "default-org-id";

/**
 * Pool is stored on `process` (a singleton truly shared across Jest's
 * sandboxed module registries and globalTeardown's loader) so that
 * `tests/integration/_global-teardown.ts` can close the exact instance the
 * tests opened, rather than re-importing this module and instantiating a
 * fresh Pool that nothing was ever connected through.
 */
const POOL_KEY = "__ARUS_INTEGRATION_PG_POOL__" as const;
type PoolHolder = { [POOL_KEY]?: Pool };
const _holder = process as unknown as PoolHolder;
export const pool: Pool =
  (_holder[POOL_KEY] ??= new Pool({ connectionString: process.env.DATABASE_URL }));

/**
 * Build a fresh RUN_ID for the calling suite. Each test file should create
 * exactly one RUN_ID (top-of-file const) so cleanup matches every row written
 * by that file.
 */
export function makeRunId(prefix = "form"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface ApiResult<T = unknown> {
  status: number;
  data: T;
  ok: boolean;
}

export async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<ApiResult<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-org-id": TEST_ORG_ID,
      "x-user-role": "admin",
      "x-user-id": "forms-integration-test",
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data: data as T, ok: res.ok };
}

/**
 * Retry a predicate until it returns truthy or the budget elapses.
 * Used for eventual-consistency surfaces (cached aggregates, queues).
 */
export async function retry<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 2000;
  const intervalMs = opts.intervalMs ?? 150;
  const deadline = Date.now() + timeoutMs;
  let last: T;
  do {
    last = await fn();
    if (predicate(last)) {return last;}
    await new Promise((r) => setTimeout(r, intervalMs));
  } while (Date.now() < deadline);
  return last;
}

/**
 * Pull one row from a small set of bootstrap entities for tests that need an
 * existing parent (vessel, equipment, crew, supplier). Cached per-process.
 */
let cachedRefs: {
  vesselId?: string;
  equipmentId?: string;
  crewId?: string;
  supplierId?: string;
} = {};

export async function getRefIds(): Promise<{
  vesselId: string;
  equipmentId: string;
  crewId: string;
  supplierId: string;
}> {
  if (
    cachedRefs.vesselId &&
    cachedRefs.equipmentId &&
    cachedRefs.crewId &&
    cachedRefs.supplierId
  ) {
    return cachedRefs as Required<typeof cachedRefs>;
  }
  const [v, e, c, s] = await Promise.all([
    pool.query("SELECT id FROM vessels WHERE org_id=$1 LIMIT 1", [TEST_ORG_ID]),
    pool.query("SELECT id FROM equipment WHERE org_id=$1 AND is_active=true LIMIT 1", [
      TEST_ORG_ID,
    ]),
    pool.query("SELECT id FROM crew WHERE org_id=$1 LIMIT 1", [TEST_ORG_ID]),
    pool.query("SELECT id FROM suppliers WHERE org_id=$1 LIMIT 1", [TEST_ORG_ID]),
  ]);
  cachedRefs = {
    vesselId: v.rows[0]?.id,
    equipmentId: e.rows[0]?.id,
    crewId: c.rows[0]?.id,
    supplierId: s.rows[0]?.id,
  };
  if (
    !cachedRefs.vesselId ||
    !cachedRefs.equipmentId ||
    !cachedRefs.crewId ||
    !cachedRefs.supplierId
  ) {
    throw new Error(
      `Missing seed data for tests — need at least 1 vessel/equipment/crew/supplier in org ${TEST_ORG_ID}`
    );
  }
  return cachedRefs as Required<typeof cachedRefs>;
}

/**
 * Best-effort cleanup of every row whose stringified payload contains RUN_ID.
 * Each test file passes the tables it touched. Errors are swallowed so a failed
 * test never poisons subsequent suites.
 *
 * Tables not listed here are owned by the test file's afterAll (or are
 * append-only and get pruned by their own retention).
 */
export async function cleanupByRunId(runId: string, tables: string[]): Promise<void> {
  // Allowlist table names so a regression in a caller can never inject SQL via
  // the dynamic DELETE FROM target.
  const SAFE_TABLE = /^[a-z_][a-z0-9_]{0,63}$/;
  for (const table of tables) {
    if (!SAFE_TABLE.test(table)) {continue;}
    try {
      // We pick a defensive WHERE clause that joins all known string columns
      // for the few tables we actually touch. The DELETE uses ::text casting so
      // it works for jsonb / text / varchar uniformly.
      const { rows } = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = $1
           AND table_schema = 'public'
           AND data_type IN ('text','character varying','jsonb','json')`,
        [table]
      );
      if (!rows.length) {continue;}
      const cols = rows
        .map((r: { column_name: string }) => r.column_name)
        .filter((c: string) => SAFE_TABLE.test(c))
        .map((c: string) => `coalesce(${c}::text,'')`);
      if (!cols.length) {continue;}
      const where = cols.map((c: string) => `${c} LIKE $1`).join(" OR ");

      // If the table has an org_id column, scope cleanup to TEST_ORG_ID so we
      // can never delete unrelated tenant rows even if a RUN_ID collision
      // occurred.
      const { rows: hasOrgId } = await pool.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = $1 AND table_schema='public' AND column_name='org_id' LIMIT 1`,
        [table]
      );
      if (hasOrgId.length) {
        await pool.query(
          `DELETE FROM ${table} WHERE org_id = $2 AND (${where})`,
          [`%${runId}%`, TEST_ORG_ID]
        );
      } else {
        await pool.query(`DELETE FROM ${table} WHERE ${where}`, [`%${runId}%`]);
      }
    } catch {
      // Swallow — cleanup is best-effort.
    }
  }
}

/**
 * Small assertion helper: fetch a list endpoint and assert the predicate
 * matches at least one row. Auto-handles either bare-array or
 * { items: [], data: [] } pagination shapes.
 */
export async function expectInList<T = unknown>(
  path: string,
  predicate: (item: T) => boolean,
  message: string
): Promise<T> {
  const { status, data } = await api<unknown>("GET", path);
  if (status !== 200) {
    throw new Error(`${message}: GET ${path} returned ${status}`);
  }
  const items = Array.isArray(data)
    ? (data as T[])
    : ((data as { items?: T[]; data?: T[] }).items ?? (data as { data?: T[] }).data ?? []);
  const hit = items.find(predicate);
  if (!hit) {
    throw new Error(`${message}: not found in ${path} (${items.length} items scanned)`);
  }
  return hit;
}

/**
 * Run a list of GETs and assert every one returns 2xx — a cheap "downstream
 * surfaces still respond after a write" smoke check.
 */
export async function assertSurfacesHealthy(paths: string[]): Promise<void> {
  const results = await Promise.all(paths.map((p) => api("GET", p)));
  results.forEach((r, i) => {
    if (r.status >= 400) {
      throw new Error(`Downstream surface ${paths[i]} failed: status ${r.status}`);
    }
  });
}
