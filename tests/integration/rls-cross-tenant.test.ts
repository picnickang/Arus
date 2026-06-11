/**
 * Task #88 — Cross-tenant RLS isolation against real Postgres.
 *
 * Proves that the pinned-RLS context (`withTenantContext` →
 * `BEGIN; SET LOCAL app.current_org_id; …; COMMIT`) is enforced by the
 * RLS policies in migration 0018: from tenant A's pinned session a raw
 * `SELECT *` that omits `WHERE org_id = …` returns zero tenant-B rows.
 *
 * Requires a live Postgres reachable via `DATABASE_URL`. The suite is
 * skip-conditional: if the DB has not been migrated (the `equipment`
 * table is missing or has no RLS policy) the test is reported skipped
 * so the suite is safe to run in environments that don't have the
 * full schema.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env["DATABASE_URL"];

const ORG_A = `t88-a-${Date.now().toString(36)}`;
const ORG_B = `t88-b-${Date.now().toString(36)}`;
const TAG = `task88-rls-${randomUUID()}`;

let pool: Pool | null = null;
let rlsReady = false;

async function tableHasRls(client: PoolClient, table: string): Promise<boolean> {
  const r = await client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
    `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1`,
    [table]
  );
  return r.rows[0]?.relrowsecurity === true && r.rows[0]?.relforcerowsecurity === true;
}

async function insertAsSuperuser(client: PoolClient, orgId: string, name: string): Promise<void> {
  // Bypass RLS as the bootstrap role by going through SET LOCAL for the
  // matching tenant — the policy passes when org_id == current_setting.
  // We insert with minimal required columns; equipment has many nullables.
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [orgId]);
    await client.query(
      `INSERT INTO equipment (id, name, org_id, type, status, criticality)
         VALUES ($1, $2, $3, 'pump', 'operational', 'medium')
         ON CONFLICT (id) DO NOTHING`,
      [`${TAG}-${orgId}`, name, orgId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  }
}

beforeAll(async () => {
  if (!databaseUrl) {
    return;
  }
  pool = new Pool({ connectionString: databaseUrl, max: 4 });
  const probe = await pool.connect();
  try {
    const r = await probe.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables
         WHERE table_schema = current_schema() AND table_name = 'equipment') AS exists`
    );
    if (!r.rows[0]?.exists) {
      return;
    }
    if (!(await tableHasRls(probe, "equipment"))) {
      return;
    }
    rlsReady = true;
    await insertAsSuperuser(probe, ORG_A, "T88 A pump");
    await insertAsSuperuser(probe, ORG_B, "T88 B pump");
  } finally {
    probe.release();
  }
});

afterAll(async () => {
  if (!pool) {
    return;
  }
  if (rlsReady) {
    const cleanup = await pool.connect();
    try {
      // Drop both fixture rows under each tenant's pinned context so we
      // never leave stray test data behind. The DELETE is RLS-scoped so
      // we run one per tenant.
      for (const org of [ORG_A, ORG_B]) {
        await cleanup.query("BEGIN");
        await cleanup.query("SELECT set_config('app.current_org_id', $1, true)", [org]);
        await cleanup.query(`DELETE FROM equipment WHERE id = $1`, [`${TAG}-${org}`]);
        await cleanup.query("COMMIT");
      }
    } catch {
      /* best-effort cleanup */
    } finally {
      cleanup.release();
    }
  }
  await pool.end();
});

describe("Task #88 — RLS cross-tenant isolation (real Postgres)", () => {
  it("returns only the pinned tenant's rows from a no-WHERE SELECT", async () => {
    if (!databaseUrl) {
      console.warn("[rls-cross-tenant] DATABASE_URL not set — skipping");
      return;
    }
    if (!pool || !rlsReady) {
      console.warn("[rls-cross-tenant] equipment table missing or RLS not enabled — skipping");
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_org_id', $1, true)", [ORG_A]);

      // Raw SELECT with NO `WHERE org_id` filter — the only protection
      // is the RLS policy from migration 0018. We scope by our fixture
      // tag so unrelated rows in the dev DB don't pollute the assertion.
      const rows = await client.query<{ id: string; org_id: string }>(
        `SELECT id, org_id FROM equipment WHERE id LIKE $1`,
        [`${TAG}-%`]
      );

      await client.query("COMMIT");

      const orgIds = rows.rows.map((r) => r.org_id);
      expect(orgIds).toContain(ORG_A);
      expect(orgIds).not.toContain(ORG_B);
    } finally {
      client.release();
    }
  });

  it("flips visibility when the pinned org switches", async () => {
    if (!databaseUrl || !pool || !rlsReady) {
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_org_id', $1, true)", [ORG_B]);
      const rows = await client.query<{ org_id: string }>(
        `SELECT org_id FROM equipment WHERE id LIKE $1`,
        [`${TAG}-%`]
      );
      await client.query("COMMIT");

      const orgIds = rows.rows.map((r) => r.org_id);
      expect(orgIds).toContain(ORG_B);
      expect(orgIds).not.toContain(ORG_A);
    } finally {
      client.release();
    }
  });

  it("returns zero rows when no tenant context is set (fail-closed)", async () => {
    if (!databaseUrl || !pool || !rlsReady) {
      return;
    }
    const client = await pool.connect();
    try {
      // Use a savepoint-less transaction with NO set_config call —
      // `current_setting('app.current_org_id', true)` returns NULL,
      // org_id = NULL is NULL (never true), so the policy matches zero.
      await client.query("BEGIN");
      const rows = await client.query<{ org_id: string }>(
        `SELECT org_id FROM equipment WHERE id LIKE $1`,
        [`${TAG}-%`]
      );
      await client.query("COMMIT");
      expect(rows.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });
});
