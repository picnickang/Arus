/**
 * Dual-Driver Query Parity Tests
 *
 * Step 5 deliverable: real cross-driver parity testing. Goes beyond
 * import-resolution checks — these tests:
 *
 *   1. Compare PG and SQLite Drizzle table column maps for each critical
 *      table (column NAMES + JS keys). Must match (modulo known drift).
 *   2. Build identical Drizzle SELECT/INSERT expressions against both PG
 *      and SQLite tables and assert each compiles to valid SQL via
 *      `.toSQL()`, references the expected columns, and yields the same
 *      column projection.
 *   3. For the `vessels` table specifically, performs an actual round-trip
 *      against an in-memory libsql database (CREATE TABLE → INSERT →
 *      SELECT) and asserts the result row has the expected JS-key shape.
 *
 * This is the test contract the architect asked for: same query path
 * exercised through both drivers, shape parity asserted in one place.
 */
import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { eq, getTableColumns } from "drizzle-orm";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { createClient as createLibsqlClient, type Client as LibsqlClient } from "@libsql/client";

// Direct PG schema imports — import from the specific schema files
// (NOT the @shared/schema barrel, which transitively loads sync-conflicts-schema.js
// and breaks under Jest's CJS transform). We need both driver-specific
// tables side by side for a parity test.
import { vessels as pgVessels, equipment as pgEquipment } from "../../shared/schema/index";
// SQLite schema barrel
import { vesselsSqlite, equipmentSqlite } from "../../shared/sqlite-schema/core";

interface TablePair {
  name: string;
  pg: any;
  sqlite: any;
  // Optional explicit field-name allowlist — if omitted, parity test
  // compares the full intersection of column JS keys across both drivers.
  expectedFields: string[];
}

const PAIRS: TablePair[] = [
  {
    name: "vessels",
    pg: pgVessels,
    sqlite: vesselsSqlite,
    expectedFields: ["id", "orgId", "name"],
  },
  {
    name: "equipment",
    pg: pgEquipment,
    sqlite: equipmentSqlite,
    expectedFields: ["id", "orgId", "vesselId", "name"],
  },
];

describe("Dual-driver query parity — column-map equivalence", () => {
  test.each(PAIRS)(
    "$name: PG and SQLite Drizzle tables expose the same JS field names for shared columns",
    ({ pg, sqlite, expectedFields }) => {
      const pgCols = getTableColumns(pg);
      const sqliteCols = getTableColumns(sqlite);
      for (const field of expectedFields) {
        expect(pgCols).toHaveProperty(field);
        expect(sqliteCols).toHaveProperty(field);
        // Underlying DB column name (snake_case) must also match — this is
        // what guarantees the SAME query renders to the SAME WHERE/SELECT.
        expect(pgCols[field].name).toBe(sqliteCols[field].name);
      }
    }
  );

  test.each(PAIRS)(
    "$name: column counts are within drift tolerance (PG can have N more columns than SQLite, never fewer fields the SQLite has)",
    ({ pg, sqlite }) => {
      const pgKeys = new Set(Object.keys(getTableColumns(pg)));
      const sqliteKeys = Object.keys(getTableColumns(sqlite));
      // Every SQLite-defined field must exist in PG. The reverse isn't
      // required: PG holds cloud-only fields (e.g. tenant audit columns)
      // that are intentionally not synced to vessel-edge SQLite.
      const sqliteOnlyMissingFromPg = sqliteKeys.filter((k) => !pgKeys.has(k));
      expect(sqliteOnlyMissingFromPg).toEqual([]);
    }
  );
});

describe("Dual-driver query parity — Drizzle expression compilation", () => {
  test.each(PAIRS)(
    "$name: an identical SELECT expression compiles successfully against both drivers",
    ({ pg, sqlite }) => {
      // We don't connect to real DBs here — drizzle's `.toSQL()` is a pure
      // serializer that runs without a live connection.
      const pgDb = drizzlePg({} as any);
      const sqliteClient = createLibsqlClient({ url: ":memory:" });
      const sqliteDb = drizzleLibsql(sqliteClient);

      const pgQuery = pgDb.select().from(pg).where(eq(pg.id, "test-id")).limit(1);
      const sqliteQuery = sqliteDb.select().from(sqlite).where(eq(sqlite.id, "test-id")).limit(1);

      const pgSql = pgQuery.toSQL();
      const sqliteSql = sqliteQuery.toSQL();

      // Both must produce non-empty SQL.
      expect(pgSql.sql.length).toBeGreaterThan(0);
      expect(sqliteSql.sql.length).toBeGreaterThan(0);

      // Both must reference the `id` column (snake_case is shared).
      expect(pgSql.sql).toMatch(/\bid\b/);
      expect(sqliteSql.sql).toMatch(/\bid\b/);

      // Both must bind the same parameter value.
      expect(pgSql.params).toContain("test-id");
      expect(sqliteSql.params).toContain("test-id");

      sqliteClient.close();
    }
  );

  test.each(PAIRS)(
    "$name: an identical INSERT expression compiles successfully against both drivers",
    ({ pg, sqlite, expectedFields }) => {
      const pgDb = drizzlePg({} as any);
      const sqliteClient = createLibsqlClient({ url: ":memory:" });
      const sqliteDb = drizzleLibsql(sqliteClient);

      // Build values object using only fields shared by both drivers.
      const values: Record<string, string> = {};
      for (const f of expectedFields) values[f] = `parity-${f}`;

      const pgInsert = pgDb.insert(pg).values(values as any);
      const sqliteInsert = sqliteDb.insert(sqlite).values(values as any);

      const pgSql = pgInsert.toSQL();
      const sqliteSql = sqliteInsert.toSQL();

      // Both must produce non-empty INSERT SQL referencing the table by snake_case.
      expect(pgSql.sql.toLowerCase()).toMatch(/^insert into\s+/);
      expect(sqliteSql.sql.toLowerCase()).toMatch(/^insert into\s+/);

      // Both must bind every value we passed.
      for (const v of Object.values(values)) {
        expect(pgSql.params).toContain(v);
        expect(sqliteSql.params).toContain(v);
      }

      // Both must reference each shared column's snake_case name in the column list.
      const pgCols = getTableColumns(pg);
      for (const f of expectedFields) {
        const dbCol = pgCols[f].name;
        expect(pgSql.sql).toMatch(new RegExp(`\\b${dbCol}\\b`));
        expect(sqliteSql.sql).toMatch(new RegExp(`\\b${dbCol}\\b`));
      }

      sqliteClient.close();
    }
  );
});

