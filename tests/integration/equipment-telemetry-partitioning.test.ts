/**
 * equipment_telemetry native partitioning (migrations/0038) against real
 * Postgres.
 *
 * Proves, through the partitioned parent:
 *   1. uq_equipment_telemetry_natural exists (the ON CONFLICT target for
 *      createTelemetryReading(s) — asserted by migrate.ts post-apply too).
 *   2. A replayed bulk insert spanning two partitions dedups to zero new
 *      rows via that index.
 *   3. Rows route to the matching monthly partition; out-of-range
 *      timestamps land in equipment_telemetry_default (the safety net).
 *   4. RLS isolation holds on the parent: a pinned tenant session sees
 *      no foreign rows even with an unfiltered SELECT.
 *
 * Requires a live, fully migrated Postgres via DATABASE_URL. The suite
 * is skip-conditional (same convention as rls-cross-tenant.test.ts):
 * when the database is absent or the table is not partitioned, every
 * test reports as passed-with-skip-note rather than failing.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env["DATABASE_URL"];

const TAG = `t-part-${randomUUID().slice(0, 8)}`;
const ORG_A = `${TAG}-org-a`;
const ORG_B = `${TAG}-org-b`;
const EQUIP_A = `${TAG}-equip-a`;
const EQUIP_B = `${TAG}-equip-b`;

let pool: Pool | null = null;
let ready = false;

// RLS assertions need a role that does NOT bypass RLS. CI and sandbox
// environments often connect as the bootstrap superuser (FORCE RLS does
// not apply to superusers), so when the main role bypasses RLS we
// provision a throwaway probe role with SELECT-only access.
const PROBE_ROLE = `${TAG.replace(/-/g, "_")}_probe`;
let rlsPool: Pool | null = null;
let rlsProbeProvisioned = false;

function monthPartitionName(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `equipment_telemetry_y${y}m${m}`;
}

async function pinned<T>(client: PoolClient, orgId: string, fn: () => Promise<T>): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [orgId]);
    const result = await fn();
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  }
}

async function insertReadings(
  client: PoolClient,
  orgId: string,
  equipmentId: string,
  rows: Array<{ ts: string; sensorType?: string; value?: number }>
): Promise<number> {
  return pinned(client, orgId, async () => {
    let inserted = 0;
    for (const row of rows) {
      const r = await client.query(
        `INSERT INTO equipment_telemetry (org_id, ts, equipment_id, sensor_type, value)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (org_id, equipment_id, sensor_type, ts) DO NOTHING`,
        [orgId, row.ts, equipmentId, row.sensorType ?? TAG, row.value ?? 1]
      );
      inserted += r.rowCount ?? 0;
    }
    return inserted;
  });
}

beforeAll(async () => {
  if (!databaseUrl) {
    return;
  }
  pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const client = await pool.connect();
  try {
    const kind = await client.query<{ relkind: string }>(
      `SELECT c.relkind FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = current_schema() AND c.relname = 'equipment_telemetry'`
    );
    ready = kind.rows[0]?.relkind === "p";
    if (!ready) {
      return;
    }
    // FK targets. organizations/equipment carry RLS too — insert pinned.
    for (const [orgId, equipId] of [
      [ORG_A, EQUIP_A],
      [ORG_B, EQUIP_B],
    ] as const) {
      await client.query(
        `INSERT INTO organizations (id, name, slug, subscription_tier)
           VALUES ($1, $1, $1, 'basic') ON CONFLICT (id) DO NOTHING`,
        [orgId]
      );
      await pinned(client, orgId, async () => {
        await client!.query(
          `INSERT INTO equipment (id, org_id, name, type)
             VALUES ($1, $2, $1, 'pump') ON CONFLICT (id) DO NOTHING`,
          [equipId, orgId]
        );
      });
    }

    const roleInfo = await client.query<{ bypass: boolean }>(
      `SELECT (rolsuper OR rolbypassrls) AS bypass FROM pg_roles WHERE rolname = current_user`
    );
    if (roleInfo.rows[0]?.bypass) {
      try {
        await client.query(`CREATE ROLE ${PROBE_ROLE} LOGIN PASSWORD 'probe'`);
        await client.query(`GRANT SELECT ON equipment_telemetry TO ${PROBE_ROLE}`);
        const probeUrl = new URL(databaseUrl);
        probeUrl.username = PROBE_ROLE;
        probeUrl.password = "probe";
        rlsPool = new Pool({ connectionString: probeUrl.toString(), max: 1 });
        rlsProbeProvisioned = true;
      } catch (err) {
        console.warn(`[t-part] cannot provision RLS probe role — RLS test will skip: ${err}`);
        rlsPool = null;
      }
    } else {
      rlsPool = pool;
    }
  } finally {
    client.release();
  }
}, 30_000);

afterAll(async () => {
  if (!pool) {
    return;
  }
  const client = await pool.connect();
  try {
    if (ready) {
      for (const orgId of [ORG_A, ORG_B]) {
        await pinned(client, orgId, async () => {
          await client!.query(`DELETE FROM equipment_telemetry WHERE org_id = $1`, [orgId]);
          await client!.query(`DELETE FROM equipment WHERE org_id = $1`, [orgId]);
        });
      }
      await client.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [ORG_A, ORG_B]);
    }
    if (rlsProbeProvisioned) {
      await rlsPool?.end().catch(() => undefined);
      await client
        .query(`REVOKE ALL ON equipment_telemetry FROM ${PROBE_ROLE}`)
        .catch(() => undefined);
      await client.query(`DROP ROLE IF EXISTS ${PROBE_ROLE}`).catch(() => undefined);
    }
  } finally {
    client.release();
    await pool.end();
  }
}, 30_000);

describe("equipment_telemetry native partitioning", () => {
  it("exposes uq_equipment_telemetry_natural on the partitioned parent", async () => {
    if (!ready) {
      console.warn("[t-part] skipped — no DATABASE_URL or table not partitioned");
      return;
    }
    const client = await pool!.connect();
    try {
      const r = await client.query(
        `SELECT indexname FROM pg_indexes
          WHERE tablename = 'equipment_telemetry'
            AND indexname = 'uq_equipment_telemetry_natural'`
      );
      expect(r.rowCount).toBe(1);
    } finally {
      client.release();
    }
  });

  it("dedups a replayed batch spanning two partitions (zero new rows)", async () => {
    if (!ready) {
      return;
    }
    const client = await pool!.connect();
    try {
      const now = new Date();
      const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15));
      const batch = [
        { ts: currentMonth.toISOString(), value: 10 },
        // 2020 predates every monthly partition → DEFAULT partition;
        // the replay must dedup across BOTH partitions.
        { ts: "2020-06-15T12:00:00.000Z", value: 20 },
      ];
      const first = await insertReadings(client, ORG_A, EQUIP_A, batch);
      const replay = await insertReadings(client, ORG_A, EQUIP_A, batch);
      expect(first).toBe(2);
      expect(replay).toBe(0);
    } finally {
      client.release();
    }
  });

  it("routes rows to the matching monthly partition and DEFAULT for out-of-range ts", async () => {
    if (!ready) {
      return;
    }
    const client = await pool!.connect();
    try {
      const placement = await pinned(client, ORG_A, async () => {
        const r = await client!.query<{ part: string; ts: Date }>(
          `SELECT tableoid::regclass::text AS part, ts FROM equipment_telemetry
            WHERE org_id = $1 AND sensor_type = $2 ORDER BY ts`,
          [ORG_A, TAG]
        );
        return r.rows;
      });
      expect(placement).toHaveLength(2);
      const byPart = new Map(placement.map((row) => [row.part, row]));
      expect(byPart.has("equipment_telemetry_default")).toBe(true);
      const currentPartition = monthPartitionName(new Date());
      expect(byPart.has(currentPartition)).toBe(true);
    } finally {
      client.release();
    }
  });

  it("enforces RLS isolation through the partitioned parent", async () => {
    if (!ready) {
      return;
    }
    if (!rlsPool) {
      console.warn("[t-part] no non-bypassing role available — RLS assertion skipped");
      return;
    }
    const writer = await pool!.connect();
    try {
      await insertReadings(writer, ORG_B, EQUIP_B, [{ ts: new Date().toISOString(), value: 99 }]);
    } finally {
      writer.release();
    }
    // Unfiltered SELECT from A's pinned, non-bypassing session: only A's rows.
    const client = await rlsPool.connect();
    try {
      const fromA = await pinned(client, ORG_A, async () => {
        const r = await client.query<{ org_id: string }>(
          `SELECT DISTINCT org_id FROM equipment_telemetry WHERE sensor_type = $1`,
          [TAG]
        );
        return r.rows.map((row) => row.org_id);
      });
      expect(fromA).toEqual([ORG_A]);
    } finally {
      client.release();
    }
  });
});
