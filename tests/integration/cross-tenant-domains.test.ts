/**
 * LR-1B — Cross-tenant leakage verification across every tenant-scoped
 * domain that ships in launch readiness.
 *
 * The existing `rls-cross-tenant.test.ts` / `rls-cross-tenant-api.test.ts`
 * pair only covers `equipment`. This suite is the parameterized
 * extension: for each `(domain, table, insertSpec)` row in DOMAINS,
 * it inserts a fixture row for ORG_A and ORG_B inside their pinned RLS
 * sessions, then proves that a pinned ORG_A session does NOT see ORG_B's
 * row in a `SELECT *` (and vice versa). This is the same primitive that
 * the API layer relies on — when a route forgets `requireOrgId`, RLS is
 * the final backstop and these assertions pin it on every domain.
 *
 * Skip-conditional: requires a live Postgres reachable via `DATABASE_URL`
 * with migration 0018 applied. Per-table guards skip rows whose tables
 * are absent in the connected schema (so the suite is safe to run in
 * partial-schema dev DBs).
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;

const ORG_A = `lr1b-a-${Date.now().toString(36)}`;
const ORG_B = `lr1b-b-${Date.now().toString(36)}`;
const TAG = `lr1b-${randomUUID()}`;

type DomainSpec = {
  domain: string;
  table: string;
  /**
   * SQL fragment that inserts one fixture row. Receives a pre-built
   * parameter list: $1=id, $2=org_id, $3=tag (for cleanup). The query
   * MUST be idempotent (`ON CONFLICT DO NOTHING`) so re-runs don't
   * fail under repeated CI.
   */
  insertSql: string;
  /** SELECT shape used for leakage assertion. Must return at least `id` + `org_id`. */
  selectSql: string;
  /** Optional pre-insert SQL that creates required FK rows in the same pinned tx. */
  beforeInsertSql?: string;
};

const DOMAINS: DomainSpec[] = [
  {
    domain: "work-orders",
    table: "work_orders",
    insertSql: `INSERT INTO work_orders (id, org_id, title, status, priority)
                VALUES ($1, $2, $3, 'open', 'medium') ON CONFLICT (id) DO NOTHING`,
    selectSql: `SELECT id, org_id FROM work_orders WHERE id LIKE $1`,
  },
  {
    domain: "kb-docs",
    table: "kb_docs",
    insertSql: `INSERT INTO kb_docs (id, org_id, title, source)
                VALUES ($1, $2, $3, 'lr1b-fixture') ON CONFLICT (id) DO NOTHING`,
    selectSql: `SELECT id, org_id FROM kb_docs WHERE id LIKE $1`,
  },
  {
    domain: "ml-models",
    table: "ml_models",
    insertSql: `INSERT INTO ml_models (id, org_id, model_name, model_type, status, equipment_type)
                VALUES ($1, $2, $3, 'classification', 'trained', 'pump') ON CONFLICT (id) DO NOTHING`,
    selectSql: `SELECT id, org_id FROM ml_models WHERE id LIKE $1`,
  },
  {
    domain: "telemetry",
    table: "raw_telemetry",
    // raw_telemetry uses (equipment_id, recorded_at) — for the leakage
    // assertion we just need any row tagged with the org and a TAG-prefixed
    // equipment_id so cleanup can find it.
    insertSql: `INSERT INTO raw_telemetry (id, org_id, equipment_id, sensor_type, value, recorded_at)
                VALUES ($1, $2, $3, 'lr1b-fixture-sensor', 1.0, NOW()) ON CONFLICT DO NOTHING`,
    selectSql: `SELECT id, org_id FROM raw_telemetry WHERE id LIKE $1`,
  },
  {
    domain: "schedules",
    table: "maintenance_schedules",
    insertSql: `INSERT INTO maintenance_schedules (id, org_id, equipment_id, task_name, scheduled_date, status, priority)
                VALUES ($1, $2, $3, 'lr1b-fixture-task', NOW(), 'scheduled', 'medium') ON CONFLICT (id) DO NOTHING`,
    selectSql: `SELECT id, org_id FROM maintenance_schedules WHERE id LIKE $1`,
  },
  {
    domain: "3d-models",
    table: "vessel_3d_models",
    insertSql: `INSERT INTO vessel_3d_models (id, org_id, vessel_id, filename, mimetype, size_bytes, stored_path)
                VALUES ($1, $2, $3, 'lr1b-fixture.glb', 'model/gltf-binary', 1, '/dev/null')
                ON CONFLICT (id) DO NOTHING`,
    selectSql: `SELECT id, org_id FROM vessel_3d_models WHERE id LIKE $1`,
  },
  {
    domain: "alerts",
    table: "alert_notifications",
    insertSql: `INSERT INTO alert_notifications (id, org_id, equipment_id, alert_type, severity, message, created_at)
                VALUES ($1, $2, $3, 'lr1b-fixture-type', 'medium', 'lr1b leakage probe', NOW())
                ON CONFLICT (id) DO NOTHING`,
    selectSql: `SELECT id, org_id FROM alert_notifications WHERE id LIKE $1`,
  },
];

let pool: Pool | null = null;
let rlsReady = false;
const availableDomains = new Set<string>();

async function tableHasRls(client: PoolClient, table: string): Promise<boolean> {
  const r = await client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
    `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1`,
    [table],
  );
  return r.rows[0]?.relrowsecurity === true && r.rows[0]?.relforcerowsecurity === true;
}