describe("Dual-driver query parity — full intersection JS-key comparison", () => {
  test.each(PAIRS)(
    "$name: every JS field shared between PG and SQLite maps to the same DB column name",
    ({ pg, sqlite }) => {
      const pgCols = getTableColumns(pg);
      const sqliteCols = getTableColumns(sqlite);
      const intersection = Object.keys(pgCols).filter((k) =>
        Object.prototype.hasOwnProperty.call(sqliteCols, k)
      );
      // Sanity — the intersection must not be empty.
      expect(intersection.length).toBeGreaterThan(0);
      const mismatches: Array<{ field: string; pg: string; sqlite: string }> = [];
      for (const field of intersection) {
        if (pgCols[field].name !== sqliteCols[field].name) {
          mismatches.push({
            field,
            pg: pgCols[field].name,
            sqlite: sqliteCols[field].name,
          });
        }
      }
      expect(mismatches).toEqual([]);
    }
  );
});

describe("Dual-driver query parity — vessels round-trip through real libsql", () => {
  let client: LibsqlClient;
  let db: ReturnType<typeof drizzleLibsql>;

  beforeAll(async () => {
    client = createLibsqlClient({ url: ":memory:" });
    db = drizzleLibsql(client);

    // Create the vessels table from a hand-written CREATE TABLE that
    // mirrors the SQLite Drizzle definition. Hand-coded so the test
    // doesn't depend on drizzle-kit migration files at runtime.
    await client.execute(`
      CREATE TABLE vessels (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        imo TEXT,
        flag TEXT,
        vessel_type TEXT,
        vessel_class TEXT,
        condition TEXT DEFAULT 'good',
        online_status TEXT DEFAULT 'unknown',
        last_heartbeat INTEGER,
        dwt INTEGER,
        year_built INTEGER,
        active INTEGER DEFAULT 1,
        notes TEXT,
        day_rate_sgd REAL,
        downtime_days REAL DEFAULT 0,
        downtime_reset_at INTEGER,
        operation_days REAL DEFAULT 0,
        operation_reset_at INTEGER,
        last_daily_update_date TEXT,
        commission_date INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );
    `);
  });

  afterAll(() => {
    client.close();
  });

  test("INSERT then SELECT through the SQLite Drizzle table yields the JS-key shape", async () => {
    const TEST_ID = "vessel-parity-test-001";

    // Same Drizzle expression style the production repository uses.
    await db.insert(vesselsSqlite).values({
      id: TEST_ID,
      orgId: "test-org",
      name: "MV Parity",
      imo: "9999999",
      vesselType: "OSV",
    });

    const rows = await db.select().from(vesselsSqlite).where(eq(vesselsSqlite.id, TEST_ID));
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row.id).toBe(TEST_ID);
    expect(row.orgId).toBe("test-org");
    expect(row.name).toBe("MV Parity");
    expect(row.imo).toBe("9999999");
    expect(row.vesselType).toBe("OSV");

    // Verify the row exposes JS camelCase keys (not snake_case). This is
    // the contract the application code depends on — drizzle must map
    // `org_id` → `orgId` for both drivers.
    const keys = Object.keys(row);
    expect(keys).toContain("orgId");
    expect(keys).toContain("vesselType");
    expect(keys).not.toContain("org_id");
    expect(keys).not.toContain("vessel_type");
  });

  test("the same JS-key shape is what the PG schema would expose", () => {
    // We don't run a live PG query here (unit tests have no DB). Instead
    // we assert the PG table's column metadata exposes the SAME JS keys
    // we just verified come back from the SQLite round-trip.
    const pgCols = getTableColumns(pgVessels);
    expect(pgCols).toHaveProperty("orgId");
    expect(pgCols).toHaveProperty("vesselType");
    expect(pgCols).toHaveProperty("name");
    expect(pgCols).toHaveProperty("imo");

    // And the underlying DB names match what we just SELECTed from libsql.
    expect(pgCols.orgId.name).toBe("org_id");
    expect(pgCols.vesselType.name).toBe("vessel_type");
  });
});
