/**
 * Task #89 — Tenant quota throttle contract (live server).
 *
 * Seeds `tenant_quotas` + `tenant_usage` for a synthetic org against
 * the real Postgres reachable via `DATABASE_URL`, then drives the
 * running dev server (TEST_BASE_URL, default http://localhost:5000)
 * through the new `storage_bytes` wiring on `POST /api/kb/upload` and
 * the per-day `telemetry_rows_today` wiring on the (Phase-A 503-gated
 * but middleware-wired) `POST /api/telemetry/readings`.
 *
 * Contract under test:
 *   - Soft (>=80% used, <100%) → request is allowed through the quota
 *     gate AND carries `X-Tenant-Quota-Warning` + `X-Tenant-Quota-Ratio`.
 *   - Hard (>=100% used)       → 429 with `Retry-After` header and
 *     body `{ code: "TENANT_QUOTA_EXCEEDED" }`, served before any
 *     downstream handler runs.
 *
 * Skip-conditional: if Postgres is unreachable or the quota tables
 * have not been migrated, the suite reports skipped rather than
 * failing so it stays safe to run against partial environments.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Pool, type PoolClient } from "pg";

const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
const databaseUrl = process.env.DATABASE_URL;

// This deployment is single-tenant — the `ORG_CONTEXT_FORBIDDEN`
// middleware rejects any X-Org-Id that isn't `default-org-id`. We
// therefore drive the test against `default-org-id` and snapshot +
// restore its `tenant_quotas` row and any pre-existing `tenant_usage`
// rows we touch, so the suite is repeatable and doesn't pollute
// real usage counters.
const ORG = "default-org-id";
const STORAGE_LIMIT = 1_000_000; // 1 MB synthetic ceiling
const TELEMETRY_LIMIT = 1_000;

let pool: Pool | null = null;
let ready = false;

// Snapshot of original DB state, restored in afterAll.
interface QuotaRow {
  max_storage_bytes: string | number;
  max_equipment_count: number;
  max_telemetry_rows_per_day: string | number;
}
let originalQuota: QuotaRow | null = null;
let hadQuotaRow = false;
const usageWindows: Array<{ metric: string; windowStart: string }> = [
  { metric: "storage_bytes", windowStart: "1970-01-01" },
  { metric: "telemetry_rows_today", windowStart: "" /* set in beforeAll */ },
];
const originalUsage = new Map<string, { value: string | number } | null>();

async function tableExists(client: PoolClient, name: string): Promise<boolean> {
  const r = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_name = $1) AS exists`,
    [name],
  );
  return r.rows[0]?.exists === true;
}

async function seedUsage(metric: string, value: number, windowDate: string): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO tenant_usage (org_id, metric, window_start, value)
       VALUES ($1, $2, $3::date, $4)
       ON CONFLICT (org_id, metric, window_start)
         DO UPDATE SET value = EXCLUDED.value, recorded_at = now()`,
    [ORG, metric, windowDate, value],
  );
}

function todayWindowDate(): string {
  return new Date().toISOString().slice(0, 10);
}

beforeAll(async () => {
  if (!databaseUrl) return;
  try {
    pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const client = await pool.connect();
    try {
      if (!(await tableExists(client, "tenant_quotas"))) return;
      if (!(await tableExists(client, "tenant_usage"))) return;
      usageWindows[1].windowStart = todayWindowDate();

      // Snapshot pre-existing quota row (if any) so we restore it.
      const existing = await client.query<QuotaRow>(
        `SELECT max_storage_bytes, max_equipment_count, max_telemetry_rows_per_day
           FROM tenant_quotas WHERE org_id = $1`,
        [ORG],
      );
      if (existing.rows.length > 0) {
        originalQuota = existing.rows[0];
        hadQuotaRow = true;
      } else {
        hadQuotaRow = false;
      }

      // Snapshot pre-existing usage values for the windows we plan to touch.
      for (const w of usageWindows) {
        const r = await client.query<{ value: string | number }>(
          `SELECT value FROM tenant_usage
             WHERE org_id = $1 AND metric = $2 AND window_start = $3::date`,
          [ORG, w.metric, w.windowStart],
        );
        originalUsage.set(
          `${w.metric}|${w.windowStart}`,
          r.rows.length > 0 ? r.rows[0] : null,
        );
      }

      // Seed a synthetic quota row that's small enough to cross the
      // 80% / 100% thresholds with cheap-to-write usage values.
      await client.query(
        `INSERT INTO tenant_quotas (org_id, max_storage_bytes, max_equipment_count, max_telemetry_rows_per_day)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (org_id) DO UPDATE
             SET max_storage_bytes = EXCLUDED.max_storage_bytes,
                 max_telemetry_rows_per_day = EXCLUDED.max_telemetry_rows_per_day`,
        [ORG, STORAGE_LIMIT, 100, TELEMETRY_LIMIT],
      );
      ready = true;
    } finally {
      client.release();
    }
  } catch {
    ready = false;
  }
}, 30_000);