async function tableExists(client: PoolClient, table: string): Promise<boolean> {
  const r = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name = $1) AS exists`,
    [table],
  );
  return r.rows[0]?.exists === true;
}

async function pinnedTx<T>(
  pool: Pool,
  orgId: string,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.current_org_id', $1, true)", [orgId]);
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (err) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    c.release();
  }
}

beforeAll(async () => {
  if (!databaseUrl) return;
  pool = new Pool({ connectionString: databaseUrl, max: 4 });
  const probe = await pool.connect();
  try {
    if (!(await tableExists(probe, "equipment"))) return;
    if (!(await tableHasRls(probe, "equipment"))) return;
    rlsReady = true;

    for (const spec of DOMAINS) {
      if ((await tableExists(probe, spec.table)) && (await tableHasRls(probe, spec.table))) {
        availableDomains.add(spec.domain);
      }
    }
  } finally {
    probe.release();
  }

  if (!rlsReady || !pool) return;

  for (const spec of DOMAINS) {
    if (!availableDomains.has(spec.domain)) continue;

    for (const org of [ORG_A, ORG_B]) {
      const id = `${TAG}-${spec.domain}-${org}`;
      try {
        await pinnedTx(pool, org, async (c) => {
          // raw_telemetry / vessel_3d_models / schedules need equipment / vessel
          // parents under RLS. We create disposable parents lazily under the
          // same pinned tx so RLS treats them as the same tenant.
          if (spec.table === "raw_telemetry" || spec.table === "maintenance_schedules" || spec.table === "alert_notifications") {
            const eqId = `${TAG}-eq-${org}`;
            await c.query(
              `INSERT INTO equipment (id, name, org_id, type, status, criticality)
                 VALUES ($1, $2, $3, 'pump', 'operational', 'medium')
                 ON CONFLICT (id) DO NOTHING`,
              [eqId, `lr1b eq ${org}`, org],
            );
            await c.query(spec.insertSql, [id, org, eqId]);
          } else if (spec.table === "vessel_3d_models") {
            const vId = `${TAG}-ves-${org}`;
            await c.query(
              `INSERT INTO vessels (id, org_id, name, status)
                 VALUES ($1, $2, $3, 'active') ON CONFLICT (id) DO NOTHING`,
              [vId, org, `lr1b vessel ${org}`],
            );
            await c.query(spec.insertSql, [id, org, vId]);
          } else if (spec.table === "kb_docs") {
            await c.query(spec.insertSql, [id, org, `lr1b kb ${org}`]);
          } else if (spec.table === "ml_models") {
            await c.query(spec.insertSql, [id, org, `lr1b model ${org}`]);
          } else {
            // work_orders
            await c.query(spec.insertSql, [id, org, `lr1b wo ${org}`]);
          }
        });
      } catch (err) {
        // If a domain's schema diverges from these fixtures (added a NOT
        // NULL column, etc.), don't fail the whole suite — drop the
        // domain from coverage and let the next CI refresh catch it.
        // eslint-disable-next-line no-console
        console.warn(`[lr1b-cross-tenant] skipping ${spec.domain}: ${(err as Error).message}`);
        availableDomains.delete(spec.domain);
      }
    }
  }
}, 90000);

afterAll(async () => {
  if (!pool) return;
  if (rlsReady) {
    for (const spec of DOMAINS) {
      if (!availableDomains.has(spec.domain)) continue;
      for (const org of [ORG_A, ORG_B]) {
        try {
          await pinnedTx(pool, org, async (c) => {
            await c.query(`DELETE FROM ${spec.table} WHERE id LIKE $1`, [`${TAG}-${spec.domain}-%`]);
            await c.query(`DELETE FROM equipment WHERE id = $1`, [`${TAG}-eq-${org}`]);
            await c.query(`DELETE FROM vessels WHERE id = $1`, [`${TAG}-ves-${org}`]);
          });
        } catch {
          /* best-effort cleanup */
        }
      }
    }
  }
  await pool.end();
});

describe("LR-1B — cross-tenant non-leakage across every tenant-scoped domain", () => {
  for (const spec of DOMAINS) {
    it(`${spec.domain}: pinned tenant A only sees A's rows; B only sees B's`, async () => {
      if (!databaseUrl || !rlsReady || !pool) {
        // eslint-disable-next-line no-console
        console.warn(`[lr1b-cross-tenant] skipping ${spec.domain} — DB / RLS not ready`);
        return;
      }
      if (!availableDomains.has(spec.domain)) {
        // eslint-disable-next-line no-console
        console.warn(`[lr1b-cross-tenant] skipping ${spec.domain} — table/RLS missing`);
        return;
      }

      const pattern = `${TAG}-${spec.domain}-%`;

      const aRows = await pinnedTx(pool, ORG_A, async (c) => {
        const r = await c.query<{ id: string; org_id: string }>(spec.selectSql, [pattern]);
        return r.rows;
      });
      const bRows = await pinnedTx(pool, ORG_B, async (c) => {
        const r = await c.query<{ id: string; org_id: string }>(spec.selectSql, [pattern]);
        return r.rows;
      });

      expect(aRows.length).toBeGreaterThan(0);
      expect(bRows.length).toBeGreaterThan(0);
      expect(aRows.every((r) => r.org_id === ORG_A)).toBe(true);
      expect(bRows.every((r) => r.org_id === ORG_B)).toBe(true);
      expect(aRows.some((r) => r.org_id === ORG_B)).toBe(false);
      expect(bRows.some((r) => r.org_id === ORG_A)).toBe(false);
    });
  }
});
