/**
 * Task #106 — Tenant usage counters must clamp at zero.
 *
 * `quotaService.incrementUsage(orgId, metric, delta)` is the single
 * writer for `tenant_usage.value`. Task #89 introduced negative
 * deltas (KB document deletes shrink the storage counter); a racing,
 * double-fired or replayed decrement would otherwise let the counter
 * drift negative and silently widen the tenant's effective quota.
 *
 * The fix clamps inside the SQL itself with `GREATEST(0, ...)` —
 *   - on the `VALUES (...)` row so a first-ever insert with a
 *     negative delta lands at 0 (not a negative starting value), AND
 *   - on the `ON CONFLICT DO UPDATE` branch, applying the RAW signed
 *     delta against the existing row and clamping the result, so a
 *     -5 against an existing 10 lands at 5 (not 10 — using
 *     `EXCLUDED.value` here would silently turn every decrement into
 *     a no-op because the VALUES branch is already clamped to 0).
 *
 * These tests assert both the SQL shape and the resulting behaviour
 * by driving the service through an in-memory executor that mimics
 * the Postgres upsert semantics. A complementary DB-level
 * `CHECK (value >= 0)` constraint lives in
 * `migrations/0020_tenant_usage_non_negative.sql` for defense in
 * depth against any future writer that bypasses this service.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  QuotaService,
  type SqlExecutor,
} from "../../server/tenancy/quota-service";

interface CapturedQuery {
  raw: string;
}

/**
 * In-memory `(org_id, metric, window_start) -> value` table that
 * understands the exact `INSERT ... ON CONFLICT DO UPDATE` shape the
 * service emits. This lets the tests assert real behaviour
 * (decrement-from-existing, floor-at-zero, no-op on missing-row +
 * negative delta) without needing a live Postgres.
 */
class SimulatedUsageTable implements SqlExecutor {
  public calls: CapturedQuery[] = [];
  public rows = new Map<string, number>();

  seed(orgId: string, metric: string, windowStart: string, value: number): void {
    this.rows.set(this.key(orgId, metric, windowStart), value);
  }

  get(orgId: string, metric: string, windowStart: string): number {
    return this.rows.get(this.key(orgId, metric, windowStart)) ?? 0;
  }

  private key(orgId: string, metric: string, windowStart: string): string {
    return `${orgId}|${metric}|${windowStart}`;
  }

  async execute(query: unknown): Promise<unknown> {
    const q = query as { queryChunks?: Array<{ value?: string[] }> };
    const raw = q?.queryChunks?.[0]?.value?.[0] ?? "";
    this.calls.push({ raw });

    if (!/INSERT INTO tenant_usage/.test(raw)) {
      return { rows: [] };
    }

    // VALUES ('org', 'metric', 'yyyy-mm-dd', GREATEST(0, <delta>))
    const valuesMatch = raw.match(
      /VALUES \('((?:[^']|'')+)', '([^']+)', '([^']+)', GREATEST\(0, (-?\d+)\)\)/,
    );
    // DO UPDATE SET value = GREATEST(0, tenant_usage.value + (<delta>))
    const updateMatch = raw.match(
      /DO UPDATE SET value = GREATEST\(0, tenant_usage\.value \+ \((-?\d+)\)\)/,
    );

    if (!valuesMatch || !updateMatch) {
      throw new Error(`Unexpected SQL shape:\n${raw}`);
    }

    const orgId = valuesMatch[1]!.replace(/''/g, "'");
    const metric = valuesMatch[2]!;
    const windowStart = valuesMatch[3]!;
    const insertDelta = Number(valuesMatch[4]);
    const updateDelta = Number(updateMatch[1]);

    // Both branches must carry the SAME raw signed delta. If they
    // diverge, the service is broken.
    expect(insertDelta).toBe(updateDelta);

    const key = this.key(orgId, metric, windowStart);
    if (this.rows.has(key)) {
      const next = Math.max(0, this.rows.get(key)! + updateDelta);
      this.rows.set(key, next);
    } else {
      this.rows.set(key, Math.max(0, insertDelta));
    }
    return { rows: [] };
  }
}

let table: SimulatedUsageTable;
let service: QuotaService;

beforeEach(() => {
  table = new SimulatedUsageTable();
  service = new QuotaService(table);
});

function lastSql(): string {
  expect(table.calls.length).toBeGreaterThan(0);
  return table.calls[table.calls.length - 1]!.raw;
}

describe("QuotaService.incrementUsage — SQL shape", () => {
  it("clamps the UPDATE branch with GREATEST(0, ...) and uses the RAW signed delta (not EXCLUDED.value)", async () => {
    await service.incrementUsage("org-A", "storage_bytes", -999_999_999);
    const sql = lastSql();
    expect(sql).toMatch(
      /DO UPDATE SET value = GREATEST\(0, tenant_usage\.value \+ \(-999999999\)\)/,
    );
    // Regression guard: must NOT use EXCLUDED.value in the UPDATE —
    // EXCLUDED.value is the already-clamped VALUES row, which would
    // turn every decrement into a no-op against an existing row.
    expect(sql).not.toMatch(/EXCLUDED\.value/);
  });

  it("clamps the VALUES branch so a first-ever insert with a negative delta lands at 0", async () => {
    await service.incrementUsage("org-B", "storage_bytes", -42);
    expect(lastSql()).toMatch(
      /VALUES \('org-B', 'storage_bytes', '[^']+', GREATEST\(0, -42\)\)/,
    );
  });

  it("escapes single quotes in orgId on the write path", async () => {
    await service.incrementUsage("o'rg", "storage_bytes", -1);
    expect(lastSql()).toContain("'o''rg'");
  });
});

describe("QuotaService.incrementUsage — behaviour", () => {
  it("decrements an existing positive counter (over-decrement does not silently become a no-op)", async () => {
    table.seed("org-A", "storage_bytes", "1970-01-01", 10);
    await service.incrementUsage("org-A", "storage_bytes", -3);
    expect(table.get("org-A", "storage_bytes", "1970-01-01")).toBe(7);
  });

  it("floors at zero when the decrement exceeds the existing value", async () => {
    table.seed("org-A", "storage_bytes", "1970-01-01", 4);
    await service.incrementUsage("org-A", "storage_bytes", -100);
    expect(table.get("org-A", "storage_bytes", "1970-01-01")).toBe(0);
  });

  it("a replayed decrement on an already-zero row stays at zero (no negative drift)", async () => {
    table.seed("org-A", "storage_bytes", "1970-01-01", 0);
    await service.incrementUsage("org-A", "storage_bytes", -50);
    await service.incrementUsage("org-A", "storage_bytes", -50);
    expect(table.get("org-A", "storage_bytes", "1970-01-01")).toBe(0);
  });

  it("a first-ever insert with a negative delta lands at 0, not negative", async () => {
    await service.incrementUsage("org-Z", "storage_bytes", -42);
    expect(table.get("org-Z", "storage_bytes", "1970-01-01")).toBe(0);
  });

  it("a positive delta still increments normally", async () => {
    table.seed("org-A", "equipment_count", "1970-01-01", 3);
    await service.incrementUsage("org-A", "equipment_count", 5);
    expect(table.get("org-A", "equipment_count", "1970-01-01")).toBe(8);
  });

  it("short-circuits on a zero delta without touching the database", async () => {
    await service.incrementUsage("org-D", "storage_bytes", 0);
    expect(table.calls).toHaveLength(0);
  });

  it("short-circuits on a non-finite delta", async () => {
    await service.incrementUsage("org-E", "storage_bytes", Number.NaN);
    expect(table.calls).toHaveLength(0);
  });
});