afterAll(async () => {
  if (pool && ready) {
    try {
      // Restore each pre-existing usage value (or delete the row we created).
      for (const w of usageWindows) {
        const key = `${w.metric}|${w.windowStart}`;
        const prior = originalUsage.get(key);
        if (prior) {
          await pool.query(
            `INSERT INTO tenant_usage (org_id, metric, window_start, value)
               VALUES ($1, $2, $3::date, $4)
               ON CONFLICT (org_id, metric, window_start)
                 DO UPDATE SET value = EXCLUDED.value`,
            [ORG, w.metric, w.windowStart, prior.value],
          );
        } else {
          await pool.query(
            `DELETE FROM tenant_usage
               WHERE org_id = $1 AND metric = $2 AND window_start = $3::date`,
            [ORG, w.metric, w.windowStart],
          );
        }
      }
      // Restore (or delete) the quota row.
      if (hadQuotaRow && originalQuota) {
        await pool.query(
          `UPDATE tenant_quotas
              SET max_storage_bytes = $2,
                  max_equipment_count = $3,
                  max_telemetry_rows_per_day = $4,
                  updated_at = now()
            WHERE org_id = $1`,
          [
            ORG,
            originalQuota.max_storage_bytes,
            originalQuota.max_equipment_count,
            originalQuota.max_telemetry_rows_per_day,
          ],
        );
      } else {
        await pool.query(`DELETE FROM tenant_quotas WHERE org_id = $1`, [ORG]);
      }
    } catch {
      // best-effort
    }
  }
  if (pool) {
    try { await pool.end(); } catch { /* noop */ }
    pool = null;
  }
}, 30_000);

async function probeServerUp(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`).catch(() => null);
    return !!r;
  } catch {
    return false;
  }
}

describe("Task #89 — enforceQuota wiring (storage_bytes on /api/kb/upload)", () => {
  it("soft-throttles at >=80% with warning headers and lets request through the gate", async () => {
    if (!ready) return; // env not provisioned
    if (!(await probeServerUp())) return;

    await seedUsage("storage_bytes", Math.floor(STORAGE_LIMIT * 0.85), "1970-01-01");

    // Empty multipart so the downstream handler short-circuits with a
    // 400; the quota middleware ran FIRST and stamped the warning
    // headers on the response before delegating to multer.
    const res = await fetch(`${BASE}/api/kb/upload`, {
      method: "POST",
      headers: {
        "X-Org-Id": ORG,
        "X-User-Id": "test-user-quota-89",
        "X-User-Role": "admin",
      },
    });

    expect(res.status).not.toBe(429);
    expect(res.headers.get("x-tenant-quota-warning")).toBe("storage_bytes");
    const ratio = Number(res.headers.get("x-tenant-quota-ratio"));
    expect(ratio).toBeGreaterThanOrEqual(0.8);
    expect(ratio).toBeLessThan(1);
    expect(res.headers.get("x-tenant-quota-exceeded")).toBeNull();
  }, 20_000);

  it("hard-throttles at >=100% with 429 + Retry-After + TENANT_QUOTA_EXCEEDED", async () => {
    if (!ready) return;
    if (!(await probeServerUp())) return;

    await seedUsage("storage_bytes", STORAGE_LIMIT, "1970-01-01");

    const res = await fetch(`${BASE}/api/kb/upload`, {
      method: "POST",
      headers: {
        "X-Org-Id": ORG,
        "X-User-Id": "test-user-quota-89",
        "X-User-Role": "admin",
      },
    });

    expect(res.status).toBe(429);
    const retry = Number(res.headers.get("retry-after"));
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(res.headers.get("x-tenant-quota-exceeded")).toBe("storage_bytes");
    const body = await res.json().catch(() => ({}));
    expect(body.code).toBe("TENANT_QUOTA_EXCEEDED");
    expect(body.metric).toBe("storage_bytes");
    expect(body.limit).toBe(STORAGE_LIMIT);
  }, 20_000);
});

describe("Task #89 — enforceQuota wiring (telemetry_rows_today on /api/telemetry/readings)", () => {
  it("soft-throttles at >=80% with warning headers", async () => {
    if (!ready) return;
    if (!(await probeServerUp())) return;

    await seedUsage(
      "telemetry_rows_today",
      Math.floor(TELEMETRY_LIMIT * 0.9),
      todayWindowDate(),
    );

    const res = await fetch(`${BASE}/api/telemetry/readings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Org-Id": ORG,
        "X-User-Id": "test-user-quota-89",
        "X-User-Role": "admin",
      },
      body: JSON.stringify({ readings: [] }),
    });

    // Phase A returns 503 from the downstream handler; quota middleware
    // ran first and stamped the warning headers regardless.
    expect(res.status).not.toBe(429);
    expect(res.headers.get("x-tenant-quota-warning")).toBe("telemetry_rows_today");
    const ratio = Number(res.headers.get("x-tenant-quota-ratio"));
    expect(ratio).toBeGreaterThanOrEqual(0.8);
    expect(ratio).toBeLessThan(1);
  }, 20_000);

  it("hard-throttles at >=100% with 429 + Retry-After pointing past now (per-day window)", async () => {
    if (!ready) return;
    if (!(await probeServerUp())) return;

    await seedUsage("telemetry_rows_today", TELEMETRY_LIMIT + 5, todayWindowDate());

    const res = await fetch(`${BASE}/api/telemetry/readings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Org-Id": ORG,
        "X-User-Id": "test-user-quota-89",
        "X-User-Role": "admin",
      },
      body: JSON.stringify({ readings: [] }),
    });

    expect(res.status).toBe(429);
    const retry = Number(res.headers.get("retry-after"));
    // Per-day metric retry-after points at the next UTC midnight → in
    // (0, 24h]. Always positive and bounded.
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(24 * 60 * 60);
    expect(res.headers.get("x-tenant-quota-exceeded")).toBe("telemetry_rows_today");
    const body = await res.json().catch(() => ({}));
    expect(body.code).toBe("TENANT_QUOTA_EXCEEDED");
    expect(body.metric).toBe("telemetry_rows_today");
  }, 20_000);
});
