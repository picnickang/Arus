/**
 * Task #211 — verifyAuditChain regression for mixed hash versions.
 *
 * Seeds a small audit chain for a synthetic tenant containing both
 * legacy `hash_version=1` (pre-orgId-binding) rows and current
 * `hash_version=2` (orgId-bound) rows, then asserts that
 * `verifyAuditChain` validates the chain end-to-end via the
 * per-row dispatch in `server/compliance/immutable-audit/verify.ts`.
 *
 * Also asserts a v2 row whose hash was computed under v1 rules fails
 * verification — confirming the dispatch is actually being honoured
 * rather than silently coercing every row to one version.
 *
 * Uses raw SQL (no drizzle schema-runtime import) so this file does
 * not trip the dual-mode schema-facade limitation documented in
 * tests/integration/README.md.
 */
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { sql } from "drizzle-orm";

const ORG = `task211-mixed-hash-${Date.now()}`;

describe("Task #211 — verifyAuditChain validates mixed v1/v2 chains", () => {
  let db: typeof import("../../server/db-config")["db"];
  let pool: typeof import("../../server/db-config")["pool"];
  let computeAuditHash: typeof import("../../server/compliance/immutable-audit/hashing")["computeAuditHash"];
  let verifyAuditChain: typeof import("../../server/compliance/immutable-audit/verify")["verifyAuditChain"];

  beforeAll(async () => {
    ({ db, pool } = await import("../../server/db-config"));
    ({ computeAuditHash } = await import("../../server/compliance/immutable-audit/hashing"));
    ({ verifyAuditChain } = await import("../../server/compliance/immutable-audit/verify"));
    if (!pool) {
      throw new Error("Task #211 integration test requires the PostgreSQL pool");
    }
    await db.execute(sql`DELETE FROM immutable_audit_trail WHERE org_id = ${ORG}`);
  }, 60000);

  afterAll(async () => {
    try {
      await db.execute(sql`DELETE FROM immutable_audit_trail WHERE org_id = ${ORG}`);
    } catch {
      // best effort
    }
  });

  type SeedRow = {
    version: 1 | 2;
    eventType: string;
    timestamp: Date;
  };

  async function seedChain(rows: SeedRow[]): Promise<string[]> {
    const ids: string[] = [];
    let prevHash: string | null = null;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const id = crypto.randomUUID();
      const hash = computeAuditHash(
        prevHash,
        ORG,
        row.timestamp,
        "work_order",
        `wo-${i}`,
        "operation",
        row.eventType,
        "test-user",
        { status: "open" },
        { status: "done" },
        row.version,
      );
      await db.execute(sql`
        INSERT INTO immutable_audit_trail (
          id, org_id, event_category, event_type, entity_type, entity_id,
          previous_state, new_state, performed_by, performed_by_type,
          event_timestamp, server_timestamp, prev_hash, hash, hash_version,
          retention_required
        ) VALUES (
          ${id}, ${ORG}, 'operation', ${row.eventType}, 'work_order', ${`wo-${i}`},
          ${JSON.stringify({ status: "open" })}::jsonb,
          ${JSON.stringify({ status: "done" })}::jsonb,
          'test-user', 'user',
          ${row.timestamp.toISOString()}::timestamptz,
          ${row.timestamp.toISOString()}::timestamptz,
          ${prevHash},
          ${hash},
          ${row.version},
          true
        )
      `);
      ids.push(id);
      prevHash = hash;
    }
    return ids;
  }

  it("verifies a chain containing both hash_version=1 and hash_version=2 rows", async () => {
    const t0 = new Date("2025-01-01T00:00:00Z").getTime();
    const seed: SeedRow[] = [
      { version: 1, eventType: "create", timestamp: new Date(t0 + 0) },
      { version: 1, eventType: "update", timestamp: new Date(t0 + 1000) },
      { version: 2, eventType: "update", timestamp: new Date(t0 + 2000) },
      { version: 2, eventType: "complete", timestamp: new Date(t0 + 3000) },
    ];
    await seedChain(seed);

    const result = await verifyAuditChain(ORG);
    expect(result).toMatchObject({ valid: true, recordsVerified: seed.length });
  });

  it("detects a v2 row whose hash was computed under v1 rules (proves dispatch is honoured)", async () => {
    await db.execute(sql`DELETE FROM immutable_audit_trail WHERE org_id = ${ORG}`);
    const ts = new Date("2025-02-01T00:00:00Z");

    // Compute the row's hash using the v1 payload shape, but store it
    // with hash_version=2 — the verifier will rehash under v2 rules
    // and the stored hash MUST NOT match.
    const id = crypto.randomUUID();
    const v1Hash = computeAuditHash(
      null,
      ORG,
      ts,
      "work_order",
      "wo-mismatch",
      "operation",
      "create",
      "test-user",
      { status: "open" },
      { status: "done" },
      1,
    );
    await db.execute(sql`
      INSERT INTO immutable_audit_trail (
        id, org_id, event_category, event_type, entity_type, entity_id,
        previous_state, new_state, performed_by, performed_by_type,
        event_timestamp, server_timestamp, prev_hash, hash, hash_version,
        retention_required
      ) VALUES (
        ${id}, ${ORG}, 'operation', 'create', 'work_order', 'wo-mismatch',
        ${JSON.stringify({ status: "open" })}::jsonb,
        ${JSON.stringify({ status: "done" })}::jsonb,
        'test-user', 'user',
        ${ts.toISOString()}::timestamptz,
        ${ts.toISOString()}::timestamptz,
        NULL,
        ${v1Hash},
        2,
        true
      )
    `);

    const result = await verifyAuditChain(ORG);
    expect(result.valid).toBe(false);
    expect(result.brokenRecordId).toBe(id);
    expect(result.error).toMatch(/Hash mismatch/);
  });
});
