/**
 * PdM scoring producer (cloud) — the job that finally writes pdm_score_logs.
 *
 * Seeds two equipment with contrasting telemetry (a flat/healthy sensor and a
 * ramping/degrading one), runs processPdmScoring for the org, and asserts it
 * wrote a pdm_score_logs row per equipment with a data-driven health index
 * (the degrading sensor scores strictly lower). This is the producer behind
 * GET /api/pdm/health and the fleet health surfaces.
 *
 * Requires a live Postgres via DATABASE_URL (the postgres lane); the scheduled
 * cron is cloud-only. Skips with a note when absent.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

import { processPdmScoring } from "../../server/job-processors/pdm-scoring-processor";
import { withTenantContext } from "../../server/middleware/db-context";
import { dbEquipmentStorage } from "../../server/repositories";

const databaseUrl = process.env["DATABASE_URL"];
const RUN = randomUUID().slice(0, 8);
const ORG_ID = `pdmscore-org-${RUN}`;
const EQUIP_FLAT = `flat-${RUN}`;
const EQUIP_RAMP = `ramp-${RUN}`;

let pool: Pool | null = null;
let ready = false;

beforeAll(async () => {
  if (!databaseUrl) {
    return;
  }
  pool = new Pool({ connectionString: databaseUrl, max: 2 });
  pool.on("error", () => undefined);
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [ORG_ID, `PdM Score ${RUN}`, `pdmscore-${RUN}`]
    );
    for (const [eq, label] of [
      [EQUIP_FLAT, "Flat"],
      [EQUIP_RAMP, "Ramp"],
    ] as const) {
      await c.query(
        `INSERT INTO equipment (id, org_id, name, type) VALUES ($1, $2, $3, 'Engine') ON CONFLICT (id) DO NOTHING`,
        [eq, ORG_ID, `${label} ${RUN}`]
      );
    }
    // Flat: constant 80 over the last 240h -> stable -> healthy.
    await c.query(
      `INSERT INTO equipment_telemetry (org_id, equipment_id, sensor_type, value, unit, status, ts)
         SELECT $1, $2, 'temperature', 80, 'C', 'normal', now() - ((g + 1) * interval '1 hour')
         FROM generate_series(0, 239) AS g`,
      [ORG_ID, EQUIP_FLAT]
    );
    // Ramp: rises toward the present (70 -> ~94) -> increasing trend -> degrading.
    await c.query(
      `INSERT INTO equipment_telemetry (org_id, equipment_id, sensor_type, value, unit, status, ts)
         SELECT $1, $2, 'temperature', 70 + (240 - g) * 0.1, 'C', 'normal', now() - ((g + 1) * interval '1 hour')
         FROM generate_series(0, 239) AS g`,
      [ORG_ID, EQUIP_RAMP]
    );
    ready = true;
  } finally {
    c.release();
  }
}, 60000);

afterAll(async () => {
  if (!pool) {
    return;
  }
  try {
    if (ready) {
      for (const stmt of [
        `DELETE FROM pdm_score_logs WHERE org_id = $1`,
        `DELETE FROM equipment_telemetry WHERE org_id = $1`,
        `DELETE FROM equipment WHERE org_id = $1`,
        `DELETE FROM organizations WHERE id = $1`,
      ]) {
        await pool.query(stmt, [ORG_ID]);
      }
    }
  } catch (err) {
    console.warn(
      `[pdm-score] cleanup skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}, 60000);

describe("PdM scoring producer (cloud) — writes pdm_score_logs from telemetry", () => {
  it("scores each equipment; the degrading one gets a lower health index", async () => {
    if (!ready) {
      console.warn("[pdm-score] skipped — no DATABASE_URL");
      return;
    }

    const summary = await processPdmScoring({ orgIds: [ORG_ID] });
    expect(summary.orgsFailed).toBe(0);
    expect(summary.equipmentScored).toBeGreaterThanOrEqual(2);

    const { rows } = await pool!.query(
      `SELECT equipment_id, health_idx, p_fail_30d FROM pdm_score_logs WHERE org_id = $1`,
      [ORG_ID]
    );
    const byEquip = new Map(rows.map((r) => [r.equipment_id, r]));
    const flat = byEquip.get(EQUIP_FLAT);
    const ramp = byEquip.get(EQUIP_RAMP);
    expect(flat).toBeDefined();
    expect(ramp).toBeDefined();

    // Data-driven: the flat/healthy sensor scores strictly higher than the
    // ramping/degrading one, and the degrading one carries a non-zero pFail30d.
    expect(Number(flat.health_idx)).toBeGreaterThan(Number(ramp.health_idx));
    expect(Number(flat.health_idx)).toBeLessThanOrEqual(100);
    expect(Number(ramp.health_idx)).toBeGreaterThanOrEqual(0);
    expect(Number(ramp.p_fail_30d)).toBeGreaterThan(0);

    // B2: getEquipmentHealth now reflects the producer's pdm_score_logs rows
    // instead of the old hardcoded 100. Run it the way production does — under
    // a pinned tenant context — and assert the data-driven health index +
    // status bands flow through (the degrading unit is no longer "healthy").
    const health = await withTenantContext(ORG_ID, () =>
      dbEquipmentStorage.getEquipmentHealth(ORG_ID)
    );
    const healthByEquip = new Map(health.map((h) => [h.id, h]));
    const flatHealth = healthByEquip.get(EQUIP_FLAT);
    const rampHealth = healthByEquip.get(EQUIP_RAMP);
    expect(flatHealth).toBeDefined();
    expect(rampHealth).toBeDefined();

    // The repository surfaces the same numbers it wrote to pdm_score_logs…
    expect(flatHealth!.healthIndex).toBe(Number(flat.health_idx));
    expect(rampHealth!.healthIndex).toBe(Number(ramp.health_idx));
    // …the degrading unit scores strictly lower (the whole point of B2 — pre-B2
    // both were a hardcoded 100)…
    expect(rampHealth!.healthIndex).toBeLessThan(flatHealth!.healthIndex);
    // …and status is derived from the index (healthy >=70 / warning >=30 /
    // critical <30), so the degrading unit is no longer reported "healthy".
    expect(flatHealth!.status).toBe("healthy");
    expect(["warning", "critical"]).toContain(rampHealth!.status);
  });
});
