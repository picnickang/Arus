/**
 * Dual-driver coverage for the durable idempotency store (L2 behind the
 * in-memory idempotency cache). The sqlite DDL has NOT NULL org_id /
 * idempotency_key / request_hash columns that the pg table lacks, so the
 * repository builds INSERT values conditionally — a drift here would
 * silently disable restart-survival on vessels (storeResponse is
 * fire-and-forget and only warns).
 *
 * Pattern follows dual-driver-query-parity.test.ts: real round-trip on an
 * in-memory libsql database (DDL copied from server/sqlite/core-tables.ts),
 * compile-only .toSQL() assertions on the pg side, and $inferInsert shape
 * pins. Tables are imported CONCRETELY (not via @shared/schema-runtime,
 * which jest maps to a CLOUD-mode mock).
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type Client as LibsqlClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { eq, gt } from "drizzle-orm";
import { requestIdempotency } from "../../shared/schema";
import { requestIdempotencySqlite } from "../../shared/sqlite-schema/sync";
import {
  buildIdempotencyInsertValues,
  type IdempotencyStoreEntry,
} from "../../server/storage/idempotency-repository";

// Must match server/sqlite/core-tables.ts (request_idempotency DDL).
const SQLITE_DDL = `CREATE TABLE IF NOT EXISTS request_idempotency (key TEXT PRIMARY KEY, org_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT UNIQUE, response_status INTEGER, response_body TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`;

function sampleEntry(overrides: Partial<IdempotencyStoreEntry> = {}): IdempotencyStoreEntry {
  return {
    fullKey: "org-1:POST:/api/work-orders:client-mutation:abc",
    orgId: "org-1",
    idempotencyKey: "client-mutation:abc",
    requestHash: "hash-abc",
    statusCode: 201,
    body: { id: "wo-1" },
    ttlMs: 60_000,
    ...overrides,
  };
}

describe("idempotency durable store — dual-driver parity", () => {
  let sqliteClient: LibsqlClient;
  let sqliteDb: ReturnType<typeof drizzleLibsql>;

  beforeAll(async () => {
    sqliteClient = createClient({ url: ":memory:" });
    sqliteDb = drizzleLibsql(sqliteClient);
    await sqliteClient.execute(SQLITE_DDL);
  });

  afterAll(() => {
    sqliteClient.close();
  });

  it("the DDL snapshot matches server/sqlite/core-tables.ts", () => {
    const coreTables = readFileSync(
      path.join(process.cwd(), "server/sqlite/core-tables.ts"),
      "utf-8"
    );
    expect(coreTables).toContain(SQLITE_DDL);
  });

  it("local-mode values round-trip on real sqlite, NOT NULL columns included", async () => {
    const values = buildIdempotencyInsertValues(sampleEntry(), true);
    await sqliteDb
      .insert(requestIdempotencySqlite)
      .values(values as typeof requestIdempotencySqlite.$inferInsert);

    const rows = await sqliteDb
      .select()
      .from(requestIdempotencySqlite)
      .where(eq(requestIdempotencySqlite.key, sampleEntry().fullKey));

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.orgId).toBe("org-1");
    expect(row.idempotencyKey).toBe("client-mutation:abc");
    expect(row.requestHash).toBe("hash-abc");
    expect(row.responseStatus).toBe(201);
    const wrapper = JSON.parse(row.responseBody ?? "") as { h: string; b: unknown };
    expect(wrapper.h).toBe("hash-abc");
    expect(wrapper.b).toEqual({ id: "wo-1" });
  });

  it("cloud-mode values omit the sqlite-only columns and the NOT NULL DDL rejects them", async () => {
    const cloudValues = buildIdempotencyInsertValues(sampleEntry({ fullKey: "cloud-key" }), false);
    expect(cloudValues).not.toHaveProperty("orgId");
    expect(cloudValues).not.toHaveProperty("idempotencyKey");
    expect(cloudValues).not.toHaveProperty("requestHash");

    // Proves WHY the conditional exists: cloud-shaped values violate the
    // sqlite NOT NULL constraints (drizzle wraps the libsql error as
    // "Failed query: ..." with the constraint detail in the cause).
    await expect(
      sqliteDb
        .insert(requestIdempotencySqlite)
        .values(cloudValues as typeof requestIdempotencySqlite.$inferInsert)
    ).rejects.toThrow(/NOT NULL|Failed query/i);
  });

  it("expiry filtering excludes expired rows on real sqlite", async () => {
    const now = new Date();
    const expired = buildIdempotencyInsertValues(
      sampleEntry({ fullKey: "expired-key", idempotencyKey: "k-exp", requestHash: "h-exp", ttlMs: -1_000 }),
      true,
      now
    );
    await sqliteDb
      .insert(requestIdempotencySqlite)
      .values(expired as typeof requestIdempotencySqlite.$inferInsert);

    const live = await sqliteDb
      .select({ key: requestIdempotencySqlite.key })
      .from(requestIdempotencySqlite)
      .where(gt(requestIdempotencySqlite.expiresAt, now));

    const keys = live.map((r) => r.key);
    expect(keys).not.toContain("expired-key");
    expect(keys).toContain(sampleEntry().fullKey);
  });

  it("pg insert compiles with the cloud-shaped values", () => {
    const pgDb = drizzlePg({} as unknown as Parameters<typeof drizzlePg>[0]);
    const values = buildIdempotencyInsertValues(sampleEntry(), false);
    const { sql, params } = pgDb
      .insert(requestIdempotency)
      .values(values as typeof requestIdempotency.$inferInsert)
      .toSQL();

    expect(sql.toLowerCase()).toMatch(/^insert into "request_idempotency"/);
    expect(sql).not.toContain("org_id");
    expect(sql).not.toContain("idempotency_key");
    expect(params).toContain(sampleEntry().fullKey);
  });

  it("value keys stay within each table's $inferInsert surface (drift pin)", () => {
    const sqliteKeys = Object.keys(requestIdempotencySqlite);
    const pgKeys = Object.keys(requestIdempotency);

    for (const key of Object.keys(buildIdempotencyInsertValues(sampleEntry(), true))) {
      expect(sqliteKeys).toContain(key);
    }
    for (const key of Object.keys(buildIdempotencyInsertValues(sampleEntry(), false))) {
      expect(pgKeys).toContain(key);
    }
  });
});
